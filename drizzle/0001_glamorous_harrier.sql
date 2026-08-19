CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('cpf','cnpj') NOT NULL DEFAULT 'cpf',
	`name` varchar(255) NOT NULL,
	`document` varchar(20),
	`phone` varchar(30),
	`whatsapp` varchar(30),
	`email` varchar(320),
	`zipCode` varchar(12),
	`address` varchar(500),
	`number` varchar(30),
	`complement` varchar(200),
	`neighborhood` varchar(200),
	`city` varchar(200),
	`stateCode` varchar(2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financialTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`description` varchar(500) NOT NULL,
	`category` varchar(160),
	`type` enum('receita','despesa') NOT NULL,
	`amount` int NOT NULL,
	`dueAt` bigint NOT NULL,
	`paidAt` bigint,
	`status` enum('pendente','pago','cancelado','atrasado') NOT NULL DEFAULT 'pendente',
	`paymentMethod` enum('dinheiro','pix','cartao_credito','cartao_debito','transferencia','boleto','outros'),
	`sourceType` enum('manual','ordem_servico','automatico'),
	`sourceId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financialTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(300) NOT NULL,
	`message` text,
	`type` enum('estoque','financeiro','os','sistema') NOT NULL DEFAULT 'sistema',
	`read` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(40),
	`name` varchar(255) NOT NULL,
	`category` varchar(160),
	`brand` varchar(160),
	`supplier` varchar(160),
	`description` text,
	`quantity` int NOT NULL DEFAULT 0,
	`minStock` int NOT NULL DEFAULT 0,
	`unit` varchar(20) NOT NULL DEFAULT 'un',
	`costPrice` int NOT NULL DEFAULT 0,
	`salePrice` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `serviceOrderProducts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceOrderId` int NOT NULL,
	`productId` int,
	`description` varchar(500) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` int NOT NULL,
	`discount` int NOT NULL DEFAULT 0,
	`total` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `serviceOrderProducts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `serviceOrderServices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceOrderId` int NOT NULL,
	`description` varchar(500) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` int NOT NULL,
	`total` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `serviceOrderServices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `serviceOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(20) NOT NULL,
	`customerId` int NOT NULL,
	`vehicleId` int NOT NULL,
	`status` enum('aberta','em_analise','aguardando_aprovacao','aguardando_peca','em_andamento','concluida','cancelada') NOT NULL DEFAULT 'aberta',
	`openedAt` bigint NOT NULL,
	`predictedAt` bigint,
	`completedAt` bigint,
	`mileage` int,
	`diagnostics` text,
	`observations` text,
	`discount` int NOT NULL DEFAULT 0,
	`totalAmount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `serviceOrders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stockMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`type` enum('entrada','saida','ajuste') NOT NULL,
	`quantity` int NOT NULL,
	`balanceAfter` int NOT NULL,
	`reason` enum('manual','ordem_servico','automatico') NOT NULL DEFAULT 'manual',
	`serviceOrderId` int,
	`description` varchar(500),
	`occurredAt` bigint NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stockMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`plate` varchar(10) NOT NULL,
	`brand` varchar(120) NOT NULL,
	`model` varchar(160) NOT NULL,
	`year` varchar(8),
	`color` varchar(80),
	`fuel` enum('flex','gasolina','etanol','diesel','gnv','eletrico'),
	`mileage` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`),
	CONSTRAINT `idx_vehicles_plate` UNIQUE(`plate`)
);
--> statement-breakpoint
CREATE TABLE `workshops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`cnpj` varchar(20),
	`phone` varchar(30),
	`whatsapp` varchar(30),
	`email` varchar(320),
	`address` varchar(500),
	`number` varchar(30),
	`neighborhood` varchar(200),
	`city` varchar(200),
	`stateCode` varchar(2),
	`zipCode` varchar(12),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workshops_id` PRIMARY KEY(`id`)
);
