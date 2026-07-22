import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["SUPER_ADMIN", "ADMIN", "ADVISOR", "LENDER_ADMIN", "LENDER_UNDERWRITER"]);
export const userStatusEnum = pgEnum("user_status", ["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"]);
export const clientStatusEnum = pgEnum("client_status", ["DRAFT", "ACTIVE", "SUBMITTED", "CLOSED", "ARCHIVED"]);
export const documentStatusEnum = pgEnum("document_status", ["UPLOADED", "VERIFIED", "REJECTED", "DELETED"]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "DRAFT", "PENDING_DELIVERY", "SENT", "DELIVERED", "DELIVERY_FAILED", "OPENED", "IN_REVIEW",
  "MORE_INFO_REQUESTED", "IDENTITY_REQUESTED", "IDENTITY_APPROVED", "IDENTITY_REJECTED",
  "OFFER_RECEIVED", "DECLINED", "EXPIRED", "CANCELLED"
]);
export const responseTypeEnum = pgEnum("response_type", ["MESSAGE", "MORE_INFO_REQUEST", "INTERESTED", "DECLINED"]);
export const offerStatusEnum = pgEnum("offer_status", ["DRAFT", "SUBMITTED", "UPDATED", "WITHDRAWN", "ACCEPTED", "REJECTED", "EXPIRED"]);
export const identityRequestStatusEnum = pgEnum("identity_request_status", ["PENDING", "PARTIALLY_APPROVED", "APPROVED", "REJECTED", "CANCELLED"]);

const timestamps = {
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow()
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firebaseUid: varchar("firebase_uid", {length: 128}).notNull().unique(),
  email: varchar("email", {length: 320}).notNull().unique(),
  firstName: varchar("first_name", {length: 100}).notNull(),
  lastName: varchar("last_name", {length: 100}).notNull(),
  phoneEncrypted: text("phone_encrypted"),
  role: userRoleEnum("role").notNull(),
  roleLabel: varchar("role_label", {length: 100}).notNull(),
  status: userStatusEnum("status").notNull().default("PENDING"),
  emailVerified: boolean("email_verified").notNull().default(false),
  deletedAt: timestamp("deleted_at", {withTimezone: true}),
  lastLoginAt: timestamp("last_login_at", {withTimezone: true}),
  ...timestamps
});

export const advisorProfiles = pgTable("advisor_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  businessName: varchar("business_name", {length: 200}),
  businessPhoneEncrypted: text("business_phone_encrypted"),
  businessEmail: varchar("business_email", {length: 320}),
  licenseNumber: varchar("license_number", {length: 100}),
  ...timestamps
}, (table) => [uniqueIndex("advisor_profiles_user_id_uq").on(table.userId)]);

export const lenders = pgTable("lenders", {
  id: serial("id").primaryKey(),
  name: varchar("name", {length: 200}).notNull(),
  slug: varchar("slug", {length: 100}).notNull().unique(),
  contactEmail: varchar("contact_email", {length: 320}).notNull(),
  active: boolean("active").notNull().default(true),
  ...timestamps
});

export const lenderUsers = pgTable("lender_users", {
  id: serial("id").primaryKey(),
  lenderId: integer("lender_id").notNull().references(() => lenders.id),
  userId: integer("user_id").notNull().references(() => users.id),
  ...timestamps
}, (table) => [
  uniqueIndex("lender_users_lender_user_uq").on(table.lenderId, table.userId),
  index("lender_users_user_idx").on(table.userId)
]);

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  publicCaseNumber: varchar("public_case_number", {length: 32}).notNull().unique(),
  advisorId: integer("advisor_id").notNull().references(() => advisorProfiles.id),
  status: clientStatusEnum("status").notNull().default("DRAFT"),
  firstNameEncrypted: text("first_name_encrypted").notNull(),
  lastNameEncrypted: text("last_name_encrypted").notNull(),
  identityNumberEncrypted: text("identity_number_encrypted").notNull(),
  phoneEncrypted: text("phone_encrypted").notNull(),
  emailEncrypted: text("email_encrypted").notNull(),
  addressEncrypted: text("address_encrypted"),
  notesEncrypted: text("notes_encrypted"),
  maritalStatus: varchar("marital_status", {length: 30}).notNull().default("SINGLE"),
  numberOfChildren: integer("number_of_children").notNull().default(0),
  childrenAges: jsonb("children_ages").$type<number[]>().notNull().default([]),
  borrowerCount: integer("borrower_count").notNull().default(1),
  deletedAt: timestamp("deleted_at", {withTimezone: true}),
  ...timestamps
}, (table) => [
  index("clients_advisor_idx").on(table.advisorId),
  index("clients_deleted_idx").on(table.deletedAt),
  check("clients_marital_status_check", sql`${table.maritalStatus} in ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'COMMON_LAW', 'SEPARATED', 'OTHER')`),
  check("clients_children_count_check", sql`${table.numberOfChildren} >= 0`),
  check("clients_borrower_count_check", sql`${table.borrowerCount} >= 1`)
]);

export const borrowers = pgTable("borrowers", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  borrowerType: varchar("borrower_type", {length: 20}).notNull(),
  fullNameEncrypted: text("full_name_encrypted").notNull(),
  identityNumberEncrypted: text("identity_number_encrypted").notNull(),
  birthDate: timestamp("birth_date", {withTimezone: false}),
  ...timestamps
}, (table) => [index("borrowers_client_idx").on(table.clientId)]);

export const employmentRecords = pgTable("employment_records", {
  id: serial("id").primaryKey(),
  borrowerId: integer("borrower_id").notNull().references(() => borrowers.id),
  employmentType: varchar("employment_type", {length: 30}).notNull(),
  employerNameEncrypted: text("employer_name_encrypted"),
  jobTitle: varchar("job_title", {length: 150}),
  monthlyNetIncome: numeric("monthly_net_income", {precision: 14, scale: 2}).notNull(),
  monthlyGrossIncome: numeric("monthly_gross_income", {precision: 14, scale: 2}).notNull().default("0"),
  additionalIncome: numeric("additional_income", {precision: 14, scale: 2}).notNull().default("0"),
  hasAdditionalIncome: boolean("has_additional_income").notNull().default(false),
  additionalIncomeType: varchar("additional_income_type", {length: 50}),
  additionalIncomeAmount: numeric("additional_income_amount", {precision: 14, scale: 2}).notNull().default("0"),
  additionalIncomeDescriptionEncrypted: text("additional_income_description_encrypted"),
  startDate: timestamp("start_date", {withTimezone: false}),
  ...timestamps
}, (table) => [
  check("employment_type_check", sql`${table.employmentType} in ('SALARIED', 'SELF_EMPLOYED', 'CONTROLLING_SHAREHOLDER', 'RETIRED', 'GOVERNMENT_EMPLOYEE', 'SECURITY_FORCES', 'ALLOWANCE', 'UNEMPLOYED', 'OTHER')`),
  check("employment_income_check", sql`${table.monthlyNetIncome} >= 0 and ${table.additionalIncomeAmount} >= 0`),
  check("employment_additional_type_check", sql`${table.additionalIncomeType} is null or ${table.additionalIncomeType} in ('SECOND_BUSINESS', 'RENTAL_INCOME', 'ALLOWANCE', 'ALIMONY', 'PENSION', 'REGULAR_OVERTIME', 'REGULAR_BONUSES', 'FOREIGN_INCOME', 'INVESTMENT_INCOME', 'FAMILY_SUPPORT', 'OTHER')`),
  check("employment_additional_income_check", sql`(${table.hasAdditionalIncome} = false and ${table.additionalIncomeType} is null and ${table.additionalIncomeAmount} = 0) or (${table.hasAdditionalIncome} = true and ${table.additionalIncomeType} is not null and ${table.additionalIncomeAmount} > 0)`)
]);

export const incomeSources = pgTable("income_sources", {
  id: serial("id").primaryKey(),
  borrowerId: integer("borrower_id").notNull().references(() => borrowers.id),
  sourceType: varchar("source_type", {length: 50}).notNull(),
  monthlyAmount: numeric("monthly_amount", {precision: 14, scale: 2}).notNull(),
  descriptionEncrypted: text("description_encrypted"),
  ...timestamps
});

export const liabilities = pgTable("liabilities", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  liabilityType: varchar("liability_type", {length: 50}).notNull(),
  outstandingBalance: numeric("outstanding_balance", {precision: 14, scale: 2}).notNull(),
  monthlyPayment: numeric("monthly_payment", {precision: 14, scale: 2}).notNull(),
  ...timestamps
}, (table) => [
  check("liabilities_amounts_check", sql`${table.outstandingBalance} >= 0 and ${table.monthlyPayment} >= 0`)
]);

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  propertyType: varchar("property_type", {length: 50}).notNull(),
  region: varchar("region", {length: 100}).notNull(),
  city: varchar("city", {length: 100}),
  addressEncrypted: text("address_encrypted"),
  propertyTypeOtherDescriptionEncrypted: text("property_type_other_description_encrypted"),
  estimatedValue: numeric("estimated_value", {precision: 14, scale: 2}).notNull(),
  existingMortgageBalance: numeric("existing_mortgage_balance", {precision: 14, scale: 2}).notNull().default("0"),
  ...timestamps
}, (table) => [
  check("properties_type_check", sql`${table.propertyType} in ('APARTMENT', 'HOUSE', 'SEMI_DETACHED', 'GARDEN_APARTMENT', 'PENTHOUSE', 'LAND', 'COMMERCIAL', 'FARM', 'ESTATE', 'KIBBUTZ', 'OTHER')`),
  check("properties_amounts_check", sql`${table.estimatedValue} >= 0 and ${table.existingMortgageBalance} >= 0`)
]);

export const loanRequests = pgTable("loan_requests", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  purpose: varchar("purpose", {length: 50}).notNull(),
  requestedAmount: numeric("requested_amount", {precision: 14, scale: 2}).notNull(),
  requestedTermMonths: integer("requested_term_months").notNull(),
  loanToValue: numeric("loan_to_value", {precision: 6, scale: 2}).notNull(),
  ...timestamps
}, (table) => [
  check("loan_requests_purpose_check", sql`${table.purpose} in ('PURCHASE_FROM_CONTRACTOR', 'BUYER_PRICE_PROGRAM', 'SECOND_HAND_PURCHASE', 'RENOVATION', 'DEBT_CONSOLIDATION', 'BUSINESS_PURPOSE', 'ANY_PURPOSE', 'SELF_CONSTRUCTION', 'FAMILY_TRANSACTION', 'KIBBUTZ_PURCHASE_OR_CONSTRUCTION', 'RECEIVER_PURCHASE', 'REVERSE_MORTGAGE', 'TAMA', 'MORTGAGE_REFINANCE')`),
  check("loan_requests_amounts_check", sql`${table.requestedAmount} >= 0 and ${table.requestedTermMonths} > 0 and ${table.loanToValue} >= 0`)
]);

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  uploadedByUserId: integer("uploaded_by_user_id").notNull().references(() => users.id),
  documentType: varchar("document_type", {length: 80}).notNull(),
  originalFileName: varchar("original_file_name", {length: 255}).notNull(),
  storageKey: varchar("storage_key", {length: 512}).notNull().unique(),
  mimeType: varchar("mime_type", {length: 100}).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksumSha256: varchar("checksum_sha256", {length: 64}).notNull(),
  status: documentStatusEnum("status").notNull().default("UPLOADED"),
  deletedAt: timestamp("deleted_at", {withTimezone: true}),
  ...timestamps
}, (table) => [index("documents_client_idx").on(table.clientId)]);

export const lenderSubmissions = pgTable("lender_submissions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  lenderId: integer("lender_id").notNull().references(() => lenders.id),
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id),
  status: submissionStatusEnum("status").notNull().default("DRAFT"),
  anonymousSnapshot: jsonb("anonymous_snapshot").notNull(),
  anonymousPdfStorageKey: varchar("anonymous_pdf_storage_key", {length: 512}),
  sentAt: timestamp("sent_at", {withTimezone: true}),
  deliveredAt: timestamp("delivered_at", {withTimezone: true}),
  openedAt: timestamp("opened_at", {withTimezone: true}),
  ...timestamps
}, (table) => [index("submissions_client_idx").on(table.clientId), index("submissions_lender_idx").on(table.lenderId)]);

export const lenderResponses = pgTable("lender_responses", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => lenderSubmissions.id),
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id),
  responseType: responseTypeEnum("response_type").notNull(),
  message: text("message").notNull(),
  ...timestamps
});

export const identityRevealRequests = pgTable("identity_reveal_requests", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => lenderSubmissions.id),
  requestedByUserId: integer("requested_by_user_id").notNull().references(() => users.id),
  reason: text("reason").notNull(),
  requestedFields: jsonb("requested_fields").notNull(),
  approvedFields: jsonb("approved_fields").notNull().default([]),
  approvedDocumentIds: jsonb("approved_document_ids").notNull().default([]),
  status: identityRequestStatusEnum("status").notNull().default("PENDING"),
  decidedByUserId: integer("decided_by_user_id").references(() => users.id),
  decidedAt: timestamp("decided_at", {withTimezone: true}),
  ...timestamps
});

export const loanOffers = pgTable("loan_offers", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => lenderSubmissions.id),
  lenderUserId: integer("lender_user_id").notNull().references(() => users.id),
  amount: numeric("amount", {precision: 14, scale: 2}).notNull(),
  interestRate: numeric("interest_rate", {precision: 7, scale: 4}).notNull(),
  termMonths: integer("term_months").notNull(),
  monthlyPayment: numeric("monthly_payment", {precision: 14, scale: 2}),
  conditions: text("conditions"),
  status: offerStatusEnum("status").notNull().default("SUBMITTED"),
  expiresAt: timestamp("expires_at", {withTimezone: true}),
  ...timestamps
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: varchar("type", {length: 80}).notNull(),
  title: varchar("title", {length: 200}).notNull(),
  body: text("body").notNull(),
  readAt: timestamp("read_at", {withTimezone: true}),
  ...timestamps
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id").references(() => users.id),
  action: varchar("action", {length: 100}).notNull(),
  entityType: varchar("entity_type", {length: 80}),
  entityId: integer("entity_id"),
  metadata: jsonb("metadata"),
  requestId: varchar("request_id", {length: 64}),
  ipAddress: varchar("ip_address", {length: 64}),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow()
}, (table) => [index("audit_actor_idx").on(table.actorUserId), index("audit_action_idx").on(table.action)]);

export const emailLogs = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").references(() => lenderSubmissions.id),
  userId: integer("user_id").references(() => users.id),
  template: varchar("template", {length: 100}),
  recipient: varchar("recipient", {length: 320}).notNull(),
  messageId: varchar("message_id", {length: 255}),
  status: varchar("status", {length: 40}).notNull(),
  sanitizedError: text("sanitized_error"),
  requestId: varchar("request_id", {length: 64}),
  sentAt: timestamp("sent_at", {withTimezone: true}),
  failedAt: timestamp("failed_at", {withTimezone: true}),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow()
});

export const aiAnalysisLogs = pgTable("ai_analysis_logs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  requestedByUserId: integer("requested_by_user_id").notNull().references(() => users.id),
  model: varchar("model", {length: 100}).notNull(),
  promptCharacters: integer("prompt_characters").notNull(),
  status: varchar("status", {length: 40}).notNull(),
  durationMs: integer("duration_ms"),
  sanitizedError: text("sanitized_error"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow()
});

export const lenderInviteTokens = pgTable("lender_invite_tokens", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => lenderSubmissions.id),
  tokenHash: varchar("token_hash", {length: 64}).notNull(),
  expiresAt: timestamp("expires_at", {withTimezone: true}).notNull(),
  usedAt: timestamp("used_at", {withTimezone: true}),
  usedByUserId: integer("used_by_user_id").references(() => users.id),
  revokedAt: timestamp("revoked_at", {withTimezone: true}),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow()
}, (table) => [uniqueIndex("invite_token_hash_uq").on(table.tokenHash), index("invite_submission_idx").on(table.submissionId)]);

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", {length: 120}).notNull().unique(),
  value: text("value"),
  category: varchar("category", {length: 60}).notNull(),
  isSecret: boolean("is_secret").notNull().default(false),
  description: text("description"),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id),
  ...timestamps
});
