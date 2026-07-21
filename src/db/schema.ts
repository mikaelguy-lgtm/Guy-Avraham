import { relations } from 'drizzle-orm';
import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  numeric,
  pgEnum,
  uniqueIndex,
  index
} from 'drizzle-orm/pg-core';

// --- ENUMS DEFINITIONS ---
// We can define native Postgres enums or use text with typescript checks.
// In Drizzle, pgEnum creates native enums in database.
export const userRoleEnum = pgEnum('user_role', ['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'LENDER_ADMIN', 'LENDER_UNDERWRITER']);
export const userStatusEnum = pgEnum('user_status', ['PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED', 'DELETED']);
export const clientStatusEnum = pgEnum('client_status', ['DRAFT', 'ACTIVE', 'READY_FOR_SUBMISSION', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'DECLINED', 'CLOSED', 'ARCHIVED']);
export const documentStatusEnum = pgEnum('document_status', ['UPLOADING', 'UPLOADED', 'PROCESSING', 'VERIFIED', 'REJECTED', 'DELETED']);
export const submissionStatusEnum = pgEnum('submission_status', [
  'DRAFT', 'PENDING_DELIVERY', 'SENT', 'DELIVERY_FAILED', 'DELIVERED', 'OPENED', 'IN_REVIEW', 'MORE_INFO_REQUESTED',
  'IDENTITY_REQUESTED', 'IDENTITY_APPROVED', 'IDENTITY_REJECTED', 'OFFER_RECEIVED',
  'DECLINED', 'EXPIRED', 'CANCELLED'
]);
export const responseTypeEnum = pgEnum('response_type', ['INTERESTED', 'NOT_INTERESTED', 'REQUEST_MORE_INFORMATION', 'REQUEST_IDENTITY_REVEAL', 'GENERAL_MESSAGE']);
export const offerStatusEnum = pgEnum('offer_status', ['DRAFT', 'SUBMITTED', 'UPDATED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED']);

// --- TABLES ---

// 1. Users Table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  firebaseUid: text('firebase_uid').notNull().unique(),
  email: text('email').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  role: userRoleEnum('role').notNull().default('ADVISOR'), // SUPER_ADMIN, ADMIN, ADVISOR, LENDER_ADMIN, LENDER_UNDERWRITER
  status: userStatusEnum('status').notNull().default('ACTIVE'), // PENDING, ACTIVE, SUSPENDED, DISABLED, DELETED
  emailVerified: boolean('email_verified').default(false),
  lastLoginAt: timestamp('last_login_at'),
  lastActivityAt: timestamp('last_activity_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    firebaseUidIdx: index('users_firebase_uid_idx').on(table.firebaseUid),
    emailIdx: index('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
    statusIdx: index('users_status_idx').on(table.status),
  };
});

// 2. Advisor Profiles Table
export const advisorProfiles = pgTable('advisor_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull().unique(),
  businessName: text('business_name'),
  licenseNumber: text('license_number'),
  businessPhone: text('business_phone'),
  businessEmail: text('business_email'),
  address: text('address'),
  logoStorageKey: text('logo_storage_key'),
  disableGemini: boolean('disable_gemini').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 3. Lenders Table
export const lenders = pgTable('lenders', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  companyNumber: text('company_number'),
  status: text('status').notNull().default('ACTIVE'), // ACTIVE, SUSPENDED, DELETED
  website: text('website'),
  generalEmail: text('general_email'),
  phone: text('phone'),
  logoStorageKey: text('logo_storage_key'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// 4. Lender Users Table
export const lenderUsers = pgTable('lender_users', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull().unique(),
  lenderId: integer('lender_id').references(() => lenders.id).notNull(),
  jobTitle: text('job_title'),
  isPrimaryContact: boolean('is_primary_contact').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
  return {
    userIdIdx: index('lender_users_user_id_idx').on(table.userId),
    lenderIdIdx: index('lender_users_lender_id_idx').on(table.lenderId),
  };
});

// 5. Clients Table
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  advisorId: integer('advisor_id').references(() => users.id).notNull(),
  caseNumber: text('case_number').notNull().unique(),
  status: clientStatusEnum('status').notNull().default('DRAFT'), // DRAFT, ACTIVE, READY_FOR_SUBMISSION, SUBMITTED, IN_REVIEW, APPROVED, DECLINED, CLOSED, ARCHIVED
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  identityNumberEncrypted: text('identity_number_encrypted'),
  identityNumberHash: text('identity_number_hash'),
  identityNumberLast4: text('identity_number_last4'),
  birthDate: text('birth_date'),
  phoneEncrypted: text('phone_encrypted'),
  emailEncrypted: text('email_encrypted'),
  maritalStatus: text('marital_status'),
  numberOfChildren: integer('number_of_children').default(0),
  city: text('city'),
  addressEncrypted: text('address_encrypted'),
  notesEncrypted: text('notes_encrypted'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    advisorIdIdx: index('clients_advisor_id_idx').on(table.advisorId),
    caseNumberIdx: index('clients_case_number_idx').on(table.caseNumber),
    statusIdx: index('clients_status_idx').on(table.status),
    idNumHashIdx: index('clients_identity_number_hash_idx').on(table.identityNumberHash),
    createdAtIdx: index('clients_created_at_idx').on(table.createdAt),
  };
});

// 6. Borrowers Table
export const borrowers = pgTable('borrowers', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  borrowerType: text('borrower_type').notNull().default('PRIMARY'), // PRIMARY, CO_SIGNER
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  identityNumberEncrypted: text('identity_number_encrypted'),
  identityNumberHash: text('identity_number_hash'),
  identityNumberLast4: text('identity_number_last4'),
  birthDate: text('birth_date'),
  phoneEncrypted: text('phone_encrypted'),
  emailEncrypted: text('email_encrypted'),
  relationshipToPrimary: text('relationship_to_primary'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    clientIdIdx: index('borrowers_client_id_idx').on(table.clientId),
  };
});

// 7. Employment Records Table
export const employmentRecords = pgTable('employment_records', {
  id: serial('id').primaryKey(),
  borrowerId: integer('borrower_id').references(() => borrowers.id).notNull(),
  employmentType: text('employment_type'), // SALARIED, SELF_EMPLOYED, UNEMPLOYED
  employerNameEncrypted: text('employer_name_encrypted'),
  jobTitle: text('job_title'),
  startDate: text('start_date'),
  monthlyNetIncome: numeric('monthly_net_income', { precision: 12, scale: 2 }).default('0'),
  monthlyGrossIncome: numeric('monthly_gross_income', { precision: 12, scale: 2 }).default('0'),
  additionalIncome: numeric('additional_income', { precision: 12, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// 8. Income Sources Table
export const incomeSources = pgTable('income_sources', {
  id: serial('id').primaryKey(),
  borrowerId: integer('borrower_id').references(() => borrowers.id).notNull(),
  incomeType: text('income_type').notNull(), // SALARY, BUSINESS, RENTAL, PENSION, CHILD_SUPPORT, OTHER
  description: text('description'),
  monthlyAmount: numeric('monthly_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  isFixed: boolean('is_fixed').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// 9. Liabilities Table
export const liabilities = pgTable('liabilities', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  liabilityType: text('liability_type').notNull(), // MORTGAGE, LOAN, CREDIT_CARD, CHILD_SUPPORT, OTHER
  institution: text('institution'),
  originalAmount: numeric('original_amount', { precision: 12, scale: 2 }).default('0'),
  currentBalance: numeric('current_balance', { precision: 12, scale: 2 }).default('0'),
  monthlyPayment: numeric('monthly_payment', { precision: 12, scale: 2 }).default('0'),
  interestRate: numeric('interest_rate', { precision: 5, scale: 2 }),
  endDate: text('end_date'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// 10. Properties Table
export const properties = pgTable('properties', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  propertyType: text('property_type'), // APARTMENT, HOUSE, PLOT, COMMERCIAL, OTHER
  city: text('city'),
  addressEncrypted: text('address_encrypted'),
  estimatedValue: numeric('estimated_value', { precision: 12, scale: 2 }).default('0'),
  purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }).default('0'),
  existingMortgageBalance: numeric('existing_mortgage_balance', { precision: 12, scale: 2 }).default('0'),
  ownershipPercentage: numeric('ownership_percentage', { precision: 5, scale: 2 }).default('100.00'),
  registrationType: text('registration_type'), // TABU, MINHAL, CHEVRA_MESHAKENET, OTHER
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// 11. Loan Requests Table
export const loanRequests = pgTable('loan_requests', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  purpose: text('purpose'), // PURCHASE, REFINANCE, EQUITY_RELEASE, BRIDGE, ALL_PURPOSES
  requestedAmount: numeric('requested_amount', { precision: 12, scale: 2 }).default('0'),
  requestedTermMonths: integer('requested_term_months'),
  requestedMonthlyPayment: numeric('requested_monthly_payment', { precision: 12, scale: 2 }).default('0'),
  loanToValue: numeric('loan_to_value', { precision: 5, scale: 2 }),
  notes: text('notes'),
  status: text('status'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// 12. Documents Table
export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  borrowerId: integer('borrower_id').references(() => borrowers.id),
  documentType: text('document_type').notNull(), // ID_CARD, PAYSLIP, BANK_STATEMENT, MORTGAGE_STATEMENT, PROPERTY_REGISTRATION, TAX_REPORT, OTHER
  originalFilename: text('original_filename').notNull(),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  checksum: text('checksum'),
  status: documentStatusEnum('status').notNull().default('UPLOADED'), // UPLOADING, UPLOADED, PROCESSING, VERIFIED, REJECTED, DELETED
  uploadedByUserId: integer('uploaded_by_user_id').references(() => users.id),
  uploadedAt: timestamp('uploaded_at'),
  verifiedByUserId: integer('verified_by_user_id').references(() => users.id),
  verifiedAt: timestamp('verified_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    clientIdIdx: index('documents_client_id_idx').on(table.clientId),
    borrowerIdIdx: index('documents_borrower_id_idx').on(table.borrowerId),
    statusIdx: index('documents_status_idx').on(table.status),
  };
});

// 13. Lender Submissions Table
export const lenderSubmissions = pgTable('lender_submissions', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  advisorId: integer('advisor_id').references(() => users.id).notNull(),
  lenderId: integer('lender_id').references(() => lenders.id).notNull(),
  status: submissionStatusEnum('status').notNull().default('SENT'), // SENT, DELIVERED, OPENED, IN_REVIEW, MORE_INFO_REQUESTED, IDENTITY_REQUESTED, IDENTITY_APPROVED, IDENTITY_REJECTED, OFFER_RECEIVED, DECLINED, EXPIRED, CANCELLED
  anonymousSnapshot: text('anonymous_snapshot'), // Full JSON structure as string
  sentAt: timestamp('sent_at').defaultNow(),
  deliveredAt: timestamp('delivered_at'),
  openedAt: timestamp('opened_at'),
  identityRequestedAt: timestamp('identity_requested_at'),
  identityApprovedAt: timestamp('identity_approved_at'),
  identityRejectedAt: timestamp('identity_rejected_at'),
  identityApprovedByUserId: integer('identity_approved_by_user_id').references(() => users.id),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  cancelledAt: timestamp('cancelled_at'),
}, (table) => {
  return {
    clientIdIdx: index('lender_submissions_client_id_idx').on(table.clientId),
    advisorIdIdx: index('lender_submissions_advisor_id_idx').on(table.advisorId),
    lenderIdIdx: index('lender_submissions_lender_id_idx').on(table.lenderId),
    statusIdx: index('lender_submissions_status_idx').on(table.status),
    createdAtIdx: index('lender_submissions_created_at_idx').on(table.createdAt),
  };
});

// 14. Lender Responses Table
export const lenderResponses = pgTable('lender_responses', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id').references(() => lenderSubmissions.id).notNull(),
  lenderUserId: integer('lender_user_id').references(() => users.id).notNull(),
  responseType: responseTypeEnum('response_type').notNull(), // INTERESTED, NOT_INTERESTED, REQUEST_MORE_INFORMATION, REQUEST_IDENTITY_REVEAL, GENERAL_MESSAGE
  message: text('message'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    subIdIdx: index('lender_responses_sub_id_idx').on(table.submissionId),
  };
});

// 15. Identity Reveal Requests Table
export const identityRevealRequests = pgTable('identity_reveal_requests', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id').references(() => lenderSubmissions.id).notNull(),
  requestedByUserId: integer('requested_by_user_id').references(() => users.id).notNull(),
  requestedFields: text('requested_fields'), // Comma separated or JSON string
  reason: text('reason'),
  status: text('status').notNull().default('PENDING'), // PENDING, APPROVED, REJECTED
  reviewedByUserId: integer('reviewed_by_user_id').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  approvedFields: text('approved_fields'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
  return {
    subIdIdx: index('identity_reveal_requests_sub_id_idx').on(table.submissionId),
    statusIdx: index('identity_reveal_requests_status_idx').on(table.status),
  };
});

// 16. Loan Offers Table
export const loanOffers = pgTable('loan_offers', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id').references(() => lenderSubmissions.id).notNull(),
  lenderId: integer('lender_id').references(() => lenders.id).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'),
  interestRate: numeric('interest_rate', { precision: 5, scale: 2 }).notNull(),
  interestType: text('interest_type').notNull(), // FIXED, PRIME, CPI_LINKED, VARIABLE
  linkedToIndex: text('linked_to_index'), // NONE, CPI, PRIME, OTHER
  termMonths: integer('term_months').notNull(),
  monthlyPayment: numeric('monthly_payment', { precision: 12, scale: 2 }),
  originationFee: numeric('origination_fee', { precision: 12, scale: 2 }).default('0'),
  additionalFees: numeric('additional_fees', { precision: 12, scale: 2 }).default('0'),
  conditions: text('conditions'),
  validUntil: timestamp('valid_until'),
  status: offerStatusEnum('status').notNull().default('SUBMITTED'), // DRAFT, SUBMITTED, UPDATED, ACCEPTED, REJECTED, WITHDRAWN, EXPIRED
  createdByUserId: integer('created_by_user_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    subIdIdx: index('loan_offers_sub_id_idx').on(table.submissionId),
    lenderIdIdx: index('loan_offers_lender_id_idx').on(table.lenderId),
    statusIdx: index('loan_offers_status_idx').on(table.status),
  };
});

// 17. Notifications Table
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // INFO, SUCCESS, WARNING, SUBMISSION_UPDATE, OFFER_RECEIVED, CHAT
  title: text('title').notNull(),
  body: text('body').notNull(),
  metadata: text('metadata'), // JSON as string
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => {
  return {
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    readAtIdx: index('notifications_read_at_idx').on(table.readAt),
  };
});

// 18. Audit Logs Table
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id').references(() => users.id),
  action: text('action').notNull(), // LOGIN, VIEW_CLIENT, UPDATE_CLIENT, UPLOAD_DOCUMENT, SEND_SUBMISSION, REVEAL_IDENTITY, etc.
  entityType: text('entity_type'), // USER, CLIENT, DOCUMENT, SUBMISSION, OFFER
  entityId: integer('entity_id'),
  metadata: text('metadata'), // JSON as string
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => {
  return {
    actorIdx: index('audit_logs_actor_idx').on(table.actorUserId),
    entityIdx: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  };
});

// 19. Email Logs Table
export const emailLogs = pgTable('email_logs', {
  id: serial('id').primaryKey(),
  recipient: text('recipient').notNull(),
  template: text('template').notNull(),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: integer('related_entity_id'),
  providerMessageId: text('provider_message_id'),
  status: text('status').notNull(), // SENT, FAILED, DELIVERED
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  failedAt: timestamp('failed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 20. AI Analysis Logs Table
export const aiAnalysisLogs = pgTable('ai_analysis_logs', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => clients.id).notNull(),
  requestedByUserId: integer('requested_by_user_id').references(() => users.id).notNull(),
  analysisType: text('analysis_type').notNull(), // CLIENT_SUMMARY, OFFER_ANALYSIS, ADVISOR_ASK
  model: text('model').notNull(),
  promptVersion: text('prompt_version'),
  status: text('status').notNull(), // PENDING, COMPLETED, FAILED
  tokenUsage: integer('token_usage'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// 21. Lender Invite Tokens Table
export const lenderInviteTokens = pgTable('lender_invite_tokens', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id').references(() => lenderSubmissions.id).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 22. System Settings Table
export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value'),
  valueType: text('value_type').notNull().default('text'), // 'text', 'number', 'boolean'
  category: text('category').notNull().default('GENERAL'), // 'GENERAL', 'EMAIL', 'DATABASE', 'SECURITY', 'AI', 'STORAGE'
  isSecret: boolean('is_secret').notNull().default(false),
  description: text('description'),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// --- RELATION RELATIONSHIPS (Optional but helpful for Drizzle) ---

export const usersRelations = relations(users, ({ many, one }) => ({
  advisorProfile: one(advisorProfiles, {
    fields: [users.id],
    references: [advisorProfiles.userId],
  }),
  lenderUser: one(lenderUsers, {
    fields: [users.id],
    references: [lenderUsers.userId],
  }),
  clients: many(clients),
  submissions: many(lenderSubmissions),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
}));

export const advisorProfilesRelations = relations(advisorProfiles, ({ one }) => ({
  user: one(users, {
    fields: [advisorProfiles.userId],
    references: [users.id],
  }),
}));

export const lendersRelations = relations(lenders, ({ many }) => ({
  lenderUsers: many(lenderUsers),
  submissions: many(lenderSubmissions),
  offers: many(loanOffers),
}));

export const lenderUsersRelations = relations(lenderUsers, ({ one }) => ({
  user: one(users, {
    fields: [lenderUsers.userId],
    references: [users.id],
  }),
  lender: one(lenders, {
    fields: [lenderUsers.lenderId],
    references: [lenders.id],
  }),
}));

export const clientsRelations = relations(clients, ({ many, one }) => ({
  advisor: one(users, {
    fields: [clients.advisorId],
    references: [users.id],
  }),
  borrowers: many(borrowers),
  liabilities: many(liabilities),
  properties: many(properties),
  loanRequests: many(loanRequests),
  documents: many(documents),
  submissions: many(lenderSubmissions),
}));

export const borrowersRelations = relations(borrowers, ({ one, many }) => ({
  client: one(clients, {
    fields: [borrowers.clientId],
    references: [clients.id],
  }),
  employmentRecords: many(employmentRecords),
  incomeSources: many(incomeSources),
  documents: many(documents),
}));

export const lenderSubmissionsRelations = relations(lenderSubmissions, ({ one, many }) => ({
  client: one(clients, {
    fields: [lenderSubmissions.clientId],
    references: [clients.id],
  }),
  advisor: one(users, {
    fields: [lenderSubmissions.advisorId],
    references: [users.id],
  }),
  lender: one(lenders, {
    fields: [lenderSubmissions.lenderId],
    references: [lenders.id],
  }),
  responses: many(lenderResponses),
  identityRevealRequests: many(identityRevealRequests),
  offers: many(loanOffers),
  inviteTokens: many(lenderInviteTokens),
}));
