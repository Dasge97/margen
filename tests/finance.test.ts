import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID as id } from "node:crypto";
import {
  emptyState,
  balances,
  allocate,
  payCommitment,
  validateState,
  money,
  nextDate,
  type State,
} from "../shared/model.js";
import {
  previewImport,
  importTransactions,
  parseDate,
} from "../shared/import.js";
function fixture() {
  const s = emptyState();
  s.accounts = [
    {
      id: id(),
      name: "Banco ficticio",
      kind: "bank",
      opening: 100000,
      openingDate: "2026-01-01",
    },
    {
      id: id(),
      name: "Cartera",
      kind: "cash",
      opening: 0,
      openingDate: "2026-01-01",
    },
  ];
  s.categories = [
    {
      id: id(),
      name: "Objetivo ficticio",
      icon: "house",
      color: "sage",
      monthlyTarget: 20000,
      goal: 500000,
      goalDate: null,
      x: 50,
      y: 20,
    },
  ];
  return s;
}
test("decimal input is converted to integer cents without silently truncating", () => {
  assert.equal(money("1.234,56 €"), 123456);
  assert.equal(money("44.35"), 4435);
  assert.equal(money("-0,01"), -1);
  assert.throws(() => money("1,234"));
  assert.throws(() => money("Infinity"));
  assert.throws(() => money("12x"));
});
test("reserving money changes purpose, not bank balance; cannot allocate twice", () => {
  let s = fixture();
  s = allocate(s, s.categories[0].id, 30000, id(), "2026-01-02");
  const b = balances(s);
  assert.equal(b.total, 100000);
  assert.equal(b.unassigned, 70000);
  assert.equal(b.reserved, 30000);
  assert.throws(() => allocate(s, s.categories[0].id, 70001, id()));
  assert.throws(() => allocate(s, s.categories[0].id, -30001, id()));
});
test("cash withdrawals are transfers and preserve wealth", () => {
  const s = fixture();
  s.transactions.push({
    id: id(),
    date: "2026-01-02",
    accountId: s.accounts[0].id,
    toAccountId: s.accounts[1].id,
    kind: "transfer",
    amount: 20000,
    payee: "Cajero",
    splits: [],
    importKey: null,
    recurrenceKey: null,
  });
  validateState(s);
  const b = balances(s);
  assert.equal(b.total, 100000);
  assert.deepEqual(Object.values(b.accounts), [80000, 20000]);
  assert.equal(b.unassigned, 100000);
});
test("refund restores the original envelope and does not become free income", () => {
  let s = fixture();
  s = allocate(s, s.categories[0].id, 30000, id(), "2026-01-02");
  for (const [kind, amount] of [
    ["expense", 10000],
    ["income", 4000],
  ] as const)
    s.transactions.push({
      id: id(),
      date: "2026-01-03",
      accountId: s.accounts[0].id,
      toAccountId: null,
      kind,
      amount,
      payee: "Compra / devolución",
      splits: [{ categoryId: s.categories[0].id, amount }],
      importKey: null,
      recurrenceKey: null,
    });
  const b = balances(validateState(s));
  assert.equal(b.total, 94000);
  assert.equal(b.categories[s.categories[0].id], 24000);
  assert.equal(b.unassigned, 70000);
});
test("unclassified expenses reduce free money; classifying them adjusts the envelope", () => {
  let s = fixture();
  s = allocate(s, s.categories[0].id, 30000, id());
  s.transactions.push({
    id: id(),
    date: "2026-01-03",
    accountId: s.accounts[0].id,
    toAccountId: null,
    kind: "expense",
    amount: 5000,
    payee: "Compra",
    splits: [],
    importKey: null,
    recurrenceKey: null,
  });
  assert.equal(balances(s).unassigned, 65000);
  s.transactions[0].splits = [{ categoryId: s.categories[0].id, amount: 5000 }];
  assert.equal(balances(s).unassigned, 70000);
  assert.equal(balances(s).categories[s.categories[0].id], 25000);
});
test("split totals, references and duplicate IDs are validated server-side", () => {
  const s = fixture();
  s.transactions.push({
    id: id(),
    date: "2026-01-03",
    accountId: s.accounts[0].id,
    toAccountId: null,
    kind: "expense",
    amount: 10000,
    payee: "Compra",
    splits: [{ categoryId: s.categories[0].id, amount: 5000 }],
    importKey: null,
    recurrenceKey: null,
  });
  assert.throws(() => validateState(s), /desglose/);
  s.transactions[0].splits = [];
  s.transactions[0].accountId = id();
  assert.throws(() => validateState(s), /Cuenta/);
  s.transactions = [];
  s.accounts.push(s.accounts[0]);
  assert.throws(() => validateState(s), /duplicados/);
});
test("future commitments do not spend money and final installment stops the schedule", () => {
  const s = fixture();
  s.commitments.push({
    id: id(),
    name: "Dos cuotas",
    amount: 4500,
    accountId: s.accounts[0].id,
    categoryId: s.categories[0].id,
    nextDate: "2026-01-31",
    frequency: "monthly",
    remaining: 2,
    anchorDay: 31,
    active: true,
  });
  assert.equal(balances(s).total, 100000);
  let paid = payCommitment(s, s.commitments[0].id, id(), "2026-01-31");
  assert.equal(balances(paid).total, 95500);
  assert.equal(paid.commitments[0].nextDate, "2026-02-28");
  paid = payCommitment(paid, s.commitments[0].id, id(), "2026-02-28");
  assert.equal(paid.commitments[0].active, false);
  assert.equal(paid.commitments[0].nextDate, "2026-03-31");
  assert.throws(() => payCommitment(paid, s.commitments[0].id, id()));
});
test("calendar clamping handles leap years without drifting anchor day", () => {
  assert.equal(nextDate("2024-01-31", "monthly", 31), "2024-02-29");
  assert.equal(nextDate("2024-02-29", "yearly", 29), "2025-02-28");
  assert.equal(parseDate("9/2/2026"), "2026-02-09");
  assert.throws(() => parseDate("31/02/2026"));
});
test("CSV repeat import is idempotent and identical purchases within file are retained", async () => {
  const s = fixture();
  const rows = [
    { Fecha: "02/01/2026", Concepto: "Compra ficticia", Importe: "-10,50" },
    { Fecha: "02/01/2026", Concepto: "Compra ficticia", Importe: "-10,50" },
    { Fecha: "31/02/2026", Concepto: "Error", Importe: "-2,00" },
  ];
  const m = { date: "Fecha", payee: "Concepto", amount: "Importe" };
  const p = await previewImport(rows, m, s.accounts[0].id, s);
  assert.equal(p.filter((x) => x.selected).length, 2);
  assert.notEqual(p[0].key, p[1].key);
  s.transactions = importTransactions(p, s.accounts[0].id, id);
  assert.equal(s.transactions.length, 2);
  const again = await previewImport(rows, m, s.accounts[0].id, s);
  assert.equal(again.filter((x) => x.duplicate).length, 2);
  assert.equal(importTransactions(again, s.accounts[0].id, id).length, 0);
  assert.ok(again[2].error);
});
test("transactions before account opening rejected to prevent opening balance double counting", () => {
  const s = fixture();
  s.transactions.push({
    id: id(),
    date: "2025-12-31",
    accountId: s.accounts[0].id,
    toAccountId: null,
    kind: "income",
    amount: 500,
    payee: "Antes del saldo",
    splits: [],
    importKey: null,
    recurrenceKey: null,
  });
  assert.throws(() => validateState(s), /saldo inicial/);
});
