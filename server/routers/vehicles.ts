import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  countServiceOrders,
  createVehicle,
  deleteVehicle,
  findVehicleByPlate,
  getCustomer,
  getVehicle,
  listVehicles,
  listVehiclesByCustomer,
  updateVehicle,
} from "../db";
import { idInput, listInput, vehicleInput } from "../validation";

async function assertVehicleRules(
  input: { customerId: number; plate: string },
  exceptId?: number
) {
  const customer = await getCustomer(input.customerId);
  if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Proprietário não encontrado" });
  const duplicate = await findVehicleByPlate(input.plate, exceptId);
  if (duplicate) {
    throw new TRPCError({ code: "CONFLICT", message: `A placa ${input.plate} já está cadastrada` });
  }
}

export const vehiclesRouter = router({
  list: protectedProcedure.input(listInput).query(({ input }) => listVehicles(input ?? {})),

  listByCustomer: protectedProcedure
    .input(z.object({ customerId: z.number().int().positive() }))
    .query(({ input }) => listVehiclesByCustomer(input.customerId)),

  get: protectedProcedure.input(idInput).query(async ({ input }) => {
    const data = await getVehicle(input.id);
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Veículo não encontrado" });
    return data;
  }),

  create: protectedProcedure.input(vehicleInput).mutation(async ({ input }) => {
    await assertVehicleRules(input);
    return createVehicle(input);
  }),

  update: protectedProcedure
    .input(vehicleInput.extend({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existing = await getVehicle(id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Veículo não encontrado" });
      await assertVehicleRules(data, id);
      // Regra: a quilometragem nunca diminui depois de registrada em OS.
      const lastOsMileage = Math.max(0, ...existing.osRows.map((os) => os.mileage ?? 0));
      if (data.mileage !== undefined && data.mileage < lastOsMileage) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `A quilometragem não pode ser menor que a registrada na última OS (${lastOsMileage.toLocaleString("pt-BR")} km)`,
        });
      }
      return updateVehicle(id, data);
    }),

  delete: protectedProcedure.input(idInput).mutation(async ({ input }) => {
    const existing = await getVehicle(input.id);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Veículo não encontrado" });
    const osCount = await countServiceOrders({ vehicleId: input.id });
    if (osCount > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `O veículo ${existing.vehicle.plate} possui ${osCount} ordem(ns) de serviço e não pode ser excluído.`,
      });
    }
    await deleteVehicle(input.id);
    return { success: true };
  }),
});
