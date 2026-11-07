import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  countServiceOrders,
  createCustomer,
  deleteCustomer,
  findCustomerByDocument,
  getCustomer,
  getCustomerProfile,
  listCustomers,
  updateCustomer,
} from "../db";
import { customerInput, idInput, listInput } from "../validation";

/** Regra: o mesmo CPF/CNPJ não pode estar em dois clientes. */
async function assertUniqueDocument(document: string | null | undefined, exceptId?: number) {
  if (!document) return;
  const duplicate = await findCustomerByDocument(document, exceptId);
  if (duplicate) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Este ${document.length === 11 ? "CPF" : "CNPJ"} já está cadastrado para ${duplicate.name}`,
    });
  }
}

export const customersRouter = router({
  list: protectedProcedure.input(listInput).query(({ input }) => listCustomers(input ?? {})),

  get: protectedProcedure.input(idInput).query(async ({ input }) => {
    const customer = await getCustomer(input.id);
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
    return customer;
  }),

  profile: protectedProcedure.input(idInput).query(async ({ input }) => {
    const profile = await getCustomerProfile(input.id);
    if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
    return profile;
  }),

  create: protectedProcedure.input(customerInput).mutation(async ({ input }) => {
    await assertUniqueDocument(input.document);
    return createCustomer(input);
  }),

  update: protectedProcedure
    .input(customerInput.and(z.object({ id: z.number().int().positive() })))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existing = await getCustomer(id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
      await assertUniqueDocument(data.document, id);
      return updateCustomer(id, data);
    }),

  delete: protectedProcedure.input(idInput).mutation(async ({ input }) => {
    const existing = await getCustomer(input.id);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
    const osCount = await countServiceOrders({ customerId: input.id });
    if (osCount > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${existing.name} possui ${osCount} ordem(ns) de serviço e não pode ser excluído(a). O histórico precisa ser mantido.`,
      });
    }
    await deleteCustomer(input.id);
    return { success: true };
  }),
});
