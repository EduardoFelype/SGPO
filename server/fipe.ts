/**
 * Integração com a Tabela FIPE (API pública e gratuita do Parallelum).
 * Documentação: https://deividfortuna.github.io/fipe/v2/
 *
 * As consultas passam pelo servidor para:
 * - guardar em cache (marcas e modelos quase nunca mudam) e economizar a cota gratuita;
 * - não depender de CORS no navegador;
 * - ter um tempo limite e uma lista reserva de marcas se a API estiver fora do ar.
 */

export type FipeVehicleType = "cars" | "motorcycles" | "trucks";
export type FipeItem = { code: string; name: string };

const BASE_URL = process.env.FIPE_API_URL ?? "https://fipe.parallelum.com.br/api/v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;

const cache = new Map<string, { at: number; data: FipeItem[] }>();

/** Marcas mais comuns no Brasil, usadas apenas se a API FIPE estiver indisponível. */
const FALLBACK_CAR_BRANDS = [
  "Audi", "BMW", "BYD", "Caoa Chery", "Chevrolet", "Citroën", "Fiat", "Ford", "Honda",
  "Hyundai", "Jac", "Jeep", "Kia", "Land Rover", "Mercedes-Benz", "Mini", "Mitsubishi",
  "Nissan", "Peugeot", "Porsche", "RAM", "Renault", "Suzuki", "Toyota", "Troller",
  "Volkswagen", "Volvo",
];
const FALLBACK_MOTO_BRANDS = [
  "BMW", "Dafra", "Ducati", "Harley-Davidson", "Honda", "Kawasaki", "Royal Enfield",
  "Shineray", "Suzuki", "Triumph", "Yamaha",
];

function fallbackBrands(type: FipeVehicleType): FipeItem[] {
  const list = type === "motorcycles" ? FALLBACK_MOTO_BRANDS : type === "cars" ? FALLBACK_CAR_BRANDS : [];
  return list.map((name) => ({ code: `local:${name}`, name }));
}

async function fetchJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.FIPE_API_TOKEN) headers["X-Subscription-Token"] = process.env.FIPE_API_TOKEN;
    const res = await fetch(`${BASE_URL}${path}`, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`FIPE respondeu ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function toItems(raw: unknown): FipeItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is { code: unknown; name: unknown } => typeof r === "object" && r !== null)
    .map((r) => ({ code: String(r.code), name: String(r.name).trim() }))
    .filter((r) => r.code && r.name);
}

async function cached(key: string, path: string): Promise<FipeItem[]> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  try {
    const data = toItems(await fetchJson(path));
    if (data.length > 0) cache.set(key, { at: Date.now(), data });
    return data;
  } catch (error) {
    // Se já tínhamos dados (mesmo vencidos), usa-os em vez de falhar.
    if (hit) return hit.data;
    throw error;
  }
}

export async function fipeBrands(type: FipeVehicleType) {
  try {
    const items = await cached(`brands:${type}`, `/${type}/brands`);
    return { source: "fipe" as const, items };
  } catch (error) {
    console.warn("[FIPE] marcas indisponíveis, usando lista local:", (error as Error).message);
    return { source: "local" as const, items: fallbackBrands(type) };
  }
}

export async function fipeModels(type: FipeVehicleType, brandCode: string) {
  if (brandCode.startsWith("local:")) return { source: "local" as const, items: [] };
  try {
    const items = await cached(`models:${type}:${brandCode}`, `/${type}/brands/${brandCode}/models`);
    return { source: "fipe" as const, items };
  } catch (error) {
    console.warn("[FIPE] modelos indisponíveis:", (error as Error).message);
    return { source: "local" as const, items: [] };
  }
}

export async function fipeYears(type: FipeVehicleType, brandCode: string, modelCode: string) {
  if (brandCode.startsWith("local:")) return { source: "local" as const, items: [] };
  try {
    const items = await cached(
      `years:${type}:${brandCode}:${modelCode}`,
      `/${type}/brands/${brandCode}/models/${modelCode}/years`
    );
    return { source: "fipe" as const, items };
  } catch (error) {
    console.warn("[FIPE] anos indisponíveis:", (error as Error).message);
    return { source: "local" as const, items: [] };
  }
}
