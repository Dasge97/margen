// Isolated, ephemeral database for browser tests. Never used by the production server.
import { PGlite } from "@electric-sql/pglite";
import express from "express";
import path from "node:path";
import { schema, type Database } from "../server/db.js";
import { createApp, errors } from "../server/app.js";
const pg = new PGlite();
await pg.exec(schema);
const db: Database = {
  query: async (text, values) => ({
    rows: (await pg.query(text, values)).rows as any[],
  }),
};
const app = createApp(db, {
  origin: "http://localhost:4100",
  production: false,
});
app.use(express.static(path.resolve("dist")));
app.get("/{*path}", (_req, res) =>
  res.sendFile(path.resolve("dist/index.html")),
);
app.use(errors);
app.listen(4100, "0.0.0.0");
