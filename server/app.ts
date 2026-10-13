import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { emptyState, validateState } from "../shared/model.js";
import { hashPassword, verifyPassword, token, digest } from "./auth.js";
import type { Database } from "./db.js";
export interface Config {
  origin: string;
  production: boolean;
  trustProxy?: boolean;
  sendReset?: (email: string, url: string) => Promise<void>;
}
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase().trim()),
  password: z.string().min(12).max(128),
});
const registration = credentials.extend({
  name: z.string().trim().min(1).max(80),
});
export function createApp(db: Database, config: Config) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          upgradeInsecureRequests: config.production ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "8mb" }));
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.get("origin") !== config.origin)
        return res.status(403).json({ error: "Origen no autorizado" });
      if (!req.is("application/json"))
        return res.status(415).json({ error: "Se requiere JSON" });
    }
    next();
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Demasiados intentos. Espera unos minutos." },
  });
  app.use("/api/auth", authLimiter);
  const cookie = (res: express.Response, value: string, clear = false) =>
    res.cookie("margen_session", value, {
      httpOnly: true,
      secure: config.production,
      sameSite: "strict",
      path: "/",
      maxAge: clear ? 0 : 7 * 24 * 3600 * 1000,
    });
  async function session(res: express.Response, userId: string) {
    const key = token();
    await db.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
      [digest(key), userId],
    );
    cookie(res, key);
  }
  const sessionToken = (req: express.Request) =>
    (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("margen_session="))
      ?.slice(15) || "";
  app.get("/api/health", async (_req, res) => {
    await db.query("SELECT 1");
    res.json({ ok: true });
  });
  app.get("/api/config", (_req, res) =>
    res.json({ passwordRecovery: Boolean(config.sendReset) }),
  );
  app.post("/api/auth/register", async (req, res) => {
    const v = registration.parse(req.body),
      id = randomUUID(),
      hash = await hashPassword(v.password);
    try {
      await db.query(
        "WITH u AS (INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,$3,$4) RETURNING id) INSERT INTO budgets(user_id,data) SELECT id,$5::jsonb FROM u",
        [id, v.email, v.name, hash, JSON.stringify(emptyState())],
      );
    } catch (e: any) {
      if (e.code === "23505")
        return res
          .status(409)
          .json({
            error:
              "No se pudo crear la cuenta. Prueba a iniciar sesión o recuperar el acceso.",
          });
      throw e;
    }
    await session(res, id);
    res.status(201).json({ user: { id, name: v.name, email: v.email } });
  });
  // A dummy hash keeps unknown-email logins on the same expensive password-check path.
  const dummyHash = hashPassword(randomUUID());
  app.post("/api/auth/login", async (req, res) => {
    const v = credentials.parse(req.body);
    const { rows } = await db.query(
      "SELECT id,name,email,password_hash FROM users WHERE email=$1",
      [v.email],
    );
    const u = rows[0];
    const ok = await verifyPassword(
      v.password,
      u?.password_hash || (await dummyHash),
    );
    if (!u || !ok)
      return res.status(401).json({ error: "Correo o contraseña incorrectos" });
    await session(res, u.id);
    res.json({ user: { id: u.id, name: u.name, email: u.email } });
  });
  app.post("/api/auth/forgot", async (req, res) => {
    const email = z.email().max(254).parse(req.body.email).toLowerCase();
    if (!config.sendReset)
      return res
        .status(503)
        .json({
          error:
            "El administrador debe configurar el envío de correo para recuperar contraseñas.",
        });
    const { rows } = await db.query("SELECT id FROM users WHERE email=$1", [
      email,
    ]);
    if (rows[0]) {
      const key = token();
      await db.query(
        "INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')",
        [digest(key), rows[0].id],
      );
      try {
        await config.sendReset(email, `${config.origin}/?reset=${key}`);
      } catch {
        console.error("No se pudo enviar un correo de recuperación");
      }
    }
    res.json({
      message: "Si existe la cuenta, recibirás un enlace de recuperación.",
    });
  });
  app.post("/api/auth/reset", async (req, res) => {
    const v = z
      .object({
        token: z.string().regex(/^[a-f0-9]{64}$/),
        password: z.string().min(12).max(128),
      })
      .parse(req.body);
    const hash = await hashPassword(v.password);
    const result = await db.query(
      "WITH valid AS (DELETE FROM password_resets WHERE token_hash=$1 AND expires_at>now() RETURNING user_id), changed AS (UPDATE users SET password_hash=$2 WHERE id IN (SELECT user_id FROM valid) RETURNING id), invalidated AS (DELETE FROM sessions WHERE user_id IN (SELECT id FROM changed)) SELECT id FROM changed",
      [digest(v.token), hash],
    );
    if (!result.rows.length)
      return res.status(400).json({ error: "Enlace caducado o no válido" });
    await db.query("DELETE FROM password_resets WHERE user_id=$1", [
      result.rows[0].id,
    ]);
    cookie(res, "", true);
    res.json({ ok: true });
  });
  app.use("/api", async (req, res, next) => {
    const hash = digest(sessionToken(req));
    const { rows } = await db.query(
      "SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [hash],
    );
    if (!rows[0])
      return res.status(401).json({ error: "Inicia sesión para continuar" });
    res.locals.user = rows[0];
    next();
  });
  app.get("/api/me", (_req, res) => res.json({ user: res.locals.user }));
  app.post("/api/logout", async (req, res) => {
    await db.query("DELETE FROM sessions WHERE token_hash=$1", [
      digest(sessionToken(req)),
    ]);
    cookie(res, "", true);
    res.json({ ok: true });
  });
  app.get("/api/budget", async (_req, res) => {
    const { rows } = await db.query(
      "SELECT data,version FROM budgets WHERE user_id=$1",
      [res.locals.user.id],
    );
    res.json(rows[0]);
  });
  app.put("/api/budget", async (req, res) => {
    const v = z
      .object({ version: z.number().int().min(0), data: z.unknown() })
      .parse(req.body);
    let data;
    try {
      data = validateState(v.data);
    } catch (e) {
      return res
        .status(400)
        .json({
          error:
            e instanceof z.ZodError ? "Datos no válidos" : (e as Error).message,
        });
    }
    const { rows } = await db.query(
      "UPDATE budgets SET data=$1::jsonb,version=version+1,updated_at=now() WHERE user_id=$2 AND version=$3 RETURNING version",
      [JSON.stringify(data), res.locals.user.id, v.version],
    );
    if (!rows.length)
      return res
        .status(409)
        .json({
          error:
            "Tu plan ha cambiado en otra pestaña o dispositivo. Recarga antes de continuar.",
        });
    res.json({ version: rows[0].version });
  });
  app.delete("/api/account", async (req, res) => {
    const p = z.string().min(12).max(128).parse(req.body.password);
    const { rows } = await db.query(
      "SELECT password_hash FROM users WHERE id=$1",
      [res.locals.user.id],
    );
    if (!(await verifyPassword(p, rows[0].password_hash)))
      return res.status(401).json({ error: "Contraseña incorrecta" });
    await db.query("DELETE FROM users WHERE id=$1", [res.locals.user.id]);
    cookie(res, "", true);
    res.json({ ok: true });
  });
  return app;
}
export const errors: express.ErrorRequestHandler = (e, _req, res, _next) => {
  if (e instanceof z.ZodError)
    return void res
      .status(400)
      .json({
        error:
          "Revisa los campos: correo válido y contraseña de al menos 12 caracteres.",
      });
  if (e.type === "entity.too.large")
    return void res
      .status(413)
      .json({ error: "El archivo o plan supera el tamaño admitido." });
  if (e instanceof SyntaxError)
    return void res.status(400).json({ error: "JSON no válido" });
  console.error("Error de servidor", e.code || e.name);
  res
    .status(500)
    .json({ error: "No se pudo completar la operación. Inténtalo de nuevo." });
};
