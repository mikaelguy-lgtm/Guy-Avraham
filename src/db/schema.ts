import {
  boolean,
  check,
  date,
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
export const documentStatusEnum = pgEnum("document_status", ["UPLOADED", "VERIFIED", "REJECTED", "REPLACED", "DELETED"]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "DRAFT", "PENDING_DELIVERY", "SENT", "DELIVERED", "DELIVERY_FAILED", "OPENED", "IN_REVIEW",
  "MORE_INFO_REQUESTED", "IDENTITY_REQUESTED", "IDENTITY_APPROVED", "IDENTITY_REJECTED",
  "OFFER_RECEIVED", "DECLINED", "EXPIRED", "CANCELLED"
]);
export const responseTypeEnum = pgEnum("response_type", ["MESSAGE", "MORE_INFO_REQUEST", "INTERESTED", "DECLINED"]);
export const offerStatusEnum = pgEnum("offer_status", ["DRAFT", "SUBMITTED", "UPDATED", "WITHDRAWN", "ACCEPTED", "REJECTED", "EXPIRED"]);
export const identityRequestStatusEnum = pgEnum("identity_request_status", ["PENDING", "PARTIALLY_APPROVED", "APPROVED", "REJECTED", "CANCELLED"]);
export const businessCalendarExceptionTypeEnum = pgEnum("business_calendar_exception_type", ["HOLIDAY", "NON_WORKING_DAY", "FORCED_WORKING_DAY"]);
export const caseVersionStatusEnum = pgEnum("case_version_status", ["CREATING", "READY", "FAILED", "ARCHIVED"]);
export const companyDeliveryStatusEnum = pgEnum("company_delivery_status", ["PENDING", "QUEUED", "PARTIALLY_SENT", "SENT", "FAILED"]);
export const companyDecisionStatusEnum = pgEnum("company_decision_status", ["PENDING", "PENDING_VERIFICATION", "INTERESTED", "NOT_INTERESTED", "EXPIRED", "CANCELLED"]);
export const companyAccessStatusEnum = pgEnum("company_access_status", ["NONE", "ACTIVE", "EXPIRED", "REVOKED"]);
export const contactInvitationStatusEnum = pgEnum("contact_invitation_status", ["PENDING", "QUEUED", "SENT", "FAILED", "OPENED", "CLOSED", "EXPIRED"]);
export const otpPurposeEnum = pgEnum("otp_purpose", ["INTEREST_DECISION", "PORTAL_ACCESS"]);
export const outboxStatusEnum = pgEnum("outbox_status", ["PENDING", "PROCESSING", "SENT", "FAILED", "CANCELLED"]);
export const submissionActorTypeEnum = pgEnum("submission_actor_type", ["ADVISOR", "ADMIN", "COMPANY_CONTACT", "SYSTEM"]);
export const emailProviderEnum = pgEnum("email_provider", ["GMAIL", "BREVO", "CUSTOM"]);
export const emailSecurityModeEnum = pgEnum("email_security_mode", ["NONE", "STARTTLS", "TLS"]);
export const emailConfigurationStatusEnum = pgEnum("email_configuration_status", ["DRAFT", "TESTED", "ACTIVE", "FAILED", "SUPERSEDED"]);

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
  contactEmail: varchar("contact_email", {length: 320}),
  legalName: varchar("legal_name", {length: 250}),
  companyNumber: varchar("company_number", {length: 50}),
  logoStorageKey: varchar("logo_storage_key", {length: 512}),
  phone: varchar("phone", {length: 50}),
  address: text("address"),
  website: varchar("website", {length: 500}),
  activityAreas: jsonb("activity_areas").$type<string[]>().notNull().default([]),
  adminNotesEncrypted: text("admin_notes_encrypted"),
  active: boolean("active").notNull().default(true),
  deletedAt: timestamp("deleted_at", {withTimezone: true}),
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
  dealDetailsEncrypted: text("deal_details_encrypted"),
  dealDetailsUpdatedByUserId: integer("deal_details_updated_by_user_id").references(() => users.id),
  dealDetailsUpdatedAt: timestamp("deal_details_updated_at", {withTimezone: true}),
  maritalStatus: varchar("marital_status", {length: 30}).notNull().default("SINGLE"),
  numberOfChildren: integer("number_of_children").notNull().default(0),
  childrenAges: jsonb("children_ages").$type<number[]>().notNull().default([]),
  borrowerCount: integer("borrower_count").notNull().default(1),
  numberOfBorrowers: integer("number_of_borrowers").notNull().default(1),
  borrowerRelationship: varchar("borrower_relationship", {length: 30}),
  borrowerRelationshipOtherEncrypted: text("borrower_relationship_other_encrypted"),
  householdChildrenCount: integer("household_children_count").notNull().default(0),
  householdChildrenAges: jsonb("household_children_ages").$type<number[]>().notNull().default([]),
  deletedAt: timestamp("deleted_at", {withTimezone: true}),
  ...timestamps
}, (table) => [
  index("clients_advisor_idx").on(table.advisorId),
  index("clients_deleted_idx").on(table.deletedAt),
  check("clients_marital_status_check", sql`${table.maritalStatus} in ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'COMMON_LAW', 'SEPARATED', 'OTHER')`),
  check("clients_children_count_check", sql`${table.numberOfChildren} >= 0`),
  check("clients_borrower_count_check", sql`${table.borrowerCount} >= 1`)
  ,check("clients_number_of_borrowers_check", sql`${table.numberOfBorrowers} between 1 and 5`)
  ,check("clients_borrower_relationship_check", sql`${table.borrowerRelationship} is null or ${table.borrowerRelationship} in ('MARRIED', 'COMMON_LAW', 'FAMILY', 'PARTNERS', 'OTHER')`)
  ,check("clients_household_children_count_check", sql`${table.householdChildrenCount} >= 0`)
]);

export const borrowers = pgTable("borrowers", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  borrowerType: varchar("borrower_type", {length: 20}).notNull(),
  fullNameEncrypted: text("full_name_encrypted").notNull(),
  identityNumberEncrypted: text("identity_number_encrypted").notNull(),
  birthDate: timestamp("birth_date", {withTimezone: false}),
  borrowerOrder: integer("borrower_order").notNull().default(1),
  isPrimary: boolean("is_primary").notNull().default(false),
  firstNameEncrypted: text("first_name_encrypted"),
  lastNameEncrypted: text("last_name_encrypted"),
  identityNumberHash: varchar("identity_number_hash", {length: 64}),
  birthDateEncrypted: text("date_of_birth_encrypted"),
  phoneEncrypted: text("phone_encrypted"),
  emailEncrypted: text("email_encrypted"),
  addressEncrypted: text("address_encrypted"),
  maritalStatus: varchar("marital_status", {length: 30}),
  numberOfChildren: integer("number_of_children").notNull().default(0),
  childrenAges: jsonb("children_ages").$type<number[]>().notNull().default([]),
  ...timestamps
}, (table) => [
  index("borrowers_client_idx").on(table.clientId),
  uniqueIndex("borrowers_client_order_uq").on(table.clientId, table.borrowerOrder),
  uniqueIndex("borrowers_client_identity_uq").on(table.clientId, table.identityNumberHash),
  uniqueIndex("borrowers_client_primary_uq").on(table.clientId).where(sql`${table.isPrimary} = true`),
  check("borrowers_order_check", sql`${table.borrowerOrder} >= 1`),
  check("borrowers_children_count_check", sql`${table.numberOfChildren} >= 0`),
  check("borrowers_marital_status_check", sql`${table.maritalStatus} is null or ${table.maritalStatus} in ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'COMMON_LAW', 'SEPARATED', 'OTHER')`)
]);

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
  employmentSeniorityYears: integer("employment_seniority_years").notNull().default(0),
  startDate: timestamp("start_date", {withTimezone: false}),
  ...timestamps
}, (table) => [
  check("employment_type_check", sql`${table.employmentType} in ('SALARIED', 'SELF_EMPLOYED', 'CONTROLLING_SHAREHOLDER', 'RETIRED', 'GOVERNMENT_EMPLOYEE', 'SECURITY_FORCES', 'ALLOWANCE', 'UNEMPLOYED', 'OTHER')`),
  check("employment_income_check", sql`${table.monthlyNetIncome} >= 0 and ${table.monthlyGrossIncome} >= 0 and ${table.additionalIncome} >= 0 and ${table.additionalIncomeAmount} >= 0 and ${table.employmentSeniorityYears} >= 0`),
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
}, (table) => [check("income_sources_amount_check", sql`${table.monthlyAmount} >= 0`)]);

export const liabilities = pgTable("liabilities", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  borrowerId: integer("borrower_id").references(() => borrowers.id),
  scope: varchar("scope", {length: 20}).notNull().default("BORROWER"),
  liabilityType: varchar("liability_type", {length: 50}).notNull(),
  outstandingBalance: numeric("outstanding_balance", {precision: 14, scale: 2}).notNull(),
  currentBalance: numeric("current_balance", {precision: 14, scale: 2}),
  monthlyPayment: numeric("monthly_payment", {precision: 14, scale: 2}).notNull(),
  endDate: date("end_date"),
  otherTypeDescriptionEncrypted: text("other_type_description_encrypted"),
  notesEncrypted: text("notes_encrypted"),
  legacyStatus: varchar("legacy_status", {length: 30}),
  deletedAt: timestamp("deleted_at", {withTimezone: true}),
  ...timestamps
}, (table) => [
  index("liabilities_client_idx").on(table.clientId),
  index("liabilities_borrower_idx").on(table.borrowerId),
  index("liabilities_active_idx").on(table.clientId, table.deletedAt),
  check("liabilities_amounts_check", sql`${table.outstandingBalance} >= 0 and ${table.monthlyPayment} >= 0 and (${table.currentBalance} is null or ${table.currentBalance} >= 0)`),
  check("liabilities_scope_check", sql`(${table.scope} = 'BORROWER' and ${table.borrowerId} is not null) or (${table.scope} = 'HOUSEHOLD' and ${table.borrowerId} is null)`),
  check("liabilities_type_check", sql`${table.liabilityType} in ('LOAN', 'MORTGAGE', 'ALIMONY', 'OTHER_FINANCIAL_ENTITY')`)
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
  check("loan_requests_purpose_check", sql`${table.purpose} in ('PURCHASE_FROM_CONTRACTOR', 'BUYER_PRICE_PROGRAM', 'SECOND_HAND_PURCHASE', 'RENOVATION', 'DEBT_CONSOLIDATION', 'BUSINESS_PURPOSE', 'ANY_PURPOSE', 'SELF_CONSTRUCTION', 'FAMILY_TRANSACTION', 'KIBBUTZ_PURCHASE_OR_CONSTRUCTION', 'RECEIVER_PURCHASE', 'REVERSE_MORTGAGE', 'TAMA', 'MORTGAGE_REFINANCE', 'BRIDGE_FINANCING')`),
  check("loan_requests_amounts_check", sql`${table.requestedAmount} >= 0 and ${table.requestedTermMonths} > 0 and ${table.loanToValue} >= 0`)
]);

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  borrowerId: integer("borrower_id").references(() => borrowers.id),
  uploadedByUserId: integer("uploaded_by_user_id").notNull().references(() => users.id),
  documentType: varchar("document_type", {length: 80}).notNull(),
  customTitle: varchar("custom_title", {length: 255}),
  descriptionEncrypted: text("description_encrypted"),
  originalFileName: varchar("original_file_name", {length: 255}).notNull(),
  storageKey: varchar("storage_key", {length: 512}).notNull().unique(),
  mimeType: varchar("mime_type", {length: 100}).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksumSha256: varchar("checksum_sha256", {length: 64}).notNull(),
  status: documentStatusEnum("status").notNull().default("UPLOADED"),
  deletedAt: timestamp("deleted_at", {withTimezone: true}),
  ...timestamps
}, (table) => [
  index("documents_client_idx").on(table.clientId),
  index("documents_borrower_idx").on(table.borrowerId),
  index("documents_required_lookup_idx").on(table.clientId, table.borrowerId, table.documentType, table.status),
  check("documents_size_check", sql`${table.sizeBytes} >= 0`)
]);

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
}, (table) => [check("loan_offers_values_check", sql`${table.amount} >= 0 and ${table.interestRate} >= 0 and ${table.interestRate} <= 100 and ${table.termMonths} between 12 and 600 and (${table.monthlyPayment} is null or ${table.monthlyPayment} >= 0)`)]);

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
}, (table) => [check("ai_analysis_metrics_check", sql`${table.promptCharacters} >= 0 and (${table.durationMs} is null or ${table.durationMs} >= 0)`)]);

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

export const emailConfigurations = pgTable("email_configurations", {
  id: serial("id").primaryKey(),
  provider: emailProviderEnum("provider").notNull(),
  status: emailConfigurationStatusEnum("status").notNull().default("DRAFT"),
  host: varchar("host", {length: 253}).notNull(),
  port: integer("port").notNull(),
  securityMode: emailSecurityModeEnum("security_mode").notNull(),
  username: varchar("username", {length: 320}),
  fromEmail: varchar("from_email", {length: 320}).notNull(),
  fromName: varchar("from_name", {length: 200}).notNull(),
  replyTo: varchar("reply_to", {length: 320}).notNull(),
  secretName: varchar("secret_name", {length: 120}),
  secretVersion: varchar("secret_version", {length: 512}),
  previousConfigurationId: integer("previous_configuration_id"),
  lastTestedAt: timestamp("last_tested_at", {withTimezone: true}),
  lastTestFailureCode: varchar("last_test_failure_code", {length: 80}),
  activatedAt: timestamp("activated_at", {withTimezone: true}),
  supersededAt: timestamp("superseded_at", {withTimezone: true}),
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id),
  updatedByUserId: integer("updated_by_user_id").notNull().references(() => users.id),
  ...timestamps
}, (table) => [
  index("email_configurations_status_idx").on(table.status, table.updatedAt),
  uniqueIndex("email_configurations_single_active_uq").on(table.status).where(sql`${table.status} = 'ACTIVE'`),
  check("email_configurations_port_check", sql`${table.port} between 1 and 65535`)
]);

export const lenderContacts = pgTable("lender_contacts", {
  id: serial("id").primaryKey(),
  lenderId: integer("lender_id").notNull().references(() => lenders.id),
  firstName: varchar("first_name", {length: 100}).notNull(),
  lastName: varchar("last_name", {length: 100}).notNull(),
  roleTitle: varchar("role_title", {length: 150}).notNull(),
  email: varchar("email", {length: 320}).notNull(),
  emailNormalized: varchar("email_normalized", {length: 320}).notNull(),
  phone: varchar("phone", {length: 50}),
  isPrimary: boolean("is_primary").notNull().default(false),
  active: boolean("active").notNull().default(true),
  deletedAt: timestamp("deleted_at", {withTimezone: true}),
  ...timestamps
}, (table) => [
  uniqueIndex("lender_contacts_email_uq").on(table.lenderId, table.emailNormalized).where(sql`${table.deletedAt} is null`),
  index("lender_contacts_active_idx").on(table.lenderId, table.active, table.deletedAt)
]);

export const businessCalendarExceptions = pgTable("business_calendar_exceptions", {
  id: serial("id").primaryKey(),
  exceptionDate: date("exception_date").notNull(),
  type: businessCalendarExceptionTypeEnum("type").notNull(),
  title: varchar("title", {length: 200}).notNull(),
  source: varchar("source", {length: 200}).notNull(),
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id),
  ...timestamps
}, (table) => [uniqueIndex("business_calendar_date_uq").on(table.exceptionDate)]);

export const deliveryBatches = pgTable("delivery_batches", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  advisorId: integer("advisor_id").notNull().references(() => advisorProfiles.id),
  idempotencyKey: varchar("idempotency_key", {length: 100}).notNull(),
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id),
  ...timestamps
}, (table) => [uniqueIndex("delivery_batches_advisor_idempotency_uq").on(table.advisorId, table.idempotencyKey)]);

export const caseVersions = pgTable("case_versions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  versionNumber: integer("version_number").notNull(),
  advisorId: integer("advisor_id").notNull().references(() => advisorProfiles.id),
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id),
  sourceClientUpdatedAt: timestamp("source_client_updated_at", {withTimezone: true}).notNull(),
  fullSnapshotEncrypted: text("full_snapshot_encrypted").notNull(),
  maskedSnapshot: jsonb("masked_snapshot").notNull(),
  maskedPdfObjectKey: varchar("masked_pdf_object_key", {length: 512}).notNull(),
  fullPdfObjectKey: varchar("full_pdf_object_key", {length: 512}).notNull(),
  redactionReport: jsonb("redaction_report").notNull(),
  contentHash: varchar("content_hash", {length: 64}).notNull(),
  pdfRendererVersion: integer("pdf_renderer_version"),
  pdfFontFingerprint: varchar("pdf_font_fingerprint", {length: 64}),
  pdfGeneratedAt: timestamp("pdf_generated_at", {withTimezone: true}),
  status: caseVersionStatusEnum("status").notNull().default("CREATING"),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow()
}, (table) => [
  uniqueIndex("case_versions_client_version_uq").on(table.clientId, table.versionNumber),
  index("case_versions_client_idx").on(table.clientId),
  check("case_versions_numbers_check", sql`${table.versionNumber} >= 1 and (${table.pdfRendererVersion} is null or ${table.pdfRendererVersion} >= 0)`)
]);

export const caseVersionDocuments = pgTable("case_version_documents", {
  id: serial("id").primaryKey(),
  caseVersionId: integer("case_version_id").notNull().references(() => caseVersions.id),
  documentId: integer("document_id").notNull().references(() => documents.id),
  immutableObjectKey: varchar("immutable_object_key", {length: 512}).notNull().unique(),
  documentType: varchar("document_type", {length: 80}).notNull(),
  customTitle: varchar("custom_title", {length: 255}),
  borrowerId: integer("borrower_id").references(() => borrowers.id),
  mimeType: varchar("mime_type", {length: 100}).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksumSha256: varchar("checksum_sha256", {length: 64}).notNull(),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow()
}, (table) => [
  uniqueIndex("case_version_documents_version_document_uq").on(table.caseVersionId, table.documentId),
  index("case_version_documents_version_idx").on(table.caseVersionId),
  check("case_version_documents_size_check", sql`${table.sizeBytes} >= 0`)
]);

export const companySubmissions = pgTable("company_submissions", {
  id: serial("id").primaryKey(),
  publicId: varchar("public_id", {length: 64}).notNull().unique(),
  caseVersionId: integer("case_version_id").notNull().references(() => caseVersions.id),
  companyId: integer("company_id").notNull().references(() => lenders.id),
  advisorId: integer("advisor_id").notNull().references(() => advisorProfiles.id),
  batchId: integer("batch_id").notNull().references(() => deliveryBatches.id),
  deliveryStatus: companyDeliveryStatusEnum("delivery_status").notNull().default("PENDING"),
  decisionStatus: companyDecisionStatusEnum("decision_status").notNull().default("PENDING"),
  accessStatus: companyAccessStatusEnum("access_status").notNull().default("NONE"),
  responseDeadlineAt: timestamp("response_deadline_at", {withTimezone: true}).notNull(),
  decisionContactId: integer("decision_contact_id").references(() => lenderContacts.id),
  decisionAt: timestamp("decision_at", {withTimezone: true}),
  fullAccessStartsAt: timestamp("full_access_starts_at", {withTimezone: true}),
  fullAccessExpiresAt: timestamp("full_access_expires_at", {withTimezone: true}),
  cancelledAt: timestamp("cancelled_at", {withTimezone: true}),
  cancellationReason: varchar("cancellation_reason", {length: 500}),
  ...timestamps
}, (table) => [
  uniqueIndex("company_submissions_version_company_uq").on(table.caseVersionId, table.companyId),
  index("company_submissions_client_status_idx").on(table.advisorId, table.decisionStatus),
  index("company_submissions_deadline_idx").on(table.decisionStatus, table.responseDeadlineAt)
]);

export const submissionContactInvitations = pgTable("submission_contact_invitations", {
  id: serial("id").primaryKey(),
  publicId: varchar("public_id", {length: 64}).notNull().unique(),
  companySubmissionId: integer("company_submission_id").notNull().references(() => companySubmissions.id),
  contactId: integer("contact_id").notNull().references(() => lenderContacts.id),
  tokenHash: varchar("token_hash", {length: 64}).notNull().unique(),
  tokenNonce: varchar("token_nonce", {length: 100}).notNull(),
  tokenExpiresAt: timestamp("token_expires_at", {withTimezone: true}).notNull(),
  status: contactInvitationStatusEnum("status").notNull().default("PENDING"),
  emailQueuedAt: timestamp("email_queued_at", {withTimezone: true}),
  emailSentAt: timestamp("email_sent_at", {withTimezone: true}),
  emailFailedAt: timestamp("email_failed_at", {withTimezone: true}),
  emailFailureReason: varchar("email_failure_reason", {length: 200}),
  openedAt: timestamp("opened_at", {withTimezone: true}),
  lastOpenedAt: timestamp("last_opened_at", {withTimezone: true}),
  openCount: integer("open_count").notNull().default(0),
  maskedPdfViewedAt: timestamp("masked_pdf_viewed_at", {withTimezone: true}),
  maskedPdfDownloadedAt: timestamp("masked_pdf_downloaded_at", {withTimezone: true}),
  reminderOneSentAt: timestamp("reminder_one_sent_at", {withTimezone: true}),
  reminderTwoSentAt: timestamp("reminder_two_sent_at", {withTimezone: true}),
  closedAt: timestamp("closed_at", {withTimezone: true}),
  closedReason: varchar("closed_reason", {length: 100}),
  ...timestamps
}, (table) => [
  uniqueIndex("submission_contact_invitation_uq").on(table.companySubmissionId, table.contactId),
  index("submission_contact_token_idx").on(table.tokenHash),
  check("submission_contact_open_count_check", sql`${table.openCount} >= 0`)
]);

export const companyPortalAccessGrants = pgTable("company_portal_access_grants", {
  id: serial("id").primaryKey(),
  companySubmissionId: integer("company_submission_id").notNull().references(() => companySubmissions.id),
  contactId: integer("contact_id").notNull().references(() => lenderContacts.id),
  accessTokenHash: varchar("access_token_hash", {length: 64}).notNull().unique(),
  tokenNonce: varchar("token_nonce", {length: 100}).notNull(),
  expiresAt: timestamp("expires_at", {withTimezone: true}).notNull(),
  revokedAt: timestamp("revoked_at", {withTimezone: true}),
  firstAuthenticatedAt: timestamp("first_authenticated_at", {withTimezone: true}),
  lastAuthenticatedAt: timestamp("last_authenticated_at", {withTimezone: true}),
  ...timestamps
}, (table) => [uniqueIndex("company_portal_grant_contact_uq").on(table.companySubmissionId, table.contactId)]);

export const otpChallenges = pgTable("otp_challenges", {
  id: serial("id").primaryKey(),
  purpose: otpPurposeEnum("purpose").notNull(),
  companySubmissionId: integer("company_submission_id").notNull().references(() => companySubmissions.id),
  contactId: integer("contact_id").notNull().references(() => lenderContacts.id),
  invitationId: integer("invitation_id").references(() => submissionContactInvitations.id),
  accessGrantId: integer("access_grant_id").references(() => companyPortalAccessGrants.id),
  codeHash: varchar("code_hash", {length: 64}).notNull(),
  codeNonce: varchar("code_nonce", {length: 100}).notNull(),
  expiresAt: timestamp("expires_at", {withTimezone: true}).notNull(),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  usedAt: timestamp("used_at", {withTimezone: true}),
  cancelledAt: timestamp("cancelled_at", {withTimezone: true}),
  lastSentAt: timestamp("last_sent_at", {withTimezone: true}).notNull(),
  ...timestamps
}, (table) => [
  index("otp_challenges_active_idx").on(table.companySubmissionId, table.contactId, table.purpose, table.expiresAt),
  check("otp_challenges_attempts_check", sql`${table.attempts} >= 0 and ${table.maxAttempts} > 0 and ${table.attempts} <= ${table.maxAttempts}`)
]);

export const externalPortalSessions = pgTable("external_portal_sessions", {
  id: serial("id").primaryKey(),
  accessGrantId: integer("access_grant_id").notNull().references(() => companyPortalAccessGrants.id),
  sessionTokenHash: varchar("session_token_hash", {length: 64}).notNull().unique(),
  expiresAt: timestamp("expires_at", {withTimezone: true}).notNull(),
  idleExpiresAt: timestamp("idle_expires_at", {withTimezone: true}).notNull(),
  lastSeenAt: timestamp("last_seen_at", {withTimezone: true}).notNull(),
  revokedAt: timestamp("revoked_at", {withTimezone: true}),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow()
}, (table) => [index("external_portal_sessions_grant_idx").on(table.accessGrantId)]);

export const companyPortalOffers = pgTable("company_portal_offers", {
  id: serial("id").primaryKey(),
  companySubmissionId: integer("company_submission_id").notNull().references(() => companySubmissions.id),
  contactId: integer("contact_id").notNull().references(() => lenderContacts.id),
  idempotencyKey: varchar("idempotency_key", {length: 100}).notNull(),
  amount: numeric("amount", {precision: 14, scale: 2}).notNull(),
  interestRate: numeric("interest_rate", {precision: 7, scale: 4}).notNull(),
  termMonths: integer("term_months").notNull(),
  monthlyPayment: numeric("monthly_payment", {precision: 14, scale: 2}),
  conditions: text("conditions"),
  expiresAt: timestamp("expires_at", {withTimezone: true}),
  status: offerStatusEnum("status").notNull().default("SUBMITTED"),
  ...timestamps
}, (table) => [
  uniqueIndex("company_portal_offers_idempotency_uq").on(table.companySubmissionId, table.contactId, table.idempotencyKey),
  index("company_portal_offers_submission_idx").on(table.companySubmissionId, table.createdAt),
  check("company_portal_offers_values_check", sql`${table.amount} > 0 and ${table.interestRate} >= 0 and ${table.interestRate} <= 100 and ${table.termMonths} between 12 and 600 and (${table.monthlyPayment} is null or ${table.monthlyPayment} >= 0)`)
]);

export const submissionEvents = pgTable("submission_events", {
  id: serial("id").primaryKey(),
  companySubmissionId: integer("company_submission_id").notNull().references(() => companySubmissions.id),
  contactInvitationId: integer("contact_invitation_id").references(() => submissionContactInvitations.id),
  contactId: integer("contact_id").references(() => lenderContacts.id),
  actorType: submissionActorTypeEnum("actor_type").notNull(),
  actorId: integer("actor_id"),
  eventType: varchar("event_type", {length: 100}).notNull(),
  metadataSafe: jsonb("metadata_safe").notNull().default({}),
  ipHash: varchar("ip_hash", {length: 64}),
  userAgentSummary: varchar("user_agent_summary", {length: 255}),
  requestId: varchar("request_id", {length: 64}),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow()
}, (table) => [index("submission_events_submission_idx").on(table.companySubmissionId, table.createdAt)]);

export const emailOutbox = pgTable("email_outbox", {
  id: serial("id").primaryKey(),
  idempotencyKey: varchar("idempotency_key", {length: 160}).notNull().unique(),
  template: varchar("template", {length: 100}).notNull(),
  recipient: varchar("recipient", {length: 320}).notNull(),
  payload: jsonb("payload").notNull(),
  status: outboxStatusEnum("status").notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", {withTimezone: true}).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", {withTimezone: true}),
  sentAt: timestamp("sent_at", {withTimezone: true}),
  messageId: varchar("message_id", {length: 255}),
  sanitizedError: varchar("sanitized_error", {length: 200}),
  companySubmissionId: integer("company_submission_id").references(() => companySubmissions.id),
  invitationId: integer("invitation_id").references(() => submissionContactInvitations.id),
  createdAt: timestamp("created_at", {withTimezone: true}).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", {withTimezone: true}).notNull().defaultNow()
}, (table) => [
  index("email_outbox_pending_idx").on(table.status, table.availableAt),
  check("email_outbox_attempts_check", sql`${table.attempts} >= 0`)
]);
