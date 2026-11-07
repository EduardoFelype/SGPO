import DashboardLayout from "@/components/DashboardLayout";
import { CharCounter, FieldError, FieldHint, IntegerInput, MoneyInput } from "@/components/FormFields";
import { SearchSelect } from "@/components/SearchSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatBRL, formatMileage } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import OsPhotosSection from "@/components/OsPhotosSection";
import { DAY_MS, LIMITS } from "@shared/limits";
import { AlertTriangle, CalendarClock, Loader2, Lock, Minus, Plus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";

/** Todos os valores monetários deste formulário estão em centavos. */
type ServiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

type ProductItem = {
  productId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

const emptyService: ServiceItem = { description: "", quantity: 1, unitPrice: 0 };
const emptyProduct: ProductItem = {
  productId: null,
  description: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
};

function toDateInput(ts: number) {
  const d = new Date(ts);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export default function ServiceOrderForm() {
  const params = useParams<{ id?: string }>();
  const editingId = params.id ? Number(params.id) : null;
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const isNew = editingId === null;

  const { data: editingData, isLoading: loadingEditing } = trpc.serviceOrders.get.useQuery(
    { id: editingId ?? 1 },
    { enabled: !isNew }
  );

  const { data: customers, isLoading: loadingCustomers } = trpc.customers.list.useQuery({ page: 1, limit: 100 });
  const [customerId, setCustomerId] = useState<string>("");
  const { data: vehicles, isLoading: loadingVehicles } = trpc.vehicles.listByCustomer.useQuery(
    { customerId: Number(customerId) },
    { enabled: Boolean(customerId) }
  );
  const { data: products, isLoading: loadingProducts } = trpc.stock.listAll.useQuery({});

  const [vehicleId, setVehicleId] = useState<string>("");
  const [predictedDate, setPredictedDate] = useState<string>("");
  const [mileage, setMileage] = useState<number | null>(null);
  const [diagnostics, setDiagnostics] = useState<string>("");
  const [observations, setObservations] = useState<string>("");
  const [services, setServices] = useState<ServiceItem[]>([emptyService]);
  const [productItems, setProductItems] = useState<ProductItem[]>([emptyProduct]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && editingData && !isNew) {
      setInitialized(true);

      setCustomerId(String(editingData.os.customerId));
      setVehicleId(String(editingData.os.vehicleId));

      if (editingData.os.predictedAt) {
        setPredictedDate(toDateInput(editingData.os.predictedAt));
      }

      if (editingData.os.mileage != null) {
        setMileage(editingData.os.mileage);
      }

      setDiagnostics(editingData.os.diagnostics ?? "");
      setObservations(editingData.os.observations ?? "");

      setServices(
        editingData.services.length > 0
          ? editingData.services.map((s) => ({
              description: s.description,
              quantity: s.quantity,
              unitPrice: s.unitPrice,
            }))
          : [emptyService]
      );

      setProductItems(
        editingData.products.length > 0
          ? editingData.products.map((p) => ({
              productId: p.productId,
              description: p.description,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
              discount: p.discount ?? 0,
            }))
          : [emptyProduct]
      );
    }
  }, [editingData, initialized, isNew]);

  const createMutation = trpc.serviceOrders.create.useMutation({
    onSuccess: (res) => {
      utils.serviceOrders.list.invalidate();
      toast.success("OS criada com sucesso");
      setLocation(`/os/${res.os.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Estado para exibir a seção de fotos (aparece após a OS ser criada)
  const [createdOsId, setCreatedOsId] = useState<number | null>(isNew ? null : editingId);
  const updateMutation = trpc.serviceOrders.update.useMutation({
    onSuccess: (res) => {
      utils.serviceOrders.get.invalidate({ id: editingId! });
      utils.serviceOrders.list.invalidate();
      toast.success("OS atualizada com sucesso");
      setLocation(`/os/${res.os.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const lineTotal = (p: ProductItem) => Math.max(0, p.quantity * p.unitPrice - p.discount);
  const totals = {
    services: services.reduce((acc, s) => acc + s.quantity * s.unitPrice, 0),
    products: productItems.reduce((acc, p) => acc + lineTotal(p), 0),
  };
  const total = totals.services + totals.products;
  const overLimit = total > LIMITS.osTotalMaxCents;

  const selectedVehicle = (vehicles ?? []).find((v) => String(v.id) === vehicleId);
  const selectedCustomer = (customers?.rows ?? []).find((c) => String(c.id) === customerId);
  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  /** Quantidade pedida por produto do estoque (somando linhas repetidas). */
  const requestedByProduct = new Map<number, number>();
  for (const p of productItems) {
    if (p.productId) requestedByProduct.set(p.productId, (requestedByProduct.get(p.productId) ?? 0) + p.quantity);
  }

  const locked =
    !isNew && (editingData?.os.status === "concluida" || editingData?.os.status === "cancelada");

  const today = toDateInput(Date.now());
  const maxPrediction = toDateInput(Date.now() + LIMITS.osPredictionMaxDays * DAY_MS);
  const minPrediction = editingData ? toDateInput(editingData.os.openedAt) : today;

  function validate() {
    const errors: Record<string, string> = {};
    if (!customerId) errors.customer = "Selecione o cliente";
    if (!vehicleId) errors.vehicle = "Selecione o veículo";
    const validServices = services.filter((s) => s.description.trim() && s.unitPrice > 0);
    const validProducts = productItems.filter((p) => p.description.trim() && p.unitPrice > 0);
    if (validServices.length === 0 && validProducts.length === 0)
      errors.items = "Adicione pelo menos um serviço ou peça com valor";
    if (services.some((s) => s.unitPrice > 0 && !s.description.trim()))
      errors.items = "Informe a descrição de todos os serviços com valor";
    if (productItems.some((p) => p.unitPrice > 0 && !p.description.trim()))
      errors.items = "Informe a descrição de todas as peças com valor";
    if (productItems.some((p) => p.discount > p.quantity * p.unitPrice))
      errors.items = "O desconto de uma peça é maior que o valor dela";
    if (overLimit) errors.items = "O total da OS ultrapassa o limite de R$ 9.999.999,99";
    if (predictedDate && (predictedDate < minPrediction || predictedDate > maxPrediction))
      errors.predicted = `A previsão deve ficar entre ${minPrediction.split("-").reverse().join("/")} e ${maxPrediction.split("-").reverse().join("/")}`;
    if (selectedVehicle && mileage != null && mileage < selectedVehicle.mileage && isNew)
      errors.mileage = `Menor que a registrada no veículo (${formatMileage(selectedVehicle.mileage)})`;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const payload = {
      customerId: Number(customerId),
      vehicleId: Number(vehicleId),
      predictedAt: predictedDate ? new Date(`${predictedDate}T12:00:00`).getTime() : undefined,
      mileage: mileage ?? null,
      diagnostics: diagnostics.trim() || null,
      observations: observations.trim() || null,
      services: services
        .filter((s) => s.description.trim())
        .map((s) => ({ description: s.description.trim(), quantity: s.quantity, unitPrice: s.unitPrice })),
      products: productItems
        .filter((p) => p.description.trim())
        .map((p) => ({
          productId: p.productId,
          description: p.description.trim(),
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          discount: Math.min(p.discount, p.quantity * p.unitPrice),
        })),
    };
    if (isNew) {
      createMutation.mutate(payload, {
        onSuccess: (res) => {
          // Manter na mesma tela com a seção de fotos visível para anexar
          setCreatedOsId(res.os.id);
        },
      });
    } else
      updateMutation.mutate({
        id: editingId!,
        ...payload,
        predictedAt: predictedDate ? new Date(`${predictedDate}T12:00:00`).getTime() : null,
      });
  }

  const saveInProgress = createMutation.isPending || updateMutation.isPending;

  function updateService(i: number, patch: Partial<ServiceItem>) {
    setServices((list) => list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function updateProduct(i: number, patch: Partial<ProductItem>) {
    setProductItems((list) =>
      list.map((p, idx) => {
        if (idx !== i) return p;
        const next = { ...p, ...patch };
        // O desconto nunca passa do valor da linha
        next.discount = Math.min(next.discount, next.quantity * next.unitPrice);
        return next;
      })
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">
          {isNew ? "Nova ordem de serviço" : `Editar ${editingData?.os.number ?? "OS"}`}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Preencha os serviços e peças aplicados. O valor total é calculado automaticamente.
        </p>

        {locked && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              Esta OS está {editingData?.os.status === "concluida" ? "concluída" : "cancelada"} e não pode
              ser alterada. Para editar, reabra a OS na{" "}
              <Link href={`/os/${editingId}`} className="font-medium underline">
                tela de detalhes
              </Link>
              .
            </div>
          </div>
        )}

        {loadingEditing ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted/60 animate-pulse" />
            ))}
          </div>
        ) : (
          <fieldset disabled={locked} className="space-y-6 disabled:opacity-70">
            <Card className="shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display">Dados da OS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Cliente *</Label>
                    <SearchSelect
                      items={(customers?.rows ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
                      value={selectedCustomer?.name ?? editingData?.os.customerName ?? ""}
                      loading={loadingCustomers}
                      disabled={locked}
                      invalid={Boolean(formErrors.customer)}
                      placeholder="Selecione o cliente"
                      searchPlaceholder="Digite o nome do cliente"
                      emptyText="Nenhum cliente encontrado."
                      onSelect={(item) => {
                        if (item.value === customerId) return;
                        setCustomerId(item.value);
                        setVehicleId("");
                      }}
                    />
                    <FieldError message={formErrors.customer} />
                  </div>
                  <div>
                    <Label>Veículo *</Label>
                    <SearchSelect
                      items={(vehicles ?? []).map((v) => ({
                        value: String(v.id),
                        label: `${v.plate} — ${v.brand} ${v.model}`,
                      }))}
                      value={
                        selectedVehicle
                          ? `${selectedVehicle.plate} — ${selectedVehicle.brand} ${selectedVehicle.model}`
                          : ""
                      }
                      loading={Boolean(customerId) && loadingVehicles}
                      disabled={!customerId || locked}
                      invalid={Boolean(formErrors.vehicle)}
                      placeholder={customerId ? "Selecione o veículo" : "Selecione o cliente primeiro"}
                      searchPlaceholder="Placa ou modelo"
                      emptyText="Este cliente não tem veículos."
                      onSelect={(item) => setVehicleId(item.value)}
                    />
                    <FieldError message={formErrors.vehicle} />
                    {customerId && !loadingVehicles && (vehicles?.length ?? 0) === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Nenhum veículo para este cliente.{" "}
                        <Link href="/veiculos" className="text-primary hover:underline">
                          Cadastrar veículo
                        </Link>
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Previsão de entrega</Label>
                    <div className="relative">
                      <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={predictedDate}
                        min={minPrediction}
                        max={maxPrediction}
                        onChange={(e) => setPredictedDate(e.target.value)}
                        className="pl-9"
                        aria-invalid={Boolean(formErrors.predicted) || undefined}
                      />
                    </div>
                    <FieldError message={formErrors.predicted} />
                  </div>
                  <div>
                    <Label>Quilometragem atual</Label>
                    <IntegerInput
                      value={mileage}
                      max={LIMITS.mileageMax}
                      suffix="km"
                      aria-invalid={Boolean(formErrors.mileage) || undefined}
                      onChange={setMileage}
                      placeholder={selectedVehicle ? selectedVehicle.mileage.toLocaleString("pt-BR") : "Ex.: 45.000"}
                    />
                    {formErrors.mileage ? (
                      <FieldError message={formErrors.mileage} />
                    ) : (
                      selectedVehicle && (
                        <FieldHint>Último registro: {formatMileage(selectedVehicle.mileage)}</FieldHint>
                      )
                    )}
                  </div>
                  <div className="col-span-2">
                    <Label>Diagnóstico</Label>
                    <Textarea
                      value={diagnostics}
                      maxLength={LIMITS.osText}
                      onChange={(e) => setDiagnostics(e.target.value)}
                      rows={2}
                      placeholder="Descreva o problema relatado pelo cliente ou diagnóstico inicial"
                    />
                    <CharCounter value={diagnostics} max={LIMITS.osText} />
                  </div>
                  <div className="col-span-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={observations}
                      maxLength={LIMITS.osText}
                      onChange={(e) => setObservations(e.target.value)}
                      rows={2}
                      placeholder="Informações adicionais"
                    />
                    <CharCounter value={observations} max={LIMITS.osText} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Serviços (mão de obra) */}
            <Card className="shadow-soft">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-display">
                  Serviços (mão de obra)
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setServices([...services, emptyService])}
                  disabled={services.length >= LIMITS.osItemsMax}
                  title={services.length >= LIMITS.osItemsMax ? `Máximo de ${LIMITS.osItemsMax} serviços` : undefined}
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {services.map((s, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-12 sm:col-span-5">
                      <Label className="text-xs">Descrição</Label>
                      <Input
                        value={s.description}
                        maxLength={LIMITS.description}
                        onChange={(e) => updateService(i, { description: e.target.value })}
                        placeholder="Ex.: Troca de óleo e filtro"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <Label className="text-xs">Qtd</Label>
                      <IntegerInput
                        value={s.quantity}
                        min={1}
                        max={LIMITS.itemQuantityMax}
                        thousands={false}
                        onChange={(v) => updateService(i, { quantity: v ?? 1 })}
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <Label className="text-xs">Valor unitário</Label>
                      <MoneyInput
                        value={s.unitPrice}
                        onChange={(cents) => updateService(i, { unitPrice: cents })}
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2 pb-2 text-sm font-medium text-navy text-right tabular-nums">
                      {formatBRL(s.quantity * s.unitPrice)}
                    </div>
                    <div className="col-span-12">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-destructive px-0"
                        onClick={() => setServices(services.filter((_, idx) => idx !== i))}
                        disabled={services.length === 1}
                      >
                        <Minus className="h-3 w-3" /> Remover
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="text-right text-sm text-muted-foreground">
                  Subtotal serviços: <span className="font-semibold text-foreground">{formatBRL(totals.services)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Peças */}
            <Card className="shadow-soft">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-display">Peças aplicadas</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setProductItems([...productItems, emptyProduct])}
                  disabled={productItems.length >= LIMITS.osItemsMax}
                  title={productItems.length >= LIMITS.osItemsMax ? `Máximo de ${LIMITS.osItemsMax} peças` : undefined}
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {productItems.map((p, i) => {
                  const stockProduct = p.productId ? productById.get(p.productId) : undefined;
                  const requested = p.productId ? requestedByProduct.get(p.productId) ?? 0 : 0;
                  const short = stockProduct && requested > stockProduct.quantity;
                  return (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end border-b pb-4 last:border-0 last:pb-0">
                      <div className="col-span-12 sm:col-span-5">
                        <Label className="text-xs">Peça do estoque (opcional)</Label>
                        <SearchSelect
                          items={[
                            { value: "none", label: "Descrever manualmente" },
                            ...(products ?? []).map((pr) => ({
                              value: String(pr.id),
                              label: pr.name,
                              hint: `${formatBRL(pr.salePrice)} · est. ${pr.quantity}`,
                            })),
                          ]}
                          value={stockProduct?.name ?? ""}
                          loading={loadingProducts}
                          placeholder="Selecionar peça do estoque"
                          searchPlaceholder="Nome da peça"
                          emptyText="Peça não encontrada no estoque."
                          onSelect={(item) => {
                            if (item.value === "none") return updateProduct(i, { productId: null });
                            const prod = productById.get(Number(item.value));
                            if (prod) {
                              updateProduct(i, {
                                productId: prod.id,
                                description: prod.name.slice(0, LIMITS.description),
                                unitPrice: prod.salePrice,
                              });
                            }
                          }}
                        />
                      </div>
                      <div className="col-span-12 sm:col-span-5">
                        <Label className="text-xs">Descrição *</Label>
                        <Input
                          value={p.description}
                          maxLength={LIMITS.description}
                          onChange={(e) => updateProduct(i, { description: e.target.value })}
                          placeholder={loadingProducts ? "Carregando..." : "Ex.: Óleo 5W30 4L"}
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Label className="text-xs">Qtd</Label>
                        <IntegerInput
                          value={p.quantity}
                          min={1}
                          max={LIMITS.itemQuantityMax}
                          thousands={false}
                          aria-invalid={short || undefined}
                          onChange={(v) => updateProduct(i, { quantity: v ?? 1 })}
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-5">
                        <Label className="text-xs">Valor unitário</Label>
                        <MoneyInput value={p.unitPrice} onChange={(cents) => updateProduct(i, { unitPrice: cents })} />
                      </div>
                      <div className="col-span-4 sm:col-span-4">
                        <Label className="text-xs">Desconto</Label>
                        <MoneyInput
                          value={p.discount}
                          max={Math.max(0, p.quantity * p.unitPrice)}
                          onChange={(cents) => updateProduct(i, { discount: cents })}
                        />
                      </div>
                      <div className="col-span-10 sm:col-span-2 pb-2 text-sm font-medium text-navy text-right tabular-nums">
                        {formatBRL(lineTotal(p))}
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setProductItems(productItems.filter((_, idx) => idx !== i))}
                          disabled={productItems.length === 1}
                          aria-label="Remover peça"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {short && (
                        <p className="col-span-12 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Estoque disponível: {stockProduct.quantity} {stockProduct.unit}. A OS só poderá ser
                          concluída quando houver estoque suficiente.
                        </p>
                      )}
                    </div>
                  );
                })}
                <div className="text-right text-sm text-muted-foreground">
                  Subtotal peças: <span className="font-semibold text-foreground">{formatBRL(totals.products)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Fotos do veículo — aparece após a OS ser criada */}
            <OsPhotosSection serviceOrderId={createdOsId} />

            {/* Total e salvar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-navy p-5 text-primary-foreground shadow-soft">
              <div>
                <p className="text-xs uppercase tracking-wider opacity-70">Total geral</p>
                <p className="font-display text-3xl font-bold tabular-nums">{formatBRL(total)}</p>
              </div>
              {formErrors.items && (
                <p className="text-sm text-orange-300">{formErrors.items}</p>
              )}
              <Button
                size="lg"
                className="bg-flame hover:bg-flame/90 text-white font-semibold"
                onClick={submit}
                disabled={saveInProgress || locked}
              >
                {saveInProgress && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4" />
                {isNew ? "Criar ordem de serviço" : "Salvar alterações"}
              </Button>
            </div>
          </fieldset>
        )}
      </div>
    </DashboardLayout>
  );
}
