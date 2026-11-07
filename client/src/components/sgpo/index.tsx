import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  OS_STATUS_LABEL,
  FIN_STATUS_LABEL,
  STOCK_TYPE_LABEL,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  CircleDot,
  Clock,
  FileSearch,
  HelpCircle,
  Inbox,
  Loader2,
  PackageX,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

/* ----------------------------- PageHeader ----------------------------- */

export function PageHeader({
  title,
  subtitle,
  action,
  actionLabel = "Novo",
  actionHref,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: boolean;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  const button = (
    <Button
      onClick={onAction}
      className="bg-navy hover:bg-navy-deep text-primary-foreground shadow-soft"
    >
      <Plus className="h-4 w-4" />
      {actionLabel}
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {action &&
        (actionHref ? (
          <Link href={actionHref}>{button}</Link>
        ) : (
          button
        ))}
    </div>
  );
}

/* ------------------------------ StatCard ------------------------------ */

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "navy",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "navy" | "flame" | "success" | "muted";
  className?: string;
}) {
  const toneClasses = {
    navy: "bg-card",
    flame: "bg-card",
    success: "bg-card",
    muted: "bg-card",
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-xl border bg-card p-5 shadow-soft flex flex-col gap-3",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center",
              tone === "navy" && "bg-navy/10 text-navy",
              tone === "flame" && "bg-accent text-accent-foreground",
              tone === "success" && "bg-emerald-500/10 text-emerald-600",
              tone === "muted" && "bg-muted text-muted-foreground"
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="font-display text-3xl font-bold tracking-tight">
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </motion.div>
  );
}

/* ----------------------------- StatusBadge ---------------------------- */

/** Cores dos selos — cada uma com versão para o tema escuro. */
const TONE = {
  sky: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  violet: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  amber: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  orange: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  blue: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  emerald: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  red: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
  gray: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10",
};

const OS_STATUS_STYLES: Record<string, string> = {
  aberta: TONE.sky,
  em_analise: TONE.violet,
  aguardando_aprovacao: TONE.amber,
  aguardando_peca: TONE.orange,
  em_andamento: TONE.blue,
  concluida: TONE.emerald,
  cancelada: `${TONE.gray} line-through decoration-1`,
};

const FIN_STATUS_STYLES: Record<string, string> = {
  pendente: TONE.amber,
  pago: TONE.emerald,
  cancelado: TONE.gray,
  atrasado: TONE.red,
};

const STOCK_TYPE_STYLES: Record<string, string> = {
  entrada: TONE.emerald,
  saida: TONE.orange,
  ajuste: TONE.gray,
};

export function StatusBadge({
  status,
  kind = "os",
}: {
  status: string;
  kind?: "os" | "fin" | "stock";
}) {
  let label = status;
  let style = "bg-muted text-muted-foreground border";
  if (kind === "os" && OS_STATUS_LABEL[status]) {
    label = OS_STATUS_LABEL[status];
    style = OS_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border";
  } else if (kind === "fin" && FIN_STATUS_LABEL[status]) {
    label = FIN_STATUS_LABEL[status];
    style = FIN_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border";
  } else if (kind === "stock" && STOCK_TYPE_LABEL[status]) {
    label = STOCK_TYPE_LABEL[status];
    style = STOCK_TYPE_STYLES[status] ?? "bg-muted text-muted-foreground border";
  }
  return (
    <Badge variant="outline" className={cn("font-medium border", style)}>
      {label}
    </Badge>
  );
}

/* ------------------------------- EmptyState --------------------------- */

/**
 * Lista vazia. Use `action` só quando a página ainda não mostra o mesmo botão no topo
 * (ex.: primeira vez, sem cadastro). Com busca/filtro ativo, use `secondaryAction` para limpar.
 */
export function EmptyState({
  title,
  description,
  action,
  actionLabel = "Começar agora",
  secondaryAction,
  secondaryLabel = "Limpar busca",
  icon,
}: {
  title: string;
  description?: string;
  action?: () => void;
  actionLabel?: string;
  secondaryAction?: () => void;
  secondaryLabel?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-card/60 py-14 px-6 flex flex-col items-center justify-center text-center gap-3">
      <div className="h-14 w-14 rounded-2xl bg-accent/60 ring-1 ring-border flex items-center justify-center text-muted-foreground">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="font-display font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Button
              onClick={action}
              className="bg-navy hover:bg-navy-deep text-primary-foreground shadow-soft"
            >
              <Plus className="h-4 w-4" />
              {actionLabel}
            </Button>
          )}
          {secondaryAction && (
            <Button onClick={secondaryAction} variant="outline">
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ LoadingCard --------------------------- */

export function LoadingCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-muted/60 animate-pulse" />
      ))}
    </div>
  );
}

/* -------------------------------- Errors ------------------------------ */

export function ErrorState({
  message = "Não foi possível carregar os dados.",
  retry,
}: {
  message?: string;
  retry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 py-12 px-6 flex flex-col items-center text-center gap-3">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <h3 className="font-medium text-foreground">Ocorreu um erro</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

/* ------------------------------- Icons -------------------------------- */

export const STATUS_ICONS = {
  aberta: CircleDot,
  em_analise: HelpCircle,
  aguardando_aprovacao: Clock,
  aguardando_peca: PackageX,
  em_andamento: Loader2,
  concluida: CheckCircle2,
  cancelada: Ban,
  estoque: AlertTriangle,
};
