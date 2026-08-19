import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, LoadingCard, PageHeader, StatusBadge } from "@/components/sgpo";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDocument, formatMileage, maskCPF, maskCNPJ, maskPhone, maskCEP } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Car, Edit2, Eye, Loader2, Search, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type CustomerForm = {
  type: "cpf" | "cnpj";
  name: string;
  document: string;
  phone: string;
  whatsapp: string;
  email: string;
  zipCode: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  stateCode: string;
  notes: string;
};

const emptyForm: CustomerForm = {
  type: "cpf",
  name: "",
  document: "",
  phone: "",
  whatsapp: "",
  email: "",
  zipCode: "",
  address: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  stateCode: "",
  notes: "",
};

export default function Customers() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const utils = trpc.useUtils();
  const invalidate = () => utils.customers.list.invalidate();

  const { data, isLoading, isError } = trpc.customers.list.useQuery({
    search: search || undefined,
    page: 1,
    limit: 50,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success("Cliente cadastrado com sucesso");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast.success("Cliente atualizado com sucesso");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.customers.delete.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Cliente excluído");
    },
    onError: (e) => toast.error(e.message),
  });

  const [deleteId, setDeleteId] = useState<number | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
    setDialogOpen(true);
  }

  function openEdit(id: number) {
    const customer = data?.rows.find((c) => c.id === id);
    if (!customer) return;
    setEditingId(id);
    setForm({
      type: customer.type as "cpf" | "cnpj",
      name: customer.name ?? "",
      document: customer.document ?? "",
      phone: customer.phone ?? "",
      whatsapp: customer.whatsapp ?? "",
      email: customer.email ?? "",
      zipCode: customer.zipCode ?? "",
      address: customer.address ?? "",
      number: customer.number ?? "",
      complement: customer.complement ?? "",
      neighborhood: customer.neighborhood ?? "",
      city: customer.city ?? "",
      stateCode: customer.stateCode ?? "",
      notes: customer.notes ?? "",
    });
    setFormErrors({});
    setDialogOpen(true);
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (form.name.trim().length < 2) errors.name = "Informe o nome (mín. 2 caracteres)";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = "E-mail inválido";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const payload = {
      type: form.type,
      name: form.name.trim(),
      document: form.document.replace(/\D/g, "").trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      zipCode: form.zipCode.trim() || null,
      address: form.address.trim() || null,
      number: form.number.trim() || null,
      complement: form.complement.trim() || null,
      neighborhood: form.neighborhood.trim() || null,
      city: form.city.trim() || null,
      stateCode: form.stateCode.trim().toUpperCase() || null,
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
        title="Clientes"
        subtitle={`${data?.total ?? ""} ${data?.total === 1 ? "cliente cadastrado" : "clientes cadastrados"}`}
        action
        actionLabel="Novo cliente"
        onAction={openCreate}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
          placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail"
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
          title="Nenhum cliente cadastrado"
          description="Cadastre clientes para vincular veículos e ordens de serviço."
          action={openCreate}
          actionLabel="Cadastrar cliente"
          icon={<UserPlus className="h-6 w-6" />}
        />
      )}

      {data && data.rows.length > 0 && (
        <div className="rounded-xl border bg-card shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Razão social</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/clientes/${c.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-muted/50">
                      {c.type === "cpf" ? "CPF" : "CNPJ"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDocument(c.document)}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell className="max-w-40 truncate">{c.email ?? "—"}</TableCell>
                  <TableCell>
                    {[c.city, c.stateCode].filter(Boolean).join(" - ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(c.id)}
                        aria-label="Editar cliente"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(c.id)}
                        aria-label="Excluir cliente"
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

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            <DialogDescription>
              Preencha os dados do cliente. Os campos de endereço são opcionais.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <Label>Tipo de pessoa *</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as "cpf" | "cnpj", document: "" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF (Pessoa física)</SelectItem>
                  <SelectItem value="cnpj">CNPJ (Pessoa jurídica)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label>
                {form.type === "cpf" ? "CPF" : "CNPJ"}
              </Label>
              <Input
                value={form.type === "cpf" ? maskCPF(form.document) : maskCNPJ(form.document)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  const maxLen = form.type === "cpf" ? 11 : 14;
                  setForm({ ...form, document: raw.slice(0, maxLen) });
                }}
                maxLength={form.type === "cpf" ? 14 : 18}
                placeholder={form.type === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
              />
            </div>
            <div className="col-span-2">
              <Label>Nome / Razão social *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome completo ou razão social"
              />
              {formErrors.name && (
                <p className="text-xs text-destructive mt-1">{formErrors.name}</p>
              )}
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={maskPhone(form.phone)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, phone: raw.slice(0, 11) });
                }}
                maxLength={15}
                placeholder="(00) 0000-0000"
              />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                value={maskPhone(form.whatsapp)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, whatsapp: raw.slice(0, 11) });
                }}
                maxLength={15}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="col-span-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
              {formErrors.email && (
                <p className="text-xs text-destructive mt-1">{formErrors.email}</p>
              )}
            </div>
            <div>
              <Label>CEP</Label>
              <Input
                value={maskCEP(form.zipCode)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, zipCode: raw.slice(0, 8) });
                }}
                maxLength={9}
                placeholder="00000-000"
              />
            </div>
            <div>
              <Label>Número</Label>
              <Input
                value={form.number}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, number: raw });
                }}
                placeholder="123"
              />
            </div>
            <div className="col-span-2">
              <Label>Endereço</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Rua, avenida etc."
              />
            </div>
            <div className="col-span-2">
              <Label>Complemento</Label>
              <Input
                value={form.complement}
                onChange={(e) => setForm({ ...form, complement: e.target.value })}
                placeholder="Sala, bloco etc."
              />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input
                value={form.neighborhood}
                onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 col-span-2 sm:col-span-1">
              <div className="col-span-2">
                <Label>Cidade</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div>
                <Label>UF</Label>
                <Input
                  value={form.stateCode}
                  maxLength={2}
                  onChange={(e) => setForm({ ...form, stateCode: e.target.value.toUpperCase() })}
                  placeholder="UF"
                />
              </div>
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
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

      {/* Confirmação de exclusão */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. O histórico do cliente permanecerá nos
              relatórios já gerados.
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
