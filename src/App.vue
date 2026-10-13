<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  Plus,
  ArrowLeftRight,
  Map,
  ChartNoAxesCombined,
  List,
  Settings,
  LogOut,
  Upload,
  Download,
  X,
  Check,
  Trash2,
  ChevronRight,
  GripVertical,
  Leaf,
  Wallet,
  CalendarDays,
} from "lucide-vue-next";
import Papa from "papaparse";
import Illustration from "./Illustration.vue";
import { api } from "./api";
import {
  emptyState,
  balances,
  formatMoney as eur,
  money,
  today,
  allocate,
  payCommitment,
  validateState,
  type State,
  type Category,
  type Transaction,
} from "../shared/model";
import {
  previewImport,
  importTransactions,
  type ImportRow,
} from "../shared/import";
const state = ref<State>(emptyState()),
  version = ref(0),
  user = ref<{ name: string; email: string } | null>(null),
  loading = ref(true),
  busy = ref(false),
  error = ref(""),
  toast = ref(""),
  tab = ref("map"),
  selected = ref(""),
  modal = ref(""),
  authMode = ref("login"),
  auth = ref({ email: "", password: "", name: "" }),
  recovery = ref(false);
const resetToken = new URLSearchParams(location.search).get("reset");
if (resetToken) authMode.value = "reset";
const confirm = window.confirm.bind(window);
const overdue = (date: string) => date < today();
const modalTitle = computed(
  () =>
    (
      ({
        account: "Añadir cuenta",
        category: "Dale forma a tu partida",
        transaction: "Un nuevo movimiento",
        reserve: "Repartir tu dinero",
        commitment: "Preparar un pago",
        income: "Tu ingreso previsto",
        import: "Importar movimientos",
        link: "Vincular un pago",
        deleteUser: "Eliminar cuenta",
      }) as Record<string, string>
    )[modal.value],
);
const uuid = () => crypto.randomUUID(),
  clone = () =>
    structuredClone(JSON.parse(JSON.stringify(state.value))) as State;
const totals = computed(() => balances(state.value));
const category = computed(() =>
  state.value.categories.find((c) => c.id === selected.value),
);
const filtered = computed(() =>
  [...state.value.transactions]
    .filter(
      (t) =>
        (!search.value ||
          t.payee.toLowerCase().includes(search.value.toLowerCase())) &&
        (!uncategorized.value || (t.kind !== "transfer" && !t.splits.length)),
    )
    .sort((a, b) => b.date.localeCompare(a.date)),
);
const search = ref(""),
  uncategorized = ref(false),
  page = ref(1),
  accountName = (id: string) =>
    state.value.accounts.find((a) => a.id === id)?.name || "Cuenta";
const categoryName = (id: string) =>
  state.value.categories.find((c) => c.id === id)?.name || "Sin partida";
const dialog = ref<HTMLDialogElement | null>(null),
  form = ref<any>({}),
  sim = ref(false),
  simAmounts = ref<Record<string, number>>({}),
  csvRows = ref<Record<string, string>[]>([]),
  csvFields = ref<string[]>([]),
  importRows = ref<ImportRow[]>([]),
  importBusy = ref(false),
  mapping = ref({ date: "", payee: "", amount: "" }),
  importAccount = ref(""),
  fileInput = ref<HTMLInputElement | null>(null);
const planTotal = computed(() =>
  state.value.categories.reduce(
    (sum, c) =>
      sum +
      (sim.value
        ? (simAmounts.value[c.id] ?? c.monthlyTarget)
        : c.monthlyTarget),
    0,
  ),
);
const nextPayments = computed(() =>
  state.value.commitments
    .filter((c) => c.active)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate)),
);
function notify(message: string) {
  toast.value = message;
  setTimeout(() => (toast.value = ""), 5000);
}
async function load() {
  const me = await api("/me");
  user.value = me.user;
  const b = await api("/budget");
  state.value = validateState(b.data);
  version.value = b.version;
  selected.value = state.value.categories[0]?.id || "";
}
onMounted(async () => {
  try {
    recovery.value = (await api("/config")).passwordRecovery;
    if (!resetToken) await load();
  } catch (e: any) {
    if (e.status !== 401) error.value = e.message;
  } finally {
    loading.value = false;
  }
});
async function authenticate() {
  error.value = "";
  busy.value = true;
  try {
    if (authMode.value === "forgot") {
      notify(
        (await api("/auth/forgot", "POST", { email: auth.value.email }))
          .message,
      );
      return;
    }
    if (authMode.value === "reset") {
      await api("/auth/reset", "POST", {
        token: resetToken,
        password: auth.value.password,
      });
      history.replaceState({}, "", location.pathname);
      authMode.value = "login";
      auth.value.password = "";
      notify("Contraseña actualizada. Inicia sesión.");
      return;
    }
    await api("/auth/" + authMode.value, "POST", auth.value);
    auth.value.password = "";
    await load();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function persist(next: State) {
  if (busy.value) throw new Error("Espera a que termine el guardado");
  validateState(next);
  busy.value = true;
  error.value = "";
  try {
    const r = await api("/budget", "PUT", {
      version: version.value,
      data: next,
    });
    state.value = next;
    version.value = r.version;
    return true;
  } catch (e: any) {
    error.value = e.message;
    throw e;
  } finally {
    busy.value = false;
  }
}
async function action(fn: () => Promise<any>) {
  try {
    await fn();
  } catch (e: any) {
    error.value = e.message;
  }
}
function open(kind: string, data?: any) {
  error.value = "";
  modal.value = kind;
  form.value =
    kind === "transaction"
      ? {
          id: "",
          kind: "expense",
          amount: "",
          payee: "",
          date: today(),
          accountId: state.value.accounts[0]?.id || "",
          toAccountId: "",
          categoryId: selected.value || "",
          splits: [],
          ...data,
        }
      : kind === "category"
        ? {
            id: "",
            name: "",
            icon: "leaf",
            color: "sage",
            monthlyTarget: "0",
            goal: "0",
            goalDate: "",
            ...data,
          }
        : kind === "account"
          ? { name: "", kind: "bank", opening: "0", openingDate: today() }
          : kind === "commitment"
            ? {
                name: "",
                amount: "",
                frequency: "monthly",
                nextDate: today(),
                remaining: "",
                accountId: state.value.accounts[0]?.id || "",
                categoryId: selected.value || "",
              }
            : kind === "reserve"
              ? { amount: "", release: false }
              : kind === "income"
                ? { amount: String(state.value.expectedIncome / 100) }
                : {};
  if (kind === "import") {
    csvRows.value = [];
    csvFields.value = [];
    importRows.value = [];
    importAccount.value = state.value.accounts[0]?.id || "";
  }
  dialog.value?.showModal();
}
function close() {
  dialog.value?.close();
  modal.value = "";
}
async function submit() {
  await action(async () => {
    const n = clone(),
      f = form.value;
    if (modal.value === "account") {
      n.accounts.push({
        id: uuid(),
        name: f.name,
        kind: f.kind,
        opening: money(f.opening),
        openingDate: f.openingDate,
      });
    } else if (modal.value === "category") {
      const old = n.categories.find((c) => c.id === f.id);
      const c: Category = {
        id: f.id || uuid(),
        name: f.name,
        icon: f.icon,
        color: f.color,
        monthlyTarget: money(f.monthlyTarget),
        goal: money(f.goal),
        goalDate: f.goalDate || null,
        x: old?.x || 50,
        y: old?.y || 18,
      };
      if (old) n.categories[n.categories.indexOf(old)] = c;
      else {
        const positions = [
          [50, 17],
          [80, 36],
          [80, 70],
          [50, 85],
          [20, 70],
          [20, 36],
        ];
        [c.x, c.y] = positions[n.categories.length % 6];
        n.categories.push(c);
      }
      await persist(n);
      selected.value = c.id;
      close();
      return;
    } else if (modal.value === "reserve") {
      const value = money(f.amount);
      if (value <= 0) throw new Error("Introduce una cantidad positiva");
      await persist(
        allocate(n, selected.value, value * (f.release ? -1 : 1), uuid()),
      );
      close();
      return;
    } else if (modal.value === "transaction") {
      const amount = money(f.amount);
      let splits =
        f.kind === "transfer"
          ? []
          : f.splits.length
            ? f.splits.map((p: any) => ({
                categoryId: p.categoryId,
                amount: money(p.amount),
              }))
            : f.categoryId
              ? [{ categoryId: f.categoryId, amount }]
              : [];
      const old = n.transactions.find((t) => t.id === f.id);
      const t: Transaction = {
        id: f.id || uuid(),
        kind: f.kind,
        date: f.date,
        amount,
        payee: f.payee,
        accountId: f.accountId,
        toAccountId: f.kind === "transfer" ? f.toAccountId : null,
        splits,
        importKey: old?.importKey || null,
        recurrenceKey: old?.recurrenceKey || null,
      };
      if (old) n.transactions[n.transactions.indexOf(old)] = t;
      else n.transactions.push(t);
    } else if (modal.value === "commitment") {
      n.commitments.push({
        id: uuid(),
        name: f.name,
        amount: money(f.amount),
        frequency: f.frequency,
        nextDate: f.nextDate,
        remaining: f.remaining ? Number(f.remaining) : null,
        anchorDay: Number(f.nextDate.slice(8)),
        accountId: f.accountId,
        categoryId: f.categoryId,
        active: true,
      });
    } else if (modal.value === "income") {
      n.expectedIncome = money(f.amount);
    }
    await persist(n);
    close();
    notify("Guardado");
  });
}
function editCategory() {
  const c = category.value!;
  open("category", {
    ...c,
    monthlyTarget: String(c.monthlyTarget / 100),
    goal: String(c.goal / 100),
    goalDate: c.goalDate || "",
  });
}
function editTransaction(t: Transaction) {
  open("transaction", {
    ...t,
    amount: String(t.amount / 100),
    categoryId: t.splits[0]?.categoryId || "",
    splits:
      t.splits.length > 1
        ? t.splits.map((p) => ({ ...p, amount: String(p.amount / 100) }))
        : [],
  });
}
async function removeTransaction(t: Transaction) {
  if (
    !confirm(
      "¿Eliminar este movimiento? Se recalcularán el saldo y las partidas. Si procede de un compromiso, su próximo vencimiento no retrocede.",
    )
  )
    return;
  await action(async () => {
    const n = clone();
    n.transactions = n.transactions.filter((x) => x.id !== t.id);
    await persist(n);
  });
}
async function removeCategory() {
  const id = selected.value;
  if (
    !confirm(
      "¿Eliminar esta partida? Solo se puede eliminar si no tiene movimientos, reservas ni compromisos.",
    )
  )
    return;
  await action(async () => {
    const n = clone();
    n.categories = n.categories.filter((c) => c.id !== id);
    await persist(n);
    selected.value = n.categories[0]?.id || "";
  });
}
function startSimulation() {
  sim.value = true;
  simAmounts.value = Object.fromEntries(
    state.value.categories.map((c) => [c.id, c.monthlyTarget]),
  );
  tab.value = "future";
}
async function applySimulation() {
  await action(async () => {
    const n = clone();
    n.categories.forEach(
      (c) => (c.monthlyTarget = simAmounts.value[c.id] ?? c.monthlyTarget),
    );
    await persist(n);
    sim.value = false;
    notify("Previsión actualizada. El dinero real no se ha movido.");
  });
}
async function readCsv(event: Event) {
  error.value = "";
  await action(async () => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 5_000_000)
      throw new Error("El CSV debe ocupar menos de 5 MB");
    const parsed = Papa.parse<Record<string, string>>(await file.text(), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.replace(/^\uFEFF/, "").trim(),
    });
    if (parsed.errors.length)
      throw new Error("CSV inválido: " + parsed.errors[0].message);
    if (parsed.data.length > 5000)
      throw new Error("Importa un máximo de 5.000 filas cada vez");
    csvRows.value = parsed.data;
    csvFields.value = parsed.meta.fields || [];
    const find = (words: string[]) =>
      csvFields.value.find((h) => words.includes(h.toLowerCase())) || "";
    mapping.value = {
      date: find(["fecha_operacion", "fecha", "date"]),
      payee: find(["concepto", "descripcion", "descripción", "payee"]),
      amount: find(["importe", "amount"]),
    };
    importRows.value = [];
  });
}
async function preview() {
  importBusy.value = true;
  try {
    importRows.value = await previewImport(
      csvRows.value,
      mapping.value,
      importAccount.value,
      state.value,
    );
  } catch (e: any) {
    error.value = e.message;
  } finally {
    importBusy.value = false;
  }
}
async function finishImport() {
  await action(async () => {
    const n = clone(),
      newRows = importTransactions(importRows.value, importAccount.value, uuid);
    if (!newRows.length) throw new Error("No hay filas seleccionadas");
    n.transactions.push(...newRows);
    await persist(n);
    close();
    tab.value = "transactions";
    uncategorized.value = true;
    notify(
      `${newRows.length} movimientos importados. Revisa partidas, devoluciones y traspasos.`,
    );
  });
}
function download() {
  const blob = new Blob([JSON.stringify(state.value, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "margen-plan.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function restore(event: Event) {
  await action(async () => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 8_000_000) throw new Error("Archivo demasiado grande");
    const next = validateState(JSON.parse(await file.text()));
    if (
      confirm(
        "¿Sustituir todos tus datos por esta copia? Exporta tu plan actual antes de continuar.",
      )
    ) {
      await persist(next);
      selected.value = next.categories[0]?.id || "";
      notify("Copia restaurada");
    }
  });
  (event.target as HTMLInputElement).value = "";
}
async function seedCategories() {
  const n = clone();
  const specs = [
    ["Mi objetivo", "house", "sage"],
    ["Coche", "car", "mint"],
    ["Servicios", "tools", "lavender"],
    ["Imprevistos", "shield", "blue"],
    ["Disfrutar", "coffee", "peach"],
    ["Vida diaria", "basket", "sand"],
  ] as const;
  specs.forEach(([name, icon, color], i) => {
    const positions = [
      [50, 16],
      [20, 35],
      [80, 35],
      [80, 72],
      [50, 85],
      [20, 72],
    ];
    n.categories.push({
      id: uuid(),
      name,
      icon,
      color,
      monthlyTarget: 0,
      goal: 0,
      goalDate: null,
      x: positions[i][0],
      y: positions[i][1],
    });
  });
  await action(async () => {
    await persist(n);
    selected.value = n.categories[0].id;
  });
}
const drag = ref<{ id: string; x: number; y: number; rect: DOMRect } | null>(
    null,
  ),
  canvas = ref<HTMLElement | null>(null);
function dragStart(e: PointerEvent, c: Category) {
  if (busy.value || !canvas.value) return;
  e.preventDefault();
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  drag.value = {
    id: c.id,
    x: c.x,
    y: c.y,
    rect: canvas.value.getBoundingClientRect(),
  };
  selected.value = c.id;
}
function dragMove(e: PointerEvent) {
  if (!drag.value) return;
  const d = drag.value;
  d.x = Math.min(
    87,
    Math.max(13, ((e.clientX - d.rect.left) / d.rect.width) * 100),
  );
  d.y = Math.min(
    86,
    Math.max(14, ((e.clientY - d.rect.top) / d.rect.height) * 100),
  );
}
async function dragEnd() {
  if (!drag.value) return;
  const d = drag.value;
  drag.value = null;
  const c = state.value.categories.find((c) => c.id === d.id);
  if (!c) return;
  const n = clone();
  Object.assign(
    n.categories.find((c) => c.id === d.id)!,
    { x: d.x, y: d.y },
  );
  await action(() => persist(n));
}
const position = (c: Category) => (drag.value?.id === c.id ? drag.value : c);
function months(c: Category) {
  const remaining = Math.max(0, c.goal - (totals.value.categories[c.id] || 0)),
    monthly = sim.value
      ? (simAmounts.value[c.id] ?? c.monthlyTarget)
      : c.monthlyTarget;
  return !remaining
    ? "Objetivo alcanzado"
    : monthly > 0
      ? `${Math.ceil(remaining / monthly)} meses al ritmo previsto`
      : "Define una aportación mensual";
}
async function markPaid(id: string) {
  if (
    !confirm(
      "¿Registrar un nuevo gasto para este vencimiento? Si ya lo importaste del banco, cancela y usa «Ya registrado».",
    )
  )
    return;
  await action(async () => {
    await persist(payCommitment(clone(), id, uuid()));
    notify("Gasto registrado y vencimiento actualizado");
  });
}
async function linkPaid(id: string) {
  open("link");
  form.value = { commitmentId: id, transactionId: "" };
}
async function confirmLink() {
  await action(async () => {
    const n = clone(),
      c = n.commitments.find((c) => c.id === form.value.commitmentId)!,
      t = n.transactions.find((t) => t.id === form.value.transactionId)!;
    if (
      !t ||
      t.kind !== "expense" ||
      t.accountId !== c.accountId ||
      t.amount !== c.amount ||
      t.recurrenceKey
    )
      throw new Error(
        "Elige un gasto sin vincular de la misma cuenta e importe",
      );
    const simulated = payCommitment(n, c.id, uuid());
    const generated = simulated.transactions.pop()!;
    Object.assign(
      simulated.transactions.find((x) => x.id === t.id)!,
      {
        recurrenceKey: generated.recurrenceKey,
        splits: t.splits.length ? t.splits : generated.splits,
      },
    );
    await persist(simulated);
    close();
  });
}
async function logout() {
  await action(async () => {
    await api("/logout", "POST", {});
    user.value = null;
    state.value = emptyState();
    authMode.value = "login";
  });
}
</script>

<template>
  <div v-if="loading" class="loading"><Leaf /> Abriendo Margen…</div>
  <div v-else-if="!user" class="auth-page">
    <section class="auth-story">
      <div class="brand"><Leaf /> margen<span>.</span></div>
      <span class="eyebrow">TU DINERO TIENE UNA VIDA DETRÁS</span>
      <h1>Haz sitio<br />a tus planes.</h1>
      <p>
        Un lugar para organizar lo que tienes,<br />disfrutar el presente y
        preparar lo que viene.
      </p>
      <div class="auth-art">
        <Illustration kind="house" /><span class="bubble b1"
          >Un hogar propio</span
        ><span class="bubble b2">Más tranquilidad</span
        ><span class="bubble b3">Espacio para disfrutar</span>
      </div>
      <small>Tu espacio. Tus prioridades. Tu ritmo.</small>
    </section>
    <section class="auth-form">
      <div class="brand mobile-brand"><Leaf /> margen.</div>
      <span class="eyebrow">EMPIEZA DONDE ESTÁS</span>
      <h2>
        {{
          authMode === "register"
            ? "Tu próximo paso empieza aquí."
            : authMode === "forgot"
              ? "Recupera tu acceso."
              : authMode === "reset"
                ? "Una nueva contraseña."
                : "Qué bien tenerte aquí."
        }}
      </h2>
      <p>No necesitas tenerlo todo ordenado para empezar.</p>
      <form @submit.prevent="authenticate">
        <label v-if="authMode === 'register'"
          >Tu nombre<input
            v-model="auth.name"
            required
            maxlength="80"
            autocomplete="given-name" /></label
        ><label v-if="authMode !== 'reset'"
          >Correo electrónico<input
            v-model="auth.email"
            type="email"
            required
            autocomplete="email" /></label
        ><label v-if="authMode !== 'forgot'"
          >Contraseña<input
            v-model="auth.password"
            type="password"
            minlength="12"
            maxlength="128"
            required
            :autocomplete="
              authMode === 'login' ? 'current-password' : 'new-password'
            "
            placeholder="Al menos 12 caracteres"
        /></label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="primary wide" :disabled="busy">
          {{
            busy
              ? "Un momento…"
              : authMode === "register"
                ? "Crear mi espacio"
                : authMode === "forgot"
                  ? "Enviar enlace"
                  : authMode === "reset"
                    ? "Guardar contraseña"
                    : "Entrar en Margen"
          }}
          <ChevronRight :size="17" />
        </button>
      </form>
      <button
        class="text-button"
        @click="
          authMode = authMode === 'login' ? 'register' : 'login';
          error = '';
        "
      >
        {{
          authMode === "login"
            ? "¿Primera vez? Crea tu cuenta"
            : "Volver a iniciar sesión"
        }}</button
      ><button
        v-if="authMode === 'login' && recovery"
        class="text-button"
        @click="authMode = 'forgot'"
      >
        He olvidado mi contraseña
      </button>
      <p class="tiny">
        Cada cuenta tiene sus propios datos. Puedes exportarlos o eliminar tu
        cuenta desde Ajustes.
      </p>
    </section>
  </div>
  <template v-else>
    <header>
      <button class="brand" @click="tab = 'map'">
        <Leaf /> margen<span>.</span>
      </button>
      <nav>
        <button :class="{ active: tab === 'map' }" @click="tab = 'map'">
          <Map :size="18" /><span>Mi mapa</span></button
        ><button
          :class="{ active: tab === 'transactions' }"
          @click="tab = 'transactions'"
        >
          <List :size="18" /><span>Movimientos</span></button
        ><button :class="{ active: tab === 'future' }" @click="tab = 'future'">
          <ChartNoAxesCombined :size="18" /><span>Mi futuro</span></button
        ><button
          :class="{ active: tab === 'commitments' }"
          @click="tab = 'commitments'"
        >
          <CalendarDays :size="18" /><span>Compromisos</span>
        </button>
      </nav>
      <button class="avatar" @click="tab = 'settings'" aria-label="Ajustes">
        {{ user.name[0].toUpperCase() }}
      </button>
    </header>
    <main>
      <div v-if="error" class="error global-error" role="alert">
        {{ error }}
        <button @click="error = ''" aria-label="Cerrar aviso">
          <X :size="16" />
        </button>
      </div>
      <div class="page-heading">
        <div>
          <span class="eyebrow">{{
            tab === "map"
              ? "TU PRESENTE, CON INTENCIÓN"
              : tab === "future"
                ? "EL FUTURO SE PREPARA HOY"
                : "TU ESPACIO PERSONAL"
          }}</span>
          <h1>
            {{
              tab === "map"
                ? "Tu dinero, con un propósito."
                : tab === "transactions"
                  ? "Cada movimiento cuenta."
                  : tab === "future"
                    ? "Haz sitio a lo que viene."
                    : tab === "commitments"
                      ? "Sin sorpresas en el calendario."
                      : "Todo en su sitio."
            }}
          </h1>
          <p>
            {{
              tab === "map"
                ? "Toca una partida para organizarla. Elige qué quieres cuidar."
                : tab === "future"
                  ? "Prueba posibilidades sin tocar tus saldos reales."
                  : tab === "transactions"
                    ? "Cuentas, efectivo y traspasos. Cada euro, una sola vez."
                    : tab === "commitments"
                      ? "Registra tus pagos cuando ocurran. Las previsiones no modifican tu saldo."
                      : "Gestiona tus cuentas, tus datos y tu acceso."
            }}
          </p>
        </div>
        <button
          v-if="state.accounts.length"
          class="primary"
          @click="open('transaction')"
          :disabled="busy"
        >
          <Plus :size="18" /> Añadir movimiento
        </button>
      </div>
      <section v-if="!state.accounts.length" class="onboarding">
        <Illustration kind="house" />
        <div>
          <span class="eyebrow">UN COMIENZO SENCILLO</span>
          <h2>Empieza con lo que tienes hoy.</h2>
          <p>
            Añade una cuenta y su saldo actual. No hace falta reconstruir tu
            pasado. Si importarás movimientos anteriores, usa el saldo justo
            antes del primer movimiento.
          </p>
          <button class="primary" @click="open('account')">
            <Plus :size="18" /> Mi primera cuenta
          </button>
        </div>
      </section>
      <template v-else-if="tab === 'map'">
        <div class="summary">
          <div>
            <small>Dinero real</small><strong>{{ eur(totals.total) }}</strong>
          </div>
          <div>
            <small>En tus partidas · neto</small
            ><strong>{{ eur(totals.reserved) }}</strong>
          </div>
          <div :class="{ negative: totals.unassigned < 0 }">
            <small>Sin asignar</small
            ><strong>{{ eur(totals.unassigned) }}</strong>
          </div>
          <span class="tiny">Las reservas siguen en tus cuentas.</span>
        </div>
        <div v-if="!state.categories.length" class="empty">
          <h2>¿Qué partes de tu vida quieres organizar?</h2>
          <p>Puedes empezar con seis partidas vacías y darles tu forma.</p>
          <button class="primary" @click="seedCategories" :disabled="busy">
            Crear mis primeras partidas
          </button>
          <button @click="open('category')">Crear una desde cero</button>
        </div>
        <div v-else class="map-layout">
          <section ref="canvas" class="canvas" aria-label="Mapa de partidas">
            <span class="canvas-caption"
              >MI MAPA <span>· arrastra desde el asa</span></span
            ><svg
              class="connections"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                v-for="c in state.categories"
                :key="c.id"
                :d="`M 50 50 Q 50 ${position(c).y} ${position(c).x} ${position(c).y}`"
                :class="c.color"
              />
            </svg>
            <div class="hub">
              <Leaf :size="26" /><span>Sin asignar</span
              ><strong>{{ eur(totals.unassigned) }}</strong
              ><small>Dale un propósito</small>
            </div>
            <div
              v-for="c in state.categories"
              :key="c.id"
              :class="['node', c.color, { selected: selected === c.id }]"
              :style="{ left: position(c).x + '%', top: position(c).y + '%' }"
            >
              <button
                class="drag"
                aria-label="Mover partida"
                @pointerdown="dragStart($event, c)"
                @pointermove="dragMove"
                @pointerup="dragEnd"
                @pointercancel="dragEnd"
              >
                <GripVertical :size="17" /></button
              ><button class="node-body" @click="selected = c.id">
                <Illustration :kind="c.icon" />
                <h3>{{ c.name }}</h3>
                <strong :class="{ negative: totals.categories[c.id] < 0 }">{{
                  eur(totals.categories[c.id])
                }}</strong
                ><small>{{
                  c.goal
                    ? "Reservado para tu objetivo"
                    : "Disponible en la partida"
                }}</small>
              </button>
            </div>
            <button
              class="canvas-add"
              @click="open('category')"
              :disabled="state.categories.length >= 30"
            >
              <Plus :size="16" /> Partida
            </button>
          </section>
          <aside v-if="category" class="inspector">
            <div class="inspector-title">
              <div :class="['mini-art', category.color]">
                <Illustration :kind="category.icon" />
              </div>
              <div>
                <span class="eyebrow">TU PARTIDA</span>
                <h2>{{ category.name }}</h2>
              </div>
            </div>
            <label class="muted">Disponible ahora</label>
            <div
              class="hero-number"
              :class="{ negative: totals.categories[category.id] < 0 }"
            >
              {{ eur(totals.categories[category.id]) }}
            </div>
            <p v-if="totals.categories[category.id] < 0" class="error">
              Esta partida ha gastado más de lo reservado. Asígnale dinero para
              cubrir la diferencia.
            </p>
            <p v-else class="tiny">
              Reservado para esta parte de tu vida. Gastar aquí reduce esta
              cantidad y el saldo de la cuenta.
            </p>
            <button
              class="primary wide"
              @click="open('reserve')"
              :disabled="busy"
            >
              Repartir dinero <ArrowLeftRight :size="17" />
            </button>
            <div class="inspector-line">
              <span>Previsión mensual</span
              ><strong>{{ eur(category.monthlyTarget) }}</strong>
            </div>
            <div v-if="category.goal" class="goal-mini">
              <span>Objetivo · {{ eur(category.goal) }}</span
              ><progress
                :value="Math.max(0, totals.categories[category.id])"
                :max="category.goal"
              ></progress
              ><small>{{ months(category) }}</small>
            </div>
            <button class="wide" @click="editCategory">
              Editar partida y objetivo</button
            ><button class="text-button" @click="startSimulation">
              ¿Y si cambio mi plan? <ChevronRight :size="14" />
            </button>
          </aside>
        </div>
        <section class="journey">
          <div>
            <span class="eyebrow">CADA PASO SUMA</span>
            <h2>Tu próximo capítulo.</h2>
            <p>
              Una casa, un viaje o simplemente más tranquilidad.<br />Elige un
              objetivo y encuentra tu ritmo.
            </p>
            <button @click="tab = 'future'">
              Ver mi futuro <ChevronRight :size="16" />
            </button>
          </div>
          <div class="journey-path">
            <span class="milestone">Hoy</span><span class="dotted"></span
            ><span class="milestone">A tu ritmo</span
            ><span class="dotted"></span><Illustration kind="house" />
          </div>
        </section>
      </template>
      <template v-else-if="tab === 'transactions'"
        ><section class="accounts-strip">
          <button
            v-for="a in state.accounts"
            :key="a.id"
            @click="tab = 'settings'"
          >
            <Wallet :size="18" /><span
              >{{ a.name
              }}<strong>{{ eur(totals.accounts[a.id]) }}</strong></span
            ></button
          ><button @click="open('account')"><Plus :size="18" /> Cuenta</button>
        </section>
        <div class="toolbar">
          <input
            v-model="search"
            placeholder="Buscar un movimiento…"
            aria-label="Buscar"
            @input="page = 1"
          /><label class="inline"
            ><input
              v-model="uncategorized"
              type="checkbox"
              @change="page = 1"
            />
            Sin partida</label
          ><button @click="open('import')">
            <Upload :size="16" /> Importar CSV
          </button>
        </div>
        <div class="ledger">
          <div v-if="!filtered.length" class="empty">
            <h2>Aquí empieza tu registro.</h2>
            <p>
              Añade un movimiento o importa un CSV. Tú decides desde cuándo
              empezar.
            </p>
          </div>
          <article
            v-for="t in filtered.slice((page - 1) * 50, page * 50)"
            :key="t.id"
            class="transaction"
          >
            <div :class="['tx-icon', t.kind]">
              {{
                t.kind === "income" ? "+" : t.kind === "transfer" ? "↔" : "−"
              }}
            </div>
            <button class="tx-main" @click="editTransaction(t)">
              <strong>{{ t.payee }}</strong
              ><small
                >{{ t.date.split("-").reverse().join("/") }} ·
                {{ accountName(t.accountId) }} ·
                {{
                  t.kind === "transfer"
                    ? "A " + accountName(t.toAccountId!)
                    : t.splits.length === 1
                      ? categoryName(t.splits[0].categoryId)
                      : t.splits.length
                        ? "Repartido en " + t.splits.length + " partidas"
                        : "Sin partida"
                }}</small
              ></button
            ><strong :class="{ income: t.kind === 'income' }"
              >{{ t.kind === "income" ? "+" : t.kind === "expense" ? "−" : ""
              }}{{ eur(t.amount) }}</strong
            ><button
              class="icon-button"
              @click="removeTransaction(t)"
              aria-label="Eliminar movimiento"
            >
              <Trash2 :size="16" />
            </button>
          </article>
        </div>
        <div class="pagination">
          <button :disabled="page <= 1" @click="page--">Anterior</button
          ><small>{{ filtered.length }} movimientos · Página {{ page }}</small
          ><button :disabled="page * 50 >= filtered.length" @click="page++">
            Siguiente
          </button>
        </div></template
      >
      <template v-else-if="tab === 'future'"
        ><div class="forecast-top">
          <div>
            <small>Ingreso mensual previsto</small
            ><button class="number-button" @click="open('income')">
              {{ eur(state.expectedIncome) }} <Settings :size="16" />
            </button>
          </div>
          <div>
            <small>Planificado al mes</small
            ><strong>{{ eur(planTotal) }}</strong>
          </div>
          <div>
            <small>Margen previsto</small
            ><strong :class="{ negative: state.expectedIncome < planTotal }">{{
              eur(state.expectedIncome - planTotal)
            }}</strong>
          </div>
          <button v-if="!sim" class="primary" @click="startSimulation">
            Probar otro reparto</button
          ><template v-else
            ><button class="primary" @click="applySimulation" :disabled="busy">
              Aplicar previsión</button
            ><button @click="sim = false">Descartar</button></template
          >
        </div>
        <div class="notice">
          {{
            sim
              ? "Simulación activa: tus saldos y reservas no cambian."
              : "Estos importes son previsiones. Reservar dinero real se hace desde Mi mapa."
          }}
          El presupuesto mensual de cada partida debe incluir sus recibos y
          pagos previstos; no se suman otra vez los compromisos.
        </div>
        <div class="future-grid">
          <article
            v-for="c in state.categories"
            :key="c.id"
            :class="['future-card', c.color]"
          >
            <Illustration :kind="c.icon" />
            <h2>{{ c.name }}</h2>
            <label
              >Aportación o presupuesto mensual<input
                v-if="sim"
                type="number"
                min="0"
                step="1"
                :value="(simAmounts[c.id] ?? c.monthlyTarget) / 100"
                @input="
                  simAmounts[c.id] = Math.max(
                    0,
                    Math.round(
                      Number(($event.target as HTMLInputElement).value) * 100,
                    ),
                  )
                "
              /><strong v-else>{{ eur(c.monthlyTarget) }}</strong></label
            ><template v-if="c.goal"
              ><progress
                :value="Math.max(0, totals.categories[c.id])"
                :max="c.goal"
              ></progress>
              <div>{{ eur(totals.categories[c.id]) }} de {{ eur(c.goal) }}</div>
              <p>{{ months(c) }}</p>
              <small v-if="c.goalDate"
                >Fecha deseada: {{ c.goalDate }} · Necesitas reunir
                {{ eur(Math.max(0, c.goal - totals.categories[c.id])) }}</small
              >
              <p class="tiny">
                Estimación sin rendimientos, nuevas retiradas ni variaciones de
                aportación.
              </p></template
            >
            <p v-else class="tiny">
              Añade un objetivo para ver cuánto te falta y estimar el plazo.
            </p>
            <button
              @click="
                selected = c.id;
                editCategory();
              "
            >
              Editar
            </button>
          </article>
          <button class="add-card" @click="open('category')">
            <Plus /> Nueva partida u objetivo
          </button>
        </div></template
      >
      <template v-else-if="tab === 'commitments'"
        ><button
          class="primary"
          @click="open('commitment')"
          :disabled="!state.categories.length"
        >
          <Plus :size="18" /> Añadir compromiso
        </button>
        <div class="notice">
          Un seguro anual, una cuota que termina o un regalo puntual. «Registrar
          pago» crea un gasto; «Ya registrado» lo vincula a un movimiento
          existente sin duplicarlo.
        </div>
        <div v-if="!nextPayments.length" class="empty">
          <CalendarDays />
          <h2>Un poco de previsión, mucha tranquilidad.</h2>
          <p>Añade tu primer pago previsto. No se cargará automáticamente.</p>
        </div>
        <div class="commitment-grid">
          <article v-for="c in nextPayments" :key="c.id" class="commitment">
            <span :class="['pill', { warning: overdue(c.nextDate) }]"
              >{{ overdue(c.nextDate) ? "Pendiente desde " : ""
              }}{{ c.nextDate }}</span
            >
            <h2>{{ c.name }}</h2>
            <strong class="big">{{ eur(c.amount) }}</strong>
            <p>
              {{ categoryName(c.categoryId) }} ·
              {{
                c.frequency === "monthly"
                  ? "Mensual"
                  : c.frequency === "yearly"
                    ? "Anual"
                    : "Puntual"
              }}<span v-if="c.remaining">
                · {{ c.remaining }} pago(s) restante(s)</span
              >
            </p>
            <div class="button-row">
              <button class="primary" @click="markPaid(c.id)" :disabled="busy">
                Registrar pago</button
              ><button @click="linkPaid(c.id)">Ya registrado</button>
            </div>
            <button
              class="text-button"
              @click="
                action(async () => {
                  if (confirm('¿Desactivar este compromiso?')) {
                    const n = clone();
                    n.commitments.find((x) => x.id === c.id)!.active = false;
                    await persist(n);
                  }
                })
              "
            >
              Dejar de preverlo
            </button>
          </article>
        </div></template
      >
      <template v-else-if="tab === 'settings'"
        ><div class="settings-grid">
          <section class="card">
            <h2>Mis cuentas</h2>
            <div v-for="a in state.accounts" :key="a.id" class="account-row">
              <Wallet :size="20" />
              <div>
                <strong>{{ a.name }}</strong
                ><small
                  >{{ a.kind === "cash" ? "Efectivo" : "Cuenta bancaria" }} ·
                  Desde {{ a.openingDate }}</small
                >
              </div>
              <strong>{{ eur(totals.accounts[a.id]) }}</strong>
            </div>
            <button @click="open('account')">
              <Plus :size="16" /> Añadir cuenta o efectivo
            </button>
            <p class="tiny">
              Para corregir un saldo, registra un movimiento de ajuste.
              Mantendrás un historial de los cambios.
            </p>
          </section>
          <section class="card">
            <h2>Tus datos son tuyos.</h2>
            <p>
              Exporta una copia completa de tu plan en JSON. Contiene
              información privada: guárdala en un lugar seguro.
            </p>
            <button @click="download">
              <Download :size="17" /> Exportar copia
            </button>
            <button @click="fileInput?.click()">
              <Upload :size="17" /> Restaurar copia</button
            ><input
              ref="fileInput"
              type="file"
              hidden
              accept="application/json"
              @change="restore"
            />
            <p class="tiny">
              Moneda: EUR. Los datos se guardan en el servidor, separados por
              usuario.
            </p>
          </section>
          <section class="card">
            <h2>{{ user.name }}</h2>
            <p>{{ user.email }}</p>
            <button @click="logout"><LogOut :size="17" /> Cerrar sesión</button
            ><button class="danger text-button" @click="open('deleteUser')">
              Eliminar mi cuenta y todos mis datos
            </button>
          </section>
        </div></template
      >
      <footer>
        <span
          ><Leaf :size="14" /> Margen · Organiza tu dinero. Haz sitio a tus
          planes.</span
        ><span>{{ busy ? "Guardando…" : "Datos guardados en tu cuenta" }}</span>
      </footer>
    </main>
  </template>
  <div v-if="toast" class="toast" role="status">
    <Check :size="18" />{{ toast }}
  </div>
  <dialog
    ref="dialog"
    @cancel="modal = ''"
    @click="$event.target === dialog && close()"
  >
    <div class="dialog-header">
      <h2>{{ modalTitle }}</h2>
      <button class="icon-button" @click="close()" aria-label="Cerrar">
        <X />
      </button>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <form
      v-if="
        [
          'account',
          'category',
          'transaction',
          'reserve',
          'commitment',
          'income',
        ].includes(modal)
      "
      @submit.prevent="submit"
    >
      <template v-if="modal === 'account'"
        ><label
          >Nombre<input
            v-model="form.name"
            required
            maxlength="80"
            placeholder="Mi banco, cartera…" /></label
        ><label
          >Tipo<select v-model="form.kind" aria-label="Tipo">
            <option value="bank">Cuenta bancaria</option>
            <option value="cash">Efectivo</option>
          </select></label
        ><label
          >Saldo inicial (€)<input
            v-model="form.opening"
            required
            inputmode="decimal" /></label
        ><label
          >Fecha del saldo inicial<input
            v-model="form.openingDate"
            type="date"
            required
        /></label>
        <p class="tiny">
          Este saldo es anterior a los movimientos que registres desde esa
          fecha. No importes movimientos ya incluidos en él.
        </p></template
      >
      <template v-if="modal === 'category'"
        ><label
          >Nombre<input
            v-model="form.name"
            required
            maxlength="80"
            placeholder="Mi casa, viajes, tranquilidad…"
        /></label>
        <div class="form-row">
          <label
            >Ilustración<select v-model="form.icon">
              <option value="house">Casa</option>
              <option value="car">Coche</option>
              <option value="tools">Herramientas</option>
              <option value="basket">Día a día</option>
              <option value="coffee">Disfrutar</option>
              <option value="shield">Tranquilidad</option>
              <option value="leaf">Crecer</option>
            </select></label
          ><label
            >Color<select v-model="form.color">
              <option
                v-for="(name, key) in {
                  sage: 'Salvia',
                  sand: 'Arena',
                  lavender: 'Lavanda',
                  peach: 'Melocotón',
                  blue: 'Azul',
                  mint: 'Menta',
                }"
                :value="key"
              >
                {{ name }}
              </option>
            </select></label
          >
        </div>
        <label
          >Previsión mensual (€)<input
            v-model="form.monthlyTarget"
            required
            inputmode="decimal" /></label
        ><label
          >Objetivo de ahorro (€) · 0 si no aplica<input
            v-model="form.goal"
            required
            inputmode="decimal" /></label
        ><label
          >Fecha deseada · opcional<input v-model="form.goalDate" type="date"
        /></label>
        <p class="tiny">
          La previsión no reserva dinero automáticamente. Puedes asignarlo desde
          el mapa.
        </p>
        <button
          v-if="form.id"
          class="danger text-button"
          type="button"
          @click="
            removeCategory().then(() => {
              if (!error) close();
            })
          "
        >
          Eliminar partida
        </button></template
      >
      <template v-if="modal === 'transaction'"
        ><label
          >Tipo<select v-model="form.kind" aria-label="Tipo">
            <option value="expense">Gasto</option>
            <option value="income">Ingreso o devolución</option>
            <option value="transfer">Traspaso entre mis cuentas</option>
          </select></label
        ><label
          >Concepto<input
            v-model="form.payee"
            required
            maxlength="200"
            placeholder="¿Qué ha pasado?"
        /></label>
        <div class="form-row">
          <label
            >Importe (€)<input
              v-model="form.amount"
              required
              inputmode="decimal" /></label
          ><label
            >Fecha<input
              v-model="form.date"
              type="date"
              :max="today()"
              required
          /></label>
        </div>
        <label
          >{{ form.kind === "transfer" ? "Cuenta de origen" : "Cuenta"
          }}<select v-model="form.accountId" required>
            <option v-for="a in state.accounts" :value="a.id">
              {{ a.name }}
            </option>
          </select></label
        ><label v-if="form.kind === 'transfer'"
          >Cuenta de destino<select v-model="form.toAccountId" required>
            <option value="" disabled>Selecciona cuenta</option>
            <option
              v-for="a in state.accounts.filter((a) => a.id !== form.accountId)"
              :value="a.id"
            >
              {{ a.name }}
            </option>
          </select></label
        ><template v-else
          ><label v-if="!form.splits.length"
            >Partida<select v-model="form.categoryId">
              <option value="">
                {{
                  form.kind === "income"
                    ? "Sin asignar · ingreso general"
                    : "Sin clasificar"
                }}
              </option>
              <option v-for="c in state.categories" :value="c.id">
                {{ c.name }}
              </option>
            </select></label
          >
          <p v-if="form.kind === 'income'" class="tiny">
            Una devolución asignada a una partida repone su disponible. Deja la
            nómina sin partida para repartirla después.
          </p>
          <div v-for="(split, i) in form.splits" class="form-row">
            <label
              >Partida<select v-model="split.categoryId" required>
                <option v-for="c in state.categories" :value="c.id">
                  {{ c.name }}
                </option>
              </select></label
            ><label
              >Importe (€)<input
                v-model="split.amount"
                required
                inputmode="decimal" /></label
            ><button
              type="button"
              @click="form.splits.splice(i, 1)"
              aria-label="Quitar desglose"
            >
              <X :size="15" />
            </button>
          </div>
          <button
            type="button"
            class="text-button"
            @click="
              form.splits.push({
                categoryId: form.categoryId || state.categories[0]?.id || '',
                amount: '',
              })
            "
          >
            + Dividir entre partidas
          </button></template
        ></template
      >
      <template v-if="modal === 'reserve'"
        ><p>
          {{ category?.name }} · disponible
          {{ eur(totals.categories[selected] || 0) }}
        </p>
        <label
          >Operación<select v-model="form.release">
            <option :value="false">Asignar desde dinero sin asignar</option>
            <option :value="true">Devolver a dinero sin asignar</option>
          </select></label
        ><label
          >Importe (€)<input v-model="form.amount" required inputmode="decimal"
        /></label>
        <p class="tiny">
          No cambia tu saldo bancario. Solo cambia el propósito de ese dinero.
        </p></template
      >
      <template v-if="modal === 'commitment'"
        ><label
          >Nombre<input
            v-model="form.name"
            required
            maxlength="80"
            placeholder="Seguro, cuotas, regalo…" /></label
        ><label
          >Importe por pago (€)<input
            v-model="form.amount"
            required
            inputmode="decimal"
        /></label>
        <div class="form-row">
          <label
            >Próximo vencimiento<input
              v-model="form.nextDate"
              type="date"
              required /></label
          ><label
            >Frecuencia<select v-model="form.frequency">
              <option value="monthly">Mensual</option>
              <option value="yearly">Anual</option>
              <option value="once">Una vez</option>
            </select></label
          >
        </div>
        <label v-if="form.frequency !== 'once'"
          >Pagos restantes · vacío si indefinido<input
            v-model="form.remaining"
            type="number"
            min="1"
            max="1200" /></label
        ><label
          >Cuenta<select v-model="form.accountId" required>
            <option v-for="a in state.accounts" :value="a.id">
              {{ a.name }}
            </option>
          </select></label
        ><label
          >Partida<select v-model="form.categoryId" required>
            <option v-for="c in state.categories" :value="c.id">
              {{ c.name }}
            </option>
          </select></label
        ></template
      >
      <template v-if="modal === 'income'"
        ><label
          >Nómina o ingreso mensual esperado (€)<input
            v-model="form.amount"
            inputmode="decimal"
            required
        /></label>
        <p class="tiny">
          Es una previsión para comparar con tu plan; no añade dinero a tus
          cuentas.
        </p></template
      ><button class="primary wide" :disabled="busy">
        {{ busy ? "Guardando…" : "Guardar" }}
      </button>
    </form>
    <section v-if="modal === 'import'" class="importer">
      <p class="tiny">
        CSV con fechas, conceptos e importes firmados: negativos para gastos,
        positivos para ingresos. El archivo se procesa en tu navegador; solo se
        guardan los movimientos seleccionados.
      </p>
      <label
        >Cuenta<select v-model="importAccount" @change="importRows = []">
          <option v-for="a in state.accounts" :value="a.id">
            {{ a.name }}
          </option>
        </select></label
      ><input type="file" accept=".csv,text/csv" @change="readCsv" /><template
        v-if="csvFields.length"
        ><div class="form-row">
          <label
            v-for="(label, key) in {
              date: 'Fecha',
              payee: 'Concepto',
              amount: 'Importe',
            }"
            >{{ label
            }}<select v-model="mapping[key]" @change="importRows = []">
              <option value="" disabled>Elige columna</option>
              <option v-for="h in csvFields" :value="h">{{ h }}</option>
            </select></label
          >
        </div>
        <button
          @click="preview"
          :disabled="
            importBusy || !mapping.date || !mapping.payee || !mapping.amount
          "
        >
          {{ importBusy ? "Revisando…" : "Revisar importación" }}
        </button></template
      ><template v-if="importRows.length"
        ><div class="notice">
          {{
            importRows.filter((r) => r.selected && !r.error && !r.duplicate)
              .length
          }}
          seleccionados ·
          {{ importRows.filter((r) => r.duplicate).length }} posibles duplicados
          · {{ importRows.filter((r) => r.error).length }} errores. Comprueba
          compras idénticas y ficheros parcialmente solapados.
        </div>
        <div class="import-preview">
          <label v-for="r in importRows" :key="r.row" class="import-row"
            ><input
              v-model="r.selected"
              type="checkbox"
              :disabled="!!r.error || r.duplicate"
            /><span
              >{{ r.date }} · {{ r.payee
              }}<small v-if="r.error || r.duplicate" class="negative">{{
                r.error || "Ya importado"
              }}</small></span
            ><strong>{{ eur(r.amount) }}</strong></label
          >
        </div>
        <p class="tiny">
          No se deducen traspasos automáticamente. Si importas las dos caras de
          un traspaso, conviértelas en un único traspaso y elimina la otra fila.
        </p>
        <button class="primary wide" @click="finishImport" :disabled="busy">
          Importar seleccionados
        </button></template
      >
    </section>
    <form v-if="modal === 'link'" @submit.prevent="confirmLink">
      <p>Selecciona el gasto existente. No se creará otro movimiento.</p>
      <label
        >Movimiento<select v-model="form.transactionId" required>
          <option value="" disabled>Selecciona</option>
          <option
            v-for="t in state.transactions.filter((t) => {
              const c = state.commitments.find(
                (c) => c.id === form.commitmentId,
              );
              return (
                c &&
                t.kind === 'expense' &&
                t.accountId === c.accountId &&
                t.amount === c.amount &&
                !t.recurrenceKey
              );
            })"
            :value="t.id"
          >
            {{ t.date }} · {{ t.payee }} · {{ eur(t.amount) }}
          </option>
        </select></label
      ><button class="primary wide" :disabled="busy">
        Vincular y avanzar vencimiento
      </button>
    </form>
    <form
      v-if="modal === 'deleteUser'"
      @submit.prevent="
        action(async () => {
          await api('/account', 'DELETE', { password: form.password });
          close();
          user = null;
          state = emptyState();
        })
      "
    >
      <p>
        Se eliminarán definitivamente tu usuario, cuentas, movimientos y planes.
        Exporta antes si quieres conservarlos.
      </p>
      <label
        >Confirma tu contraseña<input
          v-model="form.password"
          type="password"
          required
          minlength="12"
          autocomplete="current-password" /></label
      ><button class="primary danger-bg wide">Eliminar definitivamente</button>
    </form>
  </dialog>
</template>
