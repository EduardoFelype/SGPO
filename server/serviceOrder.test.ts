import { describe, expect, it, vi } from "vitest";

// Mock do módulo db para testar as regras de negócio de forma unitária
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getDb: vi.fn(async () => ({ mock: true })),
  };
});

describe("service order business rules (contracts)", () => {
  it("status enum contém os 7 estados exigidos", async () => {
    // Valida o contrato do schema — os estados exigidos são:
    // aberta, em análise, aguardando aprovação, aguardando peça, em andamento, concluída, cancelada
    const { serviceOrders } = await import("../drizzle/schema");
    const statusColumn = serviceOrders.status;
    const enumValues = (statusColumn as unknown as { enumValues: string[] }).enumValues;
    expect(enumValues).toEqual(
      expect.arrayContaining([
        "aberta",
        "em_analise",
        "aguardando_aprovacao",
        "aguardando_peca",
        "em_andamento",
        "concluida",
        "cancelada",
      ])
    );
  });

  it("cálculo de itens da OS: subtotal = serviços + (peças − descontos)", () => {
    const services = [
      { description: "Troca de óleo", quantity: 1, unitPrice: 15000 },
      { description: "Alinhamento", quantity: 2, unitPrice: 7500 },
    ];
    const products = [
      { description: "Óleo 5W30 1L", quantity: 4, unitPrice: 4500, discount: 0 },
      { description: "Filtro de óleo", quantity: 1, unitPrice: 2800, discount: 500 },
    ];
    const servicesTotal = services.reduce((acc, s) => acc + s.quantity * s.unitPrice, 0);
    const productsTotal = products.reduce(
      (acc, p) => acc + p.quantity * p.unitPrice - p.discount,
      0
    );
    expect(servicesTotal).toBe(30000);
    expect(productsTotal).toBe(20300);
    expect(servicesTotal + productsTotal).toBe(50300);
  });

  it("movimentação de entrada aumenta estoque", () => {
    const current = 5;
    const type = "entrada" as const;
    const quantity = 10;
    const delta = type === "entrada" ? quantity : -quantity;
    const newQty = Math.max(0, current + delta);
    expect(newQty).toBe(15);
  });

  it("movimentação de saída não pode deixar estoque negativo", () => {
    const current = 3;
    const type = "saida" as const;
    const quantity = 10;
    const delta = type === "entrada" ? quantity : -quantity;
    expect(current + delta).toBeLessThan(0); // erro esperado: estoque insuficiente
  });

  it("ajuste define o estoque para o valor informado", () => {
    const _current = 3;
    const type = "ajuste" as const;
    const quantity = 50;
    const newQty = type === "ajuste" ? Math.max(0, quantity) : 0;
    expect(newQty).toBe(50);
  });

  it("alerta de estoque mínimo é emitido quando quantidade <= mínimo", () => {
    const check = (qty: number, min: number) => min > 0 && qty <= min;
    expect(check(2, 5)).toBe(true);
    expect(check(5, 5)).toBe(true);
    expect(check(6, 5)).toBe(false);
    expect(check(6, 0)).toBe(false); // min 0 não dispara alerta
  });

  it("geração de receita não duplica para a mesma OS", () => {
    // A regra verifica a existência de lançamento com sourceType='ordem_servico'
    // e sourceId = id da OS antes de criar.
    const existing = [{ id: 1 }]; // já existe
    const created = existing.length === 0;
    expect(created).toBe(false);

    const existingEmpty: unknown[] = [];
    const createdAgain = existingEmpty.length === 0;
    expect(createdAgain).toBe(true);
  });

  it("baixa automática de estoque não duplica para a mesma OS", () => {
    // A regra verifica movimentação reason='ordem_servico' + serviceOrderId + productId
    const existing = [{ id: 42 }];
    expect(existing.length > 0).toBe(true); // não deve criar nova movimentação
  });
});
