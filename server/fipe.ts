/**
 * Integração com a Tabela FIPE.
 *
 * Fonte principal: BrasilAPI (gratuita, sem chave) — https://brasilapi.com.br/docs#tag/FIPE
 * Fonte reserva:   API FIPE do Parallelum — https://deividfortuna.github.io/fipe/v2/
 * As duas usam os mesmos códigos de marca e modelo da Tabela FIPE oficial.
 *
 * As consultas passam pelo servidor para:
 * - guardar em cache (marcas e modelos quase nunca mudam) e economizar a cota gratuita;
 * - não depender de CORS no navegador;
 * - ter um tempo limite e uma lista reserva de marcas se a API estiver fora do ar.
 */

export type FipeVehicleType = "cars" | "motorcycles" | "trucks";
export type FipeItem = { code: string; name: string };

const BASE_URL = process.env.FIPE_API_URL ?? "https://fipe.parallelum.com.br/api/v2";
const BRASILAPI_URL = process.env.BRASILAPI_URL ?? "https://brasilapi.com.br/api/fipe";
const BRASILAPI_TYPE: Record<FipeVehicleType, string> = {
  cars: "carros",
  motorcycles: "motos",
  trucks: "caminhoes",
};
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

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`FIPE respondeu ${res.status}`);
    // Algumas APIs devolvem uma página HTML (ex.: verificação anti-robô) em vez de JSON.
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("json")) throw new Error(`FIPE respondeu ${type || "sem JSON"}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Parallelum: [{ code, name }] */
function fromParallelum(raw: unknown): FipeItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is { code: unknown; name: unknown } => typeof r === "object" && r !== null)
    .map((r) => ({ code: String(r.code ?? ""), name: String(r.name ?? "").trim() }))
    .filter((r) => r.code && r.name);
}

/** BrasilAPI: marcas [{ nome, valor }] e modelos [{ modelo, valor }] */
function fromBrasilApi(raw: unknown): FipeItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({ code: String(r.valor ?? ""), name: String(r.nome ?? r.modelo ?? "").trim() }))
    .filter((r) => r.code && r.name && !seen.has(r.code) && Boolean(seen.add(r.code)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function parallelum(path: string) {
  return async () => {
    const headers: Record<string, string> = {};
    if (process.env.FIPE_API_TOKEN) headers["X-Subscription-Token"] = process.env.FIPE_API_TOKEN;
    return fromParallelum(await fetchJson(`${BASE_URL}${path}`, headers));
  };
}

function brasilApi(path: string) {
  return async () => fromBrasilApi(await fetchJson(`${BRASILAPI_URL}${path}`));
}

/** Tenta cada fonte na ordem e guarda em cache a primeira que trouxer dados. */
async function cached(key: string, sources: Array<() => Promise<FipeItem[]>>): Promise<FipeItem[]> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  let lastError: unknown = null;
  for (const source of sources) {
    try {
      const data = await source();
      if (data.length > 0) {
        cache.set(key, { at: Date.now(), data });
        return data;
      }
    } catch (error) {
      lastError = error;
    }
  }
  // Se já tínhamos dados (mesmo vencidos), usa-os em vez de falhar.
  if (hit) return hit.data;
  if (lastError) throw lastError;
  return [];
}

export async function fipeBrands(type: FipeVehicleType) {
  try {
    const items = await cached(`brands:${type}`, [
      brasilApi(`/marcas/v1/${BRASILAPI_TYPE[type]}`),
      parallelum(`/${type}/brands`),
    ]);
    if (items.length === 0) throw new Error("lista vazia");
    return { source: "fipe" as const, items };
  } catch (error) {
    console.warn("[FIPE] marcas indisponíveis, usando lista local:", (error as Error).message);
    return { source: "local" as const, items: fallbackBrands(type) };
  }
}

export async function fipeModels(type: FipeVehicleType, brandCode: string) {
  if (brandCode.startsWith("local:")) return { source: "local" as const, items: [] };
  try {
    const items = await cached(`models:${type}:${brandCode}`, [
      brasilApi(`/veiculos/v1/${BRASILAPI_TYPE[type]}/${encodeURIComponent(brandCode)}`),
      parallelum(`/${type}/brands/${encodeURIComponent(brandCode)}/models`),
    ]);
    return { source: "fipe" as const, items };
  } catch (error) {
    console.warn("[FIPE] modelos indisponíveis:", (error as Error).message);
    return { source: "local" as const, items: [] };
  }
}

export async function fipeYears(type: FipeVehicleType, brandCode: string, modelCode: string) {
  if (brandCode.startsWith("local:")) return { source: "local" as const, items: [] };
  try {
    // A BrasilAPI não lista anos por modelo; sem a Parallelum, a tela mostra todos os anos permitidos.
    const items = await cached(`years:${type}:${brandCode}:${modelCode}`, [
      parallelum(`/${type}/brands/${encodeURIComponent(brandCode)}/models/${encodeURIComponent(modelCode)}/years`),
    ]);
    return { source: "fipe" as const, items };
  } catch (error) {
    console.warn("[FIPE] anos indisponíveis:", (error as Error).message);
    return { source: "local" as const, items: [] };
  }
}
