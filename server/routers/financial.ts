import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  cashFlow,
  createFinancialTransaction,
  deleteFinancialTransaction,
  getFinancialTransaction,
  listFinancialTransactions,
  updateFinancialTransaction,
} from "../db";
import { idInput, searchInput, transactionInput } from "../validation";

const OS_LOCK_MESSAGE =
  "Este lançamento foi gerado automaticamente pela OS. Para alterá-lo, reabra ou cancele a OS.";

export const financialRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(["receita", "despesa"]).optional(),
          status: z.enum(["pendente", "pago", "cancelado", "atrasado"]).optional(),
          from: z.number().int().optional(),
          to: z.number().int().optional(),
          search: searchInput,
          page: z.number().int().min(1).max(10_000).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(({ input }) => listFinancialTransactions(input ?? {})),

  cashFlow: protectedProcedure
    .input(z.object({ from: z.number().int().positive(), to: z.number().int().positive() }))
    .query(({ input }) => {
      if (input.to < input.from) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A data final deve ser depois da inicial" });
      }
      return cashFlow(input);
    }),

  create: protectedProcedure.input(transactionInput).mutation(async ({ input }) => {
    const now = Date.now();
    // Regra: lançamentos manuais nunca se passam por lançamentos de OS.
    const data = { ...input, sourceType: "manual" as const, sourceId: null };
    if (data.status === "pago") data.paidAt = now;
    else data.paidAt = null;
    return createFinancialTransaction(data);
  }),

  update: protectedProcedure
    .input(transactionInput.extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existing = await getFinancialTransaction(id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Lançamento não encontrado" });
      if (existing.sourceType === "ordem_servico") {
        throw new TRPCError({ code: "FORBIDDEN", message: OS_LOCK_MESSAGE });
      }
      const next = { ...data, sourceType: existing.sourceType, sourceId: existing.sourceId };
      if (next.status === "pago") {
        // Mantém a data original do pagamento se já estava pago.
        next.paidAt = existing.status === "pago" && existing.paidAt ? existing.paidAt : Date.now();
      } else {
        next.paidAt = null;
      }
      return updateFinancialTransaction(id, next);
    }),

  markPaid: protectedProcedure.input(idInput).mutation(async ({ input }) => {
    const existing = await getFinancialTransaction(input.id);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Lançamento não encontrado" });
    if (existing.status === "pago") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Este lançamento já está pago" });
    }
    if (existing.status === "cancelado") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Lançamentos cancelados não podem ser marcados como pagos",
      });
    }
    return updateFinancialTransaction(input.id, { status: "pago", paidAt: Date.now() });
  }),

  delete: protectedProcedure.input(idInput).mutation(async ({ input }) => {
    const exists = await getFinancialTransaction(input.id);
    if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Lançamento não encontrado" });
    if (exists.sourceType === "ordem_servico") {
      throw new TRPCError({ code: "FORBIDDEN", message: OS_LOCK_MESSAGE });
    }
    await deleteFinancialTransaction(input.id);
    return { success: true };
  }),
});
