import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import OsPhotosSection from "@/components/OsPhotosSection";
import { CalendarClock, Loader2, Minus, Plus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";

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

  const { data: customers } = trpc.customers.list.useQuery({ page: 1, limit: 100 });
  const [customerId, setCustomerId] = useState<string>("");
  const { data: vehicles, isLoading: loadingVehicles } = trpc.vehicles.listByCustomer.useQuery(
    { customerId: Number(customerId) },
    { enabled: Boolean(customerId) }
  );
  const { data: products, isLoading: loadingProducts } = trpc.stock.listAll.useQuery({});

  const [vehicleId, setVehicleId] = useState<string>("");
  const [predictedDate, setPredictedDate] = useState<string>("");
  const [mileage, setMileage] = useState<string>("");
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
      const d = new Date(editingData.os.predictedAt);
      setPredictedDate(d.toISOString().slice(0, 10));
    }

    if (editingData.os.mileage != null) {
      setMileage(String(editingData.os.mileage));
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

  const totals = {
    services: services.reduce((acc, s) => acc + s.quantity * s.unitPrice, 0),
    products: productItems.reduce((acc, p) => acc + p.quantity * p.unitPrice - p.discount, 0),
  };
  const total = totals.services + totals.products;

  function validate() {
    const errors: Record<string, string> = {};
    if (!customerId) errors.customer = "Selecione o cliente";
    if (!vehicleId) errors.vehicle = "Selecione o veículo";
    const validServices = services.filter((s) => s.description.trim() && s.unitPrice > 0);
    const validProducts = productItems.filter(
      (p) => p.description.trim() && p.unitPrice > 0
    );
    if (validServices.length === 0 && validProducts.length === 0)
      errors.items = "Adicione pelo menos um serviço ou peça com valor";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const payload = {
      customerId: Number(customerId),
      vehicleId: Number(vehicleId),
      predictedAt: predictedDate ? new Date(`${predictedDate}T12:00:00`).getTime() : undefined,
      mileage: mileage ? Number(mileage) : null,
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
          discount: p.discount,
        })),
    };
    if (isNew) {
      createMutation.mutate(payload, {
        onSuccess: (res) => {
          // Manter na mesma tela com a seção de fotos visível para anexar
          setCreatedOsId(res.os.id);
        },
      });
    } else updateMutation.mutate({ id: editingId!, ...payload } as never);
  }

  const saveInProgress = createMutation.isPending || updateMutation.isPending;

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">
          {isNew ? "Nova ordem de serviço" : `Editar OS #${editingData?.os.number}`}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Preencha os serviços e peças aplicados. O valor total é calculado automaticamente.
        </p>

        {loadingEditing ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted/60 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display">Dados da OS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Cliente *</Label>
                    <Select
                      value={customerId}
                      onValueChange={(v) => {
                        setCustomerId(v);
                        setVehicleId("");
                      }}
                    >
                      <SelectTrigger className={formErrors.customer ? "border-destructive" : ""}>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {(customers?.rows ?? []).map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.customer && (
                      <p className="text-xs text-destructive mt-1">{formErrors.customer}</p>
                    )}
                  </div>
                  <div>
                    <Label>Veículo *</Label>
                    <Select
                      value={vehicleId}
                      onValueChange={setVehicleId}
                      disabled={!customerId}
                    >
                      <SelectTrigger className={formErrors.vehicle ? "border-destructive" : ""}>
                        <SelectValue placeholder={customerId ? "Selecione o veículo" : "Selecione o cliente primeiro"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(vehicles ?? []).map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.plate} — {v.brand} {v.model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.vehicle && (
                      <p className="text-xs text-destructive mt-1">{formErrors.vehicle}</p>
                    )}
                    {customerId && loadingVehicles && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Carregando veículos...
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
                        onChange={(e) => setPredictedDate(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Quilometragem atual</Label>
                    <Input
                      inputMode="numeric"
                      value={mileage ? Number(mileage).toLocaleString("pt-BR") : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setMileage(raw);
                      }}
                      placeholder="Ex.: 45.000"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Diagnóstico</Label>
                    <Textarea
                      value={diagnostics}
                      onChange={(e) => setDiagnostics(e.target.value)}
                      rows={2}
                      placeholder="Descreva o problema relatado pelo cliente ou diagnóstico inicial"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      rows={2}
                      placeholder="Informações adicionais"
                    />
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
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {services.map((s, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Label className="text-xs">Descrição</Label>
                      <Input
                        value={s.description}
                        onChange={(e) => {
                          const next = [...services];
                          next[i] = { ...next[i], description: e.target.value };
                          setServices(next);
                        }}
                        placeholder="Ex.: Troca de óleo e filtro"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Qtd</Label>
                      <Input
                        inputMode="numeric"
                        value={s.quantity}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          const next = [...services];
                          next[i] = { ...next[i], quantity: Number(raw) || 1 };
                          setServices(next);
                        }}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Valor unitário</Label>
                      <Input
                        inputMode="decimal"
                        value={s.unitPrice}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.,]/g, "");
                          const next = [...services];
                          next[i] = { ...next[i], unitPrice: Number(val.replace(",", ".")) || 0 };
                          setServices(next);
                        }}
                      />
                    </div>
                    <div className="col-span-2 text-sm font-medium text-navy">
                      {formatBRL(s.quantity * s.unitPrice * 100)}
                    </div>
                    <div className="col-span-12">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-destructive px-0"
                        onClick={() =>
                          setServices(services.filter((_, idx) => idx !== i))
                        }
                        disabled={services.length === 1}
                      >
                        <Minus className="h-3 w-3" /> Remover
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="text-right text-sm text-muted-foreground">
                  Subtotal serviços: <span className="font-semibold text-foreground">{formatBRL(totals.services * 100)}</span>
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
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {productItems.map((p, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <Label className="text-xs">Peça do estoque (opcional)</Label>
                      <Select
                        value={p.productId ? String(p.productId) : "none"}
                        onValueChange={(v) => {
                          const next = [...productItems];
                          if (v === "none") {
                            next[i] = { ...next[i], productId: null };
                          } else {
                            const prod = (products ?? []).find(
                              (pr) => pr.id === Number(v)
                            );
                            if (prod) {
                              next[i] = {
                                ...next[i],
                                productId: prod.id,
                                description: prod.name,
                                unitPrice: prod.salePrice,
                              };
                            }
                          }
                          setProductItems(next);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar peça" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Descrever manualmente</SelectItem>
                          {(products ?? []).map((pr: { id: number; name: string; salePrice: number; quantity: number }) => (
                            <SelectItem key={pr.id} value={String(pr.id)}>
                              {pr.name} — {formatBRL(pr.salePrice * 100)} (est. {pr.quantity})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-5">
                      <Label className="text-xs">Descrição *</Label>
                      <Input
                        value={p.description}
                        onChange={(e) => {
                          const next = [...productItems];
                          next[i] = { ...next[i], description: e.target.value };
                          setProductItems(next);
                        }}
                        placeholder={loadingProducts ? "Carregando..." : "Ex.: Óleo 5W30 4L"}
                      />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Qtd</Label>
                      <Input
                        inputMode="numeric"
                        value={p.quantity}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, "");
                          const next = [...productItems];
                          next[i] = { ...next[i], quantity: Number(raw) || 1 };
                          setProductItems(next);
                        }}
                      />
                    </div>
                    <div className="col-span-12 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Valor unitário</Label>
                        <Input
                          inputMode="decimal"
                          value={p.unitPrice}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.,]/g, "");
                            const next = [...productItems];
                            next[i] = { ...next[i], unitPrice: Number(val.replace(",", ".")) || 0 };
                            setProductItems(next);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Desconto</Label>
                        <Input
                          inputMode="decimal"
                          value={p.discount}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.,]/g, "");
                            const next = [...productItems];
                            next[i] = { ...next[i], discount: Number(val.replace(",", ".")) || 0 };
                            setProductItems(next);
                          }}
                        />
                      </div>
                    </div>
                    <div className="col-span-11 text-sm font-medium text-navy">
                      Total: {formatBRL((p.quantity * p.unitPrice - p.discount) * 100)}
                    </div>
                    <div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 text-destructive"
                        onClick={() =>
                          setProductItems(productItems.filter((_, idx) => idx !== i))
                        }
                        disabled={productItems.length === 1}
                        aria-label="Remover peça"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div className="text-right text-sm text-muted-foreground">
                  Subtotal peças: <span className="font-semibold text-foreground">{formatBRL(totals.products * 100)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Fotos do veículo — aparece após a OS ser criada */}
            <OsPhotosSection serviceOrderId={createdOsId} />

            {/* Total e salvar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-navy p-5 text-primary-foreground shadow-soft">
              <div>
                <p className="text-xs uppercase tracking-wider opacity-70">Total geral</p>
                <p className="font-display text-3xl font-bold">{formatBRL(total * 100)}</p>
              </div>
              {formErrors.items && (
                <p className="text-sm text-orange-300">{formErrors.items}</p>
              )}
              <Button
                size="lg"
                className="bg-flame hover:bg-flame/90 text-white font-semibold"
                onClick={submit}
                disabled={saveInProgress}
              >
                {saveInProgress && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4" />
                {isNew ? "Criar ordem de serviço" : "Salvar alterações"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
