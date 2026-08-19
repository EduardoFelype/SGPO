import DashboardLayout from "@/components/DashboardLayout";
import { LoadingCard } from "@/components/sgpo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatBRL, formatDateTime } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { CalendarClock, FileSpreadsheet, FileText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Range = "today" | "7days" | "30days" | "month" | "year" | "custom";

const RANGE_LABEL: Record<Range, string> = {
  today: "Hoje",
  "7days": "Últimos 7 dias",
  "30days": "Últimos 30 dias",
  month: "Este mês",
  year: "Este ano",
  custom: "Personalizado",
};

function getRange(range: Range, customFrom?: string, customTo?: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
  let from = 0;
  let to = Date.now();
  switch (range) {
    case "today":
      from = todayStart;
      to = todayEnd;
      break;
    case "7days":
      from = Date.now() - 7 * 24 * 3600 * 1000;
      break;
    case "30days":
      from = Date.now() - 30 * 24 * 3600 * 1000;
      break;
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      break;
    case "year":
      from = new Date(now.getFullYear(), 0, 1).getTime();
      break;
    case "custom":
      if (customFrom) from = new Date(`${customFrom}T00:00:00`).getTime();
      if (customTo) to = new Date(`${customTo}T23:59:59`).getTime();
      break;
  }
  return { from, to };
}

function buildCsv(rows: (string | number)[][], header: string[]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [header.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\n");
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob(["\ufeff" + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  aguardando_aprovacao: "Aguardando aprovação",
  aguardando_peca: "Aguardando peça",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export default function Reports() {
  const [range, setRange] = useState<Range>("30days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [osSearch, setOsSearch] = useState("");
  const utils = trpc.useUtils();

  const { from, to } = useMemo(() => getRange(range, customFrom, customTo), [range, customFrom, customTo]);

  const osInput = useMemo(
    () => ({
      preset: range === "custom" ? ("custom" as const) : range,
      from: range === "custom" ? from : undefined,
      to: range === "custom" ? to : undefined,
    }),
    [range, from, to]
  );

  const { data: osRows, isLoading: osLoading } = trpc.serviceOrders.list.useQuery({
    search: osSearch || undefined,
    page: 1,
    limit: 100,
  });
  const { data: financialRows } = trpc.reports.financial.useQuery(osInput);
  const { data: customersRows } = trpc.reports.customers.useQuery();

  const osInRange = useMemo(() => {
    const rows = osRows?.rows ?? [];
    return rows.filter((r) => r.openedAt >= from && r.openedAt <= to);
  }, [osRows, from, to]);

  const finSummary = useMemo(() => {
    const rows = financialRows ?? [];
    const revenues = rows
      .filter((t) => t.type === "receita" && t.status !== "cancelado")
      .reduce((acc, t) => acc + t.amount, 0);
    const expenses = rows
      .filter((t) => t.type === "despesa" && t.status !== "cancelado")
      .reduce((acc, t) => acc + t.amount, 0);
    return { revenues, expenses, count: rows.length };
  }, [financialRows]);

  if (osLoading) return <DashboardLayout><LoadingCard /></DashboardLayout>;

  function exportOs(format: "csv" | "xlsx" | "pdf") {
    if (osInRange.length === 0) {
      toast.error("Não há OS no período selecionado para exportar");
      return;
    }
    const header = ["Número", "Status", "Cliente", "Veículo", "Abertura", "Conclusão", "Total (R$)"];
    const rows = osInRange.map((r) => [
      r.number,
      STATUS_LABEL[r.status] ?? r.status,
      r.customerName ?? "",
      r.vehiclePlate ? `${r.vehiclePlate} ${r.vehicleModel ?? ""}`.trim() : "",
      r.openedAt ? new Date(r.openedAt).toLocaleDateString("pt-BR") : "",
      r.completedAt ? new Date(r.completedAt).toLocaleDateString("pt-BR") : "",
      (r.totalAmount / 100).toFixed(2).replace(".", ","),
    ]);
    if (format === "pdf") {
      openPrintWindow(
        "Relatório de Ordens de Serviço",
        header,
        rows,
        `Total geral: ${formatBRL(osInRange.reduce((acc, r) => acc + r.totalAmount, 0))}`
      );
      toast.success("PDF gerado — use a opção de impressão para salvar");
      return;
    }
    downloadBlob(
      buildCsv(rows, header),
      `os_${new Date().toISOString().slice(0, 10)}.csv`,
      format === "xlsx" ? "application/vnd.ms-excel;charset=utf-8" : "text/csv;charset=utf-8"
    );
    toast.success(format === "xlsx" ? "Planilha exportada" : "CSV exportado");
  }

  function exportFinancial(format: "csv" | "xlsx" | "pdf") {
    const rows = financialRows ?? [];
    if (rows.length === 0) {
      toast.error("Não há lançamentos no período selecionado para exportar");
      return;
    }
    const header = ["Descrição", "Tipo", "Categoria", "Status", "Vencimento", "Pagamento", "Valor (R$)"];
    const dataRows = rows.map((r) => [
      r.description,
      r.type === "receita" ? "Receita" : "Despesa",
      r.category ?? "",
      r.status,
      new Date(r.dueAt).toLocaleDateString("pt-BR"),
      r.paidAt ? new Date(r.paidAt).toLocaleDateString("pt-BR") : "",
      (r.amount / 100).toFixed(2).replace(".", ","),
    ]);
    if (format === "pdf") {
      openPrintWindow("Relatório Financeiro", header, dataRows);
      toast.success("PDF gerado — use a opção de impressão para salvar");
      return;
    }
    downloadBlob(
      buildCsv(dataRows, header),
      `financeiro_${new Date().toISOString().slice(0, 10)}.csv`,
      format === "xlsx" ? "application/vnd.ms-excel;charset=utf-8" : "text/csv;charset=utf-8"
    );
    toast.success(format === "xlsx" ? "Planilha exportada" : "CSV exportado");
  }

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-navy">
            Relatórios
          </h1>
          <p className="text-sm text-muted-foreground">
            Análises do negócio com filtros de período
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="h-4 w-4" />
            <Label>Período:</Label>
          </div>
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RANGE_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {range === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-40"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-40"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* OS do período */}
        <Card className="shadow-soft lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base font-display">Ordens de Serviço</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(from).toLocaleDateString("pt-BR")} a{" "}
                {new Date(to).toLocaleDateString("pt-BR")} — {osInRange.length} OS
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={osSearch}
                  onChange={(e) => setOsSearch(e.target.value)}
                  placeholder="Buscar cliente"
                  className="pl-8 h-8 w-48 text-sm"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => exportOs("csv")} title="Exportar CSV">
                <FileText className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportOs("xlsx")} title="Exportar Excel (arquivo CSV compatível, aberto direto no Excel)">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportOs("pdf")} title="Exportar PDF">
                <FileText className="h-3.5 w-3.5" /> PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {osInRange.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma OS no período selecionado.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Abertura</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {osInRange.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.number}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.status === "concluida"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                              : r.status === "cancelada"
                                ? "bg-gray-200 text-gray-600"
                                : "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400"
                          }`}
                        >
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{r.customerName ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.vehiclePlate ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(r.openedAt)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-navy">
                        {formatBRL(r.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Resumo financeiro do período */}
        <Card className="shadow-soft">
          <CardHeader className="pb-2 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base font-display">Resumo financeiro</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receitas e despesas do período
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => exportFinancial("csv")} title="CSV">
                <FileText className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => exportFinancial("xlsx")} title="Exportar para Excel (arquivo CSV compatível)">
                <FileSpreadsheet className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => exportFinancial("pdf")} title="PDF">
                <FileText className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
              <span className="text-sm font-medium text-emerald-700">Receitas</span>
              <span className="font-display font-bold text-emerald-700">
                {formatBRL(finSummary.revenues)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <span className="text-sm font-medium text-red-700">Despesas</span>
              <span className="font-display font-bold text-red-700">
                {formatBRL(finSummary.expenses)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-navy text-primary-foreground px-3 py-2">
              <span className="text-sm font-medium">Saldo</span>
              <span className="font-display font-bold">
                {formatBRL(finSummary.revenues - finSummary.expenses)}
              </span>
            </div>
            <div className="pt-3 border-t">
              <p className="text-sm font-medium text-navy mb-1">Clientes cadastrados</p>
              <p className="font-display text-2xl font-bold">{customersRows?.length ?? 0}</p>
            </div>
            <div className="pt-1">
              <p className="text-sm font-medium text-navy mb-1">Lançamentos no período</p>
              <p className="font-display text-2xl font-bold">{finSummary.count}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function openPrintWindow(title: string, header: string[], rows: (string | number)[][], footer?: string) {
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Permita pop-ups para gerar o PDF");
    return;
  }
  win.document.write(`
    <html><head><title>${title} — SGPO</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#0f2440}
      h1{color:#0f2440;font-size:20px;margin:0}
      .sub{color:#6b7280;font-size:12px;margin:4px 0 16px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th{background:#0f2440;color:#fff;text-align:left;padding:8px}
      td{border-bottom:1px solid #e5e7eb;padding:7px 8px}
      tr:nth-child(even){background:#f8fafc}
      .total{margin-top:16px;font-weight:bold}
      .brand{color:#e8590c;font-size:14px;font-weight:bold}
    </style></head><body>
    <p class="brand">SGPO</p>
    <h1>${title}</h1>
    <table><thead><tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
    ${footer ? `<p class="total">${footer}</p>` : ""}
    </body></html>
  `);
  win.document.close();
  win.print();
}
