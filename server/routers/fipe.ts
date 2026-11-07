import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { fipeBrands, fipeModels, fipeYears } from "../fipe";

const vehicleType = z.enum(["cars", "motorcycles", "trucks"]).default("cars");
const code = z.string().regex(/^[A-Za-z0-9:\- ]{1,60}$/, "Código inválido");

export const fipeRouter = router({
  brands: protectedProcedure
    .input(z.object({ type: vehicleType }))
    .query(({ input }) => fipeBrands(input.type)),

  models: protectedProcedure
    .input(z.object({ type: vehicleType, brandCode: code }))
    .query(({ input }) => fipeModels(input.type, input.brandCode)),

  years: protectedProcedure
    .input(z.object({ type: vehicleType, brandCode: code, modelCode: code }))
    .query(({ input }) => fipeYears(input.type, input.brandCode, input.modelCode)),
});
