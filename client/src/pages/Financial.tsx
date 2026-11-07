import DashboardLayout from "@/components/DashboardLayout";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { EmptyState, ErrorState, LoadingCard, PageHeader, StatCard, StatusBadge } from "@/components/sgpo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL, formatDate, FIN_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { chartDate, chartMoney, chartTheme } from "@/lib/chartTheme";
import { CharCounter, FieldError, MoneyInput } from "@/components/FormFields";
import { SearchSelect } from "@/components/SearchSelect";
import { LIMITS } from "@shared/limits";
import {
  Banknote,
  CalendarX2,
  CheckCircle2,
  CircleDollarSign,
  Edit2,
  Loader2,
  Search,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type TransactionForm = {
  description: string;
  category: string;
  type: "receita" | "despesa";
  /** Valor em centavos */
  amount: number;
  dueDate: string;
  status: "pendente" | "pago" | "cancelado";
  paymentMethod:
    | ""
    | "dinheiro"
    | "pix"
    | "cartao_credito"
    | "cartao_debito"
    | "transferencia"
    | "boleto"
    | "outros";
  notes: string;
};

function toDateInput(ts: number) {
  const d = new Date(ts);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const DEFAULT_CATEGORIES = [
  "Aluguel", "Água", "Energia", "Internet/Telefone", "Fornecedores", "Peças", "Salários",
  "Impostos", "Ferramentas", "Manutenção", "Serviços de oficina", "Outros",
];

const emptyForm: TransactionForm = {
  description: "",
  category: "",
  type: "receita",
  amount: 0,
  dueDate: toDateInput(Date.now()),
  status: "pendente",
  paymentMethod: "",
  notes: "",
};

type TabValue = "todos" | "receitas" | "despesas";

const PAYMENT_METHOD_OPTIONS: { value: TransactionForm["paymentMethod"]; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "outros", label: "Outros" },
];

export default function Financial() {
  const utils = trpc.useUtils();
  const cashFlowPeriod = useMemo(() => {
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      Math.max(1, now.getDate() - 29)
    ).getTime();
    return { from: start, to: Date.now() };
  }, []);
  const { data: cashFlow } = trpc.dashboard.cashFlow.useQuery(cashFlowPeriod);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [tab, setTab] = useState<TabValue>("todos");
  const [status, setStatus] = useState<string>("");
  const statusSelectValue = status || "todos";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TransactionForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const yearMs = 365 * 24 * 60 * 60 * 1000;
  const minDue = toDateInput(Date.now() - LIMITS.financialYearsRange * yearMs + 24 * 60 * 60 * 1000);
  const maxDue = toDateInput(Date.now() + LIMITS.financialYearsRange * yearMs - 24 * 60 * 60 * 1000);

  const queryInput = useMemo(
    () => ({
      type:
        tab === "receitas"
          ? ("receita" as const)
          : tab === "despesas"
            ? ("despesa" as const)
            : undefined,
      status: (status || undefined) as
        | "pendente"
        | "pago"
        | "cancelado"
        | "atrasado"
        | undefined,
      search: search || undefined,
      page: 1,
      limit: 50,
    }),
    [tab, status, search]
  );

  const { data, isLoading, isError } = trpc.financial.list.useQuery(queryInput);
  const isFiltered = Boolean(search || status || tab !== "todos");
  /** Sem nenhum lançamento e sem filtro: o botão de criar fica só no aviso central. */
  const isFirstUse = !isLoading && !isError && !isFiltered && (data?.total ?? 0) === 0;
  const clearFilters = () => {
    setSearch("");
    setSearchInput("");
    setStatus("");
    setTab("todos");
  };
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    (data?.rows ?? []).forEach((t) => t.category && set.add(t.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [data]);

  const invalidate = () => utils.financial.list.invalidate();

  const createMutation = trpc.financial.create.useMutation({
    onSuccess: () => {
      utils.financial.list.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.cashFlow.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Lançamento criado com sucesso");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.financial.update.useMutation({
    onSuccess: () => {
      utils.financial.list.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.cashFlow.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      toast.success("Lançamento atualizado com sucesso");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.financial.delete.useMutation({
    onSuccess: () => {
      utils.financial.list.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.cashFlow.invalidate();
      toast.success("Lançamento removido");
    },
    onError: (e) => toast.error(e.message),
  });
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; description: string } | null>(
    null
  );
  const markPaidMutation = trpc.financial.markPaid.useMutation({
    onSuccess: () => {
      utils.financial.list.invalidate();
      utils.dashboard.summary.invalidate();
      utils.dashboard.cashFlow.invalidate();
      toast.success("Pagamento registrado");
    },
    onError: (e) => toast.error(e.message),
  });

  const now = Date.now();
  const totals = useMemo(() => {
    const rows = data?.rows ?? [];
    return {
      receivable: rows
        .filter((t) => t.type === "receita" && t.status === "pendente")
        .reduce((acc, t) => acc + t.amount, 0),
      payable: rows
        .filter((t) => t.type === "despesa" && t.status === "pendente")
        .reduce((acc, t) => acc + t.amount, 0),
      overdue: rows
        .filter(
          (t) =>
            t.status === "atrasado" ||
            (t.status === "pendente" && t.dueAt < now)
        )
        .reduce((acc, t) => acc + t.amount, 0),
    };
  }, [data, now]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
    setDialogOpen(true);
  }

  function openEdit(id: number) {
    const t = data?.rows.find((r) => r.id === id);
    if (!t) return;
    setEditingId(id);
    setForm({
      description: t.description,
      category: t.category ?? "",
      type: t.type,
      amount: t.amount,
      dueDate: toDateInput(t.dueAt),
      status: t.status === "atrasado" ? "pendente" : t.status,
      paymentMethod: (t.paymentMethod ?? "") as TransactionForm["paymentMethod"],
      notes: t.notes ?? "",
    });
    setFormErrors({});
    setDialogOpen(true);
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (form.description.trim().length < 2) errors.description = "Informe a descrição (mín. 2 caracteres)";
    if (form.amount <= 0) errors.amount = "Informe um valor maior que zero";
    if (!form.dueDate) errors.dueDate = "Informe a data de vencimento";
    else if (form.dueDate < minDue || form.dueDate > maxDue)
      errors.dueDate = `Vencimento deve estar entre ${minDue.split("-").reverse().join("/")} e ${maxDue.split("-").reverse().join("/")}`;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const payload = {
      description: form.description.trim(),
      category: form.category.trim() || null,
      type: form.type,
      amount: form.amount,
      dueAt: new Date(`${form.dueDate}T12:00:00`).getTime(),
      status: form.status,
      paymentMethod: form.paymentMethod || null,
      notes: form.notes.trim() || null,
    } as const;
    if (editingId) updateMutation.mutate({ id: editingId, ...payload });
    else createMutation.mutate(payload);
  }

  function renderTable() {
    if (isLoading) return <LoadingCard />;
    if (isError) return <ErrorState retry={invalidate} />;
    if (!data || data.rows.length === 0)
      return (
        <EmptyState
          title={isFiltered ? "Nenhum lançamento encontrado" : "Nenhum lançamento ainda"}
          description={
            isFiltered
              ? "Nenhum lançamento corresponde à busca ou aos filtros escolhidos."
              : "Registre receitas e despesas para acompanhar o fluxo de caixa da oficina."
          }
          action={isFiltered ? undefined : openCreate}
          actionLabel="Novo lançamento"
          secondaryAction={isFiltered ? clearFilters : undefined}
          secondaryLabel="Limpar filtros"
          icon={<Wallet className="h-6 w-6" />}
        />
      );

    return (
      <div className="rounded-xl border bg-card shadow-soft overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="hidden xl:table-cell">Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="hidden xl:table-cell">Pagamento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((t) => {
              const overdue = t.status === "pendente" && t.dueAt < Date.now();
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 ${
                        t.type === "receita"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                          : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                      }`}
                    >
                      {t.type === "receita" ? "+" : "−"}{" "}
                      {t.type === "receita" ? "Receita" : "Despesa"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-sm">{t.description}</p>
                    {t.sourceType === "ordem_servico" && (
                      <p className="text-xs text-muted-foreground">
                        Gerado automaticamente por OS
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                    {t.category ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={overdue ? "atrasado" : t.status} kind="fin" />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatDate(t.dueAt)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground text-sm">
                    {t.paymentMethod
                      ? PAYMENT_METHOD_LABEL[t.paymentMethod]
                      : "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold tabular-nums whitespace-nowrap ${
                      t.type === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                    }`}
                  >
                    {formatBRL(t.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {t.status === "pendente" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
                          title="Marcar como pago"
                          aria-label="Marcar como pago"
                          onClick={() => markPaidMutation.mutate({ id: t.id })}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                      {t.sourceType === "ordem_servico" ? (
                        <span
                          className="text-[11px] text-muted-foreground px-2"
                          title="Gerado pela OS — altere reabrindo ou cancelando a OS"
                        >
                          via OS
                        </span>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Editar lançamento"
                            aria-label="Editar lançamento"
                            onClick={() => openEdit(t.id)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Excluir lançamento"
                            aria-label="Excluir lançamento"
                            onClick={() => setDeleteTarget({ id: t.id, description: t.description })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Financeiro"
        subtitle={`${data?.total ?? ""} ${data?.total === 1 ? "lançamento" : "lançamentos"}`}
        action={!isFirstUse}
        actionLabel="Novo lançamento"
        onAction={openCreate}
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        <StatCard
          label="A receber"
          value={formatBRL(totals.receivable)}
          hint="receitas pendentes"
          icon={<CircleDollarSign className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="A pagar"
          value={formatBRL(totals.payable)}
          hint="despesas pendentes"
          icon={<Banknote className="h-4 w-4" />}
          tone="muted"
        />
        <StatCard
          label="Vencidos"
          value={<span className={totals.overdue > 0 ? "text-destructive" : undefined}>{formatBRL(totals.overdue)}</span>}
          hint={totals.overdue > 0 ? "precisam de atenção" : "nada vencido"}
          icon={<CalendarX2 className="h-4 w-4" />}
          tone="flame"
        />
      </div>

      <Card className="mb-6 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-navy" /> Fluxo de caixa (últimos 30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cashFlow && cashFlow.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={cashFlow}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={chartTheme.axis}
                  tickFormatter={chartDate}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                />
                <YAxis
                  tick={chartTheme.axis}
                  tickFormatter={chartMoney}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatBRL(value),
                    name === "income" ? "Receitas" : "Despesas",
                  ]}
                  labelFormatter={(v) => chartDate(String(v))}
                  contentStyle={chartTheme.tooltip.contentStyle}
                  labelStyle={chartTheme.tooltip.labelStyle}
                  itemStyle={chartTheme.tooltip.itemStyle}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#incomeGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#expenseGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
              Nenhum lançamento no período para exibir o gráfico.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="inline-flex items-center rounded-lg border bg-card p-1 shadow-soft">
          {(["todos", "receitas", "despesas"] as TabValue[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-navy text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "todos" ? "Todos" : t === "receitas" ? "Receitas" : "Despesas"}
            </button>
          ))}
        </div>
        <div className="relative min-w-60 flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            maxLength={LIMITS.search}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput.trim())}
            placeholder="Buscar por descrição ou categoria"
            className="pl-9"
          />
          {search && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs text-muted-foreground"
              onClick={() => {
                setSearch("");
                setSearchInput("");
              }}
            >
              Limpar
            </Button>
          )}
        </div>
        <Select value={statusSelectValue} onValueChange={(v) => setStatus(v === "todos" ? "" : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {Object.entries(FIN_STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {renderTable()}

      {/* Diálogo lançamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? "Editar lançamento" : "Novo lançamento"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Atualize os dados do lançamento financeiro."
                : "Registre uma receita ou despesa da oficina."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm({ ...form, type: v as "receita" | "despesa" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <SearchSelect
                  items={categoryOptions.map((c) => ({ value: c, label: c }))}
                  value={form.category}
                  placeholder="Selecione ou crie"
                  searchPlaceholder="Digite a categoria"
                  emptyText="Categoria nova."
                  allowCustom
                  customMaxLength={LIMITS.shortText}
                  onSelect={(item) => setForm({ ...form, category: item.label })}
                  onCustom={(text) => setForm({ ...form, category: text })}
                />
              </div>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input
                value={form.description}
                maxLength={LIMITS.description}
                aria-invalid={Boolean(formErrors.description) || undefined}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex.: Conta de energia de março"
              />
              <FieldError message={formErrors.description} />
              <CharCounter value={form.description} max={LIMITS.description} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor *</Label>
                <MoneyInput
                  value={form.amount}
                  aria-invalid={Boolean(formErrors.amount) || undefined}
                  onChange={(v) => setForm({ ...form, amount: v })}
                />
                <FieldError message={formErrors.amount} />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  min={minDue}
                  max={maxDue}
                  aria-invalid={Boolean(formErrors.dueDate) || undefined}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
                <FieldError message={formErrors.dueDate} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as TransactionForm["status"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Select
                  value={form.paymentMethod || "none"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      paymentMethod:
                        (v === "none" ? "" : v) as TransactionForm["paymentMethod"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {PAYMENT_METHOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input
                value={form.notes}
                maxLength={LIMITS.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Informações complementares"
              />
              <CharCounter value={form.notes} max={LIMITS.notes} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className={
                form.type === "receita"
                  ? "bg-flame hover:bg-flame/90 text-white"
                  : "bg-navy text-primary-foreground hover:bg-navy/90"
              }
              onClick={submit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {editingId ? "Salvar alterações" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir lançamento?"
        description={
          deleteTarget
            ? `O lançamento "${deleteTarget.description}" será removido permanentemente. Essa ação não pode ser desfeita.`
            : undefined
        }
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate({ id: deleteTarget.id });
            setDeleteTarget(null);
          }
        }}
      />
    </DashboardLayout>
  );
}
