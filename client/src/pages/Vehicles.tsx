import DashboardLayout from "@/components/DashboardLayout";
import { CharCounter, FieldError, FieldHint, IntegerInput } from "@/components/FormFields";
import { SearchSelect } from "@/components/SearchSelect";
import { VehicleModelPicker, type Fuel } from "@/components/VehicleModelPicker";
import { EmptyState, ErrorState, LoadingCard, PageHeader } from "@/components/sgpo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatMileage } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  LIMITS,
  isValidPlate,
  isValidVehicleYear,
  normalizePlate,
  plateFormat,
} from "@shared/limits";
import { Car, CheckCircle2, Edit2, Loader2, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type VehicleForm = {
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year: string;
  color: string;
  fuel: Fuel;
  mileage: number | null;
  notes: string;
};

const emptyForm: VehicleForm = {
  customerId: "",
  plate: "",
  brand: "",
  model: "",
  year: "",
  color: "",
  fuel: "",
  mileage: null,
  notes: "",
};

const FUEL_LABEL: Record<string, string> = {
  flex: "Flex",
  gasolina: "Gasolina",
  etanol: "Etanol",
  diesel: "Diesel",
  gnv: "GNV",
  eletrico: "Elétrico",
};

/** Cores mais comuns da frota brasileira — evita digitação e variações ("prata", "Prata ", "PRATA"). */
const COMMON_COLORS = [
  "Branco", "Preto", "Prata", "Cinza", "Vermelho", "Azul", "Marrom", "Bege", "Verde",
  "Amarelo", "Laranja", "Dourado", "Vinho", "Grafite",
];

/** Formata a placa para exibição: ABC-1234 (antiga) ou ABC1D23 (Mercosul). */
function displayPlate(plate: string) {
  return plateFormat(plate) === "antiga" ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
}

export default function Vehicles() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const utils = trpc.useUtils();
  const invalidate = () => utils.vehicles.list.invalidate();

  const { data, isLoading, isError } = trpc.vehicles.list.useQuery({
    search: search || undefined,
    page: 1,
    limit: 50,
  });

  const { data: customers } = trpc.customers.list.useQuery({
    page: 1,
    limit: 100,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createMutation = trpc.vehicles.create.useMutation({
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success("Veículo cadastrado com sucesso");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.vehicles.update.useMutation({
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success("Veículo atualizado com sucesso");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.vehicles.delete.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Veículo excluído");
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate(customerId = "") {
    setEditingId(null);
    setForm({ ...emptyForm, customerId });
    setFormErrors({});
    setDialogOpen(true);
  }

  // Vindo da ficha do cliente (/veiculos?novo=1&cliente=ID): abre o cadastro já com o dono escolhido
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("novo") === "1") {
      openCreate(params.get("cliente") ?? "");
      window.history.replaceState(null, "", "/veiculos");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit(id: number) {
    const vehicle = data?.rows.find((v) => v.id === id);
    if (!vehicle) return;
    setEditingId(id);
    setForm({
      customerId: String(vehicle.customerId ?? ""),
      plate: vehicle.plate ?? "",
      brand: vehicle.brand ?? "",
      model: vehicle.model ?? "",
      year: vehicle.year ?? "",
      color: vehicle.color ?? "",
      fuel: (vehicle.fuel ?? "") as Fuel,
      mileage: vehicle.mileage ?? null,
      notes: vehicle.notes ?? "",
    });
    setFormErrors({});
    setDialogOpen(true);
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.customerId) errors.customerId = "Selecione o proprietário";
    if (!isValidPlate(form.plate)) errors.plate = "Placa inválida. Use ABC1234 ou Mercosul ABC1D23";
    if (!form.brand.trim()) errors.brand = "Selecione a marca";
    if (!form.model.trim()) errors.model = "Selecione o modelo";
    if (form.year && !isValidVehicleYear(form.year)) errors.year = "Ano inválido";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const payload = {
      customerId: Number(form.customerId),
      plate: normalizePlate(form.plate),
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: form.year || null,
      color: form.color.trim() || null,
      fuel: form.fuel || null,
      mileage: form.mileage ?? 0,
      notes: form.notes.trim() || null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const plateKind = plateFormat(form.plate);
  /** Sem nenhum cadastro e sem busca: o botão de criar fica só no aviso central. */
  const isFirstUse = !isLoading && !isError && !search && (data?.total ?? 0) === 0;
  const selectedCustomer = customers?.rows.find((c) => String(c.id) === form.customerId);

  return (
    <DashboardLayout>
      <PageHeader
        title="Veículos"
        subtitle={`${data?.total ?? ""} ${data?.total === 1 ? "veículo cadastrado" : "veículos cadastrados"}`}
        action={!isFirstUse}
        actionLabel="Novo veículo"
        onAction={() => openCreate()}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchInput}
          maxLength={LIMITS.search}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput.trim())}
          placeholder="Buscar por placa, marca, modelo ou proprietário"
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

      {isLoading && <LoadingCard />}
      {isError && <ErrorState retry={invalidate} />}

      {!isLoading && !isError && (data?.rows.length ?? 0) === 0 && (
        <EmptyState
          title={search ? "Nenhum veículo encontrado" : "Nenhum veículo cadastrado"}
          description={
            search
              ? `Nenhum resultado para “${search}”.`
              : "Cadastre veículos vinculando-os a um cliente para iniciar ordens de serviço."
          }
          action={search ? undefined : () => openCreate()}
          actionLabel="Cadastrar veículo"
          secondaryAction={
            search
              ? () => {
                  setSearch("");
                  setSearchInput("");
                }
              : undefined
          }
          icon={<Car className="h-6 w-6" />}
        />
      )}

      {data && data.rows.length > 0 && (
        <div className="rounded-xl border bg-card shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead>Marca / Modelo</TableHead>
                <TableHead className="hidden xl:table-cell">Combustível</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead className="hidden xl:table-cell">Cor</TableHead>
                <TableHead className="hidden lg:table-cell">Quilometragem</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <span className="font-display font-bold tracking-wide text-navy whitespace-nowrap">
                      {displayPlate(v.plate)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-64">
                    <p className="font-medium truncate">{v.brand || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate" title={v.model}>
                      {v.model || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">{v.fuel ? FUEL_LABEL[v.fuel] : "—"}</TableCell>
                  <TableCell>{v.year ?? "—"}</TableCell>
                  <TableCell className="hidden xl:table-cell">{v.color ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap hidden lg:table-cell">{formatMileage(v.mileage)}</TableCell>
                  <TableCell className="max-w-40">
                    {v.customerName ? (
                      <Link
                        href={`/clientes/${v.customerId}`}
                        className="truncate block hover:text-primary hover:underline"
                      >
                        {v.customerName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(v.id)}
                        aria-label="Editar veículo"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(v.id)}
                        aria-label="Excluir veículo"
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar veículo" : "Novo veículo"}</DialogTitle>
            <DialogDescription>
              Vincule o veículo a um cliente. Marca, modelo e ano vêm da Tabela FIPE para evitar nomes errados.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Proprietário *</Label>
              <SearchSelect
                items={(customers?.rows ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
                value={selectedCustomer?.name ?? ""}
                invalid={Boolean(formErrors.customerId)}
                placeholder="Selecione um cliente"
                searchPlaceholder="Digite o nome do cliente"
                emptyText="Nenhum cliente encontrado."
                onSelect={(item) => setForm({ ...form, customerId: item.value })}
              />
              <FieldError message={formErrors.customerId} />
              {(customers?.rows.length ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum cliente cadastrado.{" "}
                  <Link href="/clientes" className="text-primary hover:underline">
                    Cadastre um cliente primeiro.
                  </Link>
                </p>
              )}
            </div>
            <div>
              <Label>Placa *</Label>
              <Input
                value={form.plate}
                maxLength={8}
                autoComplete="off"
                className="uppercase tracking-wider font-medium"
                aria-invalid={Boolean(formErrors.plate) || undefined}
                onChange={(e) => setForm({ ...form, plate: normalizePlate(e.target.value).slice(0, 7) })}
                placeholder="ABC1D23"
              />
              {formErrors.plate ? (
                <FieldError message={formErrors.plate} />
              ) : plateKind ? (
                <p className="text-[11px] text-green-700 dark:text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {plateKind === "mercosul" ? "Placa Mercosul" : "Placa padrão antigo"}
                </p>
              ) : (
                <FieldHint>7 caracteres: ABC1234 ou ABC1D23</FieldHint>
              )}
            </div>
            <div>
              <Label>Combustível</Label>
              <Select
                value={form.fuel || "none"}
                onValueChange={(v) => setForm({ ...form, fuel: v === "none" ? "" : (v as Fuel) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  {Object.entries(FUEL_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <VehicleModelPicker
              brand={form.brand}
              model={form.model}
              year={form.year}
              fuel={form.fuel}
              errors={{ brand: formErrors.brand, model: formErrors.model, year: formErrors.year }}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            />

            <div>
              <Label>Cor</Label>
              <SearchSelect
                items={COMMON_COLORS.map((c) => ({ value: c, label: c }))}
                value={form.color}
                placeholder="Selecione a cor"
                searchPlaceholder="Digite a cor"
                emptyText="Cor não listada."
                allowCustom
                customMaxLength={LIMITS.shortText}
                onSelect={(item) => setForm({ ...form, color: item.label })}
                onCustom={(text) => setForm({ ...form, color: text })}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label>Quilometragem</Label>
              <IntegerInput
                value={form.mileage}
                max={LIMITS.mileageMax}
                suffix="km"
                onChange={(v) => setForm({ ...form, mileage: v })}
                placeholder="Ex.: 45.000"
              />
              <FieldHint>Máximo {LIMITS.mileageMax.toLocaleString("pt-BR")} km</FieldHint>
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                maxLength={LIMITS.notes}
                rows={2}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Detalhes adicionais (opcional)"
              />
              <CharCounter value={form.notes} max={LIMITS.notes} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-navy hover:bg-navy-deep text-primary-foreground"
              onClick={submit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              {editingId ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir veículo?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Veículos com ordens de serviço registradas não podem
              ser excluídos, para preservar o histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId !== null) deleteMutation.mutate({ id: deleteId });
                setDeleteId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
