import { money, dateSchema, type Transaction, type State } from "./model.js";
export function parseDate(value: string): string {
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return dateSchema.parse(s);
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!m) throw new Error("Fecha no reconocida");
  return dateSchema.parse(
    `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`,
  );
}
export interface Mapping {
  date: string;
  payee: string;
  amount: string;
}
export interface ImportRow {
  row: number;
  date: string;
  payee: string;
  amount: number;
  key: string;
  duplicate: boolean;
  error: string;
  selected: boolean;
}
// Canonical string instead of a lossy hash. A stable duplicate occurrence index preserves
// repeated same-day purchases inside one file. Across partial overlaps, review is required.
export async function previewImport(
  rows: Record<string, string>[],
  mapping: Mapping,
  accountId: string,
  state: State,
): Promise<ImportRow[]> {
  const counts = new Map<string, number>(),
    known = new Set(state.transactions.map((t) => t.importKey));
  return Promise.all(
    rows.map(async (row, i) => {
      try {
        const date = parseDate(row[mapping.date] || ""),
          payee = (row[mapping.payee] || "").trim(),
          amount = money(row[mapping.amount] || "");
        if (!payee || payee.length > 200 || !amount)
          throw new Error("Concepto vacío, demasiado largo o importe cero");
        if (date < state.accounts.find((a) => a.id === accountId)!.openingDate)
          throw new Error("Anterior al saldo inicial de la cuenta");
        const base = JSON.stringify([
          accountId,
          date,
          payee.toLowerCase().replace(/\s+/g, " "),
          amount,
        ]);
        const occurrence = (counts.get(base) || 0) + 1;
        counts.set(base, occurrence);
        const bytes = await globalThis.crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(base + ":" + occurrence),
        );
        const key = Array.from(new Uint8Array(bytes))
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
        const duplicate = known.has(key);
        return {
          row: i + 2,
          date,
          payee,
          amount,
          key,
          duplicate,
          error: "",
          selected: !duplicate,
        };
      } catch (e) {
        return {
          row: i + 2,
          date: "",
          payee: row[mapping.payee] || "",
          amount: 0,
          key: "",
          duplicate: false,
          error: (e as Error).message,
          selected: false,
        };
      }
    }),
  );
}
export function importTransactions(
  rows: ImportRow[],
  accountId: string,
  ids: () => string,
): Transaction[] {
  return rows
    .filter((r) => r.selected && !r.duplicate && !r.error)
    .map((r) => ({
      id: ids(),
      date: r.date,
      accountId,
      toAccountId: null,
      kind: r.amount > 0 ? "income" : "expense",
      amount: Math.abs(r.amount),
      payee: r.payee,
      splits: [],
      importKey: r.key,
      recurrenceKey: null,
    }));
}
