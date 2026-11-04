import { describe, expect, it } from "vite-plus/test";
import { parseConfig } from "../src/config.ts";

describe("parseConfig", () => {
  it("applies defaults for an empty env", () => {
    expect(parseConfig({})).toEqual({
      ok: true,
      config: {
        port: 8080,
        redisUrl: "redis://localhost:6379",
        allowedOrigins: ["http://localhost:5173"],
        nodeEnv: "development",
      },
    });
  });

  it("treats empty strings as unset", () => {
    const r = parseConfig({ PORT: "", REDIS_URL: "" });
    expect(r.ok && r.config.port).toBe(8080);
  });

  it("parses explicit values, rediss:// and comma-separated origins", () => {
    const r = parseConfig({
      PORT: "3000",
      REDIS_URL: "rediss://default:secret@example.upstash.io:6379",
      ALLOWED_ORIGIN: " https://hexfall.example , http://localhost:5173/ ,",
      NODE_ENV: "production",
    });
    expect(r).toEqual({
      ok: true,
      config: {
        port: 3000,
        redisUrl: "rediss://default:secret@example.upstash.io:6379",
        allowedOrigins: ["https://hexfall.example", "http://localhost:5173"],
        nodeEnv: "production",
      },
    });
  });

  it("ignores unrelated env vars", () => {
    expect(parseConfig({ PATH: "/usr/bin", HOME: "/root" }).ok).toBe(true);
  });

  it.each([
    [{ PORT: "abc" }, "PORT"],
    [{ PORT: "70000" }, "PORT"],
    [{ PORT: "80.5" }, "PORT"],
    [{ REDIS_URL: "http://localhost:6379" }, "REDIS_URL"],
    [{ REDIS_URL: "not a url" }, "REDIS_URL"],
    [{ ALLOWED_ORIGIN: "not-an-origin" }, "ALLOWED_ORIGIN"],
    [{ ALLOWED_ORIGIN: " , " }, "ALLOWED_ORIGIN"],
    [{ NODE_ENV: "staging" }, "NODE_ENV"],
  ])("rejects %j", (env, key) => {
    const r = parseConfig(env);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.startsWith(key))).toBe(true);
  });
});
