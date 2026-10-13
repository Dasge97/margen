import express from "express";
import path from "node:path";
import nodemailer from "nodemailer";
import { connect, schema } from "./db.js";
import { createApp, errors } from "./app.js";
const db = connect();
await db.query(schema);
const origin = process.env.APP_ORIGIN || "http://localhost:5173";
const production = process.env.NODE_ENV === "production";
if (production && !origin.startsWith("https://"))
  throw new Error("APP_ORIGIN debe usar HTTPS en producción");
const transport = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      ...(process.env.SMTP_USER
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
        : {}),
    })
  : null;
const app = createApp(db, {
  origin,
  production,
  trustProxy: process.env.TRUST_PROXY === "1",
  sendReset: transport
    ? async (email, url) => {
        await transport.sendMail({
          from: process.env.MAIL_FROM || "Margen <noreply@example.com>",
          to: email,
          subject: "Recupera tu acceso a Margen",
          text: `Abre este enlace en los próximos 30 minutos para cambiar tu contraseña:\n\n${url}\n\nSi no lo has solicitado, ignora este mensaje.`,
        });
      }
    : undefined,
});
app.use(express.static(path.resolve("dist")));
app.get("/{*path}", (req, res) => {
  if (req.path.startsWith("/api/"))
    return void res.status(404).json({ error: "Ruta no encontrada" });
  res.sendFile(path.resolve("dist/index.html"));
});
app.use(errors);
const server = app.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log("Margen está listo en el puerto " + (process.env.PORT || 3000)),
);
const cleanup = setInterval(() => {
  void db.query("DELETE FROM sessions WHERE expires_at<now()").catch(() => {});
  void db
    .query("DELETE FROM password_resets WHERE expires_at<now()")
    .catch(() => {});
}, 3600000);
cleanup.unref();
process.on("SIGTERM", () => {
  server.close(() => {
    void db.end().then(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
});
