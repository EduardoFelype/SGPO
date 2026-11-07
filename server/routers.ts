import { router } from "./_core/trpc";
import { authRouter } from "./routers/auth";
import { customersRouter } from "./routers/customers";
import { dashboardRouter, notificationsRouter, reportsRouter, workshopRouter } from "./routers/dashboard";
import { financialRouter } from "./routers/financial";
import { fipeRouter } from "./routers/fipe";
import { serviceOrdersRouter } from "./routers/serviceOrders";
import { stockRouter } from "./routers/stock";
import { vehiclesRouter } from "./routers/vehicles";

export const appRouter = router({
  auth: authRouter,
  customers: customersRouter,
  vehicles: vehiclesRouter,
  serviceOrders: serviceOrdersRouter,
  stock: stockRouter,
  financial: financialRouter,
  dashboard: dashboardRouter,
  reports: reportsRouter,
  notifications: notificationsRouter,
  workshop: workshopRouter,
  fipe: fipeRouter,
});

export type AppRouter = typeof appRouter;
