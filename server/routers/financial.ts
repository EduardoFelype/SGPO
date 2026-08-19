import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  cashFlow,
  createFinancialTransaction,
  deleteFinancialTransaction,
  listFinancialTransactions,
  updateFinancialTransaction,
} from "../db";

const transactionInput = z.object({
  description: z.string().min(1, "Informe a descrição").max(500),
  category: z.string().max(160).optional().nullable(),
  type: z.enum(["receita", "despesa"]),
  amount: z.number().int().min(1, "Valor deve ser maior que zero"),
  dueAt: z.number().int().positive("Informe a data de vencimento"),
  status: z.enum(["pendente", "pago", "cancelado", "atrasado"]).default("pendente"),
  paidAt: z.number().int().optional().nullable(),
  paymentMethod: z
    .enum(["dinheiro", "pix", "cartao_credito", "cartao_debito", "transferencia", "boleto", "outros"])
    .optional()
    .nullable(),
  sourceType: z.enum(["manual", "ordem_servico", "automatico"]).optional().nullable(),
  sourceId: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const financialRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(["receita", "despesa"]).optional(),
          status: z.enum(["pendente", "pago", "cancelado", "atrasado"]).optional(),
          from: z.number().int().optional(),
          to: z.number().int().optional(),
          search: z.string().optional(),
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(({ input }) => listFinancialTransactions(input ?? {})),

  cashFlow: protectedProcedure
    .input(z.object({ from: z.number().int().positive(), to: z.number().int().positive() }))
    .query(({ input }) => cashFlow(input)),

  create: protectedProcedure.input(transactionInput).mutation(async ({ input }) => {
    const now = Date.now();
    let data = input;
    if (input.status === "pago" && !input.paidAt) {
      data = { ...input, paidAt: now };
    }
    return createFinancialTransaction(data);
  }),

  update: protectedProcedure
    .input(transactionInput.merge(z.object({ id: z.number().int().positive() })))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      if (data.status === "pago" && !data.paidAt) {
        data.paidAt = Date.now();
      }
      if (data.status !== "pago") {
        data.paidAt = null;
      }
      return updateFinancialTransaction(id, data);
    }),

  markPaid: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      return updateFinancialTransaction(input.id, { status: "pago", paidAt: Date.now() });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const all = await listFinancialTransactions({ limit: 10000, page: 1 });
      const exists = all.rows.find((t) => t.id === input.id);
      if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Lançamento não encontrado" });
      if (exists.sourceType === "ordem_servico") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Este lançamento foi gerado automaticamente pela OS e não pode ser excluído manualmente",
        });
      }
      await deleteFinancialTransaction(input.id);
      return { success: true };
    }),
});
