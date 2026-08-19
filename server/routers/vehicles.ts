import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createVehicle,
  deleteVehicle,
  getVehicle,
  listVehicles,
  listVehiclesByCustomer,
  updateVehicle,
} from "../db";

const vehicleInput = z.object({
  customerId: z.number().int().positive("Selecione o cliente"),
  plate: z
    .string()
    .min(7, "Placa inválida")
    .max(8)
    .transform((v) => v.toUpperCase().trim()),
  brand: z.string().min(1, "Informe a marca").max(120),
  model: z.string().min(1, "Informe o modelo").max(160),
  year: z.string().max(8).optional().nullable(),
  color: z.string().max(80).optional().nullable(),
  fuel: z.enum(["flex", "gasolina", "etanol", "diesel", "gnv", "eletrico"]).optional().nullable(),
  mileage: z.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
});

export const vehiclesRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          page: z.number().int().min(1).optional(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .optional()
    )
    .query(({ input }) => listVehicles(input ?? {})),

  listByCustomer: protectedProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .query(({ input }) => listVehiclesByCustomer(input.customerId)),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const data = await getVehicle(input.id);
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Veículo não encontrado" });
      return data;
    }),

  create: protectedProcedure.input(vehicleInput).mutation(async ({ input }) => {
    const existing = await listVehicles({ search: input.plate });
    const duplicate = existing.rows.find((v) => v.plate === input.plate);
    if (duplicate) {
      throw new TRPCError({ code: "CONFLICT", message: "Já existe um veículo com essa placa" });
    }
    return createVehicle(input);
  }),

  update: protectedProcedure
    .input(vehicleInput.merge(z.object({ id: z.number().int().positive() })))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existingRows = await listVehicles({});
      const duplicate = existingRows.rows.find(
        (v) => v.plate === input.plate && v.id !== id
      );
      if (duplicate) {
        throw new TRPCError({ code: "CONFLICT", message: "Já existe um veículo com essa placa" });
      }
      return updateVehicle(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const existing = await getVehicle(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Veículo não encontrado" });
      await deleteVehicle(input.id);
      return { success: true };
    }),
});
