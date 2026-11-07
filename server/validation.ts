import { z } from "zod";
import {
  LIMITS,
  UF_LIST,
  cleanText,
  isValidCEP,
  isValidCNPJ,
  isValidCPF,
  isValidEmail,
  isValidPhone,
  isValidPlate,
  isValidVehicleYear,
  normalizePlate,
  onlyDigits,
} from "@shared/limits";

/* ------------------------------------------------------------------ */
/* Blocos reutilizáveis                                                */
/* ------------------------------------------------------------------ */

/** Texto obrigatório: remove espaços extras e limita o tamanho. */
export const requiredText = (label: string, max: number, min = 1) =>
  z
    .string()
    .transform(cleanText)
    .pipe(
      z
        .string()
        .min(min, min > 1 ? `${label} deve ter pelo menos ${min} caracteres` : `Informe ${label.toLowerCase()}`)
        .max(max, `${label} deve ter no máximo ${max} caracteres`)
    );

/** Texto opcional: vazio vira null. */
export const optionalText = (label: string, max: number) =>
  z
    .string()
    .transform((v) => cleanText(v))
    .pipe(z.string().max(max, `${label} deve ter no máximo ${max} caracteres`))
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/** Texto longo (mantém quebras de linha, só tira espaços nas pontas). */
export const optionalLongText = (label: string, max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(max, `${label} deve ter no máximo ${max} caracteres`))
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const moneyCents = (label: string, { min = 0, max: maxCents = LIMITS.moneyMaxCents } = {}) =>
  z
    .number({ error: `${label} inválido` })
    .int(`${label} deve estar em centavos`)
    .min(min, min > 0 ? `${label} deve ser maior que zero` : `${label} não pode ser negativo`)
    .max(maxCents, `${label} acima do limite permitido (R$ ${(maxCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})`);

export const searchInput = z.string().max(LIMITS.search, "Busca muito longa").optional();

export const listInput = z
  .object({
    search: searchInput,
    page: z.number().int().min(1).max(10_000).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .optional();

export const idInput = z.object({ id: z.number().int().positive() });

/* ------------------------------------------------------------------ */
/* Clientes                                                            */
/* ------------------------------------------------------------------ */

const optionalPhone = (label: string) =>
  z
    .string()
    .transform(onlyDigits)
    .refine((v) => v === "" || isValidPhone(v), `${label} inválido. Use DDD + número (10 ou 11 dígitos)`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const customerInput = z
  .object({
    type: z.enum(["cpf", "cnpj"]).default("cpf"),
    name: requiredText("Nome", LIMITS.nameMax, LIMITS.nameMin),
    document: z
      .string()
      .transform(onlyDigits)
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
    phone: optionalPhone("Telefone"),
    whatsapp: optionalPhone("WhatsApp"),
    email: z
      .string()
      .transform((v) => v.trim().toLowerCase())
      .refine((v) => v === "" || isValidEmail(v), "E-mail inválido")
      .refine((v) => v.length <= LIMITS.email, `E-mail deve ter no máximo ${LIMITS.email} caracteres`)
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
    zipCode: z
      .string()
      .transform(onlyDigits)
      .refine((v) => v === "" || isValidCEP(v), "CEP deve ter 8 dígitos")
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
    address: optionalText("Endereço", LIMITS.address),
    number: optionalText("Número", LIMITS.addressNumber),
    complement: optionalText("Complemento", LIMITS.complement),
    neighborhood: optionalText("Bairro", LIMITS.neighborhood),
    city: optionalText("Cidade", LIMITS.city),
    stateCode: z
      .string()
      .transform((v) => v.trim().toUpperCase())
      .refine((v) => v === "" || (UF_LIST as readonly string[]).includes(v), "UF inválida")
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
    notes: optionalLongText("Observações", LIMITS.notes),
  })
  .superRefine((data, ctx) => {
    if (!data.document) return;
    if (data.type === "cpf" && !isValidCPF(data.document)) {
      ctx.addIssue({ code: "custom", path: ["document"], message: "CPF inválido" });
    }
    if (data.type === "cnpj" && !isValidCNPJ(data.document)) {
      ctx.addIssue({ code: "custom", path: ["document"], message: "CNPJ inválido" });
    }
  });

/* ------------------------------------------------------------------ */
/* Veículos                                                            */
/* ------------------------------------------------------------------ */

export const vehicleInput = z.object({
  customerId: z.number().int().positive("Selecione o proprietário"),
  plate: z
    .string()
    .transform(normalizePlate)
    .refine(isValidPlate, "Placa inválida. Use o padrão ABC1234 ou Mercosul ABC1D23"),
  brand: requiredText("Marca", LIMITS.vehicleBrand),
  model: requiredText("Modelo", LIMITS.vehicleModel),
  year: z
    .string()
    .transform(onlyDigits)
    .refine((v) => v === "" || isValidVehicleYear(v), "Ano de fabricação inválido")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  color: optionalText("Cor", LIMITS.shortText),
  fuel: z.enum(["flex", "gasolina", "etanol", "diesel", "gnv", "eletrico"]).optional().nullable(),
  mileage: z
    .number()
    .int("Quilometragem deve ser um número inteiro")
    .min(0, "Quilometragem não pode ser negativa")
    .max(LIMITS.mileageMax, `Quilometragem acima do limite (${LIMITS.mileageMax.toLocaleString("pt-BR")} km)`)
    .optional(),
  notes: optionalLongText("Observações", LIMITS.notes),
});

/* ------------------------------------------------------------------ */
/* Ordens de serviço                                                   */
/* ------------------------------------------------------------------ */

const itemQuantity = z
  .number()
  .int("Quantidade deve ser um número inteiro")
  .min(1, "Quantidade mínima é 1")
  .max(LIMITS.itemQuantityMax, `Quantidade máxima por item é ${LIMITS.itemQuantityMax}`);

export const serviceItemInput = z.object({
  description: requiredText("Descrição do serviço", LIMITS.description),
  quantity: itemQuantity.optional(),
  unitPrice: moneyCents("Valor do serviço"),
});

export const productItemInput = z
  .object({
    productId: z.number().int().positive().nullable().optional(),
    description: requiredText("Descrição da peça", LIMITS.description),
    quantity: itemQuantity.optional(),
    unitPrice: moneyCents("Valor da peça"),
    discount: moneyCents("Desconto").optional(),
  })
  .refine((p) => (p.discount ?? 0) <= (p.quantity ?? 1) * p.unitPrice, {
    message: "O desconto não pode ser maior que o valor da peça",
    path: ["discount"],
  });

export const serviceItemsArray = z
  .array(serviceItemInput)
  .max(LIMITS.osItemsMax, `Máximo de ${LIMITS.osItemsMax} serviços por OS`);

export const productItemsArray = z
  .array(productItemInput)
  .max(LIMITS.osItemsMax, `Máximo de ${LIMITS.osItemsMax} peças por OS`);

export const osStatusEnum = z.enum([
  "aberta",
  "em_analise",
  "aguardando_aprovacao",
  "aguardando_peca",
  "em_andamento",
  "concluida",
  "cancelada",
]);

export const osMileage = z
  .number()
  .int()
  .min(0, "Quilometragem não pode ser negativa")
  .max(LIMITS.mileageMax, `Quilometragem acima do limite (${LIMITS.mileageMax.toLocaleString("pt-BR")} km)`);

/* ------------------------------------------------------------------ */
/* Estoque                                                             */
/* ------------------------------------------------------------------ */

const stockQty = (label: string) =>
  z
    .number()
    .int(`${label} deve ser um número inteiro`)
    .min(0, `${label} não pode ser negativo`)
    .max(LIMITS.stockQuantityMax, `${label} máximo é ${LIMITS.stockQuantityMax.toLocaleString("pt-BR")}`);

export const productInput = z
  .object({
    code: optionalText("Código", LIMITS.productCode),
    name: requiredText("Nome do produto", LIMITS.nameMax, 2),
    category: optionalText("Categoria", LIMITS.shortText),
    brand: optionalText("Marca", LIMITS.shortText),
    supplier: optionalText("Fornecedor", LIMITS.shortText),
    description: optionalLongText("Descrição", LIMITS.notes),
    quantity: stockQty("Quantidade").default(0),
    minStock: stockQty("Estoque mínimo").default(0),
    unit: z.enum(["un", "cx", "lt", "pc", "kit"]).default("un"),
    costPrice: moneyCents("Custo").default(0),
    salePrice: moneyCents("Preço de venda", { min: 1 }),
  });

export const stockMovementInput = z
  .object({
    productId: z.number().int().positive("Selecione o produto"),
    type: z.enum(["entrada", "saida", "ajuste"]),
    quantity: z
      .number()
      .int("Quantidade deve ser um número inteiro")
      .min(0, "Quantidade não pode ser negativa")
      .max(LIMITS.stockQuantityMax, `Quantidade máxima é ${LIMITS.stockQuantityMax.toLocaleString("pt-BR")}`),
    description: optionalText("Descrição", LIMITS.description),
  })
  .refine((m) => m.type === "ajuste" || m.quantity >= 1, {
    message: "Informe uma quantidade maior que zero",
    path: ["quantity"],
  });

/* ------------------------------------------------------------------ */
/* Financeiro                                                          */
/* ------------------------------------------------------------------ */

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export const transactionInput = z.object({
  description: requiredText("Descrição", LIMITS.description, 2),
  category: optionalText("Categoria", LIMITS.shortText),
  type: z.enum(["receita", "despesa"]),
  amount: moneyCents("Valor", { min: 1 }),
  dueAt: z
    .number()
    .int()
    .positive("Informe a data de vencimento")
    .refine(
      (v) => Math.abs(v - Date.now()) <= LIMITS.financialYearsRange * YEAR_MS,
      `Vencimento deve estar dentro de ${LIMITS.financialYearsRange} anos a partir de hoje`
    ),
  status: z.enum(["pendente", "pago", "cancelado", "atrasado"]).default("pendente"),
  paidAt: z.number().int().optional().nullable(),
  paymentMethod: z
    .enum(["dinheiro", "pix", "cartao_credito", "cartao_debito", "transferencia", "boleto", "outros"])
    .optional()
    .nullable(),
  sourceType: z.enum(["manual", "ordem_servico", "automatico"]).optional().nullable(),
  sourceId: z.number().int().positive().optional().nullable(),
  notes: optionalLongText("Observações", LIMITS.notes),
});
