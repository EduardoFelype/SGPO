import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, LoadingCard, StatCard } from "@/components/sgpo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatBRL,
  formatBRLCompact,
  formatDate,
  OS_STATUS_LABEL,
} from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  CalendarRange,
  Car,
  CheckCircle2,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "wouter";
import { StatusBadge } from "@/components/sgpo";

const CHART_COLORS = {
  receita: "#1d5a96",
  despesa: "#F26A1F",
  saldo: "#0B1B33",
  grid: "#e8edf4",
  text: "#5b6b85",
};

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError } = trpc.dashboard.summary.useQuery();
  const from = useMemo(() => Date.now() - days * 86_400_000, [days]);
  const { data: cashFlow } = trpc.dashboard.cashFlow.useQuery({ from, to: Date.now() });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Visão geral da sua oficina
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
            {[
              { label: "7d", days: 7 },
              { label: "30d", days: 30 },
              { label: "90d", days: 90 },
            ].map((o) => (
              <Button
                key={o.days}
                variant={days === o.days ? "default" : "ghost"}
                size="sm"
                onClick={() => setDays(o.days)}
                className={
                  days === o.days
                    ? "bg-navy hover:bg-navy-deep text-primary-foreground h-7"
                    : "h-7 text-muted-foreground"
                }
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading && <LoadingCard rows={4} />}
        {isError && <ErrorState />}

        {data && (
          <>
            <motion.div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.05,
                  },
                },
              }}
            >
              <motion.div className="contents" variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}>
              <StatCard
                label="OS abertas"
                value={data.openOs}
                hint="em andamento"
                icon={<Wrench className="h-4.5 w-4.5" />}
                tone="flame"
              />
              <StatCard
                label="OS concluídas"
                value={data.completedOs}
                hint={`receita ${formatBRLCompact(data.completedRevenue)}`}
                icon={<CheckCircle2 className="h-4.5 w-4.5" />}
                tone="success"
              />
              <StatCard
                label="Receitas"
                value={formatBRLCompact(data.totalRevenue)}
                hint={formatDate(data.periodFrom)}
                icon={<TrendingUp className="h-4.5 w-4.5" />}
                tone="navy"
              />
              <StatCard
                label="Despesas"
                value={formatBRLCompact(data.totalExpense)}
                hint={formatDate(data.periodFrom)}
                icon={<ArrowDownRight className="h-4.5 w-4.5" />}
                tone="flame"
              />
              <StatCard
                label="Saldo"
                value={formatBRLCompact(data.balance)}
                hint={formatDate(data.periodFrom)}
                icon={<Wallet className="h-4.5 w-4.5" />}
                tone="navy"
              />
              <StatCard
                label="Estoque crítico"
                value={data.lowStockCount}
                hint="itens abaixo do mínimo"
                icon={<AlertTriangle className="h-4.5 w-4.5" />}
                tone={data.lowStockCount > 0 ? "flame" : "muted"}
              />
              </motion.div>
            </motion.div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-2 shadow-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display">
                    Receita × Despesa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={(cashFlow ?? []).map((d) => ({
                          ...d,
                          date: new Date(`${d.date}T12:00:00`).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                          }),
                        }))}
                      >
                        <defs>
                          <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS.receita} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={CHART_COLORS.receita} stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="gDes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS.despesa} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={CHART_COLORS.despesa} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: CHART_COLORS.text }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickFormatter={(v) => `${(Number(v) / 100).toLocaleString("pt-BR")}`}
                          tick={{ fontSize: 11, fill: CHART_COLORS.text }}
                          tickLine={false}
                          axisLine={false}
                          width={64}
                        />
                        <RTooltip
                          formatter={(value: number, name: string) => [
                            formatBRL(value),
                            name === "receita" ? "Receitas" : "Despesas",
                          ]}
                          labelStyle={{ color: CHART_COLORS.text, fontSize: 12 }}
                          contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="receita"
                          stroke={CHART_COLORS.receita}
                          strokeWidth={2}
                          fill="url(#gRec)"
                        />
                        <Area
                          type="monotone"
                          dataKey="despesa"
                          stroke={CHART_COLORS.despesa}
                          strokeWidth={2}
                          fill="url(#gDes)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display">
                    Status das OS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                    data={data.osByStatus.map((s) => ({
                      label: OS_STATUS_LABEL[s.status] ?? s.status,
                      value: Number(s.count ?? 0),
                    }))}
                  >
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: CHART_COLORS.text }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: CHART_COLORS.text }}
                          tickLine={false}
                          axisLine={false}
                          width={28}
                        />
                        <RTooltip
                          cursor={{ fill: "rgba(15,42,77,0.05)" }}
                          contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                        />
                        <Bar dataKey="value" fill={CHART_COLORS.receita} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* OS recentes */}
              <Card className="shadow-soft">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-display">
                    Ordens de serviço recentes
                  </CardTitle>
                  <Link
                    href="/os"
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    Ver todas <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </CardHeader>
                <CardContent>
                  {data.recentOs.length === 0 ? (
                    <EmptyState
                      title="Nenhuma OS ainda"
                      description="Crie a primeira ordem de serviço para começar a operar."
                      action={() => (window.location.href = "/os")}
                      actionLabel="Criar OS"
                      icon={<Wrench className="h-6 w-6" />}
                    />
                  ) : (
                    <div className="space-y-2.5">
                      {data.recentOs.map((os) => (
                        <Link
                          key={os.id}
                          href={`/os/${os.id}`}
                          className="flex items-center gap-3 rounded-lg border bg-background/60 p-3 hover:border-primary/40 hover:bg-accent/30 transition-colors"
                        >
                          <span className="font-display text-sm font-bold text-navy">
                            #{String(os.number).padStart(6, "0")}
                          </span>
                          <span className="flex-1 min-w-0 text-sm truncate">
                            {os.customerName} · {os.vehiclePlate}
                          </span>
                          <StatusBadge status={os.status} kind="os" />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Alertas de estoque */}
              <Card className="shadow-soft">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-display">
                    Alertas de estoque mínimo
                  </CardTitle>
                  <Link
                    href="/estoque"
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    Ver estoque <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </CardHeader>
                <CardContent>
                  {data.lowStock.length === 0 ? (
                    <EmptyState
                      title="Estoque saudável"
                      description="Nenhum item está abaixo do estoque mínimo."
                      icon={<CheckCircle2 className="h-6 w-6" />}
                    />
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto">
                      {data.lowStock.map((p) => (
                        <Link
                          key={p.id}
                          href="/estoque"
                          className="flex items-center gap-3 rounded-lg border border-accent/60 bg-accent/20 p-3 hover:bg-accent/40 transition-colors"
                        >
                          <span className="h-8 w-8 rounded-lg bg-accent-foreground/10 text-accent-foreground flex items-center justify-center">
                            <AlertTriangle className="h-4 w-4" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="text-sm font-medium block truncate">{p.name}</span>
                            <span className="text-xs text-muted-foreground">
                              Mín. {p.minStock} {p.unit}
                            </span>
                          </span>
                          <Badge
                            variant="outline"
                            className="bg-accent-foreground text-accent border-transparent font-bold"
                          >
                            {p.quantity}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
