import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  cancelServiceOrder,
  createServiceOrder,
  deleteOsPhoto,
  getServiceOrder,
  insertOsPhoto,
  listOsPhotos,
  listServiceOrders,
  reopenServiceOrder,
  type PartialProductItem,
  type PartialServiceItem,
  updateServiceOrder,
} from "../db";
import { storagePut } from "../storage";

const serviceItemInput = z.object({
  description: z.string().min(1, "Informe a descrição do serviço").max(500),
  quantity: z.number().int().min(1).optional(),
  unitPrice: z.number().min(0, "Valor unitário inválido"),
});

const productItemInput = z.object({
  productId: z.number().int().positive().nullable().optional(),
  description: z.string().min(1, "Informe a descrição da peça").max(500),
  quantity: z.number().int().min(1).optional(),
  unitPrice: z.number().min(0, "Valor unitário inválido"),
  discount: z.number().min(0).optional(),
});

export const serviceOrdersRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum([
              "aberta",
              "em_analise",
              "aguardando_aprovacao",
              "aguardando_peca",
              "em_andamento",
              "concluida",
              "cancelada",
            ])
            .optional(),
          search: z.string().optional(),
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(({ input }) => listServiceOrders(input ?? {})),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const data = await getServiceOrder(input.id);
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de serviço não encontrada" });
      return data;
    }),

  create: protectedProcedure
    .input(
      z.object({
        customerId: z.number().int().positive("Selecione o cliente"),
        vehicleId: z.number().int().positive("Selecione o veículo"),
        predictedAt: z.number().int().optional(),
        mileage: z.number().int().min(0).optional().nullable(),
        diagnostics: z.string().optional().nullable(),
        observations: z.string().optional().nullable(),
        services: z.array(serviceItemInput),
        products: z.array(productItemInput),
      })
    )
    .mutation(({ input }) =>
      createServiceOrder({
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        predictedAt: input.predictedAt,
        mileage: input.mileage ?? undefined,
        diagnostics: input.diagnostics ?? undefined,
        observations: input.observations ?? undefined,
        services: input.services,
        products: input.products,
      })
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z
          .enum([
            "aberta",
            "em_analise",
            "aguardando_aprovacao",
            "aguardando_peca",
            "em_andamento",
            "concluida",
            "cancelada",
          ])
          .optional(),
        customerId: z.number().int().positive().optional(),
        vehicleId: z.number().int().positive().optional(),
        predictedAt: z.number().int().nullable().optional(),
        mileage: z.number().int().min(0).nullable().optional(),
        diagnostics: z.string().nullable().optional(),
        observations: z.string().nullable().optional(),
        services: z.array(serviceItemInput),
        products: z.array(productItemInput),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      try {
        return await updateServiceOrder(
          id,
          data as {
            status?: typeof data.status;
            customerId?: number;
            vehicleId?: number;
            predictedAt?: number | null;
            mileage?: number | null;
            diagnostics?: string | null;
            observations?: string | null;
            services: PartialServiceItem[];
            products: PartialProductItem[];
          }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao atualizar a OS";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
    }),

  // ---------------------------------------------------------------------------
  // Fotos da OS (anexos do veículo)
  // ---------------------------------------------------------------------------
  photos: router({
    list: protectedProcedure
      .input(z.object({ serviceOrderId: z.number().int().positive() }))
      .query(({ input }) => listOsPhotos(input.serviceOrderId)),

    add: protectedProcedure
      .input(
        z.object({
          serviceOrderId: z.number().int().positive(),
          /** Base64 do arquivo (dataUrl sem prefixo ou com prefixo image/*) */
          base64: z.string().min(1, "Nenhum arquivo enviado"),
          fileName: z.string().max(300),
          mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        })
      )
      .mutation(async ({ input }) => {
        // Validação do tamanho (~5MB) e conteúdo
        const buffer = Buffer.from(input.base64, "base64");
        if (buffer.length > 5 * 1024 * 1024) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A foto deve ter no máximo 5 MB",
          });
        }
        if (buffer.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo vazio" });
        }

        // Verifica se a OS existe
        const os = await getServiceOrder(input.serviceOrderId);
        if (!os) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Ordem de serviço não encontrada" });
        }

        const ext = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
        const { url, key } = await storagePut(
          `os-photos/${os.os.number}-${safeName}.${ext}`,
          buffer,
          input.mimeType
        );

        await insertOsPhoto({
          serviceOrderId: input.serviceOrderId,
          url,
          fileKey: key,
          fileName: input.fileName,
        });
        return { url };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await deleteOsPhoto(input.id);
        return { success: true } as const;
      }),
  }),

  cancel: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => cancelServiceOrder(input.id)),

  reopen: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => reopenServiceOrder(input.id)),
});
