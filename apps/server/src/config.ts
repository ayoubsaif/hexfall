import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().min(0).max(65535).default(8080),
  REDIS_URL: z
    .url({ protocol: /^rediss?$/, error: "must be a redis:// or rediss:// URL" })
    .default("redis://localhost:6379"),
  ALLOWED_ORIGIN: z
    .string()
    .default("http://localhost:5173")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o.length > 0),
    )
    .pipe(z.array(z.url({ protocol: /^https?$/ })).min(1, "must list at least one origin"))
    // Normalize to the exact form browsers send in the Origin header.
    .transform((list) => [...new Set(list.map((o) => new URL(o).origin))]),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Web Push (game-server "Push configuration"): all three or none.
  VAPID_PUBLIC_KEY: z
    .string()
    .regex(/^[A-Za-z0-9_-]{40,}$/, "must be a base64url key")
    .optional(),
  VAPID_PRIVATE_KEY: z
    .string()
    .regex(/^[A-Za-z0-9_-]{20,}$/, "must be a base64url key")
    .optional(),
  VAPID_SUBJECT: z
    .string()
    .regex(/^(mailto:\S+@\S+|https:\/\/\S+)$/, "must be a mailto: or https: URL")
    .optional(),
});

const VAPID_VARS = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"] as const;

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export interface Config {
  port: number;
  redisUrl: string;
  allowedOrigins: readonly string[];
  nodeEnv: "development" | "production" | "test";
  /** Web Push keys, or null when push is off. */
  push: PushConfig | null;
}

export type ConfigResult = { ok: true; config: Config } | { ok: false; errors: string[] };

/** Pure: validates an env-like record. Empty strings count as unset. */
export function parseConfig(env: Record<string, string | undefined>): ConfigResult {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined && v !== "") cleaned[k] = v;
  const parsed = ConfigSchema.safeParse(cleaned);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(env)"}: ${i.message}`),
    };
  }
  const d = parsed.data;
  const set = VAPID_VARS.filter((k) => d[k] !== undefined);
  if (set.length > 0 && set.length < VAPID_VARS.length) {
    const missing = VAPID_VARS.filter((k) => d[k] === undefined);
    return {
      ok: false,
      errors: missing.map((k) => `${k}: required when any VAPID_* variable is set`),
    };
  }
  return {
    ok: true,
    config: {
      port: d.PORT,
      redisUrl: d.REDIS_URL,
      allowedOrigins: d.ALLOWED_ORIGIN,
      nodeEnv: d.NODE_ENV,
      push:
        d.VAPID_PUBLIC_KEY && d.VAPID_PRIVATE_KEY && d.VAPID_SUBJECT
          ? {
              publicKey: d.VAPID_PUBLIC_KEY,
              privateKey: d.VAPID_PRIVATE_KEY,
              subject: d.VAPID_SUBJECT,
            }
          : null,
    },
  };
}

/** Boot-time loader: the only place that reads process.env. Exits(1) on invalid config. */
export function loadConfig(): Config {
  const result = parseConfig(process.env);
  if (!result.ok) {
    console.error(
      `[config] invalid environment:\n${result.errors.map((e) => `  - ${e}`).join("\n")}`,
    );
    process.exit(1);
  }
  return result.config;
}
