/**
 * Aparência comum dos gráficos (Recharts), usando as variáveis de cor do tema
 * para funcionar igual no modo claro e no escuro.
 */
export const chartTheme = {
  grid: "var(--border)",
  axis: { fontSize: 11, fill: "var(--muted-foreground)" },
  tooltip: {
    contentStyle: {
      borderRadius: 10,
      border: "1px solid var(--border)",
      background: "var(--popover)",
      color: "var(--popover-foreground)",
      fontSize: 12,
      boxShadow: "0 8px 24px rgb(0 0 0 / 0.18)",
    },
    labelStyle: { color: "var(--muted-foreground)", fontSize: 12, marginBottom: 4 },
    itemStyle: { color: "var(--popover-foreground)" },
    cursor: { fill: "var(--muted)", opacity: 0.4 },
  },
} as const;

/** "2026-11-04" → "04/11" */
export function chartDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  return m ? `${m[3]}/${m[2]}` : String(value);
}

/** Centavos → "R$ 1,2 mil" no eixo do gráfico */
export function chartMoney(cents: number): string {
  const value = Number(cents) / 100;
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
