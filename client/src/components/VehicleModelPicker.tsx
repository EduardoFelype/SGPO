import { SearchSelect } from "@/components/SearchSelect";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { LIMITS, vehicleYearMax } from "@shared/limits";
import { Bike, Car, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type FipeType = "cars" | "motorcycles" | "trucks";
export type Fuel = "" | "flex" | "gasolina" | "etanol" | "diesel" | "gnv" | "eletrico";

/** Converte o combustível descrito pela FIPE ("2020 Gasolina") para o enum do sistema. */
function fuelFromFipe(name: string): Fuel {
  const n = name.toLowerCase();
  if (n.includes("flex")) return "flex";
  if (n.includes("diesel")) return "diesel";
  if (n.includes("álcool") || n.includes("alcool") || n.includes("etanol")) return "etanol";
  if (n.includes("elétric") || n.includes("eletric")) return "eletrico";
  if (n.includes("gasolina")) return "gasolina";
  return "";
}

/**
 * Marca → modelo → ano, consultando a Tabela FIPE.
 * O usuário escolhe de uma lista em vez de digitar, evitando nomes errados de carro.
 */
export function VehicleModelPicker({
  brand,
  model,
  year,
  fuel,
  errors,
  onChange,
}: {
  brand: string;
  model: string;
  year: string;
  fuel: Fuel;
  errors?: { brand?: string; model?: string; year?: string };
  onChange: (patch: { brand?: string; model?: string; year?: string; fuel?: Fuel }) => void;
}) {
  const [type, setType] = useState<FipeType>("cars");
  const [brandCode, setBrandCode] = useState<string | null>(null);
  const [modelCode, setModelCode] = useState<string | null>(null);

  const brandsQuery = trpc.fipe.brands.useQuery(
    { type },
    { staleTime: 60 * 60 * 1000, retry: 1 }
  );
  const brands = brandsQuery.data?.items ?? [];
  const fipeOffline = brandsQuery.data?.source === "local" || brandsQuery.isError;

  // Na edição, descobre o código FIPE a partir do nome da marca já salvo
  useEffect(() => {
    if (brandCode || !brand || brands.length === 0) return;
    const match = brands.find((b) => b.name.toLowerCase() === brand.toLowerCase());
    if (match) setBrandCode(match.code);
  }, [brand, brands, brandCode]);

  const modelsQuery = trpc.fipe.models.useQuery(
    { type, brandCode: brandCode ?? "" },
    { enabled: Boolean(brandCode) && !brandCode?.startsWith("local:"), staleTime: 60 * 60 * 1000, retry: 1 }
  );
  const models = modelsQuery.data?.items ?? [];

  useEffect(() => {
    if (modelCode || !model || models.length === 0) return;
    const match = models.find((m) => m.name.toLowerCase() === model.toLowerCase());
    if (match) setModelCode(match.code);
  }, [model, models, modelCode]);

  const yearsQuery = trpc.fipe.years.useQuery(
    { type, brandCode: brandCode ?? "", modelCode: modelCode ?? "" },
    { enabled: Boolean(brandCode && modelCode), staleTime: 60 * 60 * 1000, retry: 1 }
  );

  /** Anos: os da FIPE para o modelo escolhido; senão, todos de (ano atual + 1) até 1950. */
  const yearItems = useMemo(() => {
    const fipeYears = (yearsQuery.data?.items ?? [])
      .map((y) => {
        const yr = y.name.slice(0, 4);
        const isZero = y.code.startsWith("32000");
        return {
          value: y.code,
          label: isZero ? String(new Date().getFullYear()) : yr,
          hint: isZero ? "0 km" : y.name.slice(5),
          fuel: fuelFromFipe(y.name),
        };
      })
      .filter((y) => /^\d{4}$/.test(y.label));
    if (fipeYears.length > 0) return fipeYears;
    const max = vehicleYearMax();
    return Array.from({ length: max - LIMITS.vehicleYearMin + 1 }, (_, i) => {
      const y = String(max - i);
      return { value: y, label: y, hint: undefined, fuel: "" as Fuel };
    });
  }, [yearsQuery.data]);

  const typeIcon = { cars: Car, motorcycles: Bike, trucks: Truck } as const;

  return (
    <>
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">Tipo de veículo (para a busca na Tabela FIPE)</Label>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={type}
          onValueChange={(v) => {
            if (!v) return;
            setType(v as FipeType);
            setBrandCode(null);
            setModelCode(null);
          }}
        >
          {(["cars", "motorcycles", "trucks"] as const).map((t) => {
            const Icon = typeIcon[t];
            return (
              <ToggleGroupItem key={t} value={t} className="gap-1 px-2.5 text-xs" aria-label={t}>
                <Icon className="h-3.5 w-3.5" />
                {t === "cars" ? "Carro" : t === "motorcycles" ? "Moto" : "Caminhão"}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      <div>
        <Label>Marca *</Label>
        <SearchSelect
          items={brands.map((b) => ({ value: b.code, label: b.name }))}
          value={brand}
          loading={brandsQuery.isLoading}
          invalid={Boolean(errors?.brand)}
          placeholder="Selecione a marca"
          searchPlaceholder="Digite para filtrar (ex.: Fiat)"
          emptyText="Marca não encontrada na Tabela FIPE."
          allowCustom
          customMaxLength={LIMITS.vehicleBrand}
          onSelect={(item) => {
            setBrandCode(item.value);
            setModelCode(null);
            onChange({ brand: item.label, model: "", year: "" });
          }}
          onCustom={(text) => {
            setBrandCode(null);
            setModelCode(null);
            onChange({ brand: text, model: "", year: "" });
          }}
        />
        {errors?.brand ? (
          <p className="text-xs text-destructive mt-1">{errors.brand}</p>
        ) : (
          fipeOffline && (
            <p className="text-[11px] text-amber-600 mt-1">
              Tabela FIPE indisponível agora — usando lista básica de marcas.
            </p>
          )
        )}
      </div>

      <div>
        <Label>Modelo *</Label>
        <SearchSelect
          items={models.map((m) => ({ value: m.code, label: m.name }))}
          value={model}
          wide
          loading={modelsQuery.isLoading && Boolean(brandCode)}
          disabled={!brand}
          invalid={Boolean(errors?.model)}
          placeholder={brand ? "Selecione o modelo" : "Escolha a marca primeiro"}
          searchPlaceholder="Digite para filtrar (ex.: Onix)"
          emptyText={
            brandCode && !brandCode.startsWith("local:")
              ? "Modelo não encontrado na Tabela FIPE."
              : "Lista de modelos indisponível para esta marca."
          }
          allowCustom
          customMaxLength={LIMITS.vehicleModel}
          onSelect={(item) => {
            setModelCode(item.value);
            onChange({ model: item.label, year: "" });
          }}
          onCustom={(text) => {
            setModelCode(null);
            onChange({ model: text });
          }}
        />
        {errors?.model && <p className="text-xs text-destructive mt-1">{errors.model}</p>}
      </div>

      <div>
        <Label>Ano</Label>
        <SearchSelect
          items={yearItems.map((y) => ({ value: y.value, label: y.label, hint: y.hint }))}
          value={year}
          loading={yearsQuery.isLoading && Boolean(modelCode)}
          invalid={Boolean(errors?.year)}
          placeholder="Selecione o ano"
          searchPlaceholder="Digite o ano"
          emptyText="Ano fora do intervalo permitido."
          onSelect={(item) => {
            const picked = yearItems.find((y) => y.value === item.value);
            onChange({
              year: item.label,
              // Só preenche o combustível se ainda não foi escolhido
              ...(picked?.fuel && !fuel ? { fuel: picked.fuel } : {}),
            });
          }}
        />
        <p className={cn("text-[11px] mt-1", errors?.year ? "text-destructive" : "text-muted-foreground")}>
          {errors?.year ??
            (modelCode && (yearsQuery.data?.items.length ?? 0) > 0
              ? "Anos disponíveis na FIPE para este modelo"
              : `De ${LIMITS.vehicleYearMin} a ${vehicleYearMax()}`)}
        </p>
      </div>
    </>
  );
}
