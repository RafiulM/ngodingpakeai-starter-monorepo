import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// config/env.ts validates process.env once, at import, and exits on failure,
// so each case loads it in a fresh process (cwd: apps/api).
function loadEnv(overrides: Record<string, string>) {
  return spawnSync(process.execPath, ["--import", "tsx", "src/config/env.ts"], {
    cwd: new URL("../..", import.meta.url),
    env: { ...process.env, ...overrides },
    encoding: "utf8",
  });
}

describe("API environment", () => {
  it("refuses TRUST_PROXY=true, which would trust spoofed client IPs", () => {
    const result = loadEnv({ TRUST_PROXY: "true" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("TRUST_PROXY");
    // Problems name the field; values such as connection strings stay out.
    expect(result.stderr).not.toContain("postgresql://");
  });

  it("accepts a hop count or a subnet list", () => {
    expect(loadEnv({ TRUST_PROXY: "1" }).status).toBe(0);
    expect(loadEnv({ TRUST_PROXY: "loopback" }).status).toBe(0);
  });
});
