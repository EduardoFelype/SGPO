import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useState } from "react";

export type SearchSelectItem = { value: string; label: string; hint?: string };

/**
 * Lista pesquisável (combobox). Evita digitação livre: o usuário escolhe um item da lista.
 * Se `allowCustom` estiver ativo, o texto digitado pode ser usado quando não houver resultado.
 */
export function SearchSelect({
  items,
  value,
  onSelect,
  onCustom,
  placeholder,
  searchPlaceholder = "Pesquisar...",
  emptyText = "Nada encontrado.",
  loading,
  disabled,
  invalid,
  allowCustom,
  customMaxLength = 120,
  wide,
  className,
}: {
  /** Lista mais larga que o botão (para nomes longos, como modelos da FIPE) */
  wide?: boolean;
  items: SearchSelectItem[];
  /** Texto exibido no botão (valor atual) */
  value: string;
  onSelect: (item: SearchSelectItem) => void;
  onCustom?: (text: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  allowCustom?: boolean;
  customMaxLength?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const trimmed = query.replace(/\s+/g, " ").trim();

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-9 px-3",
            !value && "text-muted-foreground",
            invalid && "border-destructive",
            className
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-60" />
          ) : (
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-64 max-w-[min(28rem,calc(100vw-2rem))]"
        style={{ width: wide ? "28rem" : undefined }}
        align="start"
        collisionPadding={16}
      >
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={(v) => setQuery(v.slice(0, customMaxLength))}
            maxLength={customMaxLength}
          />
          <CommandList className="max-h-64">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <p className="text-sm text-muted-foreground">{emptyText}</p>
                  {allowCustom && trimmed.length >= 2 && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="mt-1 h-auto p-0 text-xs"
                      onClick={() => {
                        onCustom?.(trimmed);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      Usar “{trimmed}” mesmo assim
                    </Button>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem
                      key={item.value}
                      value={`${item.label} ${item.value}`}
                      onSelect={() => {
                        onSelect(item);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4",
                          value && value.toLowerCase() === item.label.toLowerCase() ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className={wide ? "whitespace-normal leading-snug" : "truncate"}>{item.label}</span>
                      {item.hint && (
                        <span className="ml-auto text-xs text-muted-foreground">{item.hint}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
