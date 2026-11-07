import DashboardLayout from "@/components/DashboardLayout";
import { LoadingCard } from "@/components/sgpo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { maskCNPJ, maskPhone, maskCEP } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { FieldError } from "@/components/FormFields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LIMITS,
  UF_LIST,
  isValidCEP,
  isValidCNPJ,
  isValidEmail,
  isValidPhone,
} from "@shared/limits";
import { Building2, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const EMPTY_FORM = {
  name: "",
  cnpj: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  number: "",
  neighborhood: "",
  city: "",
  stateCode: "",
  zipCode: "",
};

export default function Settings() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.workshop.get.useQuery();

  const [form, setForm] = useState(EMPTY_FORM);
  const [initialized, setInitialized] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data && !initialized) {
      setForm({
        name: data.name ?? "",
        cnpj: data.cnpj ?? "",
        phone: data.phone ?? "",
        whatsapp: data.whatsapp ?? "",
        email: data.email ?? "",
        address: data.address ?? "",
        number: data.number ?? "",
        neighborhood: data.neighborhood ?? "",
        city: data.city ?? "",
        stateCode: data.stateCode ?? "",
        zipCode: data.zipCode ?? "",
      });
      setInitialized(true);
    }
  }, [data, initialized]);

  const updateMutation = trpc.workshop.update.useMutation({
    onSuccess: () => {
      utils.workshop.get.invalidate();
      toast.success("Perfil da oficina atualizado");
    },
    onError: (e) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Informe o nome da oficina";
    if (form.cnpj && !isValidCNPJ(form.cnpj)) next.cnpj = "CNPJ inválido";
    if (form.phone && !isValidPhone(form.phone)) next.phone = "Telefone inválido";
    if (form.whatsapp && !isValidPhone(form.whatsapp)) next.whatsapp = "WhatsApp inválido";
    if (form.email && !isValidEmail(form.email)) next.email = "E-mail inválido";
    if (form.zipCode && !isValidCEP(form.zipCode)) next.zipCode = "CEP deve ter 8 dígitos";
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Corrija os campos destacados");
      return;
    }
    updateMutation.mutate({
      name: form.name.trim(),
      cnpj: form.cnpj.replace(/\D/g, "").trim() || null,
      phone: form.phone.replace(/\D/g, "").trim() || null,
      whatsapp: form.whatsapp.replace(/\D/g, "").trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      number: form.number.trim() || null,
      neighborhood: form.neighborhood.trim() || null,
      city: form.city.trim() || null,
      stateCode: form.stateCode.trim().toUpperCase() || null,
      zipCode: form.zipCode.replace(/\D/g, "").trim() || null,
    });
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingCard />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-navy">
            Configurações
          </h1>
          <p className="text-sm text-muted-foreground">
            Perfil da oficina exibido nos relatórios e documentos do SGPO
          </p>
        </div>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Dados da oficina
            </CardTitle>
            <CardDescription>
              Informações que aparecem nos documentos e cabeçalho do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Nome da oficina *</Label>
                  <Input
                    value={form.name}
                    maxLength={LIMITS.nameMax}
                    aria-invalid={Boolean(errors.name) || undefined}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ex.: Auto Center Silva"
                  />
                  <FieldError message={errors.name} />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input
                    value={maskCNPJ(form.cnpj)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setForm({ ...form, cnpj: raw.slice(0, 14) });
                    }}
                    maxLength={18}
                    inputMode="numeric"
                    aria-invalid={Boolean(errors.cnpj) || undefined}
                    placeholder="00.000.000/0000-00"
                  />
                  <FieldError message={errors.cnpj} />
                </div>
                <div>
                  <Label>Telefone fixo</Label>
                  <Input
                    value={maskPhone(form.phone)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setForm({ ...form, phone: raw.slice(0, 11) });
                    }}
                    maxLength={15}
                    inputMode="tel"
                    aria-invalid={Boolean(errors.phone) || undefined}
                    placeholder="(11) 0000-0000"
                  />
                  <FieldError message={errors.phone} />
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
                    inputMode="tel"
                    aria-invalid={Boolean(errors.whatsapp) || undefined}
                    placeholder="(11) 90000-0000"
                  />
                  <FieldError message={errors.whatsapp} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={form.email}
                    maxLength={LIMITS.email}
                    aria-invalid={Boolean(errors.email) || undefined}
                    onChange={(e) => setForm({ ...form, email: e.target.value.trim() })}
                    placeholder="contato@oficina.com.br"
                  />
                  <FieldError message={errors.email} />
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm font-medium text-navy mb-3">Endereço</p>
                <div className="grid grid-cols-6 gap-4">
                  <div className="col-span-3">
                    <Label>Rua / Avenida</Label>
                    <Input
                      value={form.address}
                      maxLength={LIMITS.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                  <div className="col-span-1">
                    <Label>Nº</Label>
                    <Input
                      value={form.number}
                      maxLength={LIMITS.addressNumber}
                      placeholder="S/N"
                      onChange={(e) => {
                        const raw = e.target.value.toUpperCase().replace(/[^0-9A-Z/ -]/g, "");
                        setForm({ ...form, number: raw });
                      }}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Bairro</Label>
                    <Input
                      value={form.neighborhood}
                      maxLength={LIMITS.neighborhood}
                      onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Cidade</Label>
                    <Input
                      value={form.city}
                      maxLength={LIMITS.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Estado (UF)</Label>
                    <Select
                      value={form.stateCode || "none"}
                      onValueChange={(v) => setForm({ ...form, stateCode: v === "none" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
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
                  <div className="col-span-2">
                    <Label>CEP</Label>
                    <Input
                      value={maskCEP(form.zipCode)}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setForm({ ...form, zipCode: raw.slice(0, 8) });
                      }}
                      maxLength={9}
                      inputMode="numeric"
                      aria-invalid={Boolean(errors.zipCode) || undefined}
                      placeholder="00000-000"
                    />
                    <FieldError message={errors.zipCode} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <Save className="h-4 w-4" /> Salvar alterações
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
