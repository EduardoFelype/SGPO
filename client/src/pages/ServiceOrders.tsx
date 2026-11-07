import DashboardLayout from "@/components/DashboardLayout";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { EmptyState, ErrorState, LoadingCard, PageHeader, StatusBadge } from "@/components/sgpo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { formatBRL, formatDate, formatDateTime, OS_STATUS_LABEL } from "@/lib/format";
import { LIMITS } from "@shared/limits";
import { trpc } from "@/lib/trpc";
import { FilePlus2, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function ServiceOrders() {
  const [cancelTarget, setCancelTarget] = useState<{
    id: number;
    number: string;
  } | null>(null);
  const [status, setStatus] = useState<
    | ""
    | "aberta"
    | "em_analise"
    | "aguardando_aprovacao"
    | "aguardando_peca"
    | "em_andamento"
    | "concluida"
    | "cancelada"
  >("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const invalidate = () => utils.serviceOrders.list.invalidate();

  const cancelMutation = trpc.serviceOrders.cancel.useMutation({
    onSuccess: () => {
      invalidate();
      utils.dashboard.summary.invalidate();
      toast.success("Ordem de serviço cancelada");
    },
    onError: (e) => toast.error(e.message),
  });

  const { data, isLoading, isError } = trpc.serviceOrders.list.useQuery({
    status: status || undefined,
    search: search || undefined,
    page: 1,
    limit: 50,
  } as const);

  const isFiltered = Boolean(search || status);
  /** Sem nenhuma OS e sem filtro: o botão de criar fica só no aviso central. */
  const isFirstUse = !isLoading && !isError && !isFiltered && (data?.total ?? 0) === 0;
  const clearFilters = () => {
    setSearch("");
    setSearchInput("");
    setStatus("");
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Ordens de Serviço"
        subtitle={`${data?.total ?? ""} ${data?.total === 1 ? "ordem de serviço" : "ordens de serviço"}`}
        action={!isFirstUse}
        actionLabel="Nova OS"
        onAction={() => setLocation("/os/nova")}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative min-w-64 flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            maxLength={LIMITS.search}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput.trim())}
            placeholder="Buscar por nº da OS, cliente ou placa"
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
        <Select value={status || "todos"} onValueChange={(v) => setStatus((v === "todos" ? "" : v) as typeof status)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(OS_STATUS_LABEL).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <LoadingCard />}
      {isError && <ErrorState retry={invalidate} />}

      {!isLoading && !isError && (data?.rows.length ?? 0) === 0 && (
        <EmptyState
          title={isFiltered ? "Nenhuma OS encontrada" : "Nenhuma ordem de serviço ainda"}
          description={
            isFiltered
              ? "Nenhuma OS corresponde à busca ou ao status escolhido."
              : "Crie uma nova OS para registrar serviços e peças aplicadas a um veículo."
          }
          action={isFiltered ? undefined : () => setLocation("/os/nova")}
          actionLabel="Criar OS"
          secondaryAction={isFiltered ? clearFilters : undefined}
          secondaryLabel="Limpar filtros"
          icon={<FilePlus2 className="h-6 w-6" />}
        />
      )}

      {data && data.rows.length > 0 && (
        <div className="rounded-xl border bg-card shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden xl:table-cell">Abertura</TableHead>
                <TableHead className="hidden lg:table-cell">Previsão</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((os) => (
                <TableRow
                  key={os.id}
                  className="cursor-pointer"
                  onClick={() => setLocation(`/os/${os.id}`)}
                >
                  <TableCell>
                    <span className="font-display font-bold tracking-wide text-navy whitespace-nowrap">
                      {os.number}
                    </span>
                  </TableCell>
                  <TableCell>{os.customerName ?? "—"}</TableCell>
                  <TableCell className="max-w-56">
                    <p className="font-medium tracking-wide">{os.vehiclePlate ?? "—"}</p>
                    {os.vehicleModel ? (
                      <p className="text-xs text-muted-foreground truncate" title={os.vehicleModel}>
                        {os.vehicleModel}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={os.status} kind="os" />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap hidden xl:table-cell">
                    {formatDateTime(os.openedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap hidden lg:table-cell">
                    {os.predictedAt ? formatDate(os.predictedAt) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                    {formatBRL(os.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {(os.status === "aberta" ||
                      os.status === "em_analise" ||
                      os.status === "aguardando_aprovacao" ||
                      os.status === "aguardando_peca") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCancelTarget({ id: os.id, number: os.number });
                        }}
                      >
                        Cancelar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <ConfirmDeleteDialog
        open={cancelTarget !== null}
        onOpenChange={(o) => !o && setCancelTarget(null)}
        title="Cancelar ordem de serviço?"
        description={
          cancelTarget
            ? `A OS ${cancelTarget.number} será cancelada e não poderá mais ser editada. Se precisar, ela pode ser reaberta depois na tela de detalhes.`
            : undefined
        }
        onConfirm={() => {
          if (cancelTarget) {
            cancelMutation.mutate({ id: cancelTarget.id });
            setCancelTarget(null);
          }
        }}
      />
    </DashboardLayout>
  );
}
