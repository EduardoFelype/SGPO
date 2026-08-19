import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  getCustomerProfile,
  listCustomers,
  updateCustomer,
} from "../db";

const customerInput = z.object({
  type: z.enum(["cpf", "cnpj"]).default("cpf"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(255),
  document: z.string().max(20).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  email: z.string().email("E-mail inválido").max(320).optional().nullable(),
  zipCode: z.string().max(12).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  number: z.string().max(30).optional().nullable(),
  complement: z.string().max(200).optional().nullable(),
  neighborhood: z.string().max(200).optional().nullable(),
  city: z.string().max(200).optional().nullable(),
  stateCode: z.string().max(2).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const customersRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }).optional()
    )
    .query(({ input }) => listCustomers(input ?? {})),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const customer = await getCustomer(input.id);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
      return customer;
    }),

  profile: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const profile = await getCustomerProfile(input.id);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
      return profile;
    }),

  create: protectedProcedure.input(customerInput).mutation(({ input }) => createCustomer(input)),

  update: protectedProcedure
    .input(customerInput.merge(z.object({ id: z.number().int().positive() })))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existing = await getCustomer(id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
      return updateCustomer(id, data);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const existing = await getCustomer(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
      await deleteCustomer(input.id);
      return { success: true };
    }),
});
