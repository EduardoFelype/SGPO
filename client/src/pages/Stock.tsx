import DashboardLayout from "@/components/DashboardLayout";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { EmptyState, ErrorState, LoadingCard, PageHeader, StatusBadge } from "@/components/sgpo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CharCounter, FieldError, FieldHint, IntegerInput, MoneyInput } from "@/components/FormFields";
import { SearchSelect } from "@/components/SearchSelect";
import { Textarea } from "@/components/ui/textarea";
import { formatBRL, STOCK_TYPE_LABEL } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { LIMITS } from "@shared/limits";
import {
  AlertTriangle,
  ArrowDownUp,
  Edit2,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const DEFAULT_CATEGORIES = [
  "Lubrificantes", "Filtros", "Freios", "Suspensão", "Elétrica", "Motor", "Arrefecimento",
  "Ignição", "Pneus", "Baterias", "Acessórios",
];

type Unit = "un" | "cx" | "lt" | "pc" | "kit";

/** Preços em centavos; quantidades como inteiros. */
type ProductForm = {
  code: string;
  name: string;
  category: string;
  brand: string;
  supplier: string;
  unit: Unit;
  quantity: number | null;
  minStock: number | null;
  costPrice: number;
  salePrice: number;
  description: string;
};

const emptyForm: ProductForm = {
  code: "",
  name: "",
  category: "",
  brand: "",
  supplier: "",
  unit: "un",
  quantity: 0,
  minStock: 0,
  costPrice: 0,
  salePrice: 0,
  description: "",
};

type MovementForm = {
  productId: string;
  type: "entrada" | "saida" | "ajuste";
  quantity: number | null;
  description: string;
};

const emptyMovement: MovementForm = {
  productId: "",
  type: "entrada",
  quantity: null,
  description: "",
};

const UNITS: Unit[] = ["un", "cx", "lt", "pc", "kit"];

export default function Stock() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveForm, setMoveForm] = useState<MovementForm>(emptyMovement);

  const { data, isLoading, isError } = trpc.stock.list.useQuery({
    search: search || undefined,
    page: 1,
    limit: 50,
  });
  const { data: lowStock } = trpc.stock.lowStock.useQuery();
  const { data: movements } = trpc.stock.movements.useQuery({ page: 1, limit: 30 });
  const { data: allProducts } = trpc.stock.listAll.useQuery({});

  /** Categorias e fornecedores já usados — o usuário escolhe em vez de redigitar. */
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    (allProducts ?? []).forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allProducts]);
  const supplierOptions = useMemo(() => {
    const set = new Set<string>();
    (allProducts ?? []).forEach((p) => p.supplier && set.add(p.supplier));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allProducts]);

  const invalidate = () => utils.stock.list.invalidate();

  const createMutation = trpc.stock.create.useMutation({
    onSuccess: () => {
      utils.stock.list.invalidate();
      utils.stock.lowStock.invalidate();
      utils.stock.listAll.invalidate();
      utils.stock.movements.invalidate();
      utils.dashboard.summary.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Produto cadastrado com sucesso");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.stock.update.useMutation({
    onSuccess: () => {
      utils.stock.list.invalidate();
      utils.stock.lowStock.invalidate();
      utils.stock.listAll.invalidate();
      utils.stock.movements.invalidate();
      utils.dashboard.summary.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      toast.success("Produto atualizado com sucesso");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.stock.delete.useMutation({
    onSuccess: () => {
      utils.stock.list.invalidate();
      utils.stock.lowStock.invalidate();
      utils.stock.listAll.invalidate();
      utils.stock.movements.invalidate();
      utils.dashboard.summary.invalidate();
      toast.success("Produto removido");
    },
    onError: (e) => toast.error(e.message),
  });
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(
    null
  );
  const moveMutation = trpc.stock.movement.useMutation({
    onSuccess: () => {
      utils.stock.movements.invalidate();
      utils.stock.list.invalidate();
      utils.stock.lowStock.invalidate();
      utils.stock.listAll.invalidate();
      utils.stock.movements.invalidate();
      utils.dashboard.summary.invalidate();
      setMoveOpen(false);
      setMoveForm(emptyMovement);
      toast.success("Movimentação registrada");
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
    setDialogOpen(true);
  }

  function openEdit(id: number) {
    const p = data?.rows.find((r) => r.id === id);
    if (!p) return;
    setEditingId(id);
    setForm({
      code: p.code ?? "",
      name: p.name,
      category: p.category ?? "",
      brand: p.brand ?? "",
      supplier: p.supplier ?? "",
      unit: (UNITS.includes(p.unit as Unit) ? p.unit : "un") as Unit,
      quantity: p.quantity,
      minStock: p.minStock,
      costPrice: p.costPrice,
      salePrice: p.salePrice,
      description: p.description ?? "",
    });
    setFormErrors({});
    setDialogOpen(true);
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (form.name.trim().length < 2) errors.name = "Informe o nome do produto (mín. 2 caracteres)";
    if (form.salePrice <= 0) errors.salePrice = "Informe o preço de venda";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submitProduct() {
    if (!validate()) return;
    const payload = {
      code: form.code.trim().toUpperCase() || null,
      name: form.name.trim(),
      category: form.category.trim() || null,
      brand: form.brand.trim() || null,
      supplier: form.supplier.trim() || null,
      description: form.description.trim() || null,
      unit: form.unit,
      quantity: form.quantity ?? 0,
      minStock: form.minStock ?? 0,
      costPrice: form.costPrice,
      salePrice: form.salePrice,
    };
    if (editingId) updateMutation.mutate({ id: editingId, ...payload });
    else createMutation.mutate(payload);
  }

  const moveProduct = data?.rows.find((p) => String(p.id) === moveForm.productId);
  /** Quanto pode ser movimentado sem estourar regras: saída ≤ estoque; entrada ≤ teto. */
  const moveMax = moveProduct
    ? moveForm.type === "saida"
      ? moveProduct.quantity
      : moveForm.type === "entrada"
        ? Math.max(0, LIMITS.stockQuantityMax - moveProduct.quantity)
        : LIMITS.stockQuantityMax
    : LIMITS.stockQuantityMax;

  function submitMovement() {
    if (!moveForm.productId) {
      toast.error("Selecione o produto");
      return;
    }
    if (moveForm.quantity == null || (moveForm.type !== "ajuste" && moveForm.quantity <= 0)) {
      toast.error("Informe a quantidade");
      return;
    }
    moveMutation.mutate({
      productId: Number(moveForm.productId),
      type: moveForm.type,
      quantity: moveForm.quantity,
      description: moveForm.description.trim() || null,
    });
  }

  /** Sem nenhum produto e sem busca: o botão de criar fica só no aviso central. */
  const isFirstUse = !isLoading && !isError && !search && (data?.total ?? 0) === 0;

  return (
    <DashboardLayout>
      <PageHeader
        title="Estoque"
        subtitle={data ? `${data.total} ${data.total === 1 ? "produto" : "produtos"}` : ""}
        action={!isFirstUse}
        actionLabel="Novo produto"
        onAction={openCreate}
      />

      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="movimentos" className="gap-1.5">
            <ArrowDownUp className="h-3.5 w-3.5" /> Movimentações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos">
          {/* Alerta estoque mínimo */}
          {lowStock && lowStock.length > 0 && (
            <Card className="mb-4 border-orange-200 bg-orange-50 shadow-soft dark:border-orange-500/30 dark:bg-orange-500/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2 text-orange-700 dark:text-orange-300">
                  <AlertTriangle className="h-4 w-4" />
                  Estoque mínimo ({lowStock.length})
                </CardTitle>
                <CardDescription>
                  Produtos abaixo do nível mínimo de estoque
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {lowStock.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-white px-3 py-1 text-xs font-medium text-orange-800 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200"
                    >
                      {p.name}
                      <span className="font-bold">({p.quantity}/{p.minStock})</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchInput}
                maxLength={LIMITS.search}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput.trim())}
                placeholder="Buscar por nome, código, marca ou fornecedor"
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
          </div>

          {isLoading && <LoadingCard />}
          {isError && <ErrorState retry={invalidate} />}

          {!isLoading && !isError && (data?.rows.length ?? 0) === 0 && (
            <EmptyState
              title={search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
              description={
                search
                  ? `Nenhum resultado para “${search}”.`
                  : "Cadastre peças e materiais para controlar o estoque da oficina."
              }
              action={search ? undefined : openCreate}
              actionLabel="Cadastrar produto"
              secondaryAction={
                search
                  ? () => {
                      setSearch("");
                      setSearchInput("");
                    }
                  : undefined
              }
              icon={<Package className="h-6 w-6" />}
            />
          )}

          {data && data.rows.length > 0 && (
            <div className="rounded-xl border bg-card shadow-soft overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden lg:table-cell">Código</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="hidden lg:table-cell">Categoria</TableHead>
                    <TableHead className="hidden xl:table-cell">Fornecedor</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right hidden xl:table-cell">Mín.</TableHead>
                    <TableHead className="text-right hidden xl:table-cell">Custo</TableHead>
                    <TableHead className="text-right">Venda</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs hidden lg:table-cell">
                        {p.code ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-7 w-7 shrink-0 rounded-lg flex items-center justify-center ${
                              p.quantity <= p.minStock
                                ? "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300"
                                : "bg-navy/5 text-navy dark:bg-white/5"
                            }`}
                          >
                            <Package className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{p.name}</p>
                            {p.brand && (
                              <p className="text-xs text-muted-foreground">{p.brand}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden lg:table-cell">
                        {p.category ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm hidden xl:table-cell">
                        {p.supplier ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-semibold ${
                            p.quantity <= p.minStock
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-navy dark:text-foreground"
                          } whitespace-nowrap`}
                        >
                          {p.quantity} {p.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm hidden xl:table-cell">
                        {p.minStock}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm whitespace-nowrap hidden xl:table-cell">
                        {formatBRL(p.costPrice)}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">
                        {formatBRL(p.salePrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Registrar movimentação"
                            aria-label="Registrar movimentação"
                            onClick={() => {
                              setMoveForm({
                                productId: String(p.id),
                                type: "entrada",
                                quantity: null,
                                description: "",
                              });
                              setMoveOpen(true);
                            }}
                          >
                            <ArrowDownUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Editar produto"
                            aria-label="Editar produto"
                            onClick={() => openEdit(p.id)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Excluir produto"
                            aria-label="Excluir produto"
                            onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="movimentos">
          <Card className="shadow-soft">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-display">
                  Histórico de movimentações
                </CardTitle>
                <CardDescription>
                  Entradas, saídas e ajustes de estoque
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setMoveOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Nova movimentação
              </Button>
            </CardHeader>
            <CardContent>
              {!movements || movements.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma movimentação registrada.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Saldo após</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.rows.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.occurredAt
                            ? new Date(m.occurredAt).toLocaleString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={m.type} kind="stock" />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.reason === "ordem_servico" ? "Ordem de serviço" : "Manual"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {m.description ?? "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            m.type === "entrada"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : m.type === "saida"
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          {m.type === "entrada" ? "+" : m.type === "saida" ? "−" : "="}
                          {Math.abs(m.quantity)}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {m.balanceAfter}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo produto */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? "Editar produto" : "Novo produto"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Atualize os dados do produto."
                : "Cadastre uma peça ou material para o estoque."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-2">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                maxLength={LIMITS.nameMax}
                aria-invalid={Boolean(formErrors.name) || undefined}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Óleo de motor 5W30"
              />
              <FieldError message={formErrors.name} />
              <CharCounter value={form.name} max={LIMITS.nameMax} />
            </div>
            <div>
              <Label>Código</Label>
              <Input
                value={form.code}
                maxLength={LIMITS.productCode}
                className="uppercase"
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9._/-]/g, "") })
                }
                placeholder="Ex.: OLE-001"
              />
              <FieldHint>Letras, números, “-”, “.” e “/” — não pode repetir</FieldHint>
            </div>
            <div>
              <Label>Unidade</Label>
              <Select
                value={form.unit}
                onValueChange={(v) => setForm({ ...form, unit: v as Unit })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="un">Unidade (un)</SelectItem>
                  <SelectItem value="cx">Caixa (cx)</SelectItem>
                  <SelectItem value="lt">Litro (lt)</SelectItem>
                  <SelectItem value="pc">Peça (pc)</SelectItem>
                  <SelectItem value="kit">Kit</SelectItem>
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
            <div>
              <Label>Marca</Label>
              <Input
                value={form.brand}
                maxLength={LIMITS.shortText}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Ex.: Mobil"
              />
            </div>
            <div className="col-span-2">
              <Label>Fornecedor</Label>
              <SearchSelect
                items={supplierOptions.map((s) => ({ value: s, label: s }))}
                value={form.supplier}
                placeholder="Selecione ou cadastre"
                searchPlaceholder="Digite o fornecedor"
                emptyText="Fornecedor novo."
                allowCustom
                customMaxLength={LIMITS.shortText}
                onSelect={(item) => setForm({ ...form, supplier: item.label })}
                onCustom={(text) => setForm({ ...form, supplier: text })}
              />
            </div>
            <div>
              <Label>Quantidade em estoque</Label>
              <IntegerInput
                value={form.quantity}
                max={LIMITS.stockQuantityMax}
                suffix={form.unit}
                onChange={(v) => setForm({ ...form, quantity: v })}
                placeholder="0"
              />
              <FieldHint>
                {editingId ? "Alterar aqui registra um ajuste no histórico" : `Máx. ${LIMITS.stockQuantityMax.toLocaleString("pt-BR")}`}
              </FieldHint>
            </div>
            <div>
              <Label>Estoque mínimo</Label>
              <IntegerInput
                value={form.minStock}
                max={LIMITS.stockQuantityMax}
                suffix={form.unit}
                onChange={(v) => setForm({ ...form, minStock: v })}
                placeholder="0"
              />
              <FieldHint>Avisa quando o estoque chegar nesse valor</FieldHint>
            </div>
            <div>
              <Label>Custo</Label>
              <MoneyInput value={form.costPrice} onChange={(v) => setForm({ ...form, costPrice: v })} />
            </div>
            <div>
              <Label>Preço de venda *</Label>
              <MoneyInput
                value={form.salePrice}
                aria-invalid={Boolean(formErrors.salePrice) || undefined}
                onChange={(v) => setForm({ ...form, salePrice: v })}
              />
              {formErrors.salePrice ? (
                <FieldError message={formErrors.salePrice} />
              ) : form.costPrice > 0 && form.salePrice > 0 ? (
                <p
                  className={`text-[11px] mt-1 ${form.salePrice < form.costPrice ? "text-amber-600" : "text-muted-foreground"}`}
                >
                  {form.salePrice < form.costPrice
                    ? "Atenção: preço de venda abaixo do custo"
                    : `Margem: ${(((form.salePrice - form.costPrice) / form.salePrice) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                </p>
              ) : null}
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                maxLength={LIMITS.notes}
                rows={2}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Informações complementares"
              />
              <CharCounter value={form.description} max={LIMITS.notes} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-flame hover:bg-flame/90 text-white"
              onClick={submitProduct}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {editingId ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo movimentação */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Nova movimentação</DialogTitle>
            <DialogDescription>
              Registre uma entrada, saída ou ajuste manual de estoque.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Produto *</Label>
              <SearchSelect
                items={(data?.rows ?? []).map((p) => ({
                  value: String(p.id),
                  label: p.name,
                  hint: `est. ${p.quantity} ${p.unit}`,
                }))}
                value={moveProduct?.name ?? ""}
                placeholder="Selecione o produto"
                searchPlaceholder="Nome do produto"
                emptyText="Produto não encontrado."
                onSelect={(item) => setMoveForm({ ...moveForm, productId: item.value, quantity: null })}
              />
              {moveProduct && (
                <FieldHint>
                  Estoque atual: {moveProduct.quantity} {moveProduct.unit} · mínimo {moveProduct.minStock}
                </FieldHint>
              )}
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select
                value={moveForm.type}
                onValueChange={(v) =>
                  setMoveForm({
                    ...moveForm,
                    type: v as MovementForm["type"],
                    quantity: null,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STOCK_TYPE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldHint>
                {moveForm.type === "entrada"
                  ? "Soma ao estoque (compra, devolução)"
                  : moveForm.type === "saida"
                    ? "Subtrai do estoque (perda, uso interno)"
                    : "Define a quantidade exata após uma contagem"}
              </FieldHint>
            </div>
            <div>
              <Label>{moveForm.type === "ajuste" ? "Nova quantidade *" : "Quantidade *"}</Label>
              <IntegerInput
                value={moveForm.quantity}
                max={moveMax}
                suffix={moveProduct?.unit}
                disabled={!moveProduct || (moveForm.type === "saida" && moveMax === 0)}
                onChange={(v) => setMoveForm({ ...moveForm, quantity: v })}
                placeholder={moveForm.type === "ajuste" ? "Quantidade contada" : "Ex.: 10"}
              />
              {moveProduct && (
                <FieldHint>
                  {moveForm.type === "saida" && moveMax === 0
                    ? "Sem estoque para saída"
                    : `Máximo: ${moveMax.toLocaleString("pt-BR")} ${moveProduct.unit}`}
                  {moveForm.quantity != null && moveForm.type !== "ajuste" && (
                    <>
                      {" "}· ficará com{" "}
                      {moveForm.type === "entrada"
                        ? moveProduct.quantity + moveForm.quantity
                        : moveProduct.quantity - moveForm.quantity}{" "}
                      {moveProduct.unit}
                    </>
                  )}
                </FieldHint>
              )}
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={moveForm.description}
                maxLength={LIMITS.description}
                onChange={(e) =>
                  setMoveForm({ ...moveForm, description: e.target.value })
                }
                placeholder="Ex.: Compra de fornecedor"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-navy text-primary-foreground hover:bg-navy/90"
              onClick={submitMovement}
              disabled={moveMutation.isPending}
            >
              {moveMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir produto?"
        description={
          deleteTarget
            ? `O produto "${deleteTarget.name}" será removido permanentemente. Essa ação não pode ser desfeita.`
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
