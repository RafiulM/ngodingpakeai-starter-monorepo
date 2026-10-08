import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import { createLogger } from "../lib/logger";
import { agent, originHeader, signUp } from "./helpers";

// Make one service fail unexpectedly, with a message that must never leak.
vi.mock("../services/notes.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../services/notes.service")>()),
  listNotes: vi.fn(async () => {
    throw new Error("boom: postgres://user:secret@db/app");
  }),
}));

function capture() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _encoding, done) {
      for (const line of String(chunk).split("\n").filter(Boolean))
        lines.push(JSON.parse(line));
      done();
    },
  });
  return {
    lines,
    logger: createLogger({ level: "debug", destination: stream }),
  };
}

describe("Server logging", () => {
  it("writes one access line per request with reqId and userId, and no secrets", async () => {
    const { lines, logger } = capture();
    const client = agent(createApp({ logger }));
    const email = await signUp(client);
    await client
      .post("/api/auth/sign-in/email")
      .set(originHeader)
      .send({ email, password: "Test-password-123!" });
    await client.get("/api/notes/00000000-0000-4000-8000-000000000000");

    const output = JSON.stringify(lines);
    expect(output).not.toContain("Test-password-123!");
    expect(output).not.toMatch(/session_token=/);

    const signIn = lines.find(
      (line) =>
        line.msg === "POST /api/auth/sign-in/email 200" ||
        String(line.msg).startsWith("POST /api/auth/sign-in/email 200"),
    );
    expect(signIn).toMatchObject({ level: 30, service: "api" });
    expect(signIn?.reqId).toEqual(expect.any(String));

    const notFound = lines.find((line) =>
      String(line.msg).startsWith("GET /api/notes/00000000"),
    );
    expect(notFound).toMatchObject({ level: 40, userId: expect.any(String) });
  });

  it("logs unexpected errors once with a stack while the client gets a generic 500", async () => {
    const { lines, logger } = capture();
    const client = agent(createApp({ logger }));
    await signUp(client);

    const response = await client
      .get("/api/notes")
      .set("X-Request-Id", "trace-500");
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Try again.",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("boom");

    const errors = lines.filter((line) => line.level === 50);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      reqId: "trace-500",
      msg: "GET /api/notes 500",
    });
    expect((errors[0].err as { stack: string }).stack).toContain("boom");
  });
});
