import pg from "pg";
export interface Database {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: any[]; rowCount?: number | null }>;
}
export const schema = `
CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY,email text UNIQUE NOT NULL,name text NOT NULL,password_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS budgets(user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,version integer NOT NULL DEFAULT 0,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions(token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS password_resets(token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS resets_expiry ON password_resets(expires_at);
`;
export function connect() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL es obligatorio");
  return new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
}
