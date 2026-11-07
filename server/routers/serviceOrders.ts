import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { LIMITS } from "@shared/limits";
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
import {
  idInput,
  optionalLongText,
  osMileage,
  osStatusEnum,
  productItemsArray,
  searchInput,
  serviceItemsArray,
} from "../validation";

/** Converte erros de regra de negócio (Error comum) em BAD_REQUEST com a mensagem original. */
async function withBusinessErrors<T>(fn: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    const message = error instanceof Error ? error.message : fallback;
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
}

const MAX_PHOTOS_PER_OS = 20;

export const serviceOrdersRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: osStatusEnum.optional(),
          search: searchInput,
          page: z.number().int().min(1).max(10_000).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(({ input }) => listServiceOrders(input ?? {})),

  get: protectedProcedure.input(idInput).query(async ({ input }) => {
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
        mileage: osMileage.optional().nullable(),
        diagnostics: optionalLongText("Diagnóstico", LIMITS.osText),
        observations: optionalLongText("Observações", LIMITS.osText),
        services: serviceItemsArray,
        products: productItemsArray,
      })
    )
    .mutation(({ input }) =>
      withBusinessErrors(
        () =>
          createServiceOrder({
            customerId: input.customerId,
            vehicleId: input.vehicleId,
            predictedAt: input.predictedAt,
            mileage: input.mileage ?? undefined,
            diagnostics: input.diagnostics ?? undefined,
            observations: input.observations ?? undefined,
            services: input.services,
            products: input.products,
          }),
        "Erro ao criar a OS"
      )
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: osStatusEnum.optional(),
        customerId: z.number().int().positive().optional(),
        vehicleId: z.number().int().positive().optional(),
        predictedAt: z.number().int().nullable().optional(),
        mileage: osMileage.nullable().optional(),
        diagnostics: optionalLongText("Diagnóstico", LIMITS.osText),
        observations: optionalLongText("Observações", LIMITS.osText),
        services: serviceItemsArray,
        products: productItemsArray,
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return withBusinessErrors(
        () =>
          updateServiceOrder(
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
          ),
        "Erro ao atualizar a OS"
      );
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
          base64: z
            .string()
            .min(1, "Nenhum arquivo enviado")
            .max(Math.ceil((5 * 1024 * 1024 * 4) / 3) + 16, "A foto deve ter no máximo 5 MB"),
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

        const existingPhotos = await listOsPhotos(input.serviceOrderId);
        if (existingPhotos.length >= MAX_PHOTOS_PER_OS) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Limite de ${MAX_PHOTOS_PER_OS} fotos por OS atingido`,
          });
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

    delete: protectedProcedure.input(idInput).mutation(async ({ input }) => {
      await deleteOsPhoto(input.id);
      return { success: true } as const;
    }),
  }),

  cancel: protectedProcedure
    .input(idInput)
    .mutation(({ input }) => withBusinessErrors(() => cancelServiceOrder(input.id), "Erro ao cancelar a OS")),

  reopen: protectedProcedure
    .input(idInput)
    .mutation(({ input }) => withBusinessErrors(() => reopenServiceOrder(input.id), "Erro ao reabrir a OS")),
});
