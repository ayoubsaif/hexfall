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
});

export interface Config {
  port: number;
  redisUrl: string;
  allowedOrigins: readonly string[];
  nodeEnv: "development" | "production" | "test";
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
  return {
    ok: true,
    config: {
      port: d.PORT,
      redisUrl: d.REDIS_URL,
      allowedOrigins: d.ALLOWED_ORIGIN,
      nodeEnv: d.NODE_ENV,
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
