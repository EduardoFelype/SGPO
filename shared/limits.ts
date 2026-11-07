/**
 * Limites e validações de negócio do SGPO.
 *
 * Este arquivo é compartilhado entre o servidor (validação definitiva via Zod)
 * e a interface (limites de digitação, máscaras e mensagens), garantindo que
 * as duas pontas apliquem exatamente as mesmas regras.
 *
 * Valores monetários são sempre tratados em centavos (inteiros).
 */

export const LIMITS = {
  /** Nome de pessoa/empresa */
  nameMin: 2,
  nameMax: 120,
  /** Campos curtos: cor, categoria, marca de produto, fornecedor */
  shortText: 60,
  /** Descrição de itens, lançamentos e movimentações */
  description: 200,
  /** Observações gerais */
  notes: 1000,
  /** Diagnóstico e observações da OS */
  osText: 2000,
  email: 120,
  address: 150,
  addressNumber: 10,
  complement: 80,
  neighborhood: 80,
  city: 80,
  productCode: 30,
  search: 100,
  vehicleBrand: 80,
  vehicleModel: 120,

  /** Maior valor monetário de um item/lançamento: R$ 999.999,99 */
  moneyMaxCents: 99_999_999,
  /** Maior total de uma OS: R$ 9.999.999,99 */
  osTotalMaxCents: 999_999_999,
  /** Quantidade máxima de um item na OS */
  itemQuantityMax: 999,
  /** Quantidade máxima de linhas (serviços ou peças) por OS */
  osItemsMax: 50,
  /** Quantidade máxima em estoque e por movimentação */
  stockQuantityMax: 99_999,
  /** Quilometragem máxima aceita */
  mileageMax: 2_000_000,
  /** Ano mínimo de fabricação aceito */
  vehicleYearMin: 1950,
  /** Previsão de entrega: no máximo N dias à frente */
  osPredictionMaxDays: 365,
  /** Lançamentos financeiros: vencimento até N anos à frente/atrás */
  financialYearsRange: 10,
} as const;

/** Ano máximo de fabricação: ano atual + 1 (modelo do ano seguinte). */
export function vehicleYearMax(now = new Date()): number {
  return now.getFullYear() + 1;
}

export const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Remove espaços extras (início, fim e repetidos no meio). */
export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Valida CPF pelos dígitos verificadores. */
export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

/** Valida CNPJ pelos dígitos verificadores. */
export function isValidCNPJ(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(cnpj[i]) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

/** Telefone brasileiro: DDD válido + 8 dígitos (fixo) ou 9 dígitos começando com 9 (celular). */
export function isValidPhone(value: string): boolean {
  const phone = onlyDigits(value);
  if (phone.length !== 10 && phone.length !== 11) return false;
  const ddd = Number(phone.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (phone.length === 11 && phone[2] !== "9") return false;
  return true;
}

export function isValidCEP(value: string): boolean {
  return /^\d{8}$/.test(onlyDigits(value));
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Normaliza placa: maiúsculas, apenas letras e números. */
export function normalizePlate(value: string): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Placa antiga (ABC1234) ou padrão Mercosul (ABC1D23). */
export function isValidPlate(value: string): boolean {
  const plate = normalizePlate(value);
  return /^[A-Z]{3}\d{4}$/.test(plate) || /^[A-Z]{3}\d[A-Z]\d{2}$/.test(plate);
}

export function plateFormat(value: string): "antiga" | "mercosul" | null {
  const plate = normalizePlate(value);
  if (/^[A-Z]{3}\d{4}$/.test(plate)) return "antiga";
  if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(plate)) return "mercosul";
  return null;
}

export function isValidVehicleYear(value: string | number, now = new Date()): boolean {
  const year = Number(value);
  return Number.isInteger(year) && year >= LIMITS.vehicleYearMin && year <= vehicleYearMax(now);
}

/** Início do dia (00:00) em milissegundos. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const DAY_MS = 24 * 60 * 60 * 1000;
