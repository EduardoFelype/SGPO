import DashboardLayout from "@/components/DashboardLayout";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { EmptyState, ErrorState, LoadingCard, PageHeader, StatusBadge } from "@/components/sgpo";
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
import {
  Banknote,
  CalendarX2,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Minus,
  Plus,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type TransactionForm = {
  description: string;
  category: string;
  type: "receita" | "despesa";
  amount: string;
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

const emptyForm: TransactionForm = {
  description: "",
  category: "",
  type: "receita",
  amount: "",
  dueDate: new Date().toISOString().slice(0, 10),
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
      amount: String(t.amount / 100),
      dueDate: new Date(t.dueAt).toISOString().slice(0, 10),
      status: t.status === "atrasado" ? "pendente" : t.status,
      paymentMethod: (t.paymentMethod ?? "") as TransactionForm["paymentMethod"],
      notes: t.notes ?? "",
    });
    setFormErrors({});
    setDialogOpen(true);
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.description.trim()) errors.description = "Informe a descrição";
    if (!form.amount || Number(form.amount) <= 0)
      errors.amount = "Informe um valor válido (em R$)";
    if (!form.dueDate) errors.dueDate = "Informe a data de vencimento";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const payload = {
      description: form.description.trim(),
      category: form.category.trim() || null,
      type: form.type,
      amount: Math.round(Number(form.amount) * 100),
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
          title="Nenhum lançamento encontrado"
          description="Registre receitas e despesas para acompanhar o fluxo de caixa da oficina."
          action={openCreate}
          actionLabel="Novo lançamento"
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
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Pagamento</TableHead>
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
                  <TableCell className="text-muted-foreground text-sm">
                    {t.category ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={overdue ? "atrasado" : t.status} kind="fin" />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(t.dueAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t.paymentMethod
                      ? PAYMENT_METHOD_LABEL[t.paymentMethod]
                      : "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
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
                          size="sm"
                          className="text-emerald-600 dark:text-emerald-400"
                          title="Marcar como pago"
                          onClick={() => markPaidMutation.mutate({ id: t.id })}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(t.id)}>
                        Editar
                      </Button>
                      {t.sourceType !== "ordem_servico" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeleteTarget({ id: t.id, description: t.description })}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
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
        action
        actionLabel="Novo lançamento"
        onAction={openCreate}
      />

      <Card className="mb-4 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-navy" /> Fluxo de caixa (últimos 30 dias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cashFlow && cashFlow.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(0, 5)}
                  stroke="#94a3b8"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `R$ ${Math.round(v / 100)}`}
                  stroke="#94a3b8"
                  width={72}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatBRL(value),
                    name === "income" ? "Receitas" : "Despesas",
                  ]}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
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
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
              Nenhum lançamento no período para exibir o gráfico.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Card className="shadow-soft border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2 text-emerald-700">
              <CircleDollarSign className="h-4 w-4" /> A receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold text-navy">
              {formatBRL(totals.receivable)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2 text-destructive">
              <Banknote className="h-4 w-4" /> A pagar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold text-navy">
              {formatBRL(totals.payable)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2 text-orange-700">
              <CalendarX2 className="h-4 w-4" /> Vencidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold text-orange-700">
              {formatBRL(totals.overdue)}
            </p>
          </CardContent>
        </Card>
      </div>

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
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
            placeholder="Buscar lançamentos"
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
        <Button variant="outline" size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
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
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Ex.: Peças, Aluguel..."
                />
              </div>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex.: Pagamento OS #1234"
              />
              {formErrors.description && (
                <p className="text-xs text-destructive mt-1">
                  {formErrors.description}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <Input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.,]/g, "");
                    setForm({ ...form, amount: val });
                  }}
                  placeholder="0,00"
                />
                {formErrors.amount && (
                  <p className="text-xs text-destructive mt-1">{formErrors.amount}</p>
                )}
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
                {formErrors.dueDate && (
                  <p className="text-xs text-destructive mt-1">{formErrors.dueDate}</p>
                )}
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
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Informações complementares"
              />
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
