import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createProduct,
  deleteProduct,
  listAllProducts,
  listLowStockProducts,
  listProducts,
  listStockMovements,
  stockMovement,
  updateProduct,
} from "../db";

const productInput = z.object({
  code: z.string().max(40).optional().nullable(),
  name: z.string().min(1, "Informe o nome do produto").max(255),
  category: z.string().max(160).optional().nullable(),
  brand: z.string().max(160).optional().nullable(),
  supplier: z.string().max(160).optional().nullable(),
  description: z.string().optional().nullable(),
  quantity: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  unit: z.string().max(20).default("un"),
  costPrice: z.number().int().min(0).default(0),
  salePrice: z.number().int().min(0),
});

export const stockRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          category: z.string().optional(),
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(({ input }) => listProducts(input ?? {})),

  listAll: protectedProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(({ input }) => listAllProducts(input?.search)),

  lowStock: protectedProcedure.query(() => listLowStockProducts()),

  create: protectedProcedure.input(productInput).mutation(({ input }) => createProduct(input)),

  update: protectedProcedure
    .input(productInput.merge(z.object({ id: z.number().int().positive() })))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const rows = await listProducts({ page: 1, limit: 1 });
      // Verificar existência com busca direta
      const all = await listProducts({ page: 1, limit: 10000 });
      const exists = all.rows.find((p) => p.id === id);
      if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      return updateProduct(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const all = await listProducts({ page: 1, limit: 10000 });
      const exists = all.rows.find((p) => p.id === input.id);
      if (!exists) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado" });
      await deleteProduct(input.id);
      return { success: true };
    }),

  movement: protectedProcedure
    .input(
      z.object({
        productId: z.number().int().positive(),
        type: z.enum(["entrada", "saida", "ajuste"]),
        quantity: z.number().int(),
        description: z.string().max(500).optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
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
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(({ input }) => listStockMovements(input ?? {})),
});
