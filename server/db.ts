import { and, asc, desc, eq, gte, like, lte, ne, or, sql } from "drizzle-orm";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { DAY_MS, LIMITS, startOfDay } from "@shared/limits";
import {
  customers,
  financialTransactions,
  notifications,
  osPhotos,
  products,
  serviceOrderProducts,
  serviceOrders,
  serviceOrderServices,
  stockMovements,
  users,
  vehicles,
  workshops,
  type Customer,
  type FinancialTransaction,
  type InsertCustomer,
  type InsertOsPhoto,
  type InsertProduct,
  type InsertUser,
  type InsertVehicle,
  type Notification,
  type Product,
  type ServiceOrder,
  type ServiceOrderProduct,
  type ServiceOrderService,
  type StockMovement,
  type User,
  type Workshop,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/* ------------------------------------------------------------------ */
/* Users / auth                                                        */
/* ------------------------------------------------------------------ */

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/* ------------------------------------------------------------------ */
/* Users locais (autenticação própria v1.2)                          */
/* ------------------------------------------------------------------ */
export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function countUsers(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ c: count() }).from(users);
  return rows[0]?.c ?? 0;
}

export async function createUserLocal(input: {
  username: string;
  name: string;
  email?: string | null;
  passwordHash: string;
  role?: "admin" | "user";
}): Promise<User> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(users).values({
    openId: `local_${input.username}`,
    username: input.username,
    name: input.name,
    email: input.email ?? null,
    loginMethod: "local",
    passwordHash: input.passwordHash,
    role: input.role ?? "user",
    lastSignedIn: new Date(),
  });
  const created = await getUserByUsername(input.username);
  if (!created) throw new Error("Failed to read back created user");
  return created;
}

export async function setUserPasswordHash(
  username: string,
  passwordHash: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.username, username));
}

/* ------------------------------------------------------------------ */
/* Workshop                                                            */
/* ------------------------------------------------------------------ */

export async function getOrCreateWorkshop(): Promise<Workshop> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(workshops).limit(1);
  if (rows.length > 0) return rows[0];
  const result = await db
    .insert(workshops)
    .values({ name: "SGPO Oficina", email: "contato@sgpo.com.br" });
  const id = result[0].insertId;
  const [created] = await db.select().from(workshops).where(eq(workshops.id, id)).limit(1);
  return created;
}

export async function updateWorkshop(data: Partial<Workshop>): Promise<Workshop> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const workshop = await getOrCreateWorkshop();
  const { id: _id, updatedAt: _u, ...rest } = data;
  if (Object.keys(rest).length > 0) {
    await db.update(workshops).set(rest).where(eq(workshops.id, workshop.id));
  }
  return getOrCreateWorkshop();
}

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export async function listCustomers(params: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const search = (params.search ?? "").trim();
  const digits = search.replace(/\D/g, "");
  const baseFilter = search
    ? or(
        like(customers.name, `%${search}%`),
        like(customers.email, `%${search}%`),
        ...(digits.length >= 3
          ? [
              like(customers.document, `%${digits}%`),
              like(customers.phone, `%${digits}%`),
              like(customers.whatsapp, `%${digits}%`),
            ]
          : [])
      )
    : undefined;

  const totalRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(customers)
    .where(baseFilter);
  const total = Number(totalRow[0]?.count ?? 0);

  const rows = await db
    .select()
    .from(customers)
    .where(baseFilter)
    .orderBy(desc(customers.createdAt))
    .limit(limit)
    .offset(offset);

  return { rows, total, page, limit };
}

export async function createCustomer(data: InsertCustomer): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(customers).values(data);
  const [created] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, result[0].insertId))
    .limit(1);
  return created;
}

export async function updateCustomer(id: number, data: Partial<Customer>): Promise<Customer> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data as Partial<Customer> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
  };
  await db.update(customers).set(rest).where(eq(customers.id, id));
  const [updated] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return updated;
}

export async function deleteCustomer(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(vehicles).where(eq(vehicles.customerId, id));
  await db.delete(customers).where(eq(customers.id, id));
}

export async function getCustomer(id: number): Promise<Customer | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return rows[0];
}

/** Cliente com o mesmo CPF/CNPJ (ignorando o próprio registro na edição). */
export async function findCustomerByDocument(
  document: string,
  exceptId?: number
): Promise<Customer | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.document, document), exceptId ? ne(customers.id, exceptId) : undefined)
    )
    .limit(1);
  return rows[0];
}

/** Quantidade de OS vinculadas a um cliente ou veículo (regras de exclusão). */
export async function countServiceOrders(filter: { customerId?: number; vehicleId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const where = filter.customerId
    ? eq(serviceOrders.customerId, filter.customerId)
    : filter.vehicleId
      ? eq(serviceOrders.vehicleId, filter.vehicleId)
      : undefined;
  const rows = await db.select({ count: sql<number>`count(*)` }).from(serviceOrders).where(where);
  return Number(rows[0]?.count ?? 0);
}

/** Perfil do cliente: veículos, contagem e totais de OS */
export async function getCustomerProfile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1);
  if (!customer) return undefined;

  const vehicleRows = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.customerId, id))
    .orderBy(desc(vehicles.createdAt));

  const osSummary = await db
    .select({
      totalGasto: sql<number>`coalesce(sum(${serviceOrders.totalAmount}), 0)`,
      osCount: sql<number>`count(*)`,
      lastVisit: sql<number>`coalesce(max(${serviceOrders.openedAt}), 0)`,
    })
    .from(serviceOrders)
    .where(eq(serviceOrders.customerId, id));

  return {
    customer,
    vehicles: vehicleRows,
    totalSpent: Number(osSummary[0]?.totalGasto ?? 0),
    osCount: Number(osSummary[0]?.osCount ?? 0),
    lastVisit: Number(osSummary[0]?.lastVisit ?? 0),
  };
}

/* ------------------------------------------------------------------ */
/* Vehicles                                                            */
/* ------------------------------------------------------------------ */

export async function listVehicles(params: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const search = (params.search ?? "").trim();
  const plateSearch = search.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const plateFilter = search
    ? or(
        plateSearch ? like(vehicles.plate, `%${plateSearch}%`) : undefined,
        like(vehicles.brand, `%${search}%`),
        like(vehicles.model, `%${search}%`),
        like(customers.name, `%${search}%`)
      )
    : undefined;

  const totalRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(vehicles)
    .leftJoin(customers, eq(vehicles.customerId, customers.id))
    .where(plateFilter);
  const total = Number(totalRow[0]?.count ?? 0);

  const rows = await db
    .select({
      id: vehicles.id,
      customerId: vehicles.customerId,
      plate: vehicles.plate,
      brand: vehicles.brand,
      model: vehicles.model,
      year: vehicles.year,
      color: vehicles.color,
      fuel: vehicles.fuel,
      mileage: vehicles.mileage,
      notes: vehicles.notes,
      createdAt: vehicles.createdAt,
      updatedAt: vehicles.updatedAt,
      customerName: customers.name,
    })
    .from(vehicles)
    .leftJoin(customers, eq(vehicles.customerId, customers.id))
    .where(plateFilter)
    .orderBy(desc(vehicles.createdAt))
    .limit(limit)
    .offset(offset);

  return { rows, total, page, limit };
}

/** Veículo com a mesma placa (ignorando o próprio registro na edição). */
export async function findVehicleByPlate(plate: string, exceptId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.plate, plate), exceptId ? ne(vehicles.id, exceptId) : undefined))
    .limit(1);
  return rows[0];
}

export async function createVehicle(data: InsertVehicle): Promise<typeof vehicles.$inferSelect> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(vehicles).values(data);
  const [created] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, result[0].insertId))
    .limit(1);
  return created;
}

export async function updateVehicle(
  id: number,
  data: Partial<typeof vehicles.$inferSelect>
): Promise<typeof vehicles.$inferSelect> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data;
  await db.update(vehicles).set(rest).where(eq(vehicles.id, id));
  const [updated] = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  return updated;
}

export async function deleteVehicle(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(vehicles).where(eq(vehicles.id, id));
}

export async function getVehicle(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
  const vehicle = rows[0];
  if (!vehicle) return undefined;

  const osRows = await db
    .select()
    .from(serviceOrders)
    .where(eq(serviceOrders.vehicleId, id))
    .orderBy(desc(serviceOrders.openedAt))
    .limit(50);

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, vehicle.customerId))
    .limit(1);

  const totalSpent = await db
    .select({ sum: sql<number>`coalesce(sum(${serviceOrders.totalAmount}), 0)` })
    .from(serviceOrders)
    .where(eq(serviceOrders.vehicleId, id));

  return { vehicle, customer, osRows, totalSpent: Number(totalSpent[0]?.sum ?? 0) };
}

export async function listVehiclesByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.select().from(vehicles).where(eq(vehicles.customerId, customerId));
}

/* ------------------------------------------------------------------ */
/* Service orders                                                      */
/* ------------------------------------------------------------------ */

export async function nextServiceOrderNumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db
    .select({ maxId: sql<number>`coalesce(max(${serviceOrders.id}), 0)` })
    .from(serviceOrders);
  const next = Number(rows[0]?.maxId ?? 0) + 1;
  return `OS-${String(next).padStart(6, "0")}`;
}

export async function listServiceOrders(params: {
  status?: ServiceOrder["status"];
  search?: string;
  page?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const statusFilter = params.status ? eq(serviceOrders.status, params.status) : undefined;
  const search = (params.search ?? "").trim();
  const plateSearch = search.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const searchFilter = search
    ? or(
        like(serviceOrders.number, `%${search.toUpperCase()}%`),
        like(customers.name, `%${search}%`),
        plateSearch ? like(vehicles.plate, `%${plateSearch}%`) : undefined
      )
    : undefined;

  const where = and(statusFilter, searchFilter) ?? undefined;

  const totalRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(serviceOrders)
    .leftJoin(customers, eq(serviceOrders.customerId, customers.id))
    .leftJoin(vehicles, eq(serviceOrders.vehicleId, vehicles.id))
    .where(where);
  const total = Number(totalRow[0]?.count ?? 0);

  const rows = await db
    .select({
      id: serviceOrders.id,
      number: serviceOrders.number,
      status: serviceOrders.status,
      openedAt: serviceOrders.openedAt,
      predictedAt: serviceOrders.predictedAt,
      completedAt: serviceOrders.completedAt,
      totalAmount: serviceOrders.totalAmount,
      customerId: serviceOrders.customerId,
      vehicleId: serviceOrders.vehicleId,
      customerName: customers.name,
      vehiclePlate: vehicles.plate,
      vehicleModel: vehicles.model,
    })
    .from(serviceOrders)
    .leftJoin(customers, eq(serviceOrders.customerId, customers.id))
    .leftJoin(vehicles, eq(serviceOrders.vehicleId, vehicles.id))
    .where(where)
    .orderBy(desc(serviceOrders.openedAt))
    .limit(limit)
    .offset(offset);

  return { rows, total, page, limit };
}

export async function getServiceOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const osRows = await db
    .select({
      id: serviceOrders.id,
      number: serviceOrders.number,
      status: serviceOrders.status,
      customerId: serviceOrders.customerId,
      vehicleId: serviceOrders.vehicleId,
      openedAt: serviceOrders.openedAt,
      predictedAt: serviceOrders.predictedAt,
      completedAt: serviceOrders.completedAt,
      mileage: serviceOrders.mileage,
      diagnostics: serviceOrders.diagnostics,
      observations: serviceOrders.observations,
      discount: serviceOrders.discount,
      totalAmount: serviceOrders.totalAmount,
      customerName: customers.name,
      customerWhatsapp: customers.whatsapp,
      customerPhone: customers.phone,
      vehiclePlate: vehicles.plate,
      vehicleModel: vehicles.model,
      vehicleBrand: vehicles.brand,
      vehicleYear: vehicles.year,
      vehicleColor: vehicles.color,
    })
    .from(serviceOrders)
    .leftJoin(customers, eq(serviceOrders.customerId, customers.id))
    .leftJoin(vehicles, eq(serviceOrders.vehicleId, vehicles.id))
    .where(eq(serviceOrders.id, id))
    .limit(1);
  const os = osRows[0];
  if (!os) return undefined;

  const services = await db
    .select()
    .from(serviceOrderServices)
    .where(eq(serviceOrderServices.serviceOrderId, id))
    .orderBy(asc(serviceOrderServices.id));

  const productRows = await db
    .select()
    .from(serviceOrderProducts)
    .where(eq(serviceOrderProducts.serviceOrderId, id))
    .orderBy(asc(serviceOrderProducts.id));

  return { os, services, products: productRows };
}

export type PartialServiceItem = {
  description: string;
  quantity?: number;
  unitPrice: number;
};

export type PartialProductItem = {
  productId?: number | null;
  description: string;
  quantity?: number;
  unitPrice: number;
  discount?: number;
};

/** Soma dos itens da OS em centavos (serviços + peças − descontos). */
export function computeServiceOrderTotal(
  services: PartialServiceItem[],
  osProducts: PartialProductItem[]
): number {
  const servicesTotal = services.reduce((acc, s) => acc + (s.quantity ?? 1) * s.unitPrice, 0);
  const productsTotal = osProducts.reduce(
    (acc, p) => acc + Math.max(0, (p.quantity ?? 1) * p.unitPrice - (p.discount ?? 0)),
    0
  );
  return servicesTotal + productsTotal;
}

/**
 * Regras comuns de criação/edição da OS:
 * - o veículo precisa pertencer ao cliente informado;
 * - a OS precisa ter ao menos um item com valor;
 * - o total não pode ultrapassar o limite;
 * - peças do estoque precisam existir.
 */
async function assertServiceOrderRules(
  db: ReturnType<typeof drizzle>,
  data: {
    customerId: number;
    vehicleId: number;
    services: PartialServiceItem[];
    products: PartialProductItem[];
  }
) {
  const [vehicle] = await db
    .select({ id: vehicles.id, customerId: vehicles.customerId, mileage: vehicles.mileage })
    .from(vehicles)
    .where(eq(vehicles.id, data.vehicleId))
    .limit(1);
  if (!vehicle) throw new Error("Veículo não encontrado");
  if (vehicle.customerId !== data.customerId) {
    throw new Error("O veículo selecionado não pertence a este cliente");
  }

  const hasValue =
    data.services.some((s) => s.unitPrice > 0) || data.products.some((p) => p.unitPrice > 0);
  if (!hasValue) throw new Error("Adicione pelo menos um serviço ou peça com valor");

  const total = computeServiceOrderTotal(data.services, data.products);
  if (total > LIMITS.osTotalMaxCents) {
    throw new Error("O total da OS ultrapassa o limite permitido (R$ 9.999.999,99)");
  }

  const productIds = Array.from(
    new Set(data.products.map((p) => p.productId).filter((id): id is number => id != null))
  );
  for (const productId of productIds) {
    const [row] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!row) throw new Error("Uma das peças selecionadas não existe mais no estoque");
  }

  return { vehicle, total };
}

function assertPrediction(predictedAt: number | null | undefined, openedAt: number) {
  if (predictedAt == null) return;
  if (predictedAt < startOfDay(openedAt)) {
    throw new Error("A previsão de entrega não pode ser anterior à abertura da OS");
  }
  if (predictedAt > Date.now() + LIMITS.osPredictionMaxDays * DAY_MS) {
    throw new Error(`A previsão de entrega deve ser em até ${LIMITS.osPredictionMaxDays} dias`);
  }
}

export async function createServiceOrder(data: {
  customerId: number;
  vehicleId: number;
  predictedAt?: number;
  mileage?: number;
  diagnostics?: string;
  observations?: string;
  services: PartialServiceItem[];
  products: PartialProductItem[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const { vehicle, total: subtotal } = await assertServiceOrderRules(db, data);
  const openedAt = Date.now();
  assertPrediction(data.predictedAt, openedAt);
  if (data.mileage != null && data.mileage < vehicle.mileage) {
    throw new Error(
      `A quilometragem informada é menor que a registrada no veículo (${vehicle.mileage.toLocaleString("pt-BR")} km)`
    );
  }

  const number = await nextServiceOrderNumber();
  const insertResult = await db.insert(serviceOrders).values({
    number,
    customerId: data.customerId,
    vehicleId: data.vehicleId,
    openedAt,
    predictedAt: data.predictedAt,
    mileage: data.mileage,
    diagnostics: data.diagnostics,
    observations: data.observations,
    discount: 0,
    totalAmount: subtotal,
  });
  const osId = insertResult[0].insertId;

  if (data.services.length > 0) {
    const serviceValues = data.services.map((s) => ({
      serviceOrderId: osId,
      description: s.description,
      quantity: s.quantity ?? 1,
      unitPrice: s.unitPrice,
      total: (s.quantity ?? 1) * s.unitPrice,
    }));
    await db.insert(serviceOrderServices).values(serviceValues);
  }
  if (data.products.length > 0) {
    const productValues = data.products.map((p) => ({
      serviceOrderId: osId,
      productId: p.productId,
      description: p.description,
      quantity: p.quantity ?? 1,
      unitPrice: p.unitPrice,
      discount: p.discount ?? 0,
      total: Math.max(0, (p.quantity ?? 1) * p.unitPrice - (p.discount ?? 0)),
    }));
    await db.insert(serviceOrderProducts).values(productValues);
  }

  const [created] = await db
    .select()
    .from(serviceOrders)
    .where(eq(serviceOrders.id, osId))
    .limit(1);
  const services = await db
    .select()
    .from(serviceOrderServices)
    .where(eq(serviceOrderServices.serviceOrderId, osId));
  const productsRows = await db
    .select()
    .from(serviceOrderProducts)
    .where(eq(serviceOrderProducts.serviceOrderId, osId));

  return { os: created, services, products: productsRows };
}

export type InsertServiceOrderService = typeof serviceOrderServices.$inferInsert;
export type InsertServiceOrderProduct = typeof serviceOrderProducts.$inferInsert;

/**
 * Atualiza OS (cabeçalho, serviços e peças), recalculando o total.
 * Executa baixa automática no estoque e gera receita quando o status
 * passa a ser "concluida" (sem duplicar movimentações/lançamentos).
 *
 * Regras:
 * - OS concluída ou cancelada não pode ser editada (é preciso reabrir antes);
 * - cancelamento só pelo fluxo próprio (cancelServiceOrder);
 * - conclusão exige estoque suficiente para as peças vinculadas.
 */
export async function updateServiceOrder(
  id: number,
  data: {
    status?: ServiceOrder["status"];
    customerId?: number;
    vehicleId?: number;
    predictedAt?: number | null;
    mileage?: number | null;
    diagnostics?: string | null;
    observations?: string | null;
    services: PartialServiceItem[];
    products: PartialProductItem[];
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [existing] = await db
    .select()
    .from(serviceOrders)
    .where(eq(serviceOrders.id, id))
    .limit(1);
  if (!existing) throw new Error("Ordem de serviço não encontrada");

  if (existing.status === "concluida") {
    throw new Error("Esta OS já foi concluída. Reabra a OS para alterá-la.");
  }
  if (existing.status === "cancelada") {
    throw new Error("Esta OS está cancelada. Reabra a OS para alterá-la.");
  }
  if (data.status === "cancelada") {
    throw new Error("Use a opção Cancelar para cancelar a OS");
  }

  const customerId = data.customerId ?? existing.customerId;
  const vehicleId = data.vehicleId ?? existing.vehicleId;
  const { vehicle, total: subtotal } = await assertServiceOrderRules(db, {
    customerId,
    vehicleId,
    services: data.services,
    products: data.products,
  });

  if (data.predictedAt !== undefined && data.predictedAt !== existing.predictedAt) {
    assertPrediction(data.predictedAt, existing.openedAt);
  }
  if (
    data.mileage != null &&
    data.mileage !== existing.mileage &&
    data.mileage < vehicle.mileage
  ) {
    throw new Error(
      `A quilometragem informada é menor que a registrada no veículo (${vehicle.mileage.toLocaleString("pt-BR")} km)`
    );
  }

  const becomingCompleted = data.status === "concluida";
  if (becomingCompleted) {
    await assertStockAvailable(db, id, data.products);
  }

  const header: Record<string, unknown> = {};
  if (data.status !== undefined) {
    header.status = data.status;
    if (becomingCompleted) header.completedAt = Date.now();
  }
  if (data.customerId !== undefined) header.customerId = data.customerId;
  if (data.vehicleId !== undefined) header.vehicleId = data.vehicleId;
  if (data.predictedAt !== undefined) header.predictedAt = data.predictedAt;
  if (data.mileage !== undefined) header.mileage = data.mileage;
  if (data.diagnostics !== undefined) header.diagnostics = data.diagnostics;
  if (data.observations !== undefined) header.observations = data.observations;

  if (Object.keys(header).length > 0) {
    await db.update(serviceOrders).set(header).where(eq(serviceOrders.id, id));
  }

  // Reescrever itens
  await db.delete(serviceOrderServices).where(eq(serviceOrderServices.serviceOrderId, id));
  await db.delete(serviceOrderProducts).where(eq(serviceOrderProducts.serviceOrderId, id));

  if (data.services.length > 0) {
    await db.insert(serviceOrderServices).values(
      data.services.map((s) => ({
        serviceOrderId: id,
        description: s.description,
        quantity: s.quantity ?? 1,
        unitPrice: s.unitPrice,
        total: (s.quantity ?? 1) * s.unitPrice,
      }))
    );
  }
  if (data.products.length > 0) {
    await db.insert(serviceOrderProducts).values(
      data.products.map((p) => ({
        serviceOrderId: id,
        productId: p.productId,
        description: p.description,
        quantity: p.quantity ?? 1,
        unitPrice: p.unitPrice,
        discount: p.discount ?? 0,
        total: Math.max(0, (p.quantity ?? 1) * p.unitPrice - (p.discount ?? 0)),
      }))
    );
  }

  await db.update(serviceOrders).set({ totalAmount: subtotal }).where(eq(serviceOrders.id, id));

  if (becomingCompleted) {
    await completeServiceOrderSideEffects(db, id, data.products, subtotal);
    // Atualiza a quilometragem do veículo quando a OS registra um valor maior
    const osMileage = data.mileage ?? existing.mileage;
    if (osMileage != null && osMileage > vehicle.mileage) {
      await db.update(vehicles).set({ mileage: osMileage }).where(eq(vehicles.id, vehicleId));
    }
  }

  const [updated] = await db
    .select()
    .from(serviceOrders)
    .where(eq(serviceOrders.id, id))
    .limit(1);
  const services = await db
    .select()
    .from(serviceOrderServices)
    .where(eq(serviceOrderServices.serviceOrderId, id));
  const productsRows = await db
    .select()
    .from(serviceOrderProducts)
    .where(eq(serviceOrderProducts.serviceOrderId, id));

  return { os: updated, services, products: productsRows };
}

/** Cancela a OS. Se ela estava concluída, devolve as peças ao estoque e cancela a receita. */
export async function cancelServiceOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [existing] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  if (!existing) throw new Error("Ordem de serviço não encontrada");
  if (existing.status === "cancelada") throw new Error("Esta OS já está cancelada");

  if (existing.status === "concluida") {
    await revertServiceOrderSideEffects(db, id);
  }
  await db
    .update(serviceOrders)
    .set({ status: "cancelada", completedAt: null })
    .where(eq(serviceOrders.id, id));
  const [updated] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  return updated;
}

/** Reabre uma OS concluída ou cancelada, desfazendo os efeitos da conclusão. */
export async function reopenServiceOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [existing] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  if (!existing) throw new Error("Ordem de serviço não encontrada");
  if (existing.status !== "concluida" && existing.status !== "cancelada") {
    throw new Error("Apenas OS concluídas ou canceladas podem ser reabertas");
  }

  if (existing.status === "concluida") {
    await revertServiceOrderSideEffects(db, id);
  }
  await db
    .update(serviceOrders)
    .set({ status: "em_andamento", completedAt: null })
    .where(eq(serviceOrders.id, id));
  const [updated] = await db.select().from(serviceOrders).where(eq(serviceOrders.id, id)).limit(1);
  return updated;
}

/** Saldo líquido já baixado do estoque por uma OS para um produto (negativo = baixado). */
async function osStockBalance(db: ReturnType<typeof drizzle>, osId: number, productId: number) {
  const rows = await db
    .select({ net: sql<number>`coalesce(sum(${stockMovements.quantity}), 0)` })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.productId, productId),
        eq(stockMovements.serviceOrderId, osId),
        eq(stockMovements.reason, "ordem_servico")
      )
    );
  return Number(rows[0]?.net ?? 0);
}

/** Agrupa as quantidades de peças do estoque por produto. */
function stockNeeds(osProducts: PartialProductItem[]) {
  const needs = new Map<number, number>();
  for (const p of osProducts) {
    if (p.productId == null) continue;
    needs.set(p.productId, (needs.get(p.productId) ?? 0) + (p.quantity ?? 1));
  }
  return needs;
}

/** Impede concluir a OS se alguma peça vinculada não tiver estoque suficiente. */
async function assertStockAvailable(
  db: ReturnType<typeof drizzle>,
  osId: number,
  osProducts: PartialProductItem[]
) {
  for (const [productId, qty] of Array.from(stockNeeds(osProducts))) {
    if ((await osStockBalance(db, osId, productId)) < 0) continue; // já baixado
    const [row] = await db
      .select({ name: products.name, quantity: products.quantity, unit: products.unit })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!row) throw new Error("Uma das peças selecionadas não existe mais no estoque");
    if (row.quantity < qty) {
      throw new Error(
        `Estoque insuficiente para "${row.name}": disponível ${row.quantity} ${row.unit}, necessário ${qty} ${row.unit}`
      );
    }
  }
}

/**
 * Efeitos colaterais da conclusão de uma OS:
 * - baixa automática no estoque das peças vinculadas (sem duplicar)
 * - geração de receita financeira (sem duplicar; reaproveita a receita cancelada)
 * - alertas de estoque mínimo com notificações
 */
async function completeServiceOrderSideEffects(
  db: ReturnType<typeof drizzle>,
  osId: number,
  osProducts: PartialProductItem[],
  total: number
) {
  const now = Date.now();
  const [osRow] = await db
    .select({ number: serviceOrders.number })
    .from(serviceOrders)
    .where(eq(serviceOrders.id, osId))
    .limit(1);
  const osNumber = osRow?.number ?? `OS-${String(osId).padStart(6, "0")}`;

  for (const [productId, qty] of Array.from(stockNeeds(osProducts))) {
    // Já existe baixa líquida para esta OS/produto? Então não duplica.
    if ((await osStockBalance(db, osId, productId)) < 0) continue;

    const [productRow] = await db
      .select({ quantity: products.quantity, minStock: products.minStock, name: products.name })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!productRow) continue;
    const newQty = Math.max(0, productRow.quantity - qty);

    await db.update(products).set({ quantity: newQty }).where(eq(products.id, productId));
    await db.insert(stockMovements).values({
      productId,
      type: "saida",
      quantity: -qty,
      balanceAfter: newQty,
      reason: "ordem_servico",
      serviceOrderId: osId,
      description: `Baixa automática — ${osNumber}`,
      occurredAt: now,
    });

    if (newQty <= productRow.minStock) {
      await createStockNotification(db, productRow.name, newQty, productRow.minStock, osNumber);
    }
  }

  // Receita financeira vinculada à OS (sem duplicar)
  const [existingTx] = await db
    .select({ id: financialTransactions.id })
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.sourceType, "ordem_servico"),
        eq(financialTransactions.sourceId, osId)
      )
    )
    .limit(1);
  if (existingTx) {
    await db
      .update(financialTransactions)
      .set({ amount: total, status: total > 0 ? "pago" : "cancelado", paidAt: now, dueAt: now })
      .where(eq(financialTransactions.id, existingTx.id));
  } else if (total > 0) {
    await db.insert(financialTransactions).values({
      description: `Recebimento — ${osNumber}`,
      category: "Serviços de oficina",
      type: "receita",
      amount: total,
      dueAt: now,
      paidAt: now,
      status: "pago",
      paymentMethod: "outros",
      sourceType: "ordem_servico",
      sourceId: osId,
      notes: "Gerado automaticamente na conclusão da OS",
    });
  }
}

/** Desfaz a conclusão: devolve as peças ao estoque e cancela a receita automática. */
async function revertServiceOrderSideEffects(db: ReturnType<typeof drizzle>, osId: number) {
  const now = Date.now();
  const [osRow] = await db
    .select({ number: serviceOrders.number })
    .from(serviceOrders)
    .where(eq(serviceOrders.id, osId))
    .limit(1);
  const osNumber = osRow?.number ?? `OS-${String(osId).padStart(6, "0")}`;

  const moved = await db
    .select({ productId: stockMovements.productId })
    .from(stockMovements)
    .where(and(eq(stockMovements.serviceOrderId, osId), eq(stockMovements.reason, "ordem_servico")));
  const productIds = Array.from(new Set(moved.map((m) => m.productId)));

  for (const productId of productIds) {
    const net = await osStockBalance(db, osId, productId);
    if (net >= 0) continue; // nada a devolver
    const [productRow] = await db
      .select({ quantity: products.quantity })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!productRow) continue;
    const returned = -net;
    const newQty = productRow.quantity + returned;
    await db.update(products).set({ quantity: newQty }).where(eq(products.id, productId));
    await db.insert(stockMovements).values({
      productId,
      type: "entrada",
      quantity: returned,
      balanceAfter: newQty,
      reason: "ordem_servico",
      serviceOrderId: osId,
      description: `Estorno da baixa — ${osNumber}`,
      occurredAt: now,
    });
  }

  await db
    .update(financialTransactions)
    .set({ status: "cancelado", paidAt: null })
    .where(
      and(
        eq(financialTransactions.sourceType, "ordem_servico"),
        eq(financialTransactions.sourceId, osId)
      )
    );
}

async function createStockNotification(
  db: ReturnType<typeof drizzle>,
  productName: string,
  qty: number,
  minStock: number,
  osNumber: string
) {
  await db.insert(notifications).values({
    title: "Estoque mínimo atingido",
    message: `O produto "${productName}" está com ${qty} unidades em estoque (mínimo: ${minStock}), após a baixa da ${osNumber}.`,
    type: "estoque",
    read: 0,
  });
}

/* ------------------------------------------------------------------ */
/* Products / stock                                                    */
/* ------------------------------------------------------------------ */

export async function listProducts(params: {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const search = (params.search ?? "").trim();
  const searchFilter = search
    ? or(
        like(products.name, `%${search}%`),
        like(products.code, `%${search}%`),
        like(products.brand, `%${search}%`),
        like(products.supplier, `%${search}%`)
      )
    : undefined;
  const categoryFilter = params.category
    ? eq(products.category, params.category)
    : undefined;
  const where = and(searchFilter, categoryFilter) ?? undefined;

  const totalRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(where);
  const total = Number(totalRow[0]?.count ?? 0);

  const rows = await db
    .select()
    .from(products)
    .where(where)
    .orderBy(asc(products.name))
    .limit(limit)
    .offset(offset);

  return { rows, total, page, limit };
}

export async function listAllProducts(search?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const s = (search ?? "").trim();
  const filter = s ? like(products.name, `%${s}%`) : undefined;
  return db.select().from(products).where(filter).orderBy(asc(products.name)).limit(500);
}

export async function createProduct(data: InsertProduct): Promise<Product> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(products).values(data);
  const [created] = await db
    .select()
    .from(products)
    .where(eq(products.id, result[0].insertId))
    .limit(1);
  return created;
}

export async function getProduct(id: number): Promise<Product | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return rows[0];
}

/** Produto com o mesmo código (ignorando o próprio registro na edição). */
export async function findProductByCode(code: string, exceptId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.code, code), exceptId ? ne(products.id, exceptId) : undefined))
    .limit(1);
  return rows[0];
}

/** Em quantas OS o produto foi usado (impede exclusão e perda de histórico). */
export async function countProductUsage(productId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db
    .select({ count: sql<number>`count(distinct ${serviceOrderProducts.serviceOrderId})` })
    .from(serviceOrderProducts)
    .where(eq(serviceOrderProducts.productId, productId));
  return Number(rows[0]?.count ?? 0);
}

/**
 * Atualiza o produto. Se a quantidade em estoque mudar pela edição,
 * registra automaticamente uma movimentação de ajuste (histórico).
 */
export async function updateProduct(
  id: number,
  data: Partial<Product>
): Promise<Product> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data as Partial<Product> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
  };
  const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  await db.update(products).set(rest).where(eq(products.id, id));
  if (before && rest.quantity !== undefined && rest.quantity !== before.quantity) {
    await db.insert(stockMovements).values({
      productId: id,
      type: "ajuste",
      quantity: rest.quantity,
      balanceAfter: rest.quantity,
      reason: "manual",
      description: `Ajuste pela edição do produto (de ${before.quantity} para ${rest.quantity})`,
      occurredAt: Date.now(),
    });
  }
  const [updated] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return updated;
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(products).where(eq(products.id, id));
}

/** Movimentação manual de estoque (entrada, saída ou ajuste). */
export async function stockMovement(params: {
  productId: number;
  type: "entrada" | "saida" | "ajuste";
  quantity: number;
  description?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, params.productId))
    .limit(1);
  if (!product) throw new Error("Produto não encontrado");

  let newQty: number;
  if (params.type === "ajuste") {
    newQty = Math.max(0, params.quantity);
    if (newQty === product.quantity) {
      throw new Error(`O estoque de "${product.name}" já é ${product.quantity}. Nada a ajustar.`);
    }
  } else {
    if (params.quantity <= 0) throw new Error("Informe uma quantidade maior que zero");
    const delta = params.type === "entrada" ? params.quantity : -params.quantity;
    if (delta < 0 && product.quantity + delta < 0) {
      throw new Error(
        `Estoque insuficiente para esta saída: disponível ${product.quantity} ${product.unit}`
      );
    }
    newQty = Math.max(0, product.quantity + delta);
  }
  if (newQty > LIMITS.stockQuantityMax) {
    throw new Error(
      `O estoque não pode passar de ${LIMITS.stockQuantityMax.toLocaleString("pt-BR")} ${product.unit}`
    );
  }

  await db.update(products).set({ quantity: newQty }).where(eq(products.id, params.productId));

  const [movement] = await db
    .insert(stockMovements)
    .values({
      productId: params.productId,
      type: params.type,
      quantity: params.type === "saida" ? -Math.abs(params.quantity) : params.quantity,
      balanceAfter: newQty,
      reason: "manual",
      description: params.description,
      occurredAt: Date.now(),
    });

  if (newQty <= product.minStock && params.type !== "ajuste") {
    await db.insert(notifications).values({
      title: "Estoque mínimo atingido",
      message: `O produto "${product.name}" está com ${newQty} unidades (mínimo: ${product.minStock}).`,
      type: "estoque",
      read: 0,
    });
  }

  const [created] = await db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.id, movement.insertId))
    .limit(1);
  return { movement: created, newQuantity: newQty };
}

export async function listStockMovements(params: {
  productId?: number;
  page?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const where = params.productId ? eq(stockMovements.productId, params.productId) : undefined;
  const totalRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(stockMovements)
    .where(where);
  const total = Number(totalRow[0]?.count ?? 0);

  const rows = await db
    .select()
    .from(stockMovements)
    .where(where)
    .orderBy(desc(stockMovements.occurredAt))
    .limit(limit)
    .offset(offset);

  return { rows, total, page, limit };
}

export async function listLowStockProducts(): Promise<Product[]> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db
    .select()
    .from(products)
    .where(sql`${products.quantity} <= ${products.minStock} AND ${products.minStock} > 0`)
    .orderBy(asc(products.name));
}

/* ------------------------------------------------------------------ */
/* Financial                                                           */
/* ------------------------------------------------------------------ */

export async function listFinancialTransactions(params: {
  type?: "receita" | "despesa";
  status?: FinancialTransaction["status"];
  from?: number;
  to?: number;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const page = params.page ?? 1;
  const limit = Math.min(params.limit ?? 20, 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (params.type) conditions.push(eq(financialTransactions.type, params.type));
  if (params.status) conditions.push(eq(financialTransactions.status, params.status));
  if (params.from) conditions.push(gte(financialTransactions.dueAt, params.from));
  if (params.to) conditions.push(lte(financialTransactions.dueAt, params.to));
  if (params.search) {
    const term = params.search.trim();
    const cond = or(
      like(financialTransactions.description, `%${term}%`),
      like(financialTransactions.category, `%${term}%`)
    );
    if (cond) conditions.push(cond);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const totalRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(financialTransactions)
    .where(where);
  const total = Number(totalRow[0]?.count ?? 0);

  const rows = await db
    .select()
    .from(financialTransactions)
    .where(where)
    .orderBy(desc(financialTransactions.dueAt))
    .limit(limit)
    .offset(offset);

  return { rows, total, page, limit };
}

export async function createFinancialTransaction(
  data: typeof financialTransactions.$inferInsert
): Promise<FinancialTransaction> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(financialTransactions).values(data);
  const [created] = await db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.id, result[0].insertId))
    .limit(1);
  return created;
}

export async function updateFinancialTransaction(
  id: number,
  data: Partial<FinancialTransaction>
): Promise<FinancialTransaction> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data as Partial<FinancialTransaction> & {
    id?: number;
    createdAt?: Date;
    updatedAt?: Date;
  };
  await db.update(financialTransactions).set(rest).where(eq(financialTransactions.id, id));
  const [updated] = await db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.id, id))
    .limit(1);
  return updated;
}

export async function getFinancialTransaction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.id, id))
    .limit(1);
  return rows[0];
}

export async function deleteFinancialTransaction(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(financialTransactions).where(eq(financialTransactions.id, id));
}

/** Fluxo de caixa diário em um intervalo (usado nos gráficos). */
export async function cashFlow(params: { from: number; to: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const rows = await db
    .select({
      date: sql<string>`from_unixtime(${financialTransactions.dueAt} / 1000, '%Y-%m-%d')`,
      income: sql<number>`coalesce(sum(case when ${financialTransactions.type} = 'receita' then ${financialTransactions.amount} else 0 end), 0)`,
      expense: sql<number>`coalesce(sum(case when ${financialTransactions.type} = 'despesa' then ${financialTransactions.amount} else 0 end), 0)`,
    })
    .from(financialTransactions)
    .where(
      and(
        gte(financialTransactions.dueAt, params.from),
        lte(financialTransactions.dueAt, params.to),
        ne(financialTransactions.status, "cancelado")
      )
    )
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  // O MySQL devolve somas como texto: converte para número
  return rows.map((r) => ({
    date: String(r.date),
    income: Number(r.income ?? 0),
    expense: Number(r.expense ?? 0),
  }));
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export async function getDashboardSummary() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const now = Date.now();
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).getTime();

  const osSummary = await db
    .select({
      total: sql<number>`count(*)`,
      openCount: sql<number>`sum(case when ${serviceOrders.status} in ('aberta','em_analise','aguardando_aprovacao','aguardando_peca','em_andamento') then 1 else 0 end)`,
      doneCount: sql<number>`sum(case when ${serviceOrders.status} = 'concluida' then 1 else 0 end)`,
      monthRevenue: sql<number>`coalesce(sum(case when ${serviceOrders.status} = 'concluida' AND ${serviceOrders.completedAt} >= ${startOfMonth} then ${serviceOrders.totalAmount} else 0 end), 0)`,
    })
    .from(serviceOrders);

  const income = await db
    .select({ sum: sql<number>`coalesce(sum(${financialTransactions.amount}), 0)` })
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.type, "receita"),
        gte(financialTransactions.dueAt, startOfMonth)
      )
    );

  const expense = await db
    .select({ sum: sql<number>`coalesce(sum(${financialTransactions.amount}), 0)` })
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.type, "despesa"),
        gte(financialTransactions.dueAt, startOfMonth)
      )
    );

  const customersCount = await db.select({ count: sql<number>`count(*)` }).from(customers);
  const vehiclesCount = await db.select({ count: sql<number>`count(*)` }).from(vehicles);

  const pendingReceivable = await db
    .select({ sum: sql<number>`coalesce(sum(${financialTransactions.amount}), 0)` })
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.type, "receita"),
        eq(financialTransactions.status, "pendente")
      )
    );

  const pendingPayable = await db
    .select({ sum: sql<number>`coalesce(sum(${financialTransactions.amount}), 0)` })
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.type, "despesa"),
        eq(financialTransactions.status, "pendente")
      )
    );

  const inProgress = await db
    .select()
    .from(serviceOrders)
    .where(eq(serviceOrders.status, "em_andamento"))
    .orderBy(desc(serviceOrders.openedAt))
    .limit(5);

  const lowStock = await listLowStockProducts();

  const recentOsRows = await db
    .select({
      id: serviceOrders.id,
      number: serviceOrders.number,
      status: serviceOrders.status,
      totalAmount: serviceOrders.totalAmount,
      openedAt: serviceOrders.openedAt,
      customerName: customers.name,
      vehiclePlate: vehicles.plate,
    })
    .from(serviceOrders)
    .leftJoin(customers, eq(serviceOrders.customerId, customers.id))
    .leftJoin(vehicles, eq(serviceOrders.vehicleId, vehicles.id))
    .orderBy(desc(serviceOrders.openedAt))
    .limit(6);

  const osByStatus = await db
    .select({
      status: serviceOrders.status,
      count: sql<number>`count(*)`,
    })
    .from(serviceOrders)
    .groupBy(serviceOrders.status);

  return {
    totalOs: Number(osSummary[0]?.total ?? 0),
    openOs: Number(osSummary[0]?.openCount ?? 0),
    completedOs: Number(osSummary[0]?.doneCount ?? 0),
    completedRevenue: Number(osSummary[0]?.monthRevenue ?? 0),
    totalRevenue: Number(income[0]?.sum ?? 0),
    totalExpense: Number(expense[0]?.sum ?? 0),
    balance: Number(income[0]?.sum ?? 0) - Number(expense[0]?.sum ?? 0),
    lowStockCount: lowStock.length,
    customers: Number(customersCount[0]?.count ?? 0),
    vehicles: Number(vehiclesCount[0]?.count ?? 0),
    receivable: Number(pendingReceivable[0]?.sum ?? 0),
    payable: Number(pendingPayable[0]?.sum ?? 0),
    periodFrom: startOfMonth,
    inProgress,
    lowStock,
    recentOs: recentOsRows,
    osByStatus,
  };
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export async function reportOs(period: { from: number; to: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db
    .select()
    .from(serviceOrders)
    .where(
      and(gte(serviceOrders.openedAt, period.from), lte(serviceOrders.openedAt, period.to))
    )
    .orderBy(desc(serviceOrders.openedAt))
    .limit(1000);
}

export async function reportFinancial(period: { from: number; to: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db
    .select()
    .from(financialTransactions)
    .where(
      and(gte(financialTransactions.dueAt, period.from), lte(financialTransactions.dueAt, period.to))
    )
    .orderBy(desc(financialTransactions.dueAt))
    .limit(1000);
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export async function listNotifications(params: { unreadOnly?: boolean } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const where = params.unreadOnly ? eq(notifications.read, 0) : undefined;
  return db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(100);
}

export async function markNotificationRead(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(notifications).set({ read: 1 }).where(eq(notifications.id, id));
}

export async function markAllNotificationsRead(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(notifications).set({ read: 1 });
}

export async function createNotification(data: {
  title: string;
  message?: string;
  type?: Notification["type"];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(notifications).values({ ...data, read: 0 });
}

// ---------------------------------------------------------------------------
// Fotos da OS (osPhotos)
// ---------------------------------------------------------------------------

export async function insertOsPhoto(photo: InsertOsPhoto) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.insert(osPhotos).values(photo);
  return result[0];
}

export async function listOsPhotos(serviceOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(osPhotos)
    .where(eq(osPhotos.serviceOrderId, serviceOrderId))
    .orderBy(asc(osPhotos.createdAt));
  return rows.map((r) => ({ ...r, url: r.url ?? "" }));
}

export async function deleteOsPhoto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(osPhotos).where(eq(osPhotos.id, id));
}
