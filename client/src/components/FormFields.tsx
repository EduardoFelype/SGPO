/**
 * Campos de formulário do SGPO com limites embutidos.
 *
 * - MoneyInput: digita em centavos da direita para a esquerda (1 → 0,01; 1500 → 15,00),
 *   não aceita letras, sinal negativo nem valores acima do limite.
 * - IntegerInput: só números inteiros, com separador de milhar e teto máximo.
 * - CharCounter: mostra quantos caracteres restam quando o campo está perto do limite.
 */
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LIMITS } from "@shared/limits";
import * as React from "react";

type BaseProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "max" | "min">;

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function MoneyInput({
  value,
  onChange,
  max = LIMITS.moneyMaxCents,
  className,
  ...props
}: BaseProps & {
  /** Valor em centavos */
  value: number;
  onChange: (cents: number) => void;
  /** Valor máximo em centavos */
  max?: number;
}) {
  const maxDigits = String(max).length;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        {...props}
        inputMode="numeric"
        autoComplete="off"
        className={cn("pl-9 text-right tabular-nums", className)}
        value={formatCents(value || 0)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, maxDigits);
          const cents = Math.min(Number(digits || "0"), max);
          onChange(cents);
        }}
        onFocus={(e) => {
          // Cursor sempre no fim: a digitação preenche da direita para a esquerda
          const el = e.currentTarget;
          requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
          props.onFocus?.(e);
        }}
      />
    </div>
  );
}

export function IntegerInput({
  value,
  onChange,
  max,
  min = 0,
  suffix,
  thousands = true,
  className,
  ...props
}: BaseProps & {
  /** Valor atual; null = campo vazio */
  value: number | null;
  onChange: (value: number | null) => void;
  max: number;
  min?: number;
  suffix?: string;
  thousands?: boolean;
}) {
  const maxDigits = String(max).length;
  const display =
    value == null ? "" : thousands ? value.toLocaleString("pt-BR") : String(value);
  return (
    <div className="relative">
      <Input
        {...props}
        inputMode="numeric"
        autoComplete="off"
        className={cn(suffix && "pr-10", "tabular-nums", className)}
        value={display}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, maxDigits);
          if (digits === "") return onChange(null);
          onChange(Math.min(Number(digits), max));
        }}
        onBlur={(e) => {
          if (value != null && value < min) onChange(min);
          props.onBlur?.(e);
        }}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Mostra o contador apenas quando faltam 20% ou menos dos caracteres. */
export function CharCounter({ value, max, className }: { value: string; max: number; className?: string }) {
  const used = value.length;
  if (used < max * 0.8) return null;
  return (
    <p
      className={cn(
        "mt-1 text-right text-[11px] tabular-nums",
        used >= max ? "text-destructive" : "text-muted-foreground",
        className
      )}
    >
      {used}/{max}
    </p>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive mt-1">{message}</p>;
}

export function FieldHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[11px] text-muted-foreground mt-1", className)}>{children}</p>;
}
