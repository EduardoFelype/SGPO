import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, LoadingCard, StatusBadge } from "@/components/sgpo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDateTime, formatDocument, formatMileage } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Car, Mail, MapPin, Phone } from "lucide-react";
import { useParams, Link, useLocation } from "wouter";

export default function CustomerDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();

  const { data: profile, isLoading, isError } = trpc.customers.profile.useQuery(
    { id },
    { enabled: Number.isFinite(id) }
  );

  if (isLoading) return <DashboardLayout><LoadingCard /></DashboardLayout>;
  if (isError || !profile)
    return (
      <DashboardLayout>
        <ErrorState retry={() => window.location.reload()} />
      </DashboardLayout>
    );

  const c = profile.customer;

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        <button
          onClick={() => setLocation("/clientes")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para clientes
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">{c.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {c.type === "cpf" ? "Pessoa física" : "Pessoa jurídica"} · cadastrado em{" "}
              {formatDateTime(new Date(c.createdAt).getTime())}
            </p>
          </div>
          <Button
            variant="outline"
            className="bg-navy hover:bg-navy-deep text-primary-foreground border-transparent"
            onClick={() => setLocation("/veiculos?novo=1")}
          >
            <Car className="h-4 w-4" /> Novo veículo
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Dados de contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{c.type === "cpf" ? "CPF" : "CNPJ"}</Badge>
                <span>{formatDocument(c.document)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-muted-foreground">OS realizadas</span>
                <span className="font-display font-bold">{profile.osCount}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-muted-foreground">Total gasto</span>
                <span className="font-display font-bold text-navy">{formatBRL(profile.totalSpent)}</span>
              </div>
              {c.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> {c.phone}
                </div>
              )}
              {c.whatsapp && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> WhatsApp: {c.whatsapp}
                </div>
              )}
              {c.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> {c.email}
                </div>
              )}
              {(c.address || c.city) && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  <span>
                    {[c.address, c.number, c.complement, c.neighborhood]
                      .filter(Boolean)
                      .join(", ")}
                    <br />
                    {[c.city, c.stateCode, c.zipCode].filter(Boolean).join(" - ")}
                  </span>
                </div>
              )}
              {c.notes && (
                <p className="text-xs text-muted-foreground border-t pt-3 mt-3">{c.notes}</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">
                Veículos ({profile.vehicles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.vehicles.length === 0 ? (
                <EmptyState
                  title="Nenhum veículo vinculado"
                  description="Vincule veículos a este cliente para criar ordens de serviço."
                  icon={<Car className="h-6 w-6" />}
                />
              ) : (
                <div className="space-y-2.5">
                  {profile.vehicles.map((v) => (
                    <Link
                      key={v.id}
                      href={`/os`}
                      className="flex items-center gap-3 rounded-lg border p-3 hover:border-primary/40 hover:bg-accent/30 transition-colors"
                      state={{ vehicleId: v.id }}
                    >
                      <span className="h-9 w-9 rounded-lg bg-navy/10 text-navy flex items-center justify-center font-display font-bold text-sm">
                        {v.plate.slice(-2)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-display font-bold tracking-wide">{v.plate}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[v.brand, v.model, v.year].filter(Boolean).join(" · ")}
                          {v.color ? ` · ${v.color}` : ""}
                        </p>
                      </div>
                      {v.mileage != null && (
                        <span className="text-xs text-muted-foreground">
                          {formatMileage(v.mileage)}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
