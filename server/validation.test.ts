import { describe, expect, it } from "vitest";
import {
  LIMITS,
  isValidCNPJ,
  isValidCPF,
  isValidPhone,
  isValidPlate,
  isValidVehicleYear,
  normalizePlate,
} from "../shared/limits";
import {
  customerInput,
  productInput,
  productItemInput,
  serviceItemsArray,
  stockMovementInput,
  transactionInput,
  vehicleInput,
} from "./validation";
import { computeServiceOrderTotal } from "./db";

describe("validadores compartilhados", () => {
  it("CPF: aceita válido e recusa dígito errado ou repetido", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("529.982.247-24")).toBe(false);
    expect(isValidCPF("111.111.111-11")).toBe(false);
  });

  it("CNPJ: aceita válido e recusa inválido", () => {
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("11.222.333/0001-80")).toBe(false);
  });

  it("telefone: fixo de 10 dígitos e celular de 11 começando com 9", () => {
    expect(isValidPhone("(61) 3035-3900")).toBe(true);
    expect(isValidPhone("(61) 99999-0000")).toBe(true);
    expect(isValidPhone("(61) 89999-0000")).toBe(false);
    expect(isValidPhone("123")).toBe(false);
  });

  it("placa: padrão antigo e Mercosul", () => {
    expect(isValidPlate("abc-1234")).toBe(true);
    expect(isValidPlate("ABC1D23")).toBe(true);
    expect(isValidPlate("ABCD123")).toBe(false);
    expect(normalizePlate("abc-1d23")).toBe("ABC1D23");
  });

  it("ano do veículo entre 1950 e ano atual + 1", () => {
    const now = new Date("2026-06-01");
    expect(isValidVehicleYear("2027", now)).toBe(true);
    expect(isValidVehicleYear("2028", now)).toBe(false);
    expect(isValidVehicleYear("1949", now)).toBe(false);
  });
});

describe("schemas de entrada", () => {
  it("cliente: CPF inválido é recusado e textos são limpos", () => {
    const bad = customerInput.safeParse({ type: "cpf", name: "Ana", document: "123.456.789-00" });
    expect(bad.success).toBe(false);
    const ok = customerInput.parse({
      type: "cpf",
      name: "  Ana   Maria  ",
      document: "529.982.247-25",
      phone: "(61) 99999-0000",
      email: " ANA@EXEMPLO.COM ",
      stateCode: "df",
    });
    expect(ok.name).toBe("Ana Maria");
    expect(ok.document).toBe("52998224725");
    expect(ok.phone).toBe("61999990000");
    expect(ok.email).toBe("ana@exemplo.com");
    expect(ok.stateCode).toBe("DF");
  });

  it("cliente: nome acima do limite é recusado", () => {
    const res = customerInput.safeParse({ type: "cpf", name: "A".repeat(LIMITS.nameMax + 1) });
    expect(res.success).toBe(false);
  });

  it("veículo: placa normalizada, quilometragem e ano limitados", () => {
    const ok = vehicleInput.parse({ customerId: 1, plate: "abc-1d23", brand: "Fiat", model: "Uno", year: "2020" });
    expect(ok.plate).toBe("ABC1D23");
    expect(vehicleInput.safeParse({ customerId: 1, plate: "ABC1D23", brand: "Fiat", model: "Uno", mileage: LIMITS.mileageMax + 1 }).success).toBe(false);
    expect(vehicleInput.safeParse({ customerId: 1, plate: "ABC1D23", brand: "Fiat", model: "Uno", year: "3000" }).success).toBe(false);
    expect(vehicleInput.safeParse({ customerId: 1, plate: "ABC1D23", brand: " ", model: "Uno" }).success).toBe(false);
  });

  it("OS: quantidade, valor e desconto limitados", () => {
    expect(productItemInput.safeParse({ description: "Filtro", quantity: 1, unitPrice: 1000, discount: 2000 }).success).toBe(false);
    expect(productItemInput.safeParse({ description: "Filtro", quantity: LIMITS.itemQuantityMax + 1, unitPrice: 1000 }).success).toBe(false);
    expect(productItemInput.safeParse({ description: "Filtro", quantity: 1, unitPrice: LIMITS.moneyMaxCents + 1 }).success).toBe(false);
    expect(productItemInput.safeParse({ description: "Filtro", quantity: 1, unitPrice: 10.5 }).success).toBe(false);
    const tooMany = Array.from({ length: LIMITS.osItemsMax + 1 }, () => ({ description: "x", unitPrice: 1 }));
    expect(serviceItemsArray.safeParse(tooMany).success).toBe(false);
  });

  it("estoque: preço de venda obrigatório e quantidade sem infinito", () => {
    expect(productInput.safeParse({ name: "Óleo", salePrice: 0 }).success).toBe(false);
    expect(productInput.safeParse({ name: "Óleo", salePrice: 100, quantity: LIMITS.stockQuantityMax + 1 }).success).toBe(false);
    expect(stockMovementInput.safeParse({ productId: 1, type: "entrada", quantity: 0 }).success).toBe(false);
    expect(stockMovementInput.safeParse({ productId: 1, type: "entrada", quantity: -5 }).success).toBe(false);
    expect(stockMovementInput.safeParse({ productId: 1, type: "ajuste", quantity: 0 }).success).toBe(true);
  });

  it("financeiro: valor positivo e vencimento dentro de 10 anos", () => {
    const base = { description: "Aluguel", type: "despesa" as const, amount: 150000, dueAt: Date.now() };
    expect(transactionInput.safeParse(base).success).toBe(true);
    expect(transactionInput.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(transactionInput.safeParse({ ...base, dueAt: Date.now() + 20 * 365 * 24 * 3600 * 1000 }).success).toBe(false);
  });
});

describe("total da OS", () => {
  it("soma serviços e peças descontando, sem linha negativa", () => {
    const total = computeServiceOrderTotal(
      [{ description: "Mão de obra", quantity: 2, unitPrice: 5000 }],
      [
        { description: "Filtro", quantity: 1, unitPrice: 3000, discount: 500 },
        { description: "Brinde", quantity: 1, unitPrice: 100, discount: 999 },
      ]
    );
    expect(total).toBe(10000 + 2500 + 0);
  });
});
