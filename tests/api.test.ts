import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp, errors } from "../server/app.js";
import { schema, type Database } from "../server/db.js";
const origin = "http://localhost:5173";
test("real SQL: users are isolated, stale writes rejected, origin enforced, logout invalidates sessions", async () => {
  const pg = new PGlite();
  await pg.exec(schema);
  const db: Database = {
    query: async (text, values) => ({
      rows: (await pg.query(text, values)).rows as any[],
    }),
  };
  const app = createApp(db, { origin, production: false });
  app.use(errors);
  const alice = request.agent(app),
    bob = request.agent(app);
  const a = await alice
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Alice Demo",
      email: "alice@example.test",
      password: "a-secure-demo-pass",
    });
  assert.equal(a.status, 201);
  assert.match(String(a.headers["set-cookie"]), /HttpOnly/);
  assert.match(String(a.headers["set-cookie"]), /SameSite=Strict/);
  assert.equal(
    (
      await bob
        .post("/api/auth/register")
        .set("Origin", origin)
        .send({
          name: "Bob Demo",
          email: "bob@example.test",
          password: "another-demo-pass",
        })
    ).status,
    201,
  );
  let plan = (await alice.get("/api/budget")).body;
  plan.data.accounts.push({
    id: randomUUID(),
    name: "Solo Alice",
    kind: "bank",
    opening: 12345,
    openingDate: "2026-01-01",
  });
  assert.equal(
    (await alice.put("/api/budget").set("Origin", origin).send(plan)).status,
    200,
  );
  assert.equal(
    (await alice.put("/api/budget").set("Origin", origin).send(plan)).status,
    409,
  );
  assert.equal((await bob.get("/api/budget")).body.data.accounts.length, 0);
  assert.equal(
    (await bob.get("/api/budget?userId=" + a.body.user.id)).body.data.accounts
      .length,
    0,
  );
  assert.equal(
    (
      await alice
        .put("/api/budget")
        .set("Origin", "https://evil.example")
        .send(plan)
    ).status,
    403,
  );
  assert.equal((await request(app).get("/api/budget")).status, 401);
  assert.equal(
    (await alice.post("/api/logout").set("Origin", origin).send({})).status,
    200,
  );
  assert.equal((await alice.get("/api/budget")).status, 401);
  const login = await alice
    .post("/api/auth/login")
    .set("Origin", origin)
    .send({ email: "alice@example.test", password: "a-secure-demo-pass" });
  assert.equal(login.status, 200);
  assert.equal(
    (
      await alice
        .delete("/api/account")
        .set("Origin", origin)
        .send({ password: "a-secure-demo-pass" })
    ).status,
    200,
  );
  assert.equal((await alice.get("/api/budget")).status, 401);
  assert.equal((await bob.get("/api/budget")).status, 200);
  await pg.close();
});
test("password reset tokens are single-use and revoke prior sessions", async () => {
  const pg = new PGlite();
  await pg.exec(schema);
  const db: Database = {
    query: async (text, values) => ({
      rows: (await pg.query(text, values)).rows as any[],
    }),
  };
  let link = "";
  const app = createApp(db, {
    origin,
    production: false,
    sendReset: async (_email, url) => {
      link = url;
    },
  });
  app.use(errors);
  const agent = request.agent(app);
  await agent
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({
      name: "Reset Demo",
      email: "reset@example.test",
      password: "old-password-demo",
    });
  const known = await request(app)
    .post("/api/auth/forgot")
    .set("Origin", origin)
    .send({ email: "reset@example.test" });
  const unknown = await request(app)
    .post("/api/auth/forgot")
    .set("Origin", origin)
    .send({ email: "missing@example.test" });
  assert.deepEqual(known.body, unknown.body);
  const token = new URL(link).searchParams.get("reset");
  assert.equal(
    (
      await request(app)
        .post("/api/auth/reset")
        .set("Origin", origin)
        .send({ token, password: "new-password-demo" })
    ).status,
    200,
  );
  assert.equal((await agent.get("/api/me")).status, 401);
  assert.equal(
    (
      await request(app)
        .post("/api/auth/reset")
        .set("Origin", origin)
        .send({ token, password: "new-password-demo" })
    ).status,
    400,
  );
  assert.equal(
    (
      await agent
        .post("/api/auth/login")
        .set("Origin", origin)
        .send({ email: "reset@example.test", password: "new-password-demo" })
    ).status,
    200,
  );
  await pg.close();
});
