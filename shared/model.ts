import { z } from "zod";
export const cents = z
  .number()
  .int()
  .min(-100_000_000_000)
  .max(100_000_000_000);
export const positive = cents.refine(
  (n) => n > 0,
  "El importe debe ser positivo",
);
export const nonnegative = cents.refine(
  (n) => n >= 0,
  "El importe no puede ser negativo",
);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + "T12:00:00Z");
    return (
      Number.isFinite(d.getTime()) &&
      d.toISOString().slice(0, 10) === s &&
      s >= "1900-01-01" &&
      s <= "2200-12-31"
    );
  }, "Fecha no válida");
const id = z.string().uuid();
const name = z.string().trim().min(1).max(80);
export const accountSchema = z.object({
  id,
  name,
  kind: z.enum(["bank", "cash"]),
  opening: cents,
  openingDate: dateSchema,
});
export const categorySchema = z.object({
  id,
  name,
  icon: z.enum(["house", "car", "tools", "basket", "coffee", "shield", "leaf"]),
  color: z.enum(["sage", "sand", "lavender", "peach", "blue", "mint"]),
  monthlyTarget: nonnegative,
  goal: nonnegative,
  goalDate: dateSchema.nullable(),
  x: z.number().min(12).max(88),
  y: z.number().min(12).max(88),
});
export const transactionSchema = z.object({
  id,
  date: dateSchema,
  accountId: id,
  toAccountId: id.nullable(),
  kind: z.enum(["income", "expense", "transfer"]),
  amount: positive,
  payee: z.string().trim().min(1).max(200),
  splits: z.array(z.object({ categoryId: id, amount: positive })).max(50),
  importKey: z.string().max(100).nullable(),
  recurrenceKey: z.string().max(100).nullable(),
});
export const allocationSchema = z.object({
  id,
  date: dateSchema,
  categoryId: id,
  amount: cents.refine((n) => n !== 0),
  note: z.string().max(200),
});
export const commitmentSchema = z.object({
  id,
  name,
  amount: positive,
  accountId: id,
  categoryId: id,
  nextDate: dateSchema,
  frequency: z.enum(["monthly", "yearly", "once"]),
  remaining: z.number().int().min(1).max(1200).nullable(),
  anchorDay: z.number().int().min(1).max(31),
  active: z.boolean(),
});
export const stateSchema = z.object({
  schemaVersion: z.literal(1),
  currency: z.literal("EUR"),
  expectedIncome: nonnegative,
  accounts: z.array(accountSchema).max(30),
  categories: z.array(categorySchema).max(30),
  transactions: z.array(transactionSchema).max(20000),
  allocations: z.array(allocationSchema).max(20000),
  commitments: z.array(commitmentSchema).max(200),
});
export type State = z.infer<typeof stateSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Category = z.infer<typeof categorySchema>;
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const emptyState = (): State => ({
  schemaVersion: 1,
  currency: "EUR",
  expectedIncome: 0,
  accounts: [],
  categories: [],
  transactions: [],
  allocations: [],
  commitments: [],
});
export function money(value: string): number {
  const s = value.trim().replace(/€/g, "").replace(/\s/g, "");
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized))
    throw new Error("Importe inválido. Usa hasta dos decimales.");
  const n = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(n) || Math.abs(n) > 100_000_000_000)
    throw new Error("Importe fuera de rango");
  return n;
}
export const formatMoney = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    n / 100,
  );
export function balances(s: State) {
  const accounts = Object.fromEntries(s.accounts.map((a) => [a.id, a.opening]));
  const categories = Object.fromEntries(s.categories.map((c) => [c.id, 0]));
  for (const a of s.allocations) categories[a.categoryId] += a.amount;
  for (const t of s.transactions) {
    accounts[t.accountId] += (t.kind === "income" ? 1 : -1) * t.amount;
    if (t.kind === "transfer") accounts[t.toAccountId!] += t.amount;
    else
      for (const p of t.splits)
        categories[p.categoryId] += (t.kind === "income" ? 1 : -1) * p.amount;
  }
  const total = Object.values(accounts).reduce((a, b) => a + b, 0);
  const reserved = Object.values(categories).reduce((a, b) => a + b, 0);
  return {
    accounts,
    categories,
    total,
    reserved,
    unassigned: total - reserved,
  };
}
export function validateState(input: unknown): State {
  const s = stateSchema.parse(input);
  const accounts = new Map(s.accounts.map((a) => [a.id, a]));
  const cats = new Set(s.categories.map((c) => c.id));
  for (const list of [
    s.accounts,
    s.categories,
    s.transactions,
    s.allocations,
    s.commitments,
  ])
    if (new Set(list.map((x) => x.id)).size !== list.length)
      throw new Error("Identificadores duplicados");
  const importKeys = new Set<string>(),
    recurrenceKeys = new Set<string>();
  for (const t of s.transactions) {
    if (
      !accounts.has(t.accountId) ||
      t.date < accounts.get(t.accountId)!.openingDate
    )
      throw new Error("Cuenta o fecha anterior al saldo inicial no válida");
    if (t.kind === "transfer") {
      if (
        !t.toAccountId ||
        t.accountId === t.toAccountId ||
        !accounts.has(t.toAccountId) ||
        t.splits.length ||
        t.date < accounts.get(t.toAccountId)!.openingDate
      )
        throw new Error("Traspaso inválido");
    } else {
      if (t.toAccountId) throw new Error("Destino solo permitido en traspasos");
      if (
        t.splits.length &&
        t.splits.reduce((n, p) => n + p.amount, 0) !== t.amount
      )
        throw new Error("El desglose no suma el importe");
      if (new Set(t.splits.map((p) => p.categoryId)).size !== t.splits.length)
        throw new Error("Partida duplicada en desglose");
      for (const p of t.splits)
        if (!cats.has(p.categoryId)) throw new Error("Partida inexistente");
    }
    for (const [key, set] of [
      [t.importKey, importKeys],
      [t.recurrenceKey, recurrenceKeys],
    ] as const) {
      if (key) {
        if (set.has(key)) throw new Error("Movimiento duplicado");
        set.add(key);
      }
    }
  }
  for (const a of s.allocations)
    if (!cats.has(a.categoryId)) throw new Error("Reserva sin partida");
  for (const c of s.commitments)
    if (!accounts.has(c.accountId) || !cats.has(c.categoryId))
      throw new Error("Compromiso sin cuenta o partida");
  return s;
}
export function allocate(
  s: State,
  categoryId: string,
  amount: number,
  id: string,
  date = today(),
): State {
  if (!s.categories.some((c) => c.id === categoryId))
    throw new Error("Partida inexistente");
  const b = balances(s);
  if (amount > 0 && amount > b.unassigned)
    throw new Error("No hay suficiente dinero sin asignar");
  if (amount < 0 && -amount > b.categories[categoryId])
    throw new Error("No puedes liberar más de lo reservado");
  return validateState({
    ...s,
    allocations: [
      ...s.allocations,
      {
        id,
        date,
        categoryId,
        amount,
        note: amount > 0 ? "Asignación" : "Liberación",
      },
    ],
  });
}
export function nextDate(
  date: string,
  frequency: "monthly" | "yearly" | "once",
  anchor: number,
): string {
  const d = new Date(date + "T12:00:00Z");
  if (frequency === "once") return date;
  const year = d.getUTCFullYear() + (frequency === "yearly" ? 1 : 0),
    month = d.getUTCMonth() + (frequency === "monthly" ? 1 : 0);
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchor, last), 12))
    .toISOString()
    .slice(0, 10);
}
export function payCommitment(
  s: State,
  id: string,
  transactionId: string,
  date = today(),
): State {
  const c = s.commitments.find((c) => c.id === id);
  if (!c?.active) throw new Error("Compromiso inactivo");
  const key = `${c.id}:${c.nextDate}`;
  if (s.transactions.some((t) => t.recurrenceKey === key))
    throw new Error("Vencimiento ya registrado");
  const remaining = c.remaining === null ? null : c.remaining - 1;
  return validateState({
    ...s,
    transactions: [
      ...s.transactions,
      {
        id: transactionId,
        date,
        accountId: c.accountId,
        toAccountId: null,
        kind: "expense",
        amount: c.amount,
        payee: c.name,
        splits: [{ categoryId: c.categoryId, amount: c.amount }],
        importKey: null,
        recurrenceKey: key,
      },
    ],
    commitments: s.commitments.map((x) =>
      x.id !== id
        ? x
        : {
            ...x,
            active: c.frequency !== "once" && remaining !== 0,
            remaining: remaining === 0 ? 1 : remaining,
            nextDate: nextDate(c.nextDate, c.frequency, c.anchorDay),
          },
    ),
  });
}
