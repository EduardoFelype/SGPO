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
import { formatBRL, STOCK_TYPE_LABEL } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowDownUp,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ProductForm = {
  code: string;
  name: string;
  category: string;
  brand: string;
  supplier: string;
  unit: string;
  quantity: string;
  minStock: string;
  costPrice: string;
  salePrice: string;
  description: string;
};

const emptyForm: ProductForm = {
  code: "",
  name: "",
  category: "",
  brand: "",
  supplier: "",
  unit: "un",
  quantity: "0",
  minStock: "0",
  costPrice: "",
  salePrice: "",
  description: "",
};

type MovementForm = {
  productId: string;
  type: "entrada" | "saida" | "ajuste";
  quantity: string;
  description: string;
};

const emptyMovement: MovementForm = {
  productId: "",
  type: "entrada",
  quantity: "",
  description: "",
};

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

  const invalidate = () => utils.stock.list.invalidate();

  const createMutation = trpc.stock.create.useMutation({
    onSuccess: () => {
      utils.stock.list.invalidate();
      utils.stock.lowStock.invalidate();
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
      unit: p.unit,
      quantity: String(p.quantity),
      minStock: String(p.minStock),
      costPrice: String(p.costPrice),
      salePrice: String(p.salePrice),
      description: p.description ?? "",
    });
    setFormErrors({});
    setDialogOpen(true);
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Informe o nome do produto";
    if (!form.salePrice || Number(form.salePrice) <= 0)
      errors.salePrice = "Informe o preço de venda válido (em R$)";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submitProduct() {
    if (!validate()) return;
    const payload = {
      code: form.code.trim() || null,
      name: form.name.trim(),
      category: form.category.trim() || null,
      brand: form.brand.trim() || null,
      supplier: form.supplier.trim() || null,
      description: form.description.trim() || null,
      unit: form.unit,
      quantity: Number(form.quantity) || 0,
      minStock: Number(form.minStock) || 0,
      costPrice: Math.round((Number(form.costPrice) || 0) * 100),
      salePrice: Math.round(Number(form.salePrice) * 100),
    };
    if (editingId) updateMutation.mutate({ id: editingId, ...payload });
    else createMutation.mutate(payload);
  }

  function submitMovement() {
    if (!moveForm.productId || !moveForm.quantity || Number(moveForm.quantity) <= 0) {
      toast.error("Selecione o produto e informe a quantidade");
      return;
    }
    moveMutation.mutate({
      productId: Number(moveForm.productId),
      type: moveForm.type,
      quantity: Number(moveForm.quantity),
      description: moveForm.description.trim() || null,
    });
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Estoque"
        subtitle={data ? `${data.total} ${data.total === 1 ? "produto" : "produtos"}` : ""}
        action
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
            <Card className="mb-4 border-orange-200 bg-orange-50 shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-display flex items-center gap-2 text-orange-700">
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
                      className="inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-white px-3 py-1 text-xs font-medium text-orange-800"
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
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
                placeholder="Buscar por nome, código ou fornecedor"
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
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>

          {isLoading && <LoadingCard />}
          {isError && <ErrorState retry={invalidate} />}

          {!isLoading && !isError && (data?.rows.length ?? 0) === 0 && (
            <EmptyState
              title="Nenhum produto cadastrado"
              description="Cadastre peças e materiais para controlar o estoque da oficina."
              action={openCreate}
              actionLabel="Cadastrar produto"
              icon={<Package className="h-6 w-6" />}
            />
          )}

          {data && data.rows.length > 0 && (
            <div className="rounded-xl border bg-card shadow-soft overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-right">Mín.</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Venda</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">
                        {p.code ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-7 w-7 shrink-0 rounded-lg flex items-center justify-center ${
                              p.quantity <= p.minStock
                                ? "bg-orange-100 text-orange-600"
                                : "bg-navy/5 text-navy"
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
                      <TableCell className="text-muted-foreground text-sm">
                        {p.category ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.supplier ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-semibold ${
                            p.quantity <= p.minStock
                              ? "text-orange-600"
                              : "text-navy"
                          }`}
                        >
                          {p.quantity} {p.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {p.minStock}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {formatBRL(p.costPrice)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatBRL(p.salePrice)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Registrar movimentação"
                            onClick={() => {
                              setMoveForm({
                                productId: String(p.id),
                                type: "entrada",
                                quantity: "",
                                description: "",
                              });
                              setMoveOpen(true);
                            }}
                          >
                            <ArrowDownUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(p.id)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                          >
                            <Minus className="h-3.5 w-3.5" />
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
                          {m.type === "entrada" ? "+" : m.type === "saida" ? "−" : "±"}
                          {m.quantity}
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
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Óleo de motor 5W30"
              />
              {formErrors.name && (
                <p className="text-xs text-destructive mt-1">{formErrors.name}</p>
              )}
            </div>
            <div>
              <Label>Código</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Ex.: OLE-001"
              />
            </div>
            <div>
              <Label>Unidade</Label>
              <Select
                value={form.unit}
                onValueChange={(v) => setForm({ ...form, unit: v })}
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
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Ex.: Lubrificantes"
              />
            </div>
            <div>
              <Label>Marca</Label>
              <Input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Ex.: Mobil"
              />
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="Ex.: Auto Peças ABC"
              />
            </div>
            <div>
              <Label>Quantidade em estoque</Label>
              <Input
                inputMode="numeric"
                value={form.quantity}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, quantity: raw });
                }}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Estoque mínimo</Label>
              <Input
                inputMode="numeric"
                value={form.minStock}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, minStock: raw });
                }}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Custo (R$)</Label>
              <Input
                inputMode="decimal"
                value={form.costPrice}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.,]/g, "");
                  setForm({ ...form, costPrice: val });
                }}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Preço de venda (R$) *</Label>
              <Input
                inputMode="decimal"
                value={form.salePrice}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.,]/g, "");
                  setForm({ ...form, salePrice: val });
                }}
                placeholder="0,00"
              />
              {formErrors.salePrice && (
                <p className="text-xs text-destructive mt-1">{formErrors.salePrice}</p>
              )}
            </div>
            <div className="col-span-2">
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Informações complementares"
              />
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
              <Select
                value={moveForm.productId}
                onValueChange={(v) => setMoveForm({ ...moveForm, productId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.rows ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} (est. {p.quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select
                value={moveForm.type}
                onValueChange={(v) =>
                  setMoveForm({
                    ...moveForm,
                    type: v as MovementForm["type"],
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
            </div>
            <div>
              <Label>Quantidade *</Label>
              <Input
                inputMode="numeric"
                value={moveForm.quantity}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setMoveForm({ ...moveForm, quantity: raw });
                }}
                placeholder="Ex.: 10"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={moveForm.description}
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
