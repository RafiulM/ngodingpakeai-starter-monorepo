import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { agent, originHeader, signUp } from "./helpers";

const app = createApp();

describe("Notes API", () => {
  it("requires a real session for every operation and answers JSON 401", async () => {
    const id = randomUUID();
    const client = agent(app);
    for (const [method, url] of [
      ["get", "/api/notes"],
      ["post", "/api/notes"],
      ["get", `/api/notes/${id}`],
      ["patch", `/api/notes/${id}`],
      ["delete", `/api/notes/${id}`],
    ] as const) {
      const response = await client[method](url).set(originHeader);
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: { code: "UNAUTHORIZED", message: "Sign in to continue." },
      });
      expect(response.headers["cache-control"]).toContain("no-store");
    }
  });

  it("supports persisted CRUD, pagination, and partial updates", async () => {
    const client = agent(app);
    await signUp(client);

    const created = await client
      .post("/api/notes")
      .set(originHeader)
      .send({ title: "  First note  ", content: "Keep me" });
    expect(created.status).toBe(201);
    const first = created.body.data;
    expect(first.title).toBe("First note");
    expect(first).not.toHaveProperty("userId");
    expect(created.headers.location).toBe(`/api/notes/${first.id}`);

    const second = (
      await client
        .post("/api/notes")
        .set(originHeader)
        .send({ title: "Second" })
    ).body.data;
    expect(second.content).toBe("");

    const pageOne = (await client.get("/api/notes?limit=1")).body;
    const pageTwo = (await client.get("/api/notes?limit=1&offset=1")).body;
    expect(pageOne.meta).toEqual({ limit: 1, offset: 0, hasMore: true });
    expect(pageTwo.meta).toEqual({ limit: 1, offset: 1, hasMore: false });
    expect([pageOne.data[0].id, pageTwo.data[0].id]).toEqual([
      second.id,
      first.id,
    ]);

    const updated = await client
      .patch(`/api/notes/${first.id}`)
      .set(originHeader)
      .send({ title: "Updated" });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      title: "Updated",
      content: "Keep me",
    });

    const deleted = await client
      .delete(`/api/notes/${first.id}`)
      .set(originHeader);
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe("");
    expect((await client.get(`/api/notes/${first.id}`)).status).toBe(404);
    expect(
      (await client.delete(`/api/notes/${first.id}`).set(originHeader)).status,
    ).toBe(404);
  });

  it("isolates accounts and rejects submitted owners", async () => {
    const owner = agent(app);
    await signUp(owner);
    const note = (
      await owner
        .post("/api/notes")
        .set(originHeader)
        .send({ title: "Private" })
    ).body.data;

    const stranger = agent(app);
    await signUp(stranger);
    expect((await stranger.get("/api/notes")).body.data).toEqual([]);
    for (const method of ["get", "patch", "delete"] as const) {
      const owned = await stranger[method](`/api/notes/${note.id}`)
        .set(originHeader)
        .send(method === "patch" ? { title: "Stolen" } : undefined);
      const absent = await stranger[method](`/api/notes/${randomUUID()}`)
        .set(originHeader)
        .send(method === "patch" ? { title: "Stolen" } : undefined);
      expect(owned.status).toBe(404);
      expect(owned.body).toEqual(absent.body);
    }
    expect(
      (
        await stranger
          .post("/api/notes")
          .set(originHeader)
          .send({ title: "Injected", userId: "someone-else" })
      ).status,
    ).toBe(422);
    expect((await owner.get(`/api/notes/${note.id}`)).body.data.title).toBe(
      "Private",
    );
  });

  it("rejects invalid bodies, IDs, pagination, and unsafe origins", async () => {
    const client = agent(app);
    await signUp(client);

    const invalidJson = await client
      .post("/api/notes")
      .set({ ...originHeader, "Content-Type": "application/json" })
      .send("{");
    expect(invalidJson.status).toBe(400);
    expect(invalidJson.body.error.code).toBe("INVALID_JSON");

    const textBody = await client
      .post("/api/notes")
      .set({ ...originHeader, "Content-Type": "text/plain" })
      .send("text");
    expect(textBody.status).toBe(415);

    for (const body of [
      {},
      { title: "   " },
      { title: "x".repeat(161) },
      { title: "Valid", content: "x".repeat(10_001) },
      { title: "Valid", unexpected: true },
    ]) {
      const response = await client
        .post("/api/notes")
        .set(originHeader)
        .send(body);
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect((await client.get("/api/notes/not-a-uuid")).status).toBe(422);
    expect(
      (
        await client
          .patch(`/api/notes/${randomUUID()}`)
          .set(originHeader)
          .send({})
      ).status,
    ).toBe(422);
    for (const query of ["limit=101", "limit=0", "offset=-1", "limit=abc"])
      expect((await client.get(`/api/notes?${query}`)).status).toBe(422);

    for (const headers of [
      { Origin: "https://untrusted.example" },
      { Origin: "null" },
      {},
      { ...originHeader, "Sec-Fetch-Site": "cross-site" },
    ]) {
      const response = await client
        .post("/api/notes")
        .set(headers)
        .send({ title: "Should not save" });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN_ORIGIN");
    }
    expect((await client.get("/api/notes")).body.data).toEqual([]);
  });

  it("stops accepting a cookie once its session is signed out", async () => {
    const client = agent(app);
    await signUp(client);
    const login = await client.get("/api/auth/get-session");
    expect(login.body.user).toBeTruthy();
    const cookie = (
      await client.post("/api/auth/sign-in/email").set(originHeader).send({
        email: login.body.user.email,
        password: "Test-password-123!",
      })
    ).headers["set-cookie"] as unknown as string[];
    const sessionCookie = cookie.map((value) => value.split(";")[0]).join("; ");
    expect(sessionCookie).toContain("session_token");

    const fresh = agent(app);
    expect(
      (await fresh.get("/api/notes").set("Cookie", sessionCookie)).status,
    ).toBe(200);
    expect(
      (
        await fresh
          .post("/api/auth/sign-out")
          .set({ ...originHeader, Cookie: sessionCookie })
          .send({})
      ).status,
    ).toBe(200);
    expect(
      (await agent(app).get("/api/notes").set("Cookie", sessionCookie)).status,
    ).toBe(401);
  });
});
