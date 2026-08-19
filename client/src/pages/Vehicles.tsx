import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, LoadingCard, PageHeader } from "@/components/sgpo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Car, Edit2, Loader2, Search, Trash2 } from "lucide-react";
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
  fuel: "" | "flex" | "gasolina" | "etanol" | "diesel" | "gnv" | "eletrico";
  mileage: string;
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
  mileage: "",
  notes: "",
};

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

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
    setDialogOpen(true);
  }

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
      fuel: vehicle.fuel ?? "",
      mileage: String(vehicle.mileage ?? ""),
      notes: vehicle.notes ?? "",
    });
    setFormErrors({});
    setDialogOpen(true);
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (!form.customerId) errors.customerId = "Selecione o proprietário";
    if (form.plate.trim().length < 6) errors.plate = "Informe a placa completa (mín. 6 caracteres)";
    if (!form.brand.trim()) errors.brand = "Informe a marca";
    if (!form.model.trim()) errors.model = "Informe o modelo";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const payload = {
      customerId: Number(form.customerId),
      plate: form.plate.trim().toUpperCase(),
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: form.year.trim() || null,
      color: form.color.trim() || null,
      fuel: form.fuel || null,
      mileage: form.mileage ? Number(form.mileage) : 0,
      notes: form.notes.trim() || null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Veículos"
        subtitle={`${data?.total ?? ""} ${data?.total === 1 ? "veículo cadastrado" : "veículos cadastrados"}`}
        action
        actionLabel="Novo veículo"
        onAction={openCreate}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          placeholder="Buscar por placa, marca, modelo ou chassi"
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
          title="Nenhum veículo cadastrado"
          description="Cadastre veículos vinculando-os a um cliente para iniciar ordens de serviço."
          action={openCreate}
          actionLabel="Cadastrar veículo"
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
                <TableHead>Combustível</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Quilometragem</TableHead>
                <TableHead>Proprietário</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <span className="font-display font-bold tracking-wide text-navy">
                      {v.plate}
                    </span>
                  </TableCell>
                  <TableCell>
                    {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell>
                    {v.fuel
                      ? v.fuel === "flex"
                        ? "Flex"
                        : v.fuel === "gasolina"
                          ? "Gasolina"
                          : v.fuel === "etanol"
                            ? "Etanol"
                            : v.fuel === "diesel"
                              ? "Diesel"
                              : v.fuel === "gnv"
                                ? "GNV"
                                : "Elétrico"
                      : "—"}
                  </TableCell>
                  <TableCell>{v.year ?? "—"}</TableCell>
                  <TableCell>{v.color ?? "—"}</TableCell>
                  <TableCell>{formatMileage(v.mileage)}</TableCell>
                  <TableCell>{v.customerId ? "—" : "—"}</TableCell>
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
              Vincule o veículo a um cliente cadastrado. Placa, marca e modelo são obrigatórios.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Proprietário *</Label>
              <Select
                value={form.customerId}
                onValueChange={(v) => setForm({ ...form, customerId: v })}
              >
                <SelectTrigger className={formErrors.customerId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(customers?.rows ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.customerId && (
                <p className="text-xs text-destructive mt-1">{formErrors.customerId}</p>
              )}
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
                onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
                placeholder="ABC1D23"
              />
              {formErrors.plate && (
                <p className="text-xs text-destructive mt-1">{formErrors.plate}</p>
              )}
            </div>
            <div>
              <Label>Combustível</Label>
              <Select
                value={form.fuel || "none"}
                onValueChange={(v) => setForm({ ...form, fuel: v === "none" ? "" : (v as VehicleForm["fuel"]) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  <SelectItem value="flex">Flex</SelectItem>
                  <SelectItem value="gasolina">Gasolina</SelectItem>
                  <SelectItem value="etanol">Etanol</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="gnv">GNV</SelectItem>
                  <SelectItem value="eletrico">Elétrico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Marca *</Label>
              <Input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="Ex.: Toyota"
              />
              {formErrors.brand && (
                <p className="text-xs text-destructive mt-1">{formErrors.brand}</p>
              )}
            </div>
            <div>
              <Label>Modelo *</Label>
              <Input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="Ex.: Corolla XEi"
              />
              {formErrors.model && (
                <p className="text-xs text-destructive mt-1">{formErrors.model}</p>
              )}
            </div>
            <div>
              <Label>Ano</Label>
              <Input
                inputMode="numeric"
                value={form.year}
                maxLength={4}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, year: raw.slice(0, 4) });
                }}
                placeholder="2024"
              />
            </div>
            <div>
              <Label>Cor</Label>
              <Input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="Ex.: Prata"
              />
            </div>
            <div>
              <Label>Quilometragem</Label>
              <Input
                inputMode="numeric"
                value={form.mileage ? Number(form.mileage).toLocaleString("pt-BR") : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, mileage: raw });
                }}
                placeholder="Ex.: 45.000"
              />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Detalhes adicionais (opcional)"
              />
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
              Essa ação não pode ser desfeita. Ordens de serviço vinculadas a este veículo
              continuarão registradas.
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
