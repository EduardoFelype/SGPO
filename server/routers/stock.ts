import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  countProductUsage,
  createProduct,
  deleteProduct,
  findProductByCode,
  getProduct,
  listAllProducts,
  listLowStockProducts,
  listProducts,
  listStockMovements,
  stockMovement,
  updateProduct,
} from "../db";
import { idInput, productInput, searchInput, stockMovementInput } from "../validation";

async function assertUniqueCode(code: string | null | undefined, exceptId?: number) {
  if (!code) return;
  const duplicate = await findProductByCode(code, exceptId);
  if (duplicate) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `O código ${code} já é usado pelo produto "${duplicate.name}"`,
    });
  }
}

export const stockRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          search: searchInput,
          category: z.string().max(60).optional(),
          page: z.number().int().min(1).max(10_000).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(({ input }) => listProducts(input ?? {})),

  listAll: protectedProcedure
    .input(z.object({ search: searchInput }).optional())
    .query(({ input }) => listAllProducts(input?.search)),

  lowStock: protectedProcedure.query(() => listLowStockProducts()),

  create: protectedProcedure.input(productInput).mutation(async ({ input }) => {
    await assertUniqueCode(input.code);
    return createProduct(input);
  }),

  update: protectedProcedure
    .input(productInput.extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const exists = await getProduct(id);
      if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      await assertUniqueCode(data.code, id);
      return updateProduct(id, data);
    }),

  delete: protectedProcedure.input(idInput).mutation(async ({ input }) => {
    const exists = await getProduct(input.id);
    if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
    const usage = await countProductUsage(input.id);
    if (usage > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `"${exists.name}" foi usado em ${usage} ordem(ns) de serviço e não pode ser excluído. Zere o estoque se não for mais usá-lo.`,
      });
    }
    await deleteProduct(input.id);
    return { success: true };
  }),

  movement: protectedProcedure.input(stockMovementInput).mutation(async ({ input }) => {
    try {
      return await stockMovement({
        ...input,
        description: input.description ?? undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro na movimentação";
      throw new TRPCError({ code: "BAD_REQUEST", message });
    }
  }),

  movements: protectedProcedure
    .input(
      z
        .object({
          productId: z.number().int().positive().optional(),
          page: z.number().int().min(1).max(10_000).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(({ input }) => listStockMovements(input ?? {})),
});
