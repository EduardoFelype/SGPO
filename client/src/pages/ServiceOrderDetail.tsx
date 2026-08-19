import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, LoadingCard, StatusBadge } from "@/components/sgpo";
import OsPhotosSection from "@/components/OsPhotosSection";
import OsPrintView from "@/components/OsPrintView";
import { shareOsViaWhatsApp } from "@/lib/osActions";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  formatBRL,
  formatDateTime,
} from "@/lib/format";

import { trpc } from "@/lib/trpc";

import {
  ArrowLeft,
  CheckCircle2,
  Edit3,
  RotateCcw,
  XCircle,
  Wrench,
  Package,
  Car,
  User,
  CalendarClock,
  Gauge,
  Stethoscope,
  ScrollText,
  Printer,
  MessageCircle,
  X,
} from "lucide-react";

import { useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

export default function ServiceOrderDetail() {
  const params = useParams<{ id: string }>();
  const osId = Number(params.id);

  const [, setLocation] = useLocation();

  const utils = trpc.useUtils();

  // IMPORTANTE:
  // Todos os hooks precisam ficar antes de qualquer return condicional.
  const [showPrint, setShowPrint] = useState(false);

  const {
    data,
    isLoading,
    isError,
  } = trpc.serviceOrders.get.useQuery(
    {
      id: osId,
    },
    {
      enabled: Number.isFinite(osId),
    }
  );

  const completeMutation =
    trpc.serviceOrders.update.useMutation({
      onSuccess: () => {
        utils.serviceOrders.get.invalidate({
          id: osId,
        });

        utils.serviceOrders.list.invalidate();
        utils.stock.list.invalidate();
        utils.dashboard.summary.invalidate();

        toast.success(
          "OS concluída! Estoque baixado e receita registrada automaticamente."
        );
      },

      onError: (error) => {
        toast.error(error.message);
      },
    });

  const reopenMutation =
    trpc.serviceOrders.reopen.useMutation({
      onSuccess: () => {
        utils.serviceOrders.get.invalidate({
          id: osId,
        });

        utils.serviceOrders.list.invalidate();
        utils.dashboard.summary.invalidate();

        toast.success("OS reaberta com sucesso");
      },

      onError: (error) => {
        toast.error(error.message);
      },
    });

  const cancelMutation =
    trpc.serviceOrders.cancel.useMutation({
      onSuccess: () => {
        utils.serviceOrders.get.invalidate({
          id: osId,
        });

        utils.serviceOrders.list.invalidate();
        utils.dashboard.summary.invalidate();

        toast.success("OS cancelada");
      },

      onError: (error) => {
        toast.error(error.message);
      },
    });

  // ==============================
  // LOADING
  // ==============================

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingCard />
      </DashboardLayout>
    );
  }

  // ==============================
  // ERRO
  // ==============================

  if (isError) {
    return (
      <DashboardLayout>
        <EmptyState
          title="Erro ao carregar a OS"
          description="Não foi possível carregar os dados da ordem de serviço."
          action={() =>
            utils.serviceOrders.get.invalidate({
              id: osId,
            })
          }
          actionLabel="Tentar novamente"
        />
      </DashboardLayout>
    );
  }

  // ==============================
  // NÃO ENCONTRADA
  // ==============================

  if (!data) {
    return (
      <DashboardLayout>
        <EmptyState
          title="OS não encontrada"
          description="Esta ordem de serviço não existe ou foi removida."
          action={() => setLocation("/os")}
          actionLabel="Voltar às OS"
        />
      </DashboardLayout>
    );
  }

  const { os, services, products } = data;

  const canComplete =
    os.status !== "concluida" &&
    os.status !== "cancelada";

  const isCompleted =
    os.status === "concluida";

  const isCancelled =
    os.status === "cancelada";

  return (
    <DashboardLayout>
      <div className="max-w-4xl">

        {/* CABEÇALHO */}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">

          <div className="flex items-center gap-3">

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/os")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                OS #{os.number}
              </h1>

              <div className="mt-1 flex items-center gap-2">

                <StatusBadge
                  status={os.status}
                  kind="os"
                />

                <span className="text-xs text-muted-foreground">
                  Aberta em {formatDateTime(os.openedAt)}
                </span>

              </div>
            </div>

          </div>

          {/* AÇÕES */}

          <div className="flex flex-wrap gap-2">

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setLocation(`/os/${osId}/editar`)
              }
            >
              <Edit3 className="h-3.5 w-3.5" />
              Editar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPrint(true)}
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </Button>

            {/* WHATSAPP */}

            <Button
              variant="outline"
              size="sm"
              className="border-green-600/40 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40"
              onClick={() => {
                try {
                  shareOsViaWhatsApp(
                    {
                      number: os.number,
                      status: os.status,

                      customerName:
                        os.customerName,

                      vehiclePlate:
                        os.vehiclePlate,

                      vehicleModel:
                        os.vehicleModel,

                      vehicleBrand:
                        os.vehicleBrand,

                      vehicleYear:
                        os.vehicleYear,

                      vehicleColor:
                        os.vehicleColor,

                      openedAt:
                        os.openedAt,

                      completedAt:
                        os.completedAt,

                      mileage:
                        os.mileage,

                      totalAmount:
                        os.totalAmount,

                      discount:
                        os.discount,

                      services: services.map((service) => ({
                        description:
                          service.description,

                        quantity:
                          service.quantity,

                        unitPrice:
                          service.unitPrice,

                        total:
                          service.total,
                      })),

                      products: products.map((product) => ({
                        description:
                          product.description,

                        quantity:
                          product.quantity,

                        unitPrice:
                          product.unitPrice,

                        discount:
                          product.discount,

                        total:
                          product.total,
                      })),

                      diagnostics:
                        os.diagnostics,
                    },

                    os.customerWhatsapp ??
                      os.customerPhone ??
                      null
                  );

                  toast.success(
                    "Abrindo WhatsApp com o resumo da OS"
                  );

                } catch (error) {

                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Não foi possível enviar pelo WhatsApp"
                  );

                }
              }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </Button>

            {/* CONCLUIR */}

            {canComplete && (
              <AlertDialog>

                <AlertDialogTrigger asChild>

                  <Button
                    size="sm"
                    className="bg-flame text-white hover:bg-flame/90"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Concluir
                  </Button>

                </AlertDialogTrigger>

                <AlertDialogContent>

                  <AlertDialogHeader>

                    <AlertDialogTitle>
                      Concluir ordem de serviço?
                    </AlertDialogTitle>

                    <AlertDialogDescription>
                      Ao concluir, as peças serão automaticamente baixadas
                      do estoque e uma receita será registrada no módulo
                      financeiro.
                    </AlertDialogDescription>

                  </AlertDialogHeader>

                  <AlertDialogFooter>

                    <AlertDialogCancel>
                      Cancelar
                    </AlertDialogCancel>

                    <AlertDialogAction
                      onClick={() =>
                        completeMutation.mutate({
                          id: osId,

                          status: "concluida",

                          services:
                            data.services.map((service) => ({
                              description:
                                service.description,

                              quantity:
                                service.quantity,

                              unitPrice:
                                service.unitPrice,
                            })),

                          products:
                            data.products.map((product) => ({
                              productId:
                                product.productId,

                              description:
                                product.description,

                              quantity:
                                product.quantity,

                              unitPrice:
                                product.unitPrice,

                              discount:
                                product.discount,
                            })),
                        } as never)
                      }
                      className="bg-flame hover:bg-flame/90"
                    >
                      {completeMutation.isPending
                        ? "Concluindo..."
                        : "Sim, concluir"}
                    </AlertDialogAction>

                  </AlertDialogFooter>

                </AlertDialogContent>

              </AlertDialog>
            )}

            {/* REABRIR */}

            {isCompleted && (
              <AlertDialog>

                <AlertDialogTrigger asChild>

                  <Button
                    variant="outline"
                    size="sm"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reabrir
                  </Button>

                </AlertDialogTrigger>

                <AlertDialogContent>

                  <AlertDialogHeader>

                    <AlertDialogTitle>
                      Reabrir ordem de serviço?
                    </AlertDialogTitle>

                    <AlertDialogDescription>
                      A receita registrada automaticamente será cancelada
                      no financeiro.
                    </AlertDialogDescription>

                  </AlertDialogHeader>

                  <AlertDialogFooter>

                    <AlertDialogCancel>
                      Cancelar
                    </AlertDialogCancel>

                    <AlertDialogAction
                      onClick={() =>
                        reopenMutation.mutate({
                          id: osId,
                        })
                      }
                    >
                      {reopenMutation.isPending
                        ? "Reabrindo..."
                        : "Sim, reabrir"}
                    </AlertDialogAction>

                  </AlertDialogFooter>

                </AlertDialogContent>

              </AlertDialog>
            )}

            {/* CANCELAR */}

            {!isCancelled && (
              <AlertDialog>

                <AlertDialogTrigger asChild>

                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/40 text-destructive"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancelar
                  </Button>

                </AlertDialogTrigger>

                <AlertDialogContent>

                  <AlertDialogHeader>

                    <AlertDialogTitle>
                      Cancelar ordem de serviço?
                    </AlertDialogTitle>

                    <AlertDialogDescription>
                      A OS será marcada como cancelada e os efeitos
                      automáticos no estoque e financeiro serão revertidos.
                    </AlertDialogDescription>

                  </AlertDialogHeader>

                  <AlertDialogFooter>

                    <AlertDialogCancel>
                      Manter
                    </AlertDialogCancel>

                    <AlertDialogAction
                      onClick={() =>
                        cancelMutation.mutate({
                          id: osId,
                        })
                      }
                      className="bg-destructive"
                    >
                      {cancelMutation.isPending
                        ? "Cancelando..."
                        : "Sim, cancelar"}
                    </AlertDialogAction>

                  </AlertDialogFooter>

                </AlertDialogContent>

              </AlertDialog>
            )}

          </div>

        </div>

        {/* CLIENTE E VEÍCULO */}

        <div className="mb-4 grid gap-4 md:grid-cols-2">

          <Card className="shadow-soft">

            <CardHeader className="pb-2">

              <CardTitle className="flex items-center gap-2 font-display text-sm">
                <User className="h-4 w-4" />
                Cliente
              </CardTitle>

            </CardHeader>

            <CardContent>

              {os.customerName ? (
                <div
                  className="cursor-pointer transition-colors hover:text-navy"
                  onClick={() =>
                    setLocation(`/clientes/${os.customerId}`)
                  }
                >
                  <p className="font-medium">
                    {os.customerName}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  —
                </p>
              )}

            </CardContent>

          </Card>

          <Card className="shadow-soft">

            <CardHeader className="pb-2">

              <CardTitle className="flex items-center gap-2 font-display text-sm">
                <Car className="h-4 w-4" />
                Veículo
              </CardTitle>

            </CardHeader>

            <CardContent>

              {os.vehiclePlate ? (
                <p className="font-medium">

                  <Badge
                    variant="outline"
                    className="mr-2 font-mono"
                  >
                    {os.vehiclePlate}
                  </Badge>

                  {os.vehicleModel}

                </p>
              ) : (
                <p className="text-muted-foreground">
                  —
                </p>
              )}

              {os.predictedAt && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">

                  <CalendarClock className="h-3 w-3" />

                  Previsão:{" "}
                  {formatDateTime(os.predictedAt)}

                </p>
              )}

              {os.mileage != null && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">

                  <Gauge className="h-3 w-3" />

                  Quilometragem:{" "}
                  {os.mileage.toLocaleString("pt-BR")} km

                </p>
              )}

            </CardContent>

          </Card>

        </div>

        {/* DIAGNÓSTICO E OBSERVAÇÕES */}

        <div className="grid gap-4 md:grid-cols-2">

          <Card className="shadow-soft">

            <CardHeader className="pb-2">

              <CardTitle className="flex items-center gap-2 font-display text-sm">
                <Stethoscope className="h-4 w-4" />
                Diagnóstico
              </CardTitle>

            </CardHeader>

            <CardContent>

              {os.diagnostics ? (
                <p className="whitespace-pre-wrap text-sm">
                  {os.diagnostics}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum diagnóstico registrado.
                </p>
              )}

            </CardContent>

          </Card>

          <Card className="shadow-soft">

            <CardHeader className="pb-2">

              <CardTitle className="flex items-center gap-2 font-display text-sm">
                <ScrollText className="h-4 w-4" />
                Observações
              </CardTitle>

            </CardHeader>

            <CardContent>

              {os.observations ? (
                <p className="whitespace-pre-wrap text-sm">
                  {os.observations}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sem observações.
                </p>
              )}

            </CardContent>

          </Card>

        </div>

        {/* FOTOS */}

        <div className="mt-4">
          <OsPhotosSection
            serviceOrderId={osId}
          />
        </div>

        {/* SERVIÇOS */}

        <Card className="mt-4 shadow-soft">

          <CardHeader className="pb-2">

            <CardTitle className="flex items-center gap-2 font-display text-sm">
              <Wrench className="h-4 w-4" />
              Serviços (mão de obra)
            </CardTitle>

          </CardHeader>

          <CardContent>

            {services.length === 0 ? (

              <p className="py-2 text-sm text-muted-foreground">
                Nenhum serviço registrado.
              </p>

            ) : (

              <div className="space-y-2">

                {services.map((service) => (

                  <div
                    key={service.id}
                    className="flex items-center justify-between text-sm"
                  >

                    <div>

                      <p className="font-medium">
                        {service.description}
                      </p>

                      <p className="text-xs text-muted-foreground">

                        {service.quantity}x{" "}
                        {formatBRL(service.unitPrice)}

                      </p>

                    </div>

                    <p className="font-medium text-navy">
                      {formatBRL(service.total)}
                    </p>

                  </div>

                ))}

              </div>

            )}

          </CardContent>

        </Card>

        {/* PEÇAS */}

        <Card className="mt-4 shadow-soft">

          <CardHeader className="pb-2">

            <CardTitle className="flex items-center gap-2 font-display text-sm">
              <Package className="h-4 w-4" />
              Peças aplicadas
            </CardTitle>

          </CardHeader>

          <CardContent>

            {products.length === 0 ? (

              <p className="py-2 text-sm text-muted-foreground">
                Nenhuma peça registrada.
              </p>

            ) : (

              <div className="space-y-2">

                {products.map((product) => (

                  <div
                    key={product.id}
                    className="flex items-center justify-between text-sm"
                  >

                    <div>

                      <p className="font-medium">
                        {product.description}
                      </p>

                      <p className="text-xs text-muted-foreground">

                        {product.quantity}x{" "}
                        {formatBRL(product.unitPrice)}

                        {product.discount
                          ? ` — desconto ${formatBRL(product.discount)}`
                          : ""}

                      </p>

                    </div>

                    <p className="font-medium text-navy">
                      {formatBRL(product.total)}
                    </p>

                  </div>

                ))}

              </div>

            )}

          </CardContent>

        </Card>

        {/* TOTAL */}

        <div className="mt-4 flex items-center justify-between rounded-xl border bg-navy p-5 text-primary-foreground shadow-soft">

          <div>

            <p className="text-xs uppercase tracking-wider opacity-70">
              Total da OS
            </p>

            <p className="font-display text-3xl font-bold">
              {formatBRL(os.totalAmount)}
            </p>

          </div>

          <div className="space-y-1 text-right text-xs opacity-80">

            {isCompleted && (
              <p>

                Concluída em{" "}

                {os.completedAt
                  ? formatDateTime(os.completedAt)
                  : "—"}

              </p>
            )}

            {isCancelled && (
              <p className="text-orange-300">
                Ordem de serviço cancelada
              </p>
            )}

          </div>

        </div>

      </div>

      {/* MODAL DE IMPRESSÃO */}

      {showPrint && (

        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm print:absolute print:inset-0 print:h-auto print:bg-white">

          <div className="flex min-h-full items-start justify-center p-4 print:min-h-0 print:p-0">

            <div className="relative my-8 w-full max-w-3xl print:my-0 print:max-w-none">

              <button
                onClick={() =>
                  setShowPrint(false)
                }
                className="absolute -right-2 -top-2 z-10 rounded-full bg-white p-2 shadow-lg transition-colors hover:bg-gray-100 print:hidden"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>

              <OsPrintView
                data={{
                  os,
                  services,
                  products,
                }}
              />

              <div className="mt-4 flex justify-center gap-3 print:hidden">

                <Button
                  size="sm"
                  className="bg-flame text-white hover:bg-flame/90"
                  onClick={() =>
                    window.print()
                  }
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir / Salvar PDF
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setShowPrint(false)
                  }
                >
                  Fechar
                </Button>

              </div>

            </div>

          </div>

        </div>

      )}

    </DashboardLayout>
  );
}