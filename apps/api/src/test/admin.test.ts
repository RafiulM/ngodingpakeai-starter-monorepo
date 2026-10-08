import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { agent, originHeader, setRole, signUp } from "./helpers";

const app = createApp();

describe("Role-based access", () => {
  it("answers 401 without a session, not 403", async () => {
    for (const [method, url] of [
      ["get", "/api/admin/notes"],
      ["delete", `/api/admin/notes/${randomUUID()}`],
    ] as const) {
      const response = await agent(app)[method](url).set(originHeader);
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    }
  });

  it("keeps the default role inside its own rows", async () => {
    const client = agent(app);
    await signUp(client);
    for (const [method, url] of [
      ["get", "/api/admin/notes"],
      ["delete", `/api/admin/notes/${randomUUID()}`],
    ] as const) {
      const response = await client[method](url).set(originHeader);
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }
  });

  it("lets an admin read and delete any account's notes until the role is revoked", async () => {
    const owner = agent(app);
    await signUp(owner, "Owner");
    const note = (
      await owner.post("/api/notes").set(originHeader).send({ title: "Theirs" })
    ).body.data;

    const admin = agent(app);
    const adminEmail = await signUp(admin, "Admin");
    await setRole(adminEmail, "admin");

    const list = await admin.get("/api/admin/notes?limit=100");
    expect(list.status).toBe(200);
    const listed = list.body.data.find(
      (item: { id: string }) => item.id === note.id,
    );
    expect(listed).toMatchObject({ title: "Theirs", ownerName: "Owner" });

    // The Origin check still applies to a permitted role.
    expect(
      (
        await admin
          .delete(`/api/admin/notes/${note.id}`)
          .set({ Origin: "https://untrusted.example" })
      ).status,
    ).toBe(403);
    expect(
      (await admin.delete(`/api/admin/notes/${note.id}`).set(originHeader))
        .status,
    ).toBe(204);
    expect((await owner.get(`/api/notes/${note.id}`)).status).toBe(404);

    await setRole(adminEmail, null);
    expect((await admin.get("/api/admin/notes")).status).toBe(403);
  });
});
