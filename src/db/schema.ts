import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const binary = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const userRoleEnum = pgEnum("flow_user_role", [
  "client",
  "admin",
  "account_manager",
  "photographer",
  "content_creator",
  "production_manager",
]);
export const accountStatusEnum = pgEnum("flow_account_status", ["pending", "active", "suspended", "disabled"]);
export const projectStatusEnum = pgEnum("flow_project_status", [
  "new",
  "pending_review",
  "waiting_client",
  "in_progress",
  "on_hold",
  "awaiting_approval",
  "revision_required",
  "completed",
  "cancelled",
]);
export const priorityEnum = pgEnum("flow_priority", ["low", "normal", "high", "urgent"]);
export const productStatusEnum = pgEnum("flow_product_status", [
  "submitted",
  "initial_review",
  "waiting_information",
  "photography_scheduled",
  "photography_in_progress",
  "image_editing",
  "content_creation",
  "internal_quality_review",
  "awaiting_client_approval",
  "revision_requested",
  "approved",
  "ready_for_publishing",
  "published",
  "completed",
]);
export const serviceRequestStatusEnum = pgEnum("flow_service_request_status", [
  "submitted",
  "under_review",
  "quotation_required",
  "waiting_client_approval",
  "approved",
  "in_progress",
  "completed",
  "cancelled",
]);
export const approvalStatusEnum = pgEnum("flow_approval_status", ["pending", "approved", "rejected", "revision_requested"]);
export const invoiceStatusEnum = pgEnum("flow_invoice_status", [
  "draft",
  "unpaid",
  "partially_paid",
  "pending",
  "paid",
  "failed",
  "cancelled",
  "refunded",
]);
export const subscriptionStatusEnum = pgEnum("flow_subscription_status", ["active", "paused", "cancelled", "expired"]);
export const listingStatusEnum = pgEnum("flow_listing_status", [
  "not_published",
  "draft",
  "ready_for_publishing",
  "pending",
  "published",
  "rejected",
  "needs_attention",
]);
export const fileCategoryEnum = pgEnum("flow_file_category", ["reference", "original", "edited", "deliverable", "document", "other"]);

export const organizations = pgTable(
  "flow_organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyName: varchar("company_name", { length: 180 }).notNull(),
    contactPerson: varchar("contact_person", { length: 140 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    category: varchar("category", { length: 120 }),
    website: varchar("website", { length: 300 }),
    description: text("description"),
    preferredLanguage: varchar("preferred_language", { length: 8 }).notNull().default("en"),
    targetMarketplaces: text("target_marketplaces").array().notNull().default(sql`ARRAY[]::text[]`),
    requiredServices: text("required_services").array().notNull().default(sql`ARRAY[]::text[]`),
    monthlyProductEstimate: integer("monthly_product_estimate"),
    additionalRequirements: text("additional_requirements"),
    status: accountStatusEnum("status").notNull().default("pending"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("flow_organizations_status_idx").on(table.status)],
);

export const users = pgTable(
  "flow_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 140 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("client"),
    status: accountStatusEnum("status").notNull().default("pending"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("flow_users_email_unique").on(table.email),
    index("flow_users_org_idx").on(table.organizationId),
    index("flow_users_role_status_idx").on(table.role, table.status),
  ],
);

export const employees = pgTable("flow_employees", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  department: varchar("department", { length: 100 }),
  title: varchar("title", { length: 120 }),
  phone: varchar("phone", { length: 40 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const roles = pgTable("flow_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 60 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(true),
  createdAt: createdAt(),
});

export const permissions = pgTable("flow_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: createdAt(),
});

export const rolePermissions = pgTable(
  "flow_role_permissions",
  {
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
);

export const sessions = pgTable(
  "flow_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("flow_sessions_user_idx").on(table.userId), index("flow_sessions_expiry_idx").on(table.expiresAt)],
);

export const passwordResetTokens = pgTable(
  "flow_password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index("flow_password_reset_user_idx").on(table.userId)],
);

export const emailVerificationTokens = pgTable(
  "flow_email_verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index("flow_email_verify_user_idx").on(table.userId)],
);

export const projects = pgTable(
  "flow_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    projectCode: varchar("project_code", { length: 24 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description"),
    accountManagerId: uuid("account_manager_id").references(() => users.id, { onDelete: "set null" }),
    status: projectStatusEnum("status").notNull().default("new"),
    priority: priorityEnum("priority").notNull().default("normal"),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    budget: numeric("budget", { precision: 12, scale: 2, mode: "number" }),
    currency: varchar("currency", { length: 3 }).notNull().default("EGP"),
    progress: smallint("progress").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("flow_projects_code_unique").on(table.projectCode),
    index("flow_projects_org_status_idx").on(table.organizationId, table.status),
    index("flow_projects_manager_idx").on(table.accountManagerId),
    index("flow_projects_due_idx").on(table.dueDate),
  ],
);

export const projectMembers = pgTable(
  "flow_project_members",
  {
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    memberRole: varchar("member_role", { length: 60 }).notNull().default("member"),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] }), index("flow_project_members_user_idx").on(table.userId)],
);

export const products = pgTable(
  "flow_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    name: varchar("name", { length: 180 }).notNull(),
    sku: varchar("sku", { length: 100 }),
    brand: varchar("brand", { length: 120 }),
    category: varchar("category", { length: 120 }),
    productType: varchar("product_type", { length: 100 }),
    description: text("description"),
    dimensions: jsonb("dimensions").$type<Record<string, string>>().notNull().default({}),
    weight: varchar("weight", { length: 60 }),
    materials: text("materials"),
    specifications: jsonb("specifications").$type<Record<string, string>>().notNull().default({}),
    targetAudience: text("target_audience"),
    targetMarketplace: varchar("target_marketplace", { length: 80 }),
    requiredServices: text("required_services").array().notNull().default(sql`ARRAY[]::text[]`),
    clientInstructions: text("client_instructions"),
    internalNotes: text("internal_notes"),
    status: productStatusEnum("status").notNull().default("submitted"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("flow_products_org_status_idx").on(table.organizationId, table.status),
    index("flow_products_project_idx").on(table.projectId),
    index("flow_products_sku_idx").on(table.sku),
    index("flow_products_created_idx").on(table.createdAt),
  ],
);

export const workflowSteps = pgTable(
  "flow_workflow_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    stageKey: varchar("stage_key", { length: 80 }).notNull(),
    stageLabel: varchar("stage_label", { length: 120 }).notNull(),
    stageOrder: smallint("stage_order").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    priority: varchar("priority", { length: 16 }).notNull().default("normal"),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    deadline: timestamp("deadline", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    clientVisible: boolean("client_visible").notNull().default(true),
    comment: text("comment"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("flow_workflow_product_order_idx").on(table.productId, table.stageOrder), index("flow_workflow_assignee_idx").on(table.assignedTo)],
);


export const automationRules = pgTable(
  "flow_automation_rules",
  {
    key: varchar("key", { length: 60 }).primaryKey(),
    enabled: boolean("enabled").notNull().default(true),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: createdAt(),
  },
);
export const productContents = pgTable(
  "flow_product_contents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    language: varchar("language", { length: 8 }).notNull(),
    title: text("title"),
    shortDescription: text("short_description"),
    fullDescription: text("full_description"),
    bulletPoints: jsonb("bullet_points").$type<string[]>().notNull().default([]),
    specifications: jsonb("specifications").$type<Record<string, string>>().notNull().default({}),
    keywords: text("keywords").array().notNull().default(sql`ARRAY[]::text[]`),
    status: varchar("status", { length: 32 }).notNull().default("draft"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("flow_product_content_version_unique").on(table.productId, table.version, table.language), index("flow_product_content_product_idx").on(table.productId)],
);

export const files = pgTable(
  "flow_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    fileName: varchar("file_name", { length: 240 }).notNull(),
    contentType: varchar("content_type", { length: 120 }).notNull(),
    fileSize: integer("file_size").notNull(),
    category: fileCategoryEnum("category").notNull().default("document"),
    versionNumber: integer("version_number").notNull().default(1),
    clientVisible: boolean("client_visible").notNull().default(true),
    content: binary("content").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("flow_files_org_created_idx").on(table.organizationId, table.createdAt), index("flow_files_product_idx").on(table.productId)],
);

export const deliverables = pgTable(
  "flow_deliverables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    deliverableType: varchar("deliverable_type", { length: 60 }).notNull(),
    versionNumber: integer("version_number").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [index("flow_deliverables_org_idx").on(table.organizationId), index("flow_deliverables_product_idx").on(table.productId)],
);

export const approvals = pgTable(
  "flow_approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    deliverableId: uuid("deliverable_id").references(() => deliverables.id, { onDelete: "set null" }),
    title: varchar("title", { length: 180 }).notNull(),
    approvalType: varchar("approval_type", { length: 60 }).notNull(),
    status: approvalStatusEnum("status").notNull().default("pending"),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    respondedBy: uuid("responded_by").references(() => users.id, { onDelete: "set null" }),
    clientNote: text("client_note"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [index("flow_approvals_org_status_idx").on(table.organizationId, table.status), index("flow_approvals_product_idx").on(table.productId)],
);

export const serviceCatalog = pgTable(
  "flow_service_catalog",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 140 }).notNull(),
    description: text("description").notNull(),
    unitType: varchar("unit_type", { length: 40 }).notNull().default("project"),
    price: numeric("price", { precision: 12, scale: 2, mode: "number" }),
    priceLabel: varchar("price_label", { length: 80 }),
    currency: varchar("currency", { length: 3 }).notNull().default("EGP"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("flow_service_catalog_enabled_idx").on(table.isEnabled, table.sortOrder)],
);

export const serviceRequests = pgTable(
  "flow_service_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    serviceId: uuid("service_id").references(() => serviceCatalog.id, { onDelete: "set null" }),
    projectName: varchar("project_name", { length: 180 }).notNull(),
    productQuantity: integer("product_quantity").notNull().default(1),
    description: text("description"),
    targetMarketplace: varchar("target_marketplace", { length: 80 }),
    desiredDeadline: date("desired_deadline"),
    priority: priorityEnum("priority").notNull().default("normal"),
    status: serviceRequestStatusEnum("status").notNull().default("submitted"),
    estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2, mode: "number" }),
    assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("flow_service_requests_org_status_idx").on(table.organizationId, table.status)],
);

export const marketplaces = pgTable("flow_marketplaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: createdAt(),
});

export const marketplaceAccounts = pgTable(
  "flow_marketplace_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    marketplaceId: uuid("marketplace_id").notNull().references(() => marketplaces.id, { onDelete: "restrict" }),
    displayName: varchar("display_name", { length: 140 }),
    externalAccountId: varchar("external_account_id", { length: 180 }),
    connectionStatus: varchar("connection_status", { length: 30 }).notNull().default("not_connected"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("flow_marketplace_account_unique").on(table.organizationId, table.marketplaceId)],
);

export const marketplaceListings = pgTable(
  "flow_marketplace_listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    marketplaceId: uuid("marketplace_id").notNull().references(() => marketplaces.id, { onDelete: "restrict" }),
    listingId: varchar("listing_id", { length: 180 }),
    listingUrl: text("listing_url"),
    status: listingStatusEnum("status").notNull().default("not_published"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("flow_listing_product_market_unique").on(table.productId, table.marketplaceId), index("flow_listing_status_idx").on(table.status)],
);

export const subscriptionPlans = pgTable("flow_subscription_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  billingCycle: varchar("billing_cycle", { length: 16 }).notNull().default("monthly"),
  productQuota: integer("product_quota"),
  includedServices: text("included_services").array().notNull().default(sql`ARRAY[]::text[]`),
  overagePrice: numeric("overage_price", { precision: 12, scale: 2, mode: "number" }),
  price: numeric("price", { precision: 12, scale: 2, mode: "number" }),
  currency: varchar("currency", { length: 3 }).notNull().default("EGP"),
  isCustom: boolean("is_custom").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const subscriptions = pgTable(
  "flow_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").references(() => subscriptionPlans.id, { onDelete: "set null" }),
    status: subscriptionStatusEnum("status").notNull().default("active"),
    billingCycle: varchar("billing_cycle", { length: 16 }).notNull().default("monthly"),
    customPrice: numeric("custom_price", { precision: 12, scale: 2, mode: "number" }),
    startsAt: date("starts_at"),
    renewsAt: date("renews_at"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("flow_subscriptions_org_status_idx").on(table.organizationId, table.status)],
);

export const subscriptionUsage = pgTable("flow_subscription_usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  productsUsed: integer("products_used").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [uniqueIndex("flow_usage_period_unique").on(table.subscriptionId, table.periodStart)]);

export const invoices = pgTable(
  "flow_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" }),
    invoiceNumber: varchar("invoice_number", { length: 40 }).notNull(),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
    discount: numeric("discount", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
    tax: numeric("tax", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
    total: numeric("total", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
    amountPaid: numeric("amount_paid", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("EGP"),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("flow_invoice_number_unique").on(table.invoiceNumber), index("flow_invoices_org_status_idx").on(table.organizationId, table.status)],
);

export const invoiceItems = pgTable("flow_invoice_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 240 }).notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2, mode: "number" }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2, mode: "number" }).notNull(),
  lineTotal: numeric("line_total", { precision: 12, scale: 2, mode: "number" }).notNull(),
  createdAt: createdAt(),
}, (table) => [index("flow_invoice_items_invoice_idx").on(table.invoiceId)]);

export const payments = pgTable(
  "flow_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("EGP"),
    method: varchar("method", { length: 60 }).notNull(),
    reference: varchar("reference", { length: 180 }),
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index("flow_payments_invoice_idx").on(table.invoiceId), index("flow_payments_status_idx").on(table.status)],
);

export const paymentEvents = pgTable("flow_payment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
  provider: varchar("provider", { length: 60 }).notNull(),
  providerEventId: varchar("provider_event_id", { length: 180 }),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  verified: boolean("verified").notNull().default(false),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  receivedAt: createdAt(),
}, (table) => [uniqueIndex("flow_payment_provider_event_unique").on(table.provider, table.providerEventId)]);

export const conversations = pgTable(
  "flow_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    subject: varchar("subject", { length: 180 }).notNull(),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("flow_conversations_org_idx").on(table.organizationId), index("flow_conversations_assignee_idx").on(table.assignedUserId)],
);

export const messages = pgTable(
  "flow_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    isInternal: boolean("is_internal").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index("flow_messages_conversation_time_idx").on(table.conversationId, table.createdAt)],
);

export const messageAttachments = pgTable(
  "flow_message_attachments",
  {
    messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.messageId, table.fileId] }), index("flow_message_attachments_file_idx").on(table.fileId)],
);

export const notifications = pgTable(
  "flow_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    type: varchar("type", { length: 60 }).notNull().default("update"),
    href: varchar("href", { length: 300 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [index("flow_notifications_user_unread_idx").on(table.userId, table.readAt, table.createdAt)],
);

export const activityLogs = pgTable(
  "flow_activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    entityType: varchar("entity_type", { length: 60 }).notNull(),
    entityId: varchar("entity_id", { length: 80 }),
    action: varchar("action", { length: 80 }).notNull(),
    description: text("description").notNull(),
    visibility: varchar("visibility", { length: 16 }).notNull().default("client"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (table) => [index("flow_activity_org_time_idx").on(table.organizationId, table.createdAt), index("flow_activity_entity_idx").on(table.entityType, table.entityId)],
);

export const auditLogs = pgTable(
  "flow_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 60 }).notNull(),
    entityId: varchar("entity_id", { length: 80 }),
    previousValue: jsonb("previous_value").$type<Record<string, unknown> | null>(),
    newValue: jsonb("new_value").$type<Record<string, unknown> | null>(),
    ipAddress: varchar("ip_address", { length: 80 }),
    createdAt: createdAt(),
  },
  (table) => [index("flow_audit_actor_time_idx").on(table.actorId, table.createdAt), index("flow_audit_entity_idx").on(table.entityType, table.entityId)],
);


export const clientDeals = pgTable(
  "flow_client_deals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 180 }).notNull(),
    summary: text("summary").notNull(),
    services: text("services").array().notNull().default(sql`ARRAY[]::text[]`),
    dealValue: numeric("deal_value", { precision: 12, scale: 2, mode: "number" }),
    currency: varchar("currency", { length: 3 }).notNull().default("EGP"),
    status: varchar("status", { length: 24 }).notNull().default("agreed"),
    agreementDate: date("agreement_date"),
    contractFileId: uuid("contract_file_id").references(() => files.id, { onDelete: "set null" }),
    contractStatus: varchar("contract_status", { length: 24 }).notNull().default("not_uploaded"),
    contractStartDate: date("contract_start_date"),
    contractEndDate: date("contract_end_date"),
    clientVisible: boolean("client_visible").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("flow_client_deals_org_date_idx").on(table.organizationId, table.agreementDate),
    index("flow_client_deals_status_idx").on(table.status),
  ],
);
