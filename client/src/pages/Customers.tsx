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
import { CharCounter, FieldError } from "@/components/FormFields";
import { formatDocument, maskCPF, maskCNPJ, maskPhone, maskCEP } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  LIMITS,
  UF_LIST,
  cleanText,
  isValidCEP,
  isValidCNPJ,
  isValidCPF,
  isValidEmail,
  isValidPhone,
  onlyDigits,
} from "@shared/limits";
import { Edit2, Loader2, Search, Trash2, UserPlus } from "lucide-react";
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
  const [cepLoading, setCepLoading] = useState(false);
  /** Sem nenhum cadastro e sem busca: o botão de criar fica só no aviso central. */
  const isFirstUse = !isLoading && !isError && !search && (data?.total ?? 0) === 0;
  const clearSearch = () => {
    setSearch("");
    setSearchInput("");
  };

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
    const name = cleanText(form.name);
    if (name.length < LIMITS.nameMin) errors.name = `Informe o nome (mín. ${LIMITS.nameMin} caracteres)`;
    if (form.document) {
      if (form.type === "cpf" && !isValidCPF(form.document)) errors.document = "CPF inválido";
      if (form.type === "cnpj" && !isValidCNPJ(form.document)) errors.document = "CNPJ inválido";
    }
    if (form.phone && !isValidPhone(form.phone)) errors.phone = "Telefone inválido (DDD + número)";
    if (form.whatsapp && !isValidPhone(form.whatsapp)) errors.whatsapp = "WhatsApp inválido (DDD + número)";
    if (form.email && !isValidEmail(form.email)) errors.email = "E-mail inválido";
    if (form.zipCode && !isValidCEP(form.zipCode)) errors.zipCode = "CEP deve ter 8 dígitos";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /** Preenche o endereço pelo CEP usando a API gratuita ViaCEP. */
  async function lookupCep(cep: string) {
    if (!isValidCEP(cep)) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const json = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (json.erro) {
        setFormErrors((e) => ({ ...e, zipCode: "CEP não encontrado" }));
        return;
      }
      setForm((f) => ({
        ...f,
        address: (json.logradouro || f.address).slice(0, LIMITS.address),
        neighborhood: (json.bairro || f.neighborhood).slice(0, LIMITS.neighborhood),
        city: (json.localidade || f.city).slice(0, LIMITS.city),
        stateCode: json.uf || f.stateCode,
      }));
      setFormErrors(({ zipCode: _z, ...rest }) => rest);
    } catch {
      // Sem internet ou ViaCEP fora do ar: o usuário preenche manualmente
    } finally {
      setCepLoading(false);
    }
  }

  function submit() {
    if (!validate()) return;
    const payload = {
      type: form.type,
      name: cleanText(form.name),
      document: onlyDigits(form.document) || null,
      phone: onlyDigits(form.phone) || null,
      whatsapp: onlyDigits(form.whatsapp) || null,
      email: form.email.trim().toLowerCase() || null,
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
        action={!isFirstUse}
        actionLabel="Novo cliente"
        onAction={openCreate}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchInput}
          maxLength={LIMITS.search}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput.trim())}
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
          title={search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          description={
            search
              ? `Nenhum resultado para “${search}”.`
              : "Cadastre clientes para vincular veículos e ordens de serviço."
          }
          action={search ? undefined : openCreate}
          actionLabel="Cadastrar cliente"
          secondaryAction={search ? clearSearch : undefined}
          icon={<UserPlus className="h-6 w-6" />}
        />
      )}

      {data && data.rows.length > 0 && (
        <div className="rounded-xl border bg-card shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Razão social</TableHead>
                <TableHead className="hidden xl:table-cell">Tipo</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="hidden xl:table-cell">E-mail</TableHead>
                <TableHead className="hidden lg:table-cell">Cidade</TableHead>
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
                  <TableCell className="hidden xl:table-cell">
                    <Badge variant="outline" className="bg-muted/50">
                      {c.type === "cpf" ? "CPF" : "CNPJ"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDocument(c.document)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {c.phone ? maskPhone(c.phone) : c.whatsapp ? maskPhone(c.whatsapp) : "—"}
                  </TableCell>
                  <TableCell className="max-w-40 truncate hidden xl:table-cell">{c.email ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell">
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
                onValueChange={(v) => {
                  setForm({ ...form, type: v as "cpf" | "cnpj", document: "" });
                  setFormErrors(({ document: _d, ...rest }) => rest);
                }}
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
                inputMode="numeric"
                value={form.type === "cpf" ? maskCPF(form.document) : maskCNPJ(form.document)}
                aria-invalid={Boolean(formErrors.document) || undefined}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  const maxLen = form.type === "cpf" ? 11 : 14;
                  setForm({ ...form, document: raw.slice(0, maxLen) });
                }}
                onBlur={() => {
                  if (!form.document) return;
                  const ok = form.type === "cpf" ? isValidCPF(form.document) : isValidCNPJ(form.document);
                  setFormErrors((e) => {
                    const { document: _d, ...rest } = e;
                    return ok ? rest : { ...rest, document: `${form.type === "cpf" ? "CPF" : "CNPJ"} inválido` };
                  });
                }}
                maxLength={form.type === "cpf" ? 14 : 18}
                placeholder={form.type === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
              />
              <FieldError message={formErrors.document} />
            </div>
            <div className="col-span-2">
              <Label>{form.type === "cpf" ? "Nome completo *" : "Razão social *"}</Label>
              <Input
                value={form.name}
                maxLength={LIMITS.nameMax}
                aria-invalid={Boolean(formErrors.name) || undefined}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={form.type === "cpf" ? "Nome completo" : "Razão social"}
              />
              <FieldError message={formErrors.name} />
              <CharCounter value={form.name} max={LIMITS.nameMax} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                inputMode="tel"
                value={maskPhone(form.phone)}
                aria-invalid={Boolean(formErrors.phone) || undefined}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, phone: raw.slice(0, 11) });
                }}
                maxLength={15}
                placeholder="(00) 0000-0000"
              />
              <FieldError message={formErrors.phone} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>WhatsApp</Label>
                {form.phone.length === 11 && !form.whatsapp && (
                  <button
                    type="button"
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => setForm({ ...form, whatsapp: form.phone })}
                  >
                    Usar o telefone
                  </button>
                )}
              </div>
              <Input
                inputMode="tel"
                value={maskPhone(form.whatsapp)}
                aria-invalid={Boolean(formErrors.whatsapp) || undefined}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  setForm({ ...form, whatsapp: raw.slice(0, 11) });
                }}
                maxLength={15}
                placeholder="(00) 00000-0000"
              />
              <FieldError message={formErrors.whatsapp} />
            </div>
            <div className="col-span-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                maxLength={LIMITS.email}
                aria-invalid={Boolean(formErrors.email) || undefined}
                onChange={(e) => setForm({ ...form, email: e.target.value.replace(/\s/g, "") })}
                placeholder="email@exemplo.com"
              />
              <FieldError message={formErrors.email} />
            </div>
            <div>
              <Label>CEP</Label>
              <div className="relative">
                <Input
                  inputMode="numeric"
                  value={maskCEP(form.zipCode)}
                  aria-invalid={Boolean(formErrors.zipCode) || undefined}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
                    setForm({ ...form, zipCode: raw });
                    if (raw.length === 8) lookupCep(raw);
                  }}
                  maxLength={9}
                  placeholder="00000-000"
                />
                {cepLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {formErrors.zipCode ? (
                <FieldError message={formErrors.zipCode} />
              ) : (
                <p className="text-[11px] text-muted-foreground mt-1">O endereço é preenchido pelo CEP</p>
              )}
            </div>
            <div>
              <Label>Número</Label>
              <Input
                value={form.number}
                maxLength={LIMITS.addressNumber}
                onChange={(e) => {
                  // Aceita números e "S/N"
                  const raw = e.target.value.toUpperCase().replace(/[^0-9A-Z/ -]/g, "");
                  setForm({ ...form, number: raw });
                }}
                placeholder="123 ou S/N"
              />
            </div>
            <div className="col-span-2">
              <Label>Endereço</Label>
              <Input
                value={form.address}
                maxLength={LIMITS.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Rua, avenida etc."
              />
            </div>
            <div className="col-span-2">
              <Label>Complemento</Label>
              <Input
                value={form.complement}
                maxLength={LIMITS.complement}
                onChange={(e) => setForm({ ...form, complement: e.target.value })}
                placeholder="Sala, bloco etc."
              />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input
                value={form.neighborhood}
                maxLength={LIMITS.neighborhood}
                onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 col-span-2 sm:col-span-1">
              <div className="col-span-2">
                <Label>Cidade</Label>
                <Input
                  value={form.city}
                  maxLength={LIMITS.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
              <div>
                <Label>UF</Label>
                <Select
                  value={form.stateCode || "none"}
                  onValueChange={(v) => setForm({ ...form, stateCode: v === "none" ? "" : v })}
                >
                  <SelectTrigger className="px-2"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {UF_LIST.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                maxLength={LIMITS.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
              <CharCounter value={form.notes} max={LIMITS.notes} />
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
              Essa ação não pode ser desfeita e remove também os veículos do cliente. Clientes com
              ordens de serviço registradas não podem ser excluídos, para preservar o histórico.
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
