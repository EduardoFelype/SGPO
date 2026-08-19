import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getDashboardSummary,
  getOrCreateWorkshop,
  cashFlow,
  reportOs,
  reportFinancial,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  updateWorkshop,
} from "../db";

export const dashboardRouter = router({
  summary: protectedProcedure.query(() => getDashboardSummary()),

  cashFlow: protectedProcedure
    .input(z.object({ from: z.number().int().positive(), to: z.number().int().positive() }))
    .query(({ input }) => cashFlow(input)),
});

const periodInput = z
  .enum(["today", "7days", "30days", "month", "year", "custom"])
  .default("30days");

export function computePeriod(preset: z.infer<typeof periodInput>, from?: number, to?: number) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today":
      return { from: startOfDay.getTime(), to: Date.now() };
    case "7days":
      return { from: startOfDay.getTime() - 7 * 86_400_000, to: Date.now() };
    case "30days":
      return { from: startOfDay.getTime() - 30 * 86_400_000, to: Date.now() };
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: Date.now() };
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1).getTime(), to: Date.now() };
    case "custom":
      return { from: from ?? Date.now() - 30 * 86_400_000, to: to ?? Date.now() };
  }
}

export const reportsRouter = router({
  os: protectedProcedure
    .input(
      z.object({
        preset: periodInput,
        from: z.number().int().optional(),
        to: z.number().int().optional(),
      })
    )
    .query(({ input }) => {
      const period = computePeriod(input.preset, input.from, input.to);
      return reportOs(period);
    }),

  financial: protectedProcedure
    .input(
      z.object({
        preset: periodInput,
        from: z.number().int().optional(),
        to: z.number().int().optional(),
      })
    )
    .query(({ input }) => {
      const period = computePeriod(input.preset, input.from, input.to);
      return reportFinancial(period);
    }),

  customers: protectedProcedure.query(async () => {
    const { rows } = await import("../db").then((m) => m.listCustomers({ limit: 10000 }));
    return rows;
  }),

  vehicles: protectedProcedure.query(async () => {
    const { rows } = await import("../db").then((m) => m.listVehicles({ limit: 10000 }));
    return rows;
  }),

  stock: protectedProcedure.query(async () => {
    const { rows } = await import("../db").then((m) => m.listProducts({ limit: 10000 }));
    return rows;
  }),
});

export const notificationsRouter = router({
  list: protectedProcedure.query(() => listNotifications()),

  unread: protectedProcedure.query(() => listNotifications({ unreadOnly: true })),

  markRead: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => markNotificationRead(input.id)),

  markAllRead: protectedProcedure.mutation(() => markAllNotificationsRead()),
});

export const workshopRouter = router({
  get: protectedProcedure.query(() => getOrCreateWorkshop()),

  update: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        cnpj: z.string().max(20).optional().nullable(),
        phone: z.string().max(30).optional().nullable(),
        whatsapp: z.string().max(30).optional().nullable(),
        email: z.string().email("E-mail inválido").max(320).optional().nullable(),
        address: z.string().max(500).optional().nullable(),
        number: z.string().max(30).optional().nullable(),
        neighborhood: z.string().max(200).optional().nullable(),
        city: z.string().max(200).optional().nullable(),
        stateCode: z.string().max(2).optional().nullable(),
        zipCode: z.string().max(12).optional().nullable(),
      })
    )
    .mutation(({ input }) => updateWorkshop(input)),
});
