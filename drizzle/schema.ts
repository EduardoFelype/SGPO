import {
  bigint,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Perfil da oficina (Workshop) — dados da empresa no perfil/configurações.
 */
export const workshops = mysqlTable("workshops", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 20 }),
  phone: varchar("phone", { length: 30 }),
  whatsapp: varchar("whatsapp", { length: 30 }),
  email: varchar("email", { length: 320 }),
  address: varchar("address", { length: 500 }),
  number: varchar("number", { length: 30 }),
  neighborhood: varchar("neighborhood", { length: 200 }),
  city: varchar("city", { length: 200 }),
  stateCode: varchar("stateCode", { length: 2 }),
  zipCode: varchar("zipCode", { length: 12 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workshop = typeof workshops.$inferSelect;

/**
 * Clientes da oficina.
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["cpf", "cnpj"]).default("cpf").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  document: varchar("document", { length: 20 }),
  phone: varchar("phone", { length: 30 }),
  whatsapp: varchar("whatsapp", { length: 30 }),
  email: varchar("email", { length: 320 }),
  zipCode: varchar("zipCode", { length: 12 }),
  address: varchar("address", { length: 500 }),
  number: varchar("number", { length: 30 }),
  complement: varchar("complement", { length: 200 }),
  neighborhood: varchar("neighborhood", { length: 200 }),
  city: varchar("city", { length: 200 }),
  stateCode: varchar("stateCode", { length: 2 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * Veículos vinculados a clientes.
 */
export const vehicles = mysqlTable(
  "vehicles",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    plate: varchar("plate", { length: 10 }).notNull(),
    brand: varchar("brand", { length: 120 }).notNull(),
    model: varchar("model", { length: 160 }).notNull(),
    year: varchar("year", { length: 8 }),
    color: varchar("color", { length: 80 }),
    fuel: mysqlEnum("fuel", ["flex", "gasolina", "etanol", "diesel", "gnv", "eletrico"]),
    mileage: int("mileage").default(0).notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("idx_vehicles_plate").on(table.plate)]
);

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;

/**
 * Ordens de serviço.
 */
export const serviceOrders = mysqlTable("serviceOrders", {
  id: int("id").autoincrement().primaryKey(),
  /** Número legível: OS-000001 */
  number: varchar("number", { length: 20 }).notNull(),
  customerId: int("customerId").notNull(),
  vehicleId: int("vehicleId").notNull(),
  status: mysqlEnum("status", [
    "aberta",
    "em_analise",
    "aguardando_aprovacao",
    "aguardando_peca",
    "em_andamento",
    "concluida",
    "cancelada",
  ])
    .default("aberta")
    .notNull(),
  openedAt: bigint("openedAt", { mode: "number" }).notNull(),
  predictedAt: bigint("predictedAt", { mode: "number" }),
  completedAt: bigint("completedAt", { mode: "number" }),
  mileage: int("mileage"),
  diagnostics: text("diagnostics"),
  observations: text("observations"),
  discount: int("discount").default(0).notNull(),
  /** Total calculado a partir dos itens menos desconto */
  totalAmount: int("totalAmount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ServiceOrder = typeof serviceOrders.$inferSelect;

/**
 * Serviços (mão de obra) vinculados a uma OS.
 */
export const serviceOrderServices = mysqlTable("serviceOrderServices", {
  id: int("id").autoincrement().primaryKey(),
  serviceOrderId: int("serviceOrderId").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  unitPrice: int("unitPrice").notNull(),
  total: int("total").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ServiceOrderService = typeof serviceOrderServices.$inferSelect;

/**
 * Peças/produtos utilizados em uma OS.
 */
export const serviceOrderProducts = mysqlTable("serviceOrderProducts", {
  id: int("id").autoincrement().primaryKey(),
  serviceOrderId: int("serviceOrderId").notNull(),
  productId: int("productId"),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  unitPrice: int("unitPrice").notNull(),
  discount: int("discount").default(0).notNull(),
  total: int("total").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ServiceOrderProduct = typeof serviceOrderProducts.$inferSelect;

/**
 * Produtos do estoque.
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 40 }),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 160 }),
  brand: varchar("brand", { length: 160 }),
  supplier: varchar("supplier", { length: 160 }),
  description: text("description"),
  quantity: int("quantity").default(0).notNull(),
  minStock: int("minStock").default(0).notNull(),
  unit: varchar("unit", { length: 20 }).default("un").notNull(),
  costPrice: int("costPrice").default(0).notNull(),
  salePrice: int("salePrice").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

/**
 * Movimentações de estoque (entrada, saída, ajuste).
 */
export const stockMovements = mysqlTable("stockMovements", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  type: mysqlEnum("type", ["entrada", "saida", "ajuste"]).notNull(),
  quantity: int("quantity").notNull(),
  balanceAfter: int("balanceAfter").notNull(),
  reason: mysqlEnum("reason", ["manual", "ordem_servico", "automatico"]).default("manual").notNull(),
  serviceOrderId: int("serviceOrderId"),
  description: varchar("description", { length: 500 }),
  occurredAt: bigint("occurredAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StockMovement = typeof stockMovements.$inferSelect;

/**
 * Lançamentos financeiros (receitas e despesas).
 */
export const financialTransactions = mysqlTable("financialTransactions", {
  id: int("id").autoincrement().primaryKey(),
  description: varchar("description", { length: 500 }).notNull(),
  category: varchar("category", { length: 160 }),
  type: mysqlEnum("type", ["receita", "despesa"]).notNull(),
  amount: int("amount").notNull(),
  /** Vencimento (timestamp ms) */
  dueAt: bigint("dueAt", { mode: "number" }).notNull(),
  paidAt: bigint("paidAt", { mode: "number" }),
  status: mysqlEnum("status", ["pendente", "pago", "cancelado", "atrasado"]).default("pendente").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", [
    "dinheiro",
    "pix",
    "cartao_credito",
    "cartao_debito",
    "transferencia",
    "boleto",
    "outros",
  ]),
  sourceType: mysqlEnum("sourceType", ["manual", "ordem_servico", "automatico"]),
  sourceId: int("sourceId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinancialTransaction = typeof financialTransactions.$inferSelect;

/**
 * Notificações do sistema.
 */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  message: text("message"),
  type: mysqlEnum("type", ["estoque", "financeiro", "os", "sistema"]).default("sistema").notNull(),
  read: int("read").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

/**
 * Fotos anexadas a uma ordem de serviço (registro do veículo).
 */
export const osPhotos = mysqlTable("osPhotos", {
  id: int("id").autoincrement().primaryKey(),
  serviceOrderId: int("serviceOrderId").notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileName: varchar("fileName", { length: 300 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OsPhoto = typeof osPhotos.$inferSelect;
export type InsertOsPhoto = typeof osPhotos.$inferInsert;
