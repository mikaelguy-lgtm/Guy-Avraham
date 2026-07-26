import {createHash, randomBytes, randomUUID} from "node:crypto";
import JSZip from "jszip";
import type {Pool, PoolClient} from "pg";
import {createPool} from "../db/index.js";
import type {
  BusinessCalendarException, DeliveryCompanySummary, DeliveryPreview, FullCaseBorrowerSnapshot,
  FullCaseLiabilitySnapshot, FullCaseSnapshot, VersionDocumentSnapshot
} from "../domain/lenderDelivery.js";
import {DeliveryError} from "../domain/lenderDelivery.js";
import {calculateAge} from "../utils/age.js";
import {getDocumentDisplayName} from "../utils/documentDisplay.js";
import type {EncryptionService} from "../utils/crypto.js";
import type {EmailService} from "./email.js";
import {sanitizeEmailError} from "./email.js";
import {CaseRedactionService} from "./caseRedaction.js";
import {createFullCasePdf, createMaskedCasePdf} from "./pdf.js";
import type {StorageService} from "./storage.js";
import {DeliveryTokenService} from "./deliveryTokens.js";
import {IsraelBusinessCalendarService} from "./israelBusinessCalendar.js";
import {deliveryEmailTemplates, type DeliveryEmailContent} from "./deliveryEmailTemplates.js";
import type {DeliveryEventBroker} from "./deliveryEvents.js";

type Row = Record<string, any>;

export interface DeliveryContext {
  requestId: string;
  ip?: string;
  userAgent?: string;
}

export interface AdvisorDeliveryActor {
  userId: number;
  advisorId: number;
}

export interface AdminDeliveryActor {
  userId: number;
}

export interface LenderDeliveryApplication {
  listAdvisorCompanies(clientId: number, actor: AdvisorDeliveryActor): Promise<DeliveryCompanySummary[]>;
  preview(clientId: number, companyIds: number[], actor: AdvisorDeliveryActor): Promise<DeliveryPreview>;
  send(clientId: number, input: {companyIds: number[]; idempotencyKey: string; previewConfirmation: string}, actor: AdvisorDeliveryActor, context: DeliveryContext): Promise<Record<string, unknown>>;
  listClientResponses(clientId: number, actor: AdvisorDeliveryActor): Promise<unknown[]>;
  getClientResponse(clientId: number, submissionPublicId: string, actor: AdvisorDeliveryActor): Promise<unknown>;
  listCompaniesForAdmin(): Promise<unknown[]>;
  createCompany(input: CompanyInput, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown>;
  updateCompany(id: number, input: Partial<CompanyInput>, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown>;
  deleteCompany(id: number, actor: AdminDeliveryActor, context: DeliveryContext): Promise<void>;
  uploadCompanyLogo(id: number, body: Buffer, mimeType: "image/png" | "image/jpeg", actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown>;
  createContact(companyId: number, input: ContactInput, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown>;
  updateContact(companyId: number, contactId: number, input: Partial<ContactInput>, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown>;
  deleteContact(companyId: number, contactId: number, actor: AdminDeliveryActor, context: DeliveryContext): Promise<void>;
  listCalendar(): Promise<unknown[]>;
  createCalendarException(input: CalendarInput, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown>;
  updateCalendarException(id: number, input: CalendarInput, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown>;
  deleteCalendarException(id: number, actor: AdminDeliveryActor, context: DeliveryContext): Promise<void>;
  listAdminSubmissions(): Promise<unknown[]>;
  getAdminSubmission(publicId: string): Promise<unknown>;
  getAdminPdf(publicId: string, kind: "masked" | "full", actor: AdminDeliveryActor, context: DeliveryContext): Promise<{body: Buffer; filename: string}>;
  adminAction(publicId: string, action: string, values: Record<string, unknown>, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown>;
  getReview(token: string, context: DeliveryContext): Promise<unknown>;
  getMaskedPdf(token: string, download: boolean, context: DeliveryContext): Promise<{body: Buffer; filename: string}>;
  decideNotInterested(token: string, context: DeliveryContext): Promise<unknown>;
  startInterest(token: string, context: DeliveryContext): Promise<unknown>;
  resendInterestCode(token: string, context: DeliveryContext): Promise<unknown>;
  verifyInterest(token: string, code: string, context: DeliveryContext): Promise<unknown>;
  getAccess(token: string): Promise<unknown>;
  sendAccessCode(token: string, context: DeliveryContext): Promise<unknown>;
  verifyAccessCode(token: string, code: string, context: DeliveryContext): Promise<{sessionToken: string; expiresAt: Date}>;
  getPortalCase(sessionToken: string, context: DeliveryContext): Promise<unknown>;
  getPortalPdf(sessionToken: string, context: DeliveryContext): Promise<{body: Buffer; filename: string}>;
  listPortalDocuments(sessionToken: string, context: DeliveryContext): Promise<unknown[]>;
  getPortalDocument(sessionToken: string, publicDocumentId: string, download: boolean, context: DeliveryContext): Promise<{body: Buffer; contentType: string; filename: string}>;
  getPortalZip(sessionToken: string, context: DeliveryContext): Promise<{body: Buffer; filename: string}>;
  logoutPortal(sessionToken: string): Promise<void>;
  processJobs(): Promise<void>;
}

export interface CompanyInput {
  name: string;
  legalName?: string | null;
  companyNumber?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  activityAreas: string[];
  adminNotes?: string | null;
  active: boolean;
}

export interface ContactInput {
  firstName: string;
  lastName: string;
  roleTitle: string;
  email: string;
  phone?: string | null;
  isPrimary: boolean;
  active: boolean;
}

export interface CalendarInput {date: string; type: "HOLIDAY" | "NON_WORKING_DAY" | "FORCED_WORKING_DAY"; title: string; source: string}

interface DeliveryServiceOptions {
  pool?: Pool;
  storage: StorageService;
  email: EmailService;
  encryption: EncryptionService;
  tokens: DeliveryTokenService;
  broker: DeliveryEventBroker;
  appUrl: string;
  nodeEnv: string;
  now?: () => Date;
}

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const safeText = (value: unknown, maximum = 255) => String(value ?? "").replace(/[\r\n\t]/g, " ").slice(0, maximum);
const localDateTime = (value: Date) => new Intl.DateTimeFormat("he-IL", {timeZone: "Asia/Jerusalem", dateStyle: "full", timeStyle: "short"}).format(value);
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export class PostgresLenderDeliveryService implements LenderDeliveryApplication {
  private readonly pool: Pool;
  private readonly storage: StorageService;
  private readonly email: EmailService;
  private readonly encryption: EncryptionService;
  private readonly tokens: DeliveryTokenService;
  private readonly broker: DeliveryEventBroker;
  private readonly appUrl: string;
  private readonly now: () => Date;
  private readonly redaction = new CaseRedactionService();

  private scheduleJobs(): void {
    void this.processJobs().catch(() => console.error("Lender delivery jobs failed", {errorCode: "LENDER_DELIVERY_JOB_FAILED"}));
  }

  constructor(options: DeliveryServiceOptions) {
    this.pool = options.pool ?? createPool();
    this.storage = options.storage;
    this.email = options.email;
    this.encryption = options.encryption;
    this.tokens = options.tokens;
    this.broker = options.broker;
    this.appUrl = options.appUrl.replace(/\/$/, "");
    this.now = options.now ?? (() => new Date());
  }

  private decrypt(value: string | null | undefined): string {
    return value ? this.encryption.decrypt(value) : "";
  }

  private async calendar(client: Pool | PoolClient = this.pool): Promise<IsraelBusinessCalendarService> {
    const result = await client.query("select exception_date::text as date, type, title, source from business_calendar_exceptions order by exception_date");
    return new IsraelBusinessCalendarService(result.rows as BusinessCalendarException[]);
  }

  private async audit(client: Pool | PoolClient, actorUserId: number | null, action: string, entityType: string, entityId: number | null, metadata: Record<string, unknown>, context: DeliveryContext): Promise<void> {
    await client.query("insert into audit_logs(actor_user_id, action, entity_type, entity_id, metadata, request_id, ip_address, user_agent) values($1,$2,$3,$4,$5,$6,$7,$8)", [actorUserId, action, entityType, entityId, metadata, context.requestId, context.ip ? sha256(context.ip) : null, context.userAgent ? safeText(context.userAgent) : null]);
  }

  private async event(client: Pool | PoolClient, values: {submissionId: number; invitationId?: number | null; contactId?: number | null; actorType: string; actorId?: number | null; type: string; metadata?: Record<string, unknown>}, context: DeliveryContext): Promise<void> {
    await client.query("insert into submission_events(company_submission_id, contact_invitation_id, contact_id, actor_type, actor_id, event_type, metadata_safe, ip_hash, user_agent_summary, request_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [values.submissionId, values.invitationId ?? null, values.contactId ?? null, values.actorType, values.actorId ?? null, values.type, values.metadata ?? {}, context.ip ? sha256(context.ip) : null, context.userAgent ? safeText(context.userAgent) : null, context.requestId]);
  }

  private async loadFullSnapshot(clientId: number, advisorId?: number): Promise<FullCaseSnapshot> {
    const clientResult = await this.pool.query(`
      select c.*, p.property_type, p.property_type_other_description_encrypted, p.city as property_city,
        p.address_encrypted as property_address_encrypted, p.estimated_value, lr.purpose, lr.requested_amount,
        lr.requested_term_months, lr.loan_to_value, ap.id as advisor_profile_id, ap.business_name,
        ap.business_phone_encrypted, ap.business_email, u.id as advisor_user_id, u.first_name as advisor_first_name,
        u.last_name as advisor_last_name, u.phone_encrypted as advisor_phone_encrypted
      from clients c
      join properties p on p.client_id = c.id
      join loan_requests lr on lr.client_id = c.id
      join advisor_profiles ap on ap.id = c.advisor_id
      join users u on u.id = ap.user_id
      where c.id = $1 and c.deleted_at is null`, [clientId]);
    const client = clientResult.rows[0];
    if (!client || (advisorId && Number(client.advisor_profile_id) !== advisorId)) throw new DeliveryError("CLIENT_NOT_FOUND", 404, "תיק הלקוח לא נמצא.");
    const borrowerResult = await this.pool.query(`
      select b.*, e.employment_type, e.employer_name_encrypted, e.job_title, e.employment_seniority_years,
        e.monthly_net_income, e.has_additional_income, e.additional_income_type, e.additional_income_amount,
        e.additional_income_description_encrypted
      from borrowers b join employment_records e on e.borrower_id = b.id
      where b.client_id = $1 order by b.borrower_order`, [clientId]);
    const liabilityResult = await this.pool.query(`select l.*, b.borrower_order from liabilities l left join borrowers b on b.id = l.borrower_id where l.client_id = $1 and l.deleted_at is null order by l.id`, [clientId]);
    const documentResult = await this.pool.query(`select d.*, b.borrower_order from documents d left join borrowers b on b.id = d.borrower_id where d.client_id = $1 and d.deleted_at is null and d.status in ('UPLOADED','VERIFIED','REPLACED') order by d.id`, [clientId]);
    const liabilities = liabilityResult.rows.map((row): FullCaseLiabilitySnapshot => ({scope: row.scope, borrowerOrder: row.borrower_order ? Number(row.borrower_order) : null, type: row.liability_type, otherTypeDescription: this.decrypt(row.other_type_description_encrypted) || null, currentBalance: Number(row.current_balance ?? row.outstanding_balance), monthlyPayment: Number(row.monthly_payment), endDate: row.end_date ? String(row.end_date).slice(0, 10) : null, notes: this.decrypt(row.notes_encrypted)}));
    const borrowers = borrowerResult.rows.map((row): FullCaseBorrowerSnapshot => {
      const dateOfBirth = this.decrypt(row.date_of_birth_encrypted) || (row.birth_date ? new Date(row.birth_date).toISOString().slice(0, 10) : "");
      const address = this.decrypt(row.address_encrypted);
      return {
        order: Number(row.borrower_order), firstName: this.decrypt(row.first_name_encrypted), lastName: this.decrypt(row.last_name_encrypted), identityNumber: this.decrypt(row.identity_number_encrypted), dateOfBirth, age: calculateAge(dateOfBirth), phone: this.decrypt(row.phone_encrypted), email: this.decrypt(row.email_encrypted), address, residenceCity: address.split(",").at(-1)?.trim() ?? "", maritalStatus: row.marital_status, numberOfChildren: Number(row.number_of_children), childrenAges: row.children_ages ?? [],
        employment: {employmentType: row.employment_type, employerName: this.decrypt(row.employer_name_encrypted), jobTitle: row.job_title ?? "", employmentSeniorityYears: Number(row.employment_seniority_years), monthlyNetIncome: Number(row.monthly_net_income), hasAdditionalIncome: Boolean(row.has_additional_income), additionalIncomeType: row.additional_income_type, additionalIncomeAmount: Number(row.additional_income_amount), additionalIncomeDescription: this.decrypt(row.additional_income_description_encrypted) || null},
        liabilities: liabilities.filter((liability) => liability.scope === "BORROWER" && liability.borrowerOrder === Number(row.borrower_order))
      };
    });
    const documents: VersionDocumentSnapshot[] = documentResult.rows.map((row) => ({documentId: Number(row.id), borrowerId: row.borrower_id ? Number(row.borrower_id) : null, borrowerOrder: row.borrower_order ? Number(row.borrower_order) : null, documentType: row.document_type, customTitle: row.custom_title, mimeType: row.mime_type, sizeBytes: Number(row.size_bytes), checksumSha256: row.checksum_sha256, storageKey: row.storage_key, createdAt: new Date(row.created_at).toISOString()}));
    const householdLiabilities = liabilities.filter((liability) => liability.scope === "HOUSEHOLD");
    return {
      publicCaseNumber: client.public_case_number, sourceClientUpdatedAt: new Date(client.updated_at).toISOString(), numberOfBorrowers: Number(client.number_of_borrowers), borrowerRelationship: client.borrower_relationship,
      household: {numberOfChildren: Number(client.household_children_count), childrenAges: client.household_children_ages ?? []}, borrowers, householdLiabilities,
      property: {propertyType: client.property_type, propertyTypeOtherDescription: this.decrypt(client.property_type_other_description_encrypted) || null, city: client.property_city ?? "", address: this.decrypt(client.property_address_encrypted), value: Number(client.estimated_value)},
      loanRequest: {purpose: client.purpose, requestedAmount: Number(client.requested_amount), requestedTermMonths: Number(client.requested_term_months), loanToValue: Number(client.loan_to_value)},
      dealDetails: this.decrypt(client.deal_details_encrypted),
      totals: {monthlyIncome: borrowers.reduce((sum, borrower) => sum + borrower.employment.monthlyNetIncome + borrower.employment.additionalIncomeAmount, 0), liabilityBalance: liabilities.reduce((sum, liability) => sum + liability.currentBalance, 0), monthlyPayments: liabilities.reduce((sum, liability) => sum + liability.monthlyPayment, 0)},
      advisor: {fullName: `${client.advisor_first_name} ${client.advisor_last_name}`.trim(), businessName: client.business_name ?? "", phone: this.decrypt(client.business_phone_encrypted || client.advisor_phone_encrypted), email: client.business_email ?? "", website: null}, documents
    };
  }

  private validateCompleteness(snapshot: FullCaseSnapshot): void {
    if (!snapshot.dealDetails.trim()) throw new DeliveryError("DEAL_DETAILS_REQUIRED", 422, "יש להשלים את פירוט העסקה לפני השליחה.");
    if (!snapshot.loanRequest.purpose) throw new DeliveryError("LOAN_PURPOSE_REQUIRED", 422, "יש לבחור מטרת הלוואה לפני השליחה.");
    const missing: string[] = [];
    for (const borrower of snapshot.borrowers) for (const type of ["ID_FRONT", "ID_BACK", "ID_APPENDIX"]) if (!snapshot.documents.some((document) => document.borrowerOrder === borrower.order && document.documentType === type)) missing.push(`${type}:${borrower.order}`);
    for (const type of ["PROPERTY_RIGHTS", "POWER_OF_ATTORNEY"]) if (!snapshot.documents.some((document) => document.borrowerId === null && document.documentType === type)) missing.push(type);
    if (missing.length) throw new DeliveryError("MISSING_REQUIRED_DOCUMENTS", 422, "חסרים מסמכי חובה הנדרשים לשליחת התיק.", {missing});
  }

  private async selectedCompanies(companyIds: number[]): Promise<Row[]> {
    const unique = [...new Set(companyIds)];
    if (!unique.length) throw new DeliveryError("COMPANY_REQUIRED", 400, "יש לבחור לפחות חברת מימון אחת.");
    const result = await this.pool.query(`select l.*, count(c.id)::int as active_contact_count from lenders l left join lender_contacts c on c.lender_id=l.id and c.active=true and c.deleted_at is null where l.id = any($1::int[]) and l.active=true and l.deleted_at is null group by l.id`, [unique]);
    if (result.rows.length !== unique.length) throw new DeliveryError("INVALID_COMPANY", 422, "אחת מחברות המימון שנבחרו אינה פעילה.");
    const missingContacts = result.rows.filter((row) => Number(row.active_contact_count) === 0);
    if (missingContacts.length) throw new DeliveryError("COMPANY_WITHOUT_ACTIVE_CONTACT", 422, "לחברת מימון שנבחרה אין איש קשר פעיל.", {companyIds: missingContacts.map((row) => row.id)});
    return result.rows;
  }

  async listAdvisorCompanies(clientId: number, actor: AdvisorDeliveryActor): Promise<DeliveryCompanySummary[]> {
    await this.loadFullSnapshot(clientId, actor.advisorId);
    const result = await this.pool.query(`
      select l.id, l.name, l.activity_areas, l.logo_storage_key, count(distinct c.id)::int active_contact_count,
        max(cs.created_at) last_sent_at
      from lenders l left join lender_contacts c on c.lender_id=l.id and c.active=true and c.deleted_at is null
      left join company_submissions cs on cs.company_id=l.id and cs.advisor_id=$1
      where l.active=true and l.deleted_at is null group by l.id order by l.name`, [actor.advisorId]);
    return result.rows.map((row) => ({id: Number(row.id), name: row.name, logoUrl: null, activityAreas: row.activity_areas ?? [], activeContactCount: Number(row.active_contact_count), lastSentAt: row.last_sent_at ? new Date(row.last_sent_at).toISOString() : null, alreadySentCurrentVersion: false}));
  }

  async preview(clientId: number, companyIds: number[], actor: AdvisorDeliveryActor): Promise<DeliveryPreview> {
    const snapshot = await this.loadFullSnapshot(clientId, actor.advisorId); this.validateCompleteness(snapshot);
    const companies = await this.selectedCompanies(companyIds);
    const redacted = this.redaction.redact(snapshot);
    const versionResult = await this.pool.query("select coalesce(max(version_number),0)::int + 1 as version_number from case_versions where client_id=$1", [clientId]);
    const createdAt = this.now();
    const pdf = await createMaskedCasePdf(redacted.maskedSnapshot, {versionNumber: Number(versionResult.rows[0].version_number), createdAt});
    const deadline = (await this.calendar()).calculateResponseDeadline(createdAt);
    const payload = JSON.stringify({clientId, advisorId: actor.advisorId, companyIds: [...new Set(companyIds)].sort((a, b) => a - b), sourceClientUpdatedAt: snapshot.sourceClientUpdatedAt, contentHash: sha256(JSON.stringify(snapshot)), expiresAt: createdAt.getTime() + 5 * 60_000});
    return {maskedSnapshot: redacted.maskedSnapshot, maskedPdfBase64: pdf.toString("base64"), companies: companies.map((row) => ({id: Number(row.id), name: row.name, logoUrl: null, activityAreas: row.activity_areas ?? [], activeContactCount: Number(row.active_contact_count), lastSentAt: null, alreadySentCurrentVersion: false})), selectedCompanyCount: companies.length, selectedContactCount: companies.reduce((sum, row) => sum + Number(row.active_contact_count), 0), responseDeadlineAt: deadline.toISOString(), previewConfirmation: this.tokens.signPreview(payload)};
  }

  private async batchSummary(client: Pool | PoolClient, batchId: number): Promise<Record<string, unknown>> {
    const result = await client.query(`select db.id batch_id, cv.id case_version_id, cv.version_number, cv.status version_status,
      cs.public_id submission_public_id, cs.company_id, l.name company_name, cs.delivery_status, cs.decision_status,
      cs.access_status, cs.response_deadline_at, count(sci.id)::int contact_count
      from delivery_batches db join company_submissions cs on cs.batch_id=db.id join case_versions cv on cv.id=cs.case_version_id
      join lenders l on l.id=cs.company_id left join submission_contact_invitations sci on sci.company_submission_id=cs.id
      where db.id=$1 group by db.id,cv.id,cs.id,l.id order by l.name`, [batchId]);
    return {batchId, caseVersionId: result.rows[0]?.case_version_id, versionNumber: result.rows[0]?.version_number, status: result.rows[0]?.version_status, companies: result.rows.map((row) => ({submissionPublicId: row.submission_public_id, companyId: row.company_id, companyName: row.company_name, deliveryStatus: row.delivery_status, decisionStatus: row.decision_status, accessStatus: row.access_status, responseDeadlineAt: row.response_deadline_at, contactCount: row.contact_count}))};
  }

  async send(clientId: number, input: {companyIds: number[]; idempotencyKey: string; previewConfirmation: string}, actor: AdvisorDeliveryActor, context: DeliveryContext): Promise<Record<string, unknown>> {
    const confirmationValue = this.tokens.verifyPreview(input.previewConfirmation);
    if (!confirmationValue) throw new DeliveryError("PREVIEW_CONFIRMATION_INVALID", 409, "אישור התצוגה המקדימה אינו תקף. יש ליצור תצוגה מקדימה חדשה.");
    let confirmation: Row;
    try { confirmation = JSON.parse(confirmationValue) as Row; } catch { throw new DeliveryError("PREVIEW_CONFIRMATION_INVALID", 409, "אישור התצוגה המקדימה אינו תקף."); }
    const selectedIds = [...new Set(input.companyIds)].sort((left, right) => left - right);
    if (confirmation.clientId !== clientId || confirmation.advisorId !== actor.advisorId || Number(confirmation.expiresAt) < this.now().getTime() || JSON.stringify(confirmation.companyIds) !== JSON.stringify(selectedIds)) throw new DeliveryError("PREVIEW_CONFIRMATION_EXPIRED", 409, "פרטי התיק או בחירת החברות השתנו. יש ליצור תצוגה מקדימה חדשה.");
    const existing = await this.pool.query("select id from delivery_batches where advisor_id=$1 and idempotency_key=$2", [actor.advisorId, input.idempotencyKey]);
    if (existing.rows[0]) return this.batchSummary(this.pool, Number(existing.rows[0].id));
    const snapshot = await this.loadFullSnapshot(clientId, actor.advisorId); this.validateCompleteness(snapshot);
    const contentHash = sha256(JSON.stringify(snapshot));
    if (snapshot.sourceClientUpdatedAt !== confirmation.sourceClientUpdatedAt || contentHash !== confirmation.contentHash) throw new DeliveryError("CLIENT_CHANGED_AFTER_PREVIEW", 409, "התיק השתנה לאחר התצוגה המקדימה. יש לעיין בגרסה המעודכנת לפני השליחה.");
    const companies = await this.selectedCompanies(selectedIds);
    const redacted = this.redaction.redact(snapshot);
    const createdAt = this.now();
    const calendar = await this.calendar();
    const deadline = calendar.calculateResponseDeadline(createdAt);
    const storagePrefix = `case-versions/${randomUUID()}`;
    let batchId = 0;
    let versionId = 0;
    let versionNumber = 0;
    const connection = await this.pool.connect();
    try {
      await connection.query("begin");
      const lockedClient = await connection.query("select updated_at from clients where id=$1 and advisor_id=$2 and deleted_at is null for update", [clientId, actor.advisorId]);
      if (!lockedClient.rows[0]) throw new DeliveryError("CLIENT_NOT_FOUND", 404, "תיק הלקוח לא נמצא.");
      if (new Date(lockedClient.rows[0].updated_at).toISOString() !== snapshot.sourceClientUpdatedAt) throw new DeliveryError("CLIENT_CHANGED_AFTER_PREVIEW", 409, "התיק השתנה בזמן השליחה. יש ליצור תצוגה מקדימה חדשה.");
      const versionResult = await connection.query("select coalesce(max(version_number),0)::int + 1 as next from case_versions where client_id=$1", [clientId]);
      versionNumber = Number(versionResult.rows[0].next);
      const batchResult = await connection.query("insert into delivery_batches(client_id,advisor_id,idempotency_key,created_by_user_id) values($1,$2,$3,$4) returning id", [clientId, actor.advisorId, input.idempotencyKey, actor.userId]);
      batchId = Number(batchResult.rows[0].id);
      const versionResultInsert = await connection.query(`insert into case_versions(client_id,version_number,advisor_id,created_by_user_id,source_client_updated_at,full_snapshot_encrypted,masked_snapshot,masked_pdf_object_key,full_pdf_object_key,redaction_report,content_hash,status)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'CREATING') returning id`, [clientId, versionNumber, actor.advisorId, actor.userId, snapshot.sourceClientUpdatedAt, this.encryption.encrypt(JSON.stringify(snapshot)), redacted.maskedSnapshot, `${storagePrefix}/masked.pdf`, `${storagePrefix}/full.pdf`, redacted.redactionReport, contentHash]);
      versionId = Number(versionResultInsert.rows[0].id);
      await connection.query("commit");
    } catch (error) {
      await connection.query("rollback");
      if ((error as {code?: string}).code === "23505") {
        const duplicate = await this.pool.query("select id from delivery_batches where advisor_id=$1 and idempotency_key=$2", [actor.advisorId, input.idempotencyKey]);
        if (duplicate.rows[0]) return this.batchSummary(this.pool, Number(duplicate.rows[0].id));
      }
      throw error;
    } finally { connection.release(); }

    try {
      const [maskedPdf, fullPdf] = await Promise.all([createMaskedCasePdf(redacted.maskedSnapshot, {versionNumber, createdAt}), createFullCasePdf(snapshot, {versionNumber, createdAt})]);
      await Promise.all([this.storage.put(`${storagePrefix}/masked.pdf`, maskedPdf, "application/pdf", {caseVersion: String(versionId), classification: "masked"}), this.storage.put(`${storagePrefix}/full.pdf`, fullPdf, "application/pdf", {caseVersion: String(versionId), classification: "confidential"})]);
      const immutableDocuments: Array<VersionDocumentSnapshot & {immutableObjectKey: string}> = [];
      for (const document of snapshot.documents) {
        const object = await this.storage.get(document.storageKey);
        const immutableObjectKey = `${storagePrefix}/documents/${randomUUID()}`;
        await this.storage.put(immutableObjectKey, object.body, document.mimeType, {checksum: document.checksumSha256, caseVersion: String(versionId)});
        immutableDocuments.push({...document, immutableObjectKey});
      }
      const finalize = await this.pool.connect();
      try {
        await finalize.query("begin");
        for (const document of immutableDocuments) await finalize.query(`insert into case_version_documents(case_version_id,document_id,immutable_object_key,document_type,custom_title,borrower_id,mime_type,size_bytes,checksum_sha256) values($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [versionId, document.documentId, document.immutableObjectKey, document.documentType, document.customTitle, document.borrowerId, document.mimeType, document.sizeBytes, document.checksumSha256]);
        for (const company of companies) {
          const submissionPublicId = randomUUID();
          const submissionResult = await finalize.query(`insert into company_submissions(public_id,case_version_id,company_id,advisor_id,batch_id,delivery_status,decision_status,access_status,response_deadline_at) values($1,$2,$3,$4,$5,'QUEUED','PENDING','NONE',$6) returning id`, [submissionPublicId, versionId, company.id, actor.advisorId, batchId, deadline]);
          const submissionId = Number(submissionResult.rows[0].id);
          const contacts = await finalize.query("select * from lender_contacts where lender_id=$1 and active=true and deleted_at is null order by is_primary desc,id", [company.id]);
          for (const contact of contacts.rows) {
            const publicId = randomUUID(); const nonce = this.tokens.createNonce(); const token = this.tokens.deriveToken("review", publicId, nonce);
            const invitationResult = await finalize.query(`insert into submission_contact_invitations(public_id,company_submission_id,contact_id,token_hash,token_nonce,token_expires_at,status,email_queued_at) values($1,$2,$3,$4,$5,$6,'QUEUED',$7) returning id`, [publicId, submissionId, contact.id, this.tokens.hash(token), nonce, deadline, createdAt]);
            const invitationId = Number(invitationResult.rows[0].id);
            await finalize.query(`insert into email_outbox(idempotency_key,template,recipient,payload,status,available_at,company_submission_id,invitation_id) values($1,'LENDER_INITIAL',$2,$3,'PENDING',$4,$5,$6)`, [`initial:${invitationId}`, contact.email, {invitationId}, createdAt, submissionId, invitationId]);
            await this.event(finalize, {submissionId, invitationId, contactId: contact.id, actorType: "SYSTEM", type: "EMAIL_QUEUED"}, context);
          }
          await this.event(finalize, {submissionId, actorType: "ADVISOR", actorId: actor.userId, type: "SUBMISSION_CREATED", metadata: {versionNumber, contactCount: contacts.rows.length}}, context);
        }
        await finalize.query("update case_versions set status='READY' where id=$1", [versionId]);
        await finalize.query("update clients set status='SUBMITTED',updated_at=now() where id=$1", [clientId]);
        await finalize.query("insert into notifications(user_id,type,title,body) select user_id,'CASE_SENT_TO_COMPANIES','התיק נשלח לחברות מימון',$2 from advisor_profiles where id=$1", [actor.advisorId, `תיק ${snapshot.publicCaseNumber} נשלח ל־${companies.length} חברות מימון.`]);
        await this.audit(finalize, actor.userId, "LENDER_DELIVERY_BATCH_CREATED", "delivery_batch", batchId, {clientId, versionId, versionNumber, companyCount: companies.length}, context);
        await finalize.query("commit");
      } catch (error) { await finalize.query("rollback"); await this.pool.query("update case_versions set status='FAILED' where id=$1", [versionId]); throw error; }
      finally { finalize.release(); }
    } catch (error) {
      await this.pool.query("update case_versions set status='FAILED' where id=$1", [versionId]);
      throw error;
    }
    this.broker.publish({type: "CASE_SENT_TO_COMPANIES", advisorId: actor.advisorId, clientId, submissionPublicId: "batch"});
    this.scheduleJobs();
    return this.batchSummary(this.pool, batchId);
  }

  async listClientResponses(clientId: number, actor: AdvisorDeliveryActor): Promise<unknown[]> {
    await this.loadFullSnapshot(clientId, actor.advisorId);
    const result = await this.pool.query(`select cs.*, cs.public_id submission_public_id, l.name company_name, l.activity_areas,
      cv.version_number, count(distinct sci.id)::int contact_count,
      count(distinct sci.id) filter(where sci.opened_at is not null)::int opened_count,
      count(distinct sci.id) filter(where sci.masked_pdf_viewed_at is not null)::int viewed_count,
      count(distinct sci.id) filter(where sci.masked_pdf_downloaded_at is not null)::int downloaded_count,
      dc.first_name decision_first_name, dc.last_name decision_last_name, dc.role_title decision_role,
      dc.email decision_email, dc.phone decision_phone, max(se.created_at) last_action_at
      from company_submissions cs join case_versions cv on cv.id=cs.case_version_id join lenders l on l.id=cs.company_id
      left join submission_contact_invitations sci on sci.company_submission_id=cs.id
      left join lender_contacts dc on dc.id=cs.decision_contact_id left join submission_events se on se.company_submission_id=cs.id
      where cv.client_id=$1 and cs.advisor_id=$2 group by cs.id,cv.id,l.id,dc.id order by cs.created_at desc`, [clientId, actor.advisorId]);
    return result.rows.map((row) => this.publicSubmission(row));
  }

  private publicSubmission(row: Row): Record<string, unknown> {
    return {publicId: row.submission_public_id ?? row.public_id, companyId: Number(row.company_id), companyName: row.company_name, versionNumber: Number(row.version_number), deliveryStatus: row.delivery_status, decisionStatus: row.decision_status, accessStatus: row.access_status, sentAt: row.created_at, responseDeadlineAt: row.response_deadline_at, decisionAt: row.decision_at, fullAccessExpiresAt: row.full_access_expires_at, contactCount: Number(row.contact_count ?? 0), openedCount: Number(row.opened_count ?? 0), viewedCount: Number(row.viewed_count ?? 0), downloadedCount: Number(row.downloaded_count ?? 0), decisionContact: row.decision_contact_id ? {name: `${row.decision_first_name} ${row.decision_last_name}`, role: row.decision_role, email: row.decision_email, phone: row.decision_phone} : null, lastActionAt: row.last_action_at};
  }

  async getClientResponse(clientId: number, submissionPublicId: string, actor: AdvisorDeliveryActor): Promise<unknown> {
    await this.loadFullSnapshot(clientId, actor.advisorId);
    const submission = await this.pool.query(`select cs.*,l.name company_name,cv.version_number from company_submissions cs join lenders l on l.id=cs.company_id join case_versions cv on cv.id=cs.case_version_id where cs.public_id=$1 and cv.client_id=$2 and cs.advisor_id=$3`, [submissionPublicId, clientId, actor.advisorId]);
    if (!submission.rows[0]) throw new DeliveryError("SUBMISSION_NOT_FOUND", 404, "השליחה לא נמצאה.");
    const events = await this.pool.query("select event_type,metadata_safe,created_at from submission_events where company_submission_id=$1 order by created_at", [submission.rows[0].id]);
    return {...this.publicSubmission({...submission.rows[0], submission_public_id: submissionPublicId}), timeline: events.rows.map((event) => ({type: event.event_type, metadata: event.metadata_safe, createdAt: event.created_at}))};
  }

  async listCompaniesForAdmin(): Promise<unknown[]> {
    const result = await this.pool.query(`select l.*, count(distinct c.id) filter(where c.deleted_at is null)::int contact_count,
      count(distinct c.id) filter(where c.active=true and c.deleted_at is null)::int active_contact_count,
      count(distinct cs.id)::int submission_count,
      count(distinct cs.id) filter(where cs.decision_status='INTERESTED')::int interested_count,
      count(distinct cs.id) filter(where cs.decision_status='NOT_INTERESTED')::int not_interested_count,
      count(distinct cs.id) filter(where cs.decision_status='EXPIRED')::int expired_count,
      max(cs.created_at) last_sent_at
      from lenders l left join lender_contacts c on c.lender_id=l.id left join company_submissions cs on cs.company_id=l.id
      where l.deleted_at is null group by l.id order by l.name`);
    const contacts = await this.pool.query("select * from lender_contacts where deleted_at is null order by lender_id,is_primary desc,id");
    return result.rows.map((row) => ({id: Number(row.id), name: row.name, legalName: row.legal_name, companyNumber: row.company_number, phone: row.phone, address: row.address, website: row.website, activityAreas: row.activity_areas ?? [], adminNotes: this.decrypt(row.admin_notes_encrypted), active: row.active, contactCount: Number(row.contact_count), activeContactCount: Number(row.active_contact_count), submissionCount: Number(row.submission_count), interestedCount: Number(row.interested_count), notInterestedCount: Number(row.not_interested_count), expiredCount: Number(row.expired_count), lastSentAt: row.last_sent_at, contacts: contacts.rows.filter((contact) => contact.lender_id === row.id).map((contact) => this.publicContact(contact))}));
  }

  private publicContact(row: Row): Record<string, unknown> {
    return {id: Number(row.id), firstName: row.first_name, lastName: row.last_name, roleTitle: row.role_title, email: row.email, phone: row.phone, isPrimary: row.is_primary, active: row.active, createdAt: row.created_at, updatedAt: row.updated_at};
  }

  private slug(name: string): string {
    const base = name.trim().toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]+/gu, "-").replace(/^-|-$/g, "").slice(0, 70) || "company";
    return `${base}-${randomUUID().slice(0, 8)}`;
  }

  async createCompany(input: CompanyInput, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown> {
    if (input.active) throw new DeliveryError("ACTIVE_COMPANY_REQUIRES_CONTACT", 422, "יש ליצור את החברה כלא פעילה, להוסיף איש קשר פעיל ורק אז להפעיל אותה.");
    const result = await this.pool.query(`insert into lenders(name,slug,contact_email,legal_name,company_number,phone,address,website,activity_areas,admin_notes_encrypted,active) values($1,$2,null,$3,$4,$5,$6,$7,$8,$9,false) returning *`, [input.name, this.slug(input.name), input.legalName ?? null, input.companyNumber ?? null, input.phone ?? null, input.address ?? null, input.website ?? null, JSON.stringify(input.activityAreas), input.adminNotes ? this.encryption.encrypt(input.adminNotes) : null]);
    await this.audit(this.pool, actor.userId, "FINANCING_COMPANY_CREATED", "lender", result.rows[0].id, {active: false}, context);
    return (await this.listCompaniesForAdmin() as Row[]).find((company) => company.id === Number(result.rows[0].id));
  }

  async updateCompany(id: number, input: Partial<CompanyInput>, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown> {
    if (input.active) {
      const contacts = await this.pool.query("select count(*)::int count from lender_contacts where lender_id=$1 and active=true and deleted_at is null", [id]);
      if (Number(contacts.rows[0].count) === 0) throw new DeliveryError("ACTIVE_COMPANY_REQUIRES_CONTACT", 422, "לא ניתן להפעיל חברה ללא איש קשר פעיל עם דוא״ל תקין.");
    }
    const fields: string[] = []; const values: unknown[] = [];
    const set = (column: string, value: unknown) => { values.push(value); fields.push(`${column}=$${values.length}`); };
    if (input.name !== undefined) set("name", input.name); if (input.legalName !== undefined) set("legal_name", input.legalName); if (input.companyNumber !== undefined) set("company_number", input.companyNumber); if (input.phone !== undefined) set("phone", input.phone); if (input.address !== undefined) set("address", input.address); if (input.website !== undefined) set("website", input.website); if (input.activityAreas !== undefined) set("activity_areas", JSON.stringify(input.activityAreas)); if (input.adminNotes !== undefined) set("admin_notes_encrypted", input.adminNotes ? this.encryption.encrypt(input.adminNotes) : null); if (input.active !== undefined) set("active", input.active);
    if (!fields.length) throw new DeliveryError("NO_CHANGES", 400, "לא נבחרו שדות לעדכון.");
    values.push(id); const result = await this.pool.query(`update lenders set ${fields.join(",")},updated_at=now() where id=$${values.length} and deleted_at is null returning id`, values);
    if (!result.rows[0]) throw new DeliveryError("COMPANY_NOT_FOUND", 404, "חברת המימון לא נמצאה.");
    await this.audit(this.pool, actor.userId, "FINANCING_COMPANY_UPDATED", "lender", id, {fields: Object.keys(input)}, context);
    return (await this.listCompaniesForAdmin() as Row[]).find((company) => company.id === id);
  }

  async deleteCompany(id: number, actor: AdminDeliveryActor, context: DeliveryContext): Promise<void> {
    const result = await this.pool.query("update lenders set active=false,deleted_at=now(),updated_at=now() where id=$1 and deleted_at is null returning id", [id]);
    if (!result.rows[0]) throw new DeliveryError("COMPANY_NOT_FOUND", 404, "חברת המימון לא נמצאה.");
    await this.pool.query("update lender_contacts set active=false,deleted_at=coalesce(deleted_at,now()),updated_at=now() where lender_id=$1", [id]);
    await this.audit(this.pool, actor.userId, "FINANCING_COMPANY_DELETED", "lender", id, {}, context);
  }

  async uploadCompanyLogo(id: number, body: Buffer, mimeType: "image/png" | "image/jpeg", actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown> {
    const company = await this.pool.query("select logo_storage_key from lenders where id=$1 and deleted_at is null", [id]);
    if (!company.rows[0]) throw new DeliveryError("COMPANY_NOT_FOUND", 404, "חברת המימון לא נמצאה.");
    const extension = mimeType === "image/png" ? "png" : "jpg";
    const objectKey = `lender-logos/${id}/${randomUUID()}.${extension}`;
    await this.storage.put(objectKey, body, mimeType, {company: String(id)});
    try {
      await this.pool.query("update lenders set logo_storage_key=$2,updated_at=now() where id=$1", [id, objectKey]);
      await this.audit(this.pool, actor.userId, "FINANCING_COMPANY_LOGO_UPDATED", "lender", id, {mimeType, sizeBytes: body.length}, context);
    } catch (error) { await this.storage.delete(objectKey).catch(() => undefined); throw error; }
    const previous = company.rows[0].logo_storage_key as string | null;
    if (previous) await this.storage.delete(previous).catch(() => undefined);
    return (await this.listCompaniesForAdmin() as Row[]).find((item) => item.id === id);
  }

  async createContact(companyId: number, input: ContactInput, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown> {
    const company = await this.pool.query("select id from lenders where id=$1 and deleted_at is null", [companyId]);
    if (!company.rows[0]) throw new DeliveryError("COMPANY_NOT_FOUND", 404, "חברת המימון לא נמצאה.");
    const email = normalizeEmail(input.email);
    try {
      const result = await this.pool.query(`insert into lender_contacts(lender_id,first_name,last_name,role_title,email,email_normalized,phone,is_primary,active) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`, [companyId, input.firstName, input.lastName, input.roleTitle, email, email, input.phone ?? null, input.isPrimary, input.active]);
      if (input.isPrimary) await this.pool.query("update lender_contacts set is_primary=false,updated_at=now() where lender_id=$1 and id<>$2 and deleted_at is null", [companyId, result.rows[0].id]);
      await this.pool.query("update lenders set contact_email=$2,updated_at=now() where id=$1", [companyId, email]);
      await this.audit(this.pool, actor.userId, "FINANCING_COMPANY_CONTACT_CREATED", "lender_contact", result.rows[0].id, {companyId}, context);
      return this.publicContact(result.rows[0]);
    } catch (error) { if ((error as {code?: string}).code === "23505") throw new DeliveryError("CONTACT_EMAIL_DUPLICATE", 409, "כתובת הדוא״ל כבר קיימת בחברה זו."); throw error; }
  }

  async updateContact(companyId: number, contactId: number, input: Partial<ContactInput>, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown> {
    if (input.active === false) {
      const state = await this.pool.query("select l.active,(select count(*) from lender_contacts c where c.lender_id=l.id and c.active=true and c.deleted_at is null and c.id<>$2)::int remaining from lenders l where l.id=$1", [companyId, contactId]);
      if (state.rows[0]?.active && Number(state.rows[0].remaining) === 0) throw new DeliveryError("ACTIVE_COMPANY_REQUIRES_CONTACT", 422, "לחברה פעילה חייב להישאר לפחות איש קשר פעיל אחד.");
    }
    const fields: string[] = []; const values: unknown[] = [];
    const set = (column: string, value: unknown) => { values.push(value); fields.push(`${column}=$${values.length}`); };
    if (input.firstName !== undefined) set("first_name", input.firstName); if (input.lastName !== undefined) set("last_name", input.lastName); if (input.roleTitle !== undefined) set("role_title", input.roleTitle); if (input.email !== undefined) {const email = normalizeEmail(input.email); set("email", email); set("email_normalized", email);} if (input.phone !== undefined) set("phone", input.phone); if (input.isPrimary !== undefined) set("is_primary", input.isPrimary); if (input.active !== undefined) set("active", input.active);
    values.push(companyId, contactId); const result = await this.pool.query(`update lender_contacts set ${fields.join(",")},updated_at=now() where lender_id=$${values.length - 1} and id=$${values.length} and deleted_at is null returning *`, values);
    if (!result.rows[0]) throw new DeliveryError("CONTACT_NOT_FOUND", 404, "איש הקשר לא נמצא.");
    if (input.isPrimary) await this.pool.query("update lender_contacts set is_primary=false,updated_at=now() where lender_id=$1 and id<>$2 and deleted_at is null", [companyId, contactId]);
    await this.audit(this.pool, actor.userId, "FINANCING_COMPANY_CONTACT_UPDATED", "lender_contact", contactId, {companyId, fields: Object.keys(input)}, context);
    return this.publicContact(result.rows[0]);
  }

  async deleteContact(companyId: number, contactId: number, actor: AdminDeliveryActor, context: DeliveryContext): Promise<void> {
    const state = await this.pool.query("select l.active,(select count(*) from lender_contacts c where c.lender_id=l.id and c.active=true and c.deleted_at is null and c.id<>$2)::int remaining from lenders l where l.id=$1", [companyId, contactId]);
    if (state.rows[0]?.active && Number(state.rows[0].remaining) === 0) throw new DeliveryError("ACTIVE_COMPANY_REQUIRES_CONTACT", 422, "לא ניתן למחוק את איש הקשר הפעיל האחרון של חברה פעילה.");
    const result = await this.pool.query("update lender_contacts set active=false,deleted_at=now(),updated_at=now() where lender_id=$1 and id=$2 and deleted_at is null returning id", [companyId, contactId]);
    if (!result.rows[0]) throw new DeliveryError("CONTACT_NOT_FOUND", 404, "איש הקשר לא נמצא.");
    await this.audit(this.pool, actor.userId, "FINANCING_COMPANY_CONTACT_DELETED", "lender_contact", contactId, {companyId}, context);
  }

  async listCalendar(): Promise<unknown[]> {
    return (await this.pool.query("select id,exception_date::text as date,type,title,source,created_at from business_calendar_exceptions order by exception_date")).rows;
  }

  async createCalendarException(input: CalendarInput, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown> {
    try { const result = await this.pool.query("insert into business_calendar_exceptions(exception_date,type,title,source,created_by_user_id) values($1,$2,$3,$4,$5) returning id,exception_date::text as date,type,title,source,created_at", [input.date, input.type, input.title, input.source, actor.userId]); await this.audit(this.pool, actor.userId, "BUSINESS_CALENDAR_EXCEPTION_CREATED", "business_calendar_exception", result.rows[0].id, {date: input.date, type: input.type}, context); return result.rows[0]; }
    catch (error) { if ((error as {code?: string}).code === "23505") throw new DeliveryError("CALENDAR_DATE_DUPLICATE", 409, "כבר קיימת הגדרת לוח שנה לתאריך זה."); throw error; }
  }

  async updateCalendarException(id: number, input: CalendarInput, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown> {
    const result = await this.pool.query("update business_calendar_exceptions set exception_date=$1,type=$2,title=$3,source=$4,updated_at=now() where id=$5 returning id,exception_date::text as date,type,title,source,created_at", [input.date, input.type, input.title, input.source, id]);
    if (!result.rows[0]) throw new DeliveryError("CALENDAR_EXCEPTION_NOT_FOUND", 404, "חריג לוח השנה לא נמצא."); await this.audit(this.pool, actor.userId, "BUSINESS_CALENDAR_EXCEPTION_UPDATED", "business_calendar_exception", id, {date: input.date, type: input.type}, context); return result.rows[0];
  }

  async deleteCalendarException(id: number, actor: AdminDeliveryActor, context: DeliveryContext): Promise<void> {
    const result = await this.pool.query("delete from business_calendar_exceptions where id=$1 returning id", [id]); if (!result.rows[0]) throw new DeliveryError("CALENDAR_EXCEPTION_NOT_FOUND", 404, "חריג לוח השנה לא נמצא."); await this.audit(this.pool, actor.userId, "BUSINESS_CALENDAR_EXCEPTION_DELETED", "business_calendar_exception", id, {}, context);
  }

  private async reviewByToken(token: string, client: Pool | PoolClient = this.pool, lock = false): Promise<Row> {
    const result = await client.query(`select sci.id invitation_id,sci.public_id invitation_public_id,sci.status invitation_status,
      sci.token_nonce,sci.token_expires_at,sci.closed_at,sci.contact_id,lc.first_name contact_first_name,
      lc.last_name contact_last_name,lc.role_title contact_role,lc.email contact_email,lc.phone contact_phone,
      cs.id submission_id,cs.public_id submission_public_id,cs.company_id,cs.advisor_id,cs.delivery_status,
      cs.decision_status,cs.access_status,cs.response_deadline_at,cs.decision_contact_id,cs.full_access_expires_at,
      l.name company_name,cv.id case_version_id,cv.version_number,cv.masked_snapshot,cv.masked_pdf_object_key,
      cv.full_pdf_object_key,c.public_case_number,c.id client_id,cs.created_at submission_created_at
      from submission_contact_invitations sci join lender_contacts lc on lc.id=sci.contact_id
      join company_submissions cs on cs.id=sci.company_submission_id join lenders l on l.id=cs.company_id
      join case_versions cv on cv.id=cs.case_version_id join clients c on c.id=cv.client_id
      where sci.token_hash=$1 ${lock ? "for update of sci,cs" : ""}`, [this.tokens.hash(token)]);
    if (!result.rows[0]) throw new DeliveryError("REVIEW_LINK_NOT_FOUND", 404, "קישור הבדיקה אינו תקף.");
    return result.rows[0];
  }

  private async applyExpiration(connection: PoolClient, row: Row, context: DeliveryContext): Promise<void> {
    await connection.query("update company_submissions set decision_status='EXPIRED',updated_at=now() where id=$1 and decision_status in('PENDING','PENDING_VERIFICATION')", [row.submission_id]);
    await connection.query("update submission_contact_invitations set status='EXPIRED',closed_at=now(),closed_reason='RESPONSE_EXPIRED',updated_at=now() where company_submission_id=$1 and closed_at is null", [row.submission_id]);
    await connection.query("update otp_challenges set cancelled_at=now(),updated_at=now() where company_submission_id=$1 and used_at is null and cancelled_at is null", [row.submission_id]);
    await connection.query("update email_outbox set status='CANCELLED',updated_at=now() where company_submission_id=$1 and template='LENDER_REMINDER' and status='PENDING'", [row.submission_id]);
    await this.event(connection, {submissionId: Number(row.submission_id), actorType: "SYSTEM", type: "COMPANY_RESPONSE_EXPIRED"}, context);
    const advisor = await connection.query("select u.id,u.email from advisor_profiles ap join users u on u.id=ap.user_id where ap.id=$1", [row.advisor_id]);
    if (advisor.rows[0]) {
      await connection.query("insert into notifications(user_id,type,title,body) values($1,'COMPANY_RESPONSE_EXPIRED','מועד תגובת חברה הסתיים',$2)", [advisor.rows[0].id, `חברת ${row.company_name} לא הגיבה לתיק ${row.public_case_number} במועד.`]);
      await connection.query(`insert into email_outbox(idempotency_key,template,recipient,payload,status,available_at,company_submission_id) values($1,'ADVISOR_EXPIRY',$2,$3,'PENDING',now(),$4) on conflict(idempotency_key) do nothing`, [`advisor-expiry:${row.submission_id}`, advisor.rows[0].email, {submissionId: row.submission_id}, row.submission_id]);
    }
  }

  private async expireSubmission(row: Row, context: DeliveryContext): Promise<void> {
    const connection = await this.pool.connect();
    try {
      await connection.query("begin");
      const locked = await connection.query("select decision_status from company_submissions where id=$1 for update", [row.submission_id]);
      if (["PENDING", "PENDING_VERIFICATION"].includes(locked.rows[0]?.decision_status)) await this.applyExpiration(connection, row, context);
      await connection.query("commit");
    } catch (error) { await connection.query("rollback"); throw error; } finally { connection.release(); }
  }

  private async ensureReviewAvailable(row: Row, context: DeliveryContext, lockedConnection?: PoolClient): Promise<void> {
    if (row.decision_status === "EXPIRED") throw new DeliveryError("REVIEW_EXPIRED", 410, "המועד למתן תשובה לתיק זה הסתיים.");
    if (row.decision_status === "CANCELLED") throw new DeliveryError("REVIEW_CANCELLED", 410, "ההזמנה לתיק זה בוטלה.");
    if (["PENDING", "PENDING_VERIFICATION"].includes(row.decision_status) && new Date(row.response_deadline_at).getTime() <= this.now().getTime()) {
      if (lockedConnection) await this.applyExpiration(lockedConnection, row, context); else await this.expireSubmission(row, context);
      throw new DeliveryError("REVIEW_EXPIRED", 410, "המועד למתן תשובה לתיק זה הסתיים.");
    }
  }

  async getReview(token: string, context: DeliveryContext): Promise<unknown> {
    const row = await this.reviewByToken(token); await this.ensureReviewAvailable(row, context);
    if (!row.closed_at) {
      await this.pool.query("update submission_contact_invitations set status='OPENED',opened_at=coalesce(opened_at,now()),last_opened_at=now(),open_count=open_count+1,updated_at=now() where id=$1", [row.invitation_id]);
      await this.event(this.pool, {submissionId: Number(row.submission_id), invitationId: Number(row.invitation_id), contactId: Number(row.contact_id), actorType: "COMPANY_CONTACT", actorId: Number(row.contact_id), type: "REVIEW_LINK_OPENED"}, context);
    }
    return {companyName: row.company_name, publicCaseNumber: row.public_case_number, versionNumber: Number(row.version_number), sentAt: row.submission_created_at, responseDeadlineAt: row.response_deadline_at, deliveryStatus: row.delivery_status, decisionStatus: row.decision_status, maskedSnapshot: row.masked_snapshot, closed: Boolean(row.closed_at), message: row.decision_status === "INTERESTED" || row.decision_status === "NOT_INTERESTED" ? "כבר התקבלה החלטה מטעם חברתכם עבור תיק זה." : null};
  }

  async getMaskedPdf(token: string, download: boolean, context: DeliveryContext): Promise<{body: Buffer; filename: string}> {
    const row = await this.reviewByToken(token); await this.ensureReviewAvailable(row, context);
    if (row.closed_at && !["PENDING", "PENDING_VERIFICATION"].includes(row.decision_status)) throw new DeliveryError("COMPANY_DECISION_ALREADY_FINALIZED", 409, "כבר התקבלה החלטה מטעם חברתכם עבור תיק זה.");
    const column = download ? "masked_pdf_downloaded_at" : "masked_pdf_viewed_at";
    await this.pool.query(`update submission_contact_invitations set ${column}=coalesce(${column},now()),updated_at=now() where id=$1`, [row.invitation_id]);
    await this.event(this.pool, {submissionId: Number(row.submission_id), invitationId: Number(row.invitation_id), contactId: Number(row.contact_id), actorType: "COMPANY_CONTACT", actorId: Number(row.contact_id), type: download ? "MASKED_PDF_DOWNLOADED" : "MASKED_PDF_VIEWED"}, context);
    const object = await this.storage.get(row.masked_pdf_object_key);
    return {body: object.body, filename: `תיק-מימון-מוסווה-${row.public_case_number}.pdf`};
  }

  private async queueDecisionMessages(client: PoolClient, row: Row, interested: boolean, context: DeliveryContext): Promise<void> {
    const contacts = await client.query("select id,email from lender_contacts where lender_id=$1 and active=true and deleted_at is null", [row.company_id]);
    for (const contact of contacts.rows) await client.query(`insert into email_outbox(idempotency_key,template,recipient,payload,status,available_at,company_submission_id) values($1,'LENDER_DECISION',$2,$3,'PENDING',now(),$4) on conflict(idempotency_key) do nothing`, [`decision:${row.submission_id}:${contact.id}:${interested}`, contact.email, {submissionId: row.submission_id, interested}, row.submission_id]);
    const advisor = await client.query("select u.id,u.email,u.first_name from advisor_profiles ap join users u on u.id=ap.user_id where ap.id=$1", [row.advisor_id]);
    if (advisor.rows[0]) {
      await client.query(`insert into notifications(user_id,type,title,body) values($1,$2,$3,$4)`, [advisor.rows[0].id, interested ? "COMPANY_INTERESTED" : "COMPANY_NOT_INTERESTED", interested ? "חברת מימון מעוניינת בתיק" : "חברת מימון אינה מעוניינת בתיק", `חברת ${row.company_name} ${interested ? "מעוניינת" : "אינה מעוניינת"} בתיק ${row.public_case_number}.`]);
      await client.query(`insert into email_outbox(idempotency_key,template,recipient,payload,status,available_at,company_submission_id) values($1,'ADVISOR_DECISION',$2,$3,'PENDING',now(),$4) on conflict(idempotency_key) do nothing`, [`advisor-decision:${row.submission_id}:${interested}`, advisor.rows[0].email, {submissionId: row.submission_id, interested}, row.submission_id]);
    }
    await this.event(client, {submissionId: Number(row.submission_id), contactId: Number(row.contact_id), invitationId: Number(row.invitation_id), actorType: "COMPANY_CONTACT", actorId: Number(row.contact_id), type: interested ? "COMPANY_INTERESTED" : "COMPANY_NOT_INTERESTED"}, context);
  }

  async decideNotInterested(token: string, context: DeliveryContext): Promise<unknown> {
    const connection = await this.pool.connect();
    try {
      await connection.query("begin");
      const row = await this.reviewByToken(token, connection, true); await this.ensureReviewAvailable(row, context, connection);
      if (row.decision_status === "NOT_INTERESTED") { await connection.query("commit"); return {decisionStatus: "NOT_INTERESTED", idempotent: true}; }
      if (["INTERESTED", "EXPIRED", "CANCELLED"].includes(row.decision_status)) throw new DeliveryError("COMPANY_DECISION_ALREADY_FINALIZED", 409, "כבר התקבלה החלטה מטעם חברתכם עבור תיק זה.");
      await connection.query("update company_submissions set decision_status='NOT_INTERESTED',decision_contact_id=$2,decision_at=now(),access_status='NONE',updated_at=now() where id=$1", [row.submission_id, row.contact_id]);
      await connection.query("update submission_contact_invitations set status='CLOSED',closed_at=now(),closed_reason='COMPANY_DECISION_FINALIZED',updated_at=now() where company_submission_id=$1 and closed_at is null", [row.submission_id]);
      await connection.query("update otp_challenges set cancelled_at=now(),updated_at=now() where company_submission_id=$1 and used_at is null and cancelled_at is null", [row.submission_id]);
      await connection.query("update email_outbox set status='CANCELLED',updated_at=now() where company_submission_id=$1 and template='LENDER_REMINDER' and status='PENDING'", [row.submission_id]);
      await this.queueDecisionMessages(connection, row, false, context);
      await connection.query("commit");
      this.broker.publish({type: "COMPANY_NOT_INTERESTED", advisorId: Number(row.advisor_id), clientId: Number(row.client_id), submissionPublicId: row.submission_public_id}); this.scheduleJobs();
      return {decisionStatus: "NOT_INTERESTED"};
    } catch (error) { await connection.query("rollback"); throw error; } finally { connection.release(); }
  }

  private async createOtp(row: Row, purpose: "INTEREST_DECISION" | "PORTAL_ACCESS", context: DeliveryContext, accessGrantId?: number): Promise<{expiresAt: Date}> {
    const now = this.now();
    const recent = await this.pool.query("select count(*)::int count,max(last_sent_at) last_sent from otp_challenges where contact_id=$1 and purpose=$2 and created_at >= $3", [row.contact_id, purpose, new Date(now.getTime() - 3_600_000)]);
    if (Number(recent.rows[0].count) >= 5) throw new DeliveryError("OTP_RATE_LIMITED", 429, "נשלחו יותר מדי קודי אימות. יש לנסות שוב מאוחר יותר.");
    if (recent.rows[0].last_sent && now.getTime() - new Date(recent.rows[0].last_sent).getTime() < 60_000) throw new DeliveryError("OTP_RESEND_TOO_SOON", 429, "ניתן לשלוח קוד חדש לאחר 60 שניות.");
    const nonce = this.tokens.createNonce(); const identity = `${row.submission_id}:${row.contact_id}`; const code = this.tokens.deriveOtp(purpose, identity, nonce); const expiresAt = new Date(now.getTime() + 10 * 60_000);
    const connection = await this.pool.connect();
    try {
      await connection.query("begin");
      await connection.query("update otp_challenges set cancelled_at=now(),updated_at=now() where company_submission_id=$1 and contact_id=$2 and purpose=$3 and used_at is null and cancelled_at is null", [row.submission_id, row.contact_id, purpose]);
      const challenge = await connection.query(`insert into otp_challenges(purpose,company_submission_id,contact_id,invitation_id,access_grant_id,code_hash,code_nonce,expires_at,last_sent_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, [purpose, row.submission_id, row.contact_id, row.invitation_id ?? null, accessGrantId ?? null, this.tokens.hash(code), nonce, expiresAt, now]);
      await connection.query(`insert into email_outbox(idempotency_key,template,recipient,payload,status,available_at,company_submission_id,invitation_id) values($1,'OTP',$2,$3,'PENDING',$4,$5,$6)`, [`otp:${challenge.rows[0].id}`, row.contact_email, {challengeId: challenge.rows[0].id}, now, row.submission_id, row.invitation_id ?? null]);
      if (purpose === "INTEREST_DECISION") await connection.query("update company_submissions set decision_status='PENDING_VERIFICATION',updated_at=now() where id=$1 and decision_status='PENDING'", [row.submission_id]);
      await this.event(connection, {submissionId: Number(row.submission_id), invitationId: row.invitation_id ? Number(row.invitation_id) : null, contactId: Number(row.contact_id), actorType: "COMPANY_CONTACT", actorId: Number(row.contact_id), type: "OTP_SENT", metadata: {purpose}}, context);
      await connection.query("commit");
    } catch (error) { await connection.query("rollback"); throw error; } finally { connection.release(); }
    this.scheduleJobs(); return {expiresAt};
  }

  async startInterest(token: string, context: DeliveryContext): Promise<unknown> {
    const row = await this.reviewByToken(token); await this.ensureReviewAvailable(row, context);
    if (["INTERESTED", "NOT_INTERESTED"].includes(row.decision_status)) throw new DeliveryError("COMPANY_DECISION_ALREADY_FINALIZED", 409, "כבר התקבלה החלטה מטעם חברתכם עבור תיק זה.");
    await this.event(this.pool, {submissionId: Number(row.submission_id), invitationId: Number(row.invitation_id), contactId: Number(row.contact_id), actorType: "COMPANY_CONTACT", actorId: Number(row.contact_id), type: "INTEREST_DECISION_STARTED"}, context);
    const challenge = await this.createOtp(row, "INTEREST_DECISION", context); return {status: "OTP_SENT", expiresAt: challenge.expiresAt};
  }

  async resendInterestCode(token: string, context: DeliveryContext): Promise<unknown> { return this.startInterest(token, context); }

  private async verifyChallenge(connection: PoolClient, row: Row, purpose: "INTEREST_DECISION" | "PORTAL_ACCESS", code: string): Promise<Row> {
    const challenge = await connection.query(`select * from otp_challenges where company_submission_id=$1 and contact_id=$2 and purpose=$3 and used_at is null and cancelled_at is null order by created_at desc limit 1 for update`, [row.submission_id, row.contact_id, purpose]);
    const current = challenge.rows[0];
    if (!current || new Date(current.expires_at).getTime() <= this.now().getTime()) throw new DeliveryError("OTP_EXPIRED", 410, "קוד האימות פג. יש לבקש קוד חדש.");
    if (Number(current.attempts) >= Number(current.max_attempts)) throw new DeliveryError("OTP_LOCKED", 429, "מספר ניסיונות האימות חרג מהמותר.");
    if (!this.tokens.verifyHash(code, current.code_hash)) { await connection.query("update otp_challenges set attempts=attempts+1,updated_at=now() where id=$1", [current.id]); throw new DeliveryError("OTP_INVALID", 400, "קוד האימות שגוי.", {attemptsRemaining: Number(current.max_attempts) - Number(current.attempts) - 1}); }
    await connection.query("update otp_challenges set used_at=now(),updated_at=now() where id=$1", [current.id]); return current;
  }

  async verifyInterest(token: string, code: string, context: DeliveryContext): Promise<unknown> {
    const connection = await this.pool.connect();
    try {
      await connection.query("begin");
      const row = await this.reviewByToken(token, connection, true); await this.ensureReviewAvailable(row, context, connection);
      if (["INTERESTED", "NOT_INTERESTED"].includes(row.decision_status)) throw new DeliveryError("COMPANY_DECISION_ALREADY_FINALIZED", 409, "כבר התקבלה החלטה מטעם חברתכם עבור תיק זה.");
      await this.verifyChallenge(connection, row, "INTEREST_DECISION", code);
      const accessExpiresAt = new Date(this.now().getTime() + 7 * 24 * 60 * 60_000);
      await connection.query("update company_submissions set decision_status='INTERESTED',decision_contact_id=$2,decision_at=now(),access_status='ACTIVE',full_access_starts_at=now(),full_access_expires_at=$3,updated_at=now() where id=$1", [row.submission_id, row.contact_id, accessExpiresAt]);
      await connection.query("update submission_contact_invitations set status='CLOSED',closed_at=now(),closed_reason='COMPANY_DECISION_FINALIZED',updated_at=now() where company_submission_id=$1 and closed_at is null", [row.submission_id]);
      await connection.query("update otp_challenges set cancelled_at=now(),updated_at=now() where company_submission_id=$1 and used_at is null and cancelled_at is null", [row.submission_id]);
      await connection.query("update email_outbox set status='CANCELLED',updated_at=now() where company_submission_id=$1 and template='LENDER_REMINDER' and status='PENDING'", [row.submission_id]);
      const contacts = await connection.query("select * from lender_contacts where lender_id=$1 and active=true and deleted_at is null", [row.company_id]);
      for (const contact of contacts.rows) {
        const nonce = this.tokens.createNonce(); const identity = `${row.submission_public_id}:${contact.id}`; const accessToken = this.tokens.deriveToken("access", identity, nonce);
        const grant = await connection.query(`insert into company_portal_access_grants(company_submission_id,contact_id,access_token_hash,token_nonce,expires_at) values($1,$2,$3,$4,$5) on conflict(company_submission_id,contact_id) do update set access_token_hash=excluded.access_token_hash,token_nonce=excluded.token_nonce,expires_at=excluded.expires_at,revoked_at=null,updated_at=now() returning id`, [row.submission_id, contact.id, this.tokens.hash(accessToken), nonce, accessExpiresAt]);
        await connection.query(`insert into email_outbox(idempotency_key,template,recipient,payload,status,available_at,company_submission_id) values($1,'FULL_ACCESS',$2,$3,'PENDING',now(),$4) on conflict(idempotency_key) do nothing`, [`full-access:${row.submission_id}:${contact.id}:${accessExpiresAt.toISOString()}`, contact.email, {grantId: grant.rows[0].id}, row.submission_id]);
      }
      await this.queueDecisionMessages(connection, row, true, context);
      await this.event(connection, {submissionId: Number(row.submission_id), invitationId: Number(row.invitation_id), contactId: Number(row.contact_id), actorType: "COMPANY_CONTACT", actorId: Number(row.contact_id), type: "OTP_VERIFIED", metadata: {purpose: "INTEREST_DECISION"}}, context);
      await this.event(connection, {submissionId: Number(row.submission_id), contactId: Number(row.contact_id), actorType: "SYSTEM", type: "FULL_ACCESS_GRANTED", metadata: {expiresAt: accessExpiresAt.toISOString()}}, context);
      await connection.query("commit");
      this.broker.publish({type: "COMPANY_INTERESTED", advisorId: Number(row.advisor_id), clientId: Number(row.client_id), submissionPublicId: row.submission_public_id}); this.scheduleJobs();
      return {decisionStatus: "INTERESTED", accessStatus: "ACTIVE", fullAccessExpiresAt: accessExpiresAt};
    } catch (error) { await connection.query(error instanceof DeliveryError && error.code === "OTP_INVALID" ? "commit" : "rollback"); throw error; } finally { connection.release(); }
  }

  private async accessByToken(token: string, client: Pool | PoolClient = this.pool, lock = false): Promise<Row> {
    const result = await client.query(`select g.id access_grant_id,g.contact_id,g.expires_at grant_expires_at,g.revoked_at,
      g.token_nonce,lc.first_name contact_first_name,lc.last_name contact_last_name,lc.email contact_email,
      cs.id submission_id,cs.public_id submission_public_id,cs.company_id,cs.advisor_id,cs.access_status,
      cs.full_access_expires_at,l.name company_name,cv.id case_version_id,cv.version_number,cv.full_snapshot_encrypted,
      cv.full_pdf_object_key,c.id client_id,c.public_case_number
      from company_portal_access_grants g join lender_contacts lc on lc.id=g.contact_id
      join company_submissions cs on cs.id=g.company_submission_id join lenders l on l.id=cs.company_id
      join case_versions cv on cv.id=cs.case_version_id join clients c on c.id=cv.client_id
      where g.access_token_hash=$1 ${lock ? "for update of g,cs" : ""}`, [this.tokens.hash(token)]);
    if (!result.rows[0]) throw new DeliveryError("ACCESS_LINK_NOT_FOUND", 404, "קישור הגישה אינו תקף."); return result.rows[0];
  }

  private ensureAccessAvailable(row: Row): void {
    if (row.revoked_at || row.access_status === "REVOKED") throw new DeliveryError("ACCESS_REVOKED", 410, "הגישה לתיק בוטלה.");
    if (row.access_status !== "ACTIVE" || new Date(row.grant_expires_at).getTime() <= this.now().getTime() || new Date(row.full_access_expires_at).getTime() <= this.now().getTime()) throw new DeliveryError("ACCESS_EXPIRED", 410, "תקופת הגישה לתיק הסתיימה. יש לפנות ליועץ או למנהל המערכת.");
  }

  async getAccess(token: string): Promise<unknown> {
    const row = await this.accessByToken(token); this.ensureAccessAvailable(row);
    return {companyName: row.company_name, publicCaseNumber: row.public_case_number, versionNumber: Number(row.version_number), expiresAt: row.full_access_expires_at, requiresOtp: true};
  }

  async sendAccessCode(token: string, context: DeliveryContext): Promise<unknown> {
    const row = await this.accessByToken(token); this.ensureAccessAvailable(row);
    const challenge = await this.createOtp(row, "PORTAL_ACCESS", context, Number(row.access_grant_id)); return {status: "OTP_SENT", expiresAt: challenge.expiresAt};
  }

  async verifyAccessCode(token: string, code: string, context: DeliveryContext): Promise<{sessionToken: string; expiresAt: Date}> {
    const connection = await this.pool.connect();
    try {
      await connection.query("begin");
      const row = await this.accessByToken(token, connection, true); this.ensureAccessAvailable(row);
      await this.verifyChallenge(connection, row, "PORTAL_ACCESS", code);
      const sessionToken = randomBytes(32).toString("base64url"); const now = this.now(); const expiresAt = new Date(Math.min(new Date(row.full_access_expires_at).getTime(), now.getTime() + 12 * 60 * 60_000)); const idleExpiresAt = new Date(now.getTime() + 30 * 60_000);
      await connection.query(`insert into external_portal_sessions(access_grant_id,session_token_hash,expires_at,idle_expires_at,last_seen_at) values($1,$2,$3,$4,$5)`, [row.access_grant_id, this.tokens.hash(sessionToken), expiresAt, idleExpiresAt, now]);
      await connection.query("update company_portal_access_grants set first_authenticated_at=coalesce(first_authenticated_at,now()),last_authenticated_at=now(),updated_at=now() where id=$1", [row.access_grant_id]);
      await this.event(connection, {submissionId: Number(row.submission_id), contactId: Number(row.contact_id), actorType: "COMPANY_CONTACT", actorId: Number(row.contact_id), type: "FULL_ACCESS_OPENED"}, context);
      await connection.query("commit");
      this.broker.publish({type: "COMPANY_FULL_ACCESS_OPENED", advisorId: Number(row.advisor_id), clientId: Number(row.client_id), submissionPublicId: row.submission_public_id});
      return {sessionToken, expiresAt};
    } catch (error) { await connection.query(error instanceof DeliveryError && error.code === "OTP_INVALID" ? "commit" : "rollback"); throw error; } finally { connection.release(); }
  }

  private async portalSession(sessionToken: string, context: DeliveryContext): Promise<Row> {
    if (!sessionToken) throw new DeliveryError("PORTAL_SESSION_REQUIRED", 401, "נדרש אימות מחדש.");
    const result = await this.pool.query(`select s.id session_id,s.expires_at session_expires_at,s.idle_expires_at,s.revoked_at session_revoked_at,
      g.id access_grant_id,g.contact_id,g.expires_at grant_expires_at,g.revoked_at grant_revoked_at,
      cs.id submission_id,cs.public_id submission_public_id,cs.advisor_id,cs.access_status,cs.full_access_expires_at,
      l.name company_name,cv.id case_version_id,cv.version_number,cv.full_snapshot_encrypted,cv.full_pdf_object_key,
      c.id client_id,c.public_case_number
      from external_portal_sessions s join company_portal_access_grants g on g.id=s.access_grant_id
      join company_submissions cs on cs.id=g.company_submission_id join lenders l on l.id=cs.company_id
      join case_versions cv on cv.id=cs.case_version_id join clients c on c.id=cv.client_id
      where s.session_token_hash=$1`, [this.tokens.hash(sessionToken)]);
    const row = result.rows[0];
    if (!row) throw new DeliveryError("PORTAL_SESSION_INVALID", 401, "ההתחברות לתיק אינה תקפה.");
    const now = this.now();
    if (row.session_revoked_at || row.grant_revoked_at || row.access_status !== "ACTIVE" || [row.session_expires_at, row.idle_expires_at, row.grant_expires_at, row.full_access_expires_at].some((value) => new Date(value).getTime() <= now.getTime())) {
      await this.pool.query("update external_portal_sessions set revoked_at=coalesce(revoked_at,now()) where id=$1", [row.session_id]);
      throw new DeliveryError("PORTAL_SESSION_EXPIRED", 410, "תקופת הגישה לתיק הסתיימה. יש לבצע אימות מחדש או לפנות למנהל המערכת.");
    }
    await this.pool.query("update external_portal_sessions set last_seen_at=$2,idle_expires_at=$3 where id=$1", [row.session_id, now, new Date(Math.min(new Date(row.session_expires_at).getTime(), now.getTime() + 30 * 60_000))]);
    void context;
    return row;
  }

  async getPortalCase(sessionToken: string, context: DeliveryContext): Promise<unknown> {
    const row = await this.portalSession(sessionToken, context);
    const snapshot = JSON.parse(this.encryption.decrypt(row.full_snapshot_encrypted)) as FullCaseSnapshot;
    return {companyName: row.company_name, versionNumber: Number(row.version_number), accessExpiresAt: row.full_access_expires_at, snapshot};
  }

  async getPortalPdf(sessionToken: string, context: DeliveryContext): Promise<{body: Buffer; filename: string}> {
    const row = await this.portalSession(sessionToken, context); const object = await this.storage.get(row.full_pdf_object_key);
    await this.event(this.pool, {submissionId: Number(row.submission_id), contactId: Number(row.contact_id), actorType: "COMPANY_CONTACT", actorId: Number(row.contact_id), type: "FULL_PDF_DOWNLOADED"}, context);
    return {body: object.body, filename: `תיק-מימון-מלא-${row.public_case_number}.pdf`};
  }

  private documentPublicId(row: Row): string {
    return this.tokens.deriveToken("version-document", String(row.id), row.checksum_sha256);
  }

  private async versionDocuments(caseVersionId: number): Promise<Row[]> {
    return (await this.pool.query("select * from case_version_documents where case_version_id=$1 order by id", [caseVersionId])).rows;
  }

  async listPortalDocuments(sessionToken: string, context: DeliveryContext): Promise<unknown[]> {
    const session = await this.portalSession(sessionToken, context); const documents = await this.versionDocuments(Number(session.case_version_id));
    return documents.map((document) => ({publicId: this.documentPublicId(document), displayName: getDocumentDisplayName({documentType: document.document_type, customTitle: document.custom_title}), documentType: document.document_type, mimeType: document.mime_type, sizeBytes: Number(document.size_bytes), createdAt: document.created_at}));
  }

  async getPortalDocument(sessionToken: string, publicDocumentId: string, download: boolean, context: DeliveryContext): Promise<{body: Buffer; contentType: string; filename: string}> {
    const session = await this.portalSession(sessionToken, context); const documents = await this.versionDocuments(Number(session.case_version_id)); const document = documents.find((candidate) => this.documentPublicId(candidate) === publicDocumentId);
    if (!document) throw new DeliveryError("DOCUMENT_NOT_FOUND", 404, "המסמך לא נמצא בגרסת התיק.");
    const object = await this.storage.get(document.immutable_object_key); const displayName = getDocumentDisplayName({documentType: document.document_type, customTitle: document.custom_title}); const extension = document.mime_type === "application/pdf" ? ".pdf" : document.mime_type === "image/png" ? ".png" : ".jpg";
    await this.event(this.pool, {submissionId: Number(session.submission_id), contactId: Number(session.contact_id), actorType: "COMPANY_CONTACT", actorId: Number(session.contact_id), type: download ? "DOCUMENT_DOWNLOADED" : "DOCUMENT_VIEWED", metadata: {documentType: document.document_type}}, context);
    return {body: object.body, contentType: document.mime_type, filename: `${displayName}${extension}`};
  }

  async getPortalZip(sessionToken: string, context: DeliveryContext): Promise<{body: Buffer; filename: string}> {
    const session = await this.portalSession(sessionToken, context); const snapshot = JSON.parse(this.encryption.decrypt(session.full_snapshot_encrypted)) as FullCaseSnapshot; const documents = await this.versionDocuments(Number(session.case_version_id)); const zip = new JSZip();
    const pdf = await this.storage.get(session.full_pdf_object_key); zip.file(`תיק-מלא/תיק-מימון-מלא-${snapshot.publicCaseNumber}.pdf`, pdf.body);
    for (const document of documents) {
      const object = await this.storage.get(document.immutable_object_key); const name = getDocumentDisplayName({documentType: document.document_type, customTitle: document.custom_title}); const extension = document.mime_type === "application/pdf" ? ".pdf" : document.mime_type === "image/png" ? ".png" : ".jpg"; const borrower = snapshot.documents.find((item) => item.documentId === Number(document.document_id))?.borrowerOrder; const folder = borrower ? `מסמכי-לווה-${borrower}` : document.document_type === "OTHER" ? "מסמכים-נוספים" : "מסמכי-נכס"; zip.file(`${folder}/${name}-${document.id}${extension}`, object.body);
    }
    const body = await zip.generateAsync({type: "nodebuffer", compression: "DEFLATE", compressionOptions: {level: 6}});
    await this.event(this.pool, {submissionId: Number(session.submission_id), contactId: Number(session.contact_id), actorType: "COMPANY_CONTACT", actorId: Number(session.contact_id), type: "FULL_CASE_ZIP_DOWNLOADED"}, context);
    return {body, filename: `תיק-מלא-${snapshot.publicCaseNumber}.zip`};
  }

  async logoutPortal(sessionToken: string): Promise<void> {
    if (sessionToken) await this.pool.query("update external_portal_sessions set revoked_at=coalesce(revoked_at,now()) where session_token_hash=$1", [this.tokens.hash(sessionToken)]);
  }

  async listAdminSubmissions(): Promise<unknown[]> {
    const result = await this.pool.query(`select cs.*,cs.public_id submission_public_id,l.name company_name,cv.version_number,
      c.public_case_number,c.first_name_encrypted,c.last_name_encrypted,u.first_name advisor_first_name,u.last_name advisor_last_name,
      count(distinct sci.id)::int contact_count,count(distinct sci.id) filter(where sci.opened_at is not null)::int opened_count,count(distinct sci.id) filter(where sci.masked_pdf_downloaded_at is not null)::int downloaded_count,
      max(se.created_at) last_action_at
      from company_submissions cs join lenders l on l.id=cs.company_id join case_versions cv on cv.id=cs.case_version_id
      join clients c on c.id=cv.client_id join advisor_profiles ap on ap.id=cs.advisor_id join users u on u.id=ap.user_id
      left join submission_contact_invitations sci on sci.company_submission_id=cs.id left join submission_events se on se.company_submission_id=cs.id
      group by cs.id,l.id,cv.id,c.id,u.id order by cs.created_at desc`);
    return result.rows.map((row) => ({...this.publicSubmission(row), publicCaseNumber: row.public_case_number, clientName: `${this.decrypt(row.first_name_encrypted)} ${this.decrypt(row.last_name_encrypted)}`.trim(), advisorName: `${row.advisor_first_name} ${row.advisor_last_name}`.trim(), openedCount: Number(row.opened_count), downloadedCount: Number(row.downloaded_count)}));
  }

  async getAdminSubmission(publicId: string): Promise<unknown> {
    const submission = await this.pool.query(`select cs.*,cs.public_id submission_public_id,l.name company_name,cv.version_number,cv.masked_snapshot,c.public_case_number from company_submissions cs join lenders l on l.id=cs.company_id join case_versions cv on cv.id=cs.case_version_id join clients c on c.id=cv.client_id where cs.public_id=$1`, [publicId]);
    if (!submission.rows[0]) throw new DeliveryError("SUBMISSION_NOT_FOUND", 404, "השליחה לא נמצאה."); const row = submission.rows[0];
    const invitations = await this.pool.query(`select sci.public_id, sci.status,sci.email_sent_at,sci.email_failed_at,sci.opened_at,sci.last_opened_at,sci.open_count,sci.masked_pdf_viewed_at,sci.masked_pdf_downloaded_at,sci.reminder_one_sent_at,sci.reminder_two_sent_at,sci.closed_at,lc.first_name,lc.last_name,lc.role_title,lc.email from submission_contact_invitations sci join lender_contacts lc on lc.id=sci.contact_id where sci.company_submission_id=$1 order by lc.is_primary desc,lc.id`, [row.id]);
    const timeline = await this.pool.query("select event_type,actor_type,metadata_safe,created_at,request_id from submission_events where company_submission_id=$1 order by created_at", [row.id]);
    return {...this.publicSubmission(row), publicCaseNumber: row.public_case_number, maskedSnapshot: row.masked_snapshot, invitations: invitations.rows.map((item) => ({publicId: item.public_id, status: item.status, contactName: `${item.first_name} ${item.last_name}`, contactRole: item.role_title, contactEmail: item.email, emailSentAt: item.email_sent_at, emailFailedAt: item.email_failed_at, openedAt: item.opened_at, lastOpenedAt: item.last_opened_at, openCount: Number(item.open_count), maskedPdfViewedAt: item.masked_pdf_viewed_at, maskedPdfDownloadedAt: item.masked_pdf_downloaded_at, reminderOneSentAt: item.reminder_one_sent_at, reminderTwoSentAt: item.reminder_two_sent_at, closedAt: item.closed_at})), timeline: timeline.rows.map((item) => ({type: item.event_type, actorType: item.actor_type, metadata: item.metadata_safe, createdAt: item.created_at, requestId: item.request_id}))};
  }

  async getAdminPdf(publicId: string, kind: "masked" | "full", actor: AdminDeliveryActor, context: DeliveryContext): Promise<{body: Buffer; filename: string}> {
    const result = await this.pool.query(`select cs.id,cv.masked_pdf_object_key,cv.full_pdf_object_key,c.public_case_number from company_submissions cs join case_versions cv on cv.id=cs.case_version_id join clients c on c.id=cv.client_id where cs.public_id=$1`, [publicId]);
    const row = result.rows[0];
    if (!row) throw new DeliveryError("SUBMISSION_NOT_FOUND", 404, "השליחה לא נמצאה.");
    const object = await this.storage.get(kind === "masked" ? row.masked_pdf_object_key : row.full_pdf_object_key);
    await this.audit(this.pool, actor.userId, kind === "masked" ? "ADMIN_MASKED_PDF_VIEWED" : "ADMIN_FULL_PDF_VIEWED", "company_submission", Number(row.id), {publicId}, context);
    return {body: object.body, filename: `תיק-מימון-${kind === "masked" ? "מוסווה" : "מלא"}-${row.public_case_number}.pdf`};
  }

  async adminAction(publicId: string, action: string, values: Record<string, unknown>, actor: AdminDeliveryActor, context: DeliveryContext): Promise<unknown> {
    const submission = await this.pool.query(`select cs.*,l.name company_name,cv.client_id,c.public_case_number from company_submissions cs join lenders l on l.id=cs.company_id join case_versions cv on cv.id=cs.case_version_id join clients c on c.id=cv.client_id where cs.public_id=$1`, [publicId]); const row = submission.rows[0];
    if (!row) throw new DeliveryError("SUBMISSION_NOT_FOUND", 404, "השליחה לא נמצאה.");
    if (action === "extend-access") {
      const days = Number(values.days ?? 7); if (!Number.isInteger(days) || days < 1 || days > 30) throw new DeliveryError("INVALID_EXTENSION", 400, "ניתן להאריך גישה בין יום אחד ל־30 ימים."); const expiresAt = new Date(this.now().getTime() + days * 24 * 60 * 60_000);
      await this.pool.query("update company_submissions set access_status='ACTIVE',full_access_expires_at=$2,updated_at=now() where id=$1 and decision_status='INTERESTED'", [row.id, expiresAt]); await this.pool.query("update company_portal_access_grants set expires_at=$2,revoked_at=null,updated_at=now() where company_submission_id=$1", [row.id, expiresAt]); await this.event(this.pool, {submissionId: Number(row.id), actorType: "ADMIN", actorId: actor.userId, type: "ADMIN_ACCESS_EXTENDED", metadata: {days}}, context);
    } else if (action === "revoke-access") {
      await this.pool.query("update company_submissions set access_status='REVOKED',updated_at=now() where id=$1", [row.id]); await this.pool.query("update company_portal_access_grants set revoked_at=now(),updated_at=now() where company_submission_id=$1", [row.id]); await this.pool.query("update external_portal_sessions set revoked_at=now() where access_grant_id in(select id from company_portal_access_grants where company_submission_id=$1) and revoked_at is null", [row.id]); await this.event(this.pool, {submissionId: Number(row.id), actorType: "ADMIN", actorId: actor.userId, type: "ADMIN_ACCESS_REVOKED"}, context);
    } else if (action === "cancel-invitation") {
      await this.pool.query("update company_submissions set decision_status='CANCELLED',cancelled_at=now(),cancellation_reason=$2,updated_at=now() where id=$1 and decision_status in('PENDING','PENDING_VERIFICATION')", [row.id, safeText(values.reason ?? "בוטל על ידי מנהל")]); await this.pool.query("update submission_contact_invitations set status='CLOSED',closed_at=now(),closed_reason='ADMIN_CANCELLED',updated_at=now() where company_submission_id=$1 and closed_at is null", [row.id]); await this.event(this.pool, {submissionId: Number(row.id), actorType: "ADMIN", actorId: actor.userId, type: "INVITATION_CANCELLED"}, context);
    } else if (action === "send-reminder" || action === "resend-failed") {
      if (action === "send-reminder" && (!(["PENDING", "PENDING_VERIFICATION"].includes(row.decision_status)) || new Date(row.response_deadline_at).getTime() <= this.now().getTime())) throw new DeliveryError("REMINDER_NOT_AVAILABLE", 409, "לא ניתן לשלוח תזכורת לאחר החלטה או לאחר תום מועד התגובה.");
      const filter = action === "resend-failed" ? "and sci.status='FAILED'" : "and sci.closed_at is null";
      const invitations = await this.pool.query(`select sci.id,lc.email from submission_contact_invitations sci join lender_contacts lc on lc.id=sci.contact_id where sci.company_submission_id=$1 ${filter}`, [row.id]);
      for (const invitation of invitations.rows) await this.pool.query(`insert into email_outbox(idempotency_key,template,recipient,payload,status,available_at,company_submission_id,invitation_id) values($1,$2,$3,$4,'PENDING',now(),$5,$6)`, [`admin:${action}:${invitation.id}:${randomUUID()}`, action === "send-reminder" ? "LENDER_REMINDER" : "LENDER_INITIAL", invitation.email, {invitationId: invitation.id, manual: true}, row.id, invitation.id]);
      if (action === "resend-failed") await this.pool.query("update submission_contact_invitations set status='QUEUED',email_failed_at=null,email_failure_reason=null,updated_at=now() where company_submission_id=$1 and status='FAILED'", [row.id]);
    } else if (action === "reissue") {
      const deadline = (await this.calendar()).calculateResponseDeadline(this.now()); const invitations = await this.pool.query("select sci.id,sci.public_id,sci.contact_id,lc.email from submission_contact_invitations sci join lender_contacts lc on lc.id=sci.contact_id where sci.company_submission_id=$1", [row.id]);
      await this.pool.query("update company_submissions set decision_status='PENDING',access_status='NONE',response_deadline_at=$2,cancelled_at=null,cancellation_reason=null,updated_at=now() where id=$1", [row.id, deadline]);
      for (const invitation of invitations.rows) { const nonce = this.tokens.createNonce(); const token = this.tokens.deriveToken("review", invitation.public_id, nonce); await this.pool.query("update submission_contact_invitations set token_hash=$2,token_nonce=$3,token_expires_at=$4,status='QUEUED',closed_at=null,closed_reason=null,email_queued_at=now(),updated_at=now() where id=$1", [invitation.id, this.tokens.hash(token), nonce, deadline]); await this.pool.query(`insert into email_outbox(idempotency_key,template,recipient,payload,status,available_at,company_submission_id,invitation_id) values($1,'LENDER_INITIAL',$2,$3,'PENDING',now(),$4,$5)`, [`reissue:${invitation.id}:${deadline.toISOString()}`, invitation.email, {invitationId: invitation.id}, row.id, invitation.id]); }
    } else throw new DeliveryError("ADMIN_ACTION_INVALID", 400, "הפעולה המבוקשת אינה נתמכת.");
    await this.audit(this.pool, actor.userId, `COMPANY_SUBMISSION_${action.toUpperCase().replace(/-/g, "_")}`, "company_submission", row.id, {publicId}, context); this.scheduleJobs(); return this.getAdminSubmission(publicId);
  }

  private async outboxContent(item: Row): Promise<{content: DeliveryEmailContent; invitationId?: number; submissionId?: number}> {
    const payload = item.payload as Row;
    if (["LENDER_INITIAL", "LENDER_REMINDER"].includes(item.template)) {
      const result = await this.pool.query(`select sci.id invitation_id,sci.public_id,sci.token_nonce,lc.first_name,lc.email,l.name company_name,cs.id submission_id,cs.response_deadline_at,c.public_case_number from submission_contact_invitations sci join lender_contacts lc on lc.id=sci.contact_id join company_submissions cs on cs.id=sci.company_submission_id join lenders l on l.id=cs.company_id join case_versions cv on cv.id=cs.case_version_id join clients c on c.id=cv.client_id where sci.id=$1`, [payload.invitationId]); const row = result.rows[0]; if (!row) throw new Error("INVITATION_MISSING"); const token = this.tokens.deriveToken("review", row.public_id, row.token_nonce); const values = {contactFirstName: row.first_name, companyName: row.company_name, publicCaseNumber: row.public_case_number, deadline: localDateTime(new Date(row.response_deadline_at)), url: `${this.appUrl}/external/review/${encodeURIComponent(token)}`}; return {content: item.template === "LENDER_INITIAL" ? deliveryEmailTemplates.initial(values) : deliveryEmailTemplates.reminder(values), invitationId: Number(row.invitation_id), submissionId: Number(row.submission_id)};
    }
    if (item.template === "OTP") {
      const result = await this.pool.query(`select o.*,lc.first_name,l.name company_name,c.public_case_number from otp_challenges o join lender_contacts lc on lc.id=o.contact_id join company_submissions cs on cs.id=o.company_submission_id join lenders l on l.id=cs.company_id join case_versions cv on cv.id=cs.case_version_id join clients c on c.id=cv.client_id where o.id=$1`, [payload.challengeId]); const row = result.rows[0]; if (!row) throw new Error("OTP_MISSING"); const code = this.tokens.deriveOtp(row.purpose, `${row.company_submission_id}:${row.contact_id}`, row.code_nonce); return {content: deliveryEmailTemplates.otp({contactFirstName: row.first_name, companyName: row.company_name, publicCaseNumber: row.public_case_number, code, portal: row.purpose === "PORTAL_ACCESS"}), submissionId: Number(row.company_submission_id)};
    }
    if (item.template === "FULL_ACCESS") {
      const result = await this.pool.query(`select g.*,lc.email,cs.public_id submission_public_id,cs.id submission_id,cs.full_access_expires_at,l.name company_name,c.public_case_number from company_portal_access_grants g join lender_contacts lc on lc.id=g.contact_id join company_submissions cs on cs.id=g.company_submission_id join lenders l on l.id=cs.company_id join case_versions cv on cv.id=cs.case_version_id join clients c on c.id=cv.client_id where g.id=$1`, [payload.grantId]); const row = result.rows[0]; if (!row) throw new Error("GRANT_MISSING"); const token = this.tokens.deriveToken("access", `${row.submission_public_id}:${row.contact_id}`, row.token_nonce); return {content: deliveryEmailTemplates.fullAccess({companyName: row.company_name, publicCaseNumber: row.public_case_number, expiresAt: localDateTime(new Date(row.full_access_expires_at)), url: `${this.appUrl}/external/access/${encodeURIComponent(token)}`}), submissionId: Number(row.submission_id)};
    }
    if (item.template === "LENDER_DECISION") {
      const result = await this.pool.query(`select cs.id,l.name company_name,c.public_case_number from company_submissions cs join lenders l on l.id=cs.company_id join case_versions cv on cv.id=cs.case_version_id join clients c on c.id=cv.client_id where cs.id=$1`, [payload.submissionId]); const row = result.rows[0]; return {content: deliveryEmailTemplates.decision({companyName: row.company_name, publicCaseNumber: row.public_case_number, interested: Boolean(payload.interested)}), submissionId: Number(row.id)};
    }
    if (item.template === "ADVISOR_DECISION") {
      const result = await this.pool.query(`select cs.id,l.name company_name,c.id client_id,u.first_name,dc.first_name contact_first_name,dc.last_name contact_last_name,dc.role_title,dc.email contact_email,dc.phone contact_phone from company_submissions cs join lenders l on l.id=cs.company_id join case_versions cv on cv.id=cs.case_version_id join clients c on c.id=cv.client_id join advisor_profiles ap on ap.id=cs.advisor_id join users u on u.id=ap.user_id left join lender_contacts dc on dc.id=cs.decision_contact_id where cs.id=$1`, [payload.submissionId]); const row = result.rows[0]; const contact = row.contact_first_name ? `${row.contact_first_name} ${row.contact_last_name} · ${row.role_title} · ${row.contact_email}${row.contact_phone ? ` · ${row.contact_phone}` : ""}` : undefined; return {content: deliveryEmailTemplates.advisor({advisorFirstName: row.first_name, companyName: row.company_name, interested: Boolean(payload.interested), contact, url: `${this.appUrl}/advisor/clients/${row.client_id}?tab=company-responses`}), submissionId: Number(row.id)};
    }
    if (item.template === "ADVISOR_DELIVERY_FAILURE" || item.template === "ADVISOR_EXPIRY") {
      const result = await this.pool.query(`select cs.id,l.name company_name,c.id client_id,c.public_case_number,u.first_name from company_submissions cs join lenders l on l.id=cs.company_id join case_versions cv on cv.id=cs.case_version_id join clients c on c.id=cv.client_id join advisor_profiles ap on ap.id=cs.advisor_id join users u on u.id=ap.user_id where cs.id=$1`, [payload.submissionId]);
      const row = result.rows[0]; if (!row) throw new Error("SUBMISSION_MISSING");
      const values = {advisorFirstName: row.first_name, companyName: row.company_name, publicCaseNumber: row.public_case_number, url: `${this.appUrl}/advisor/clients/${row.client_id}?tab=company-responses`};
      return {content: item.template === "ADVISOR_DELIVERY_FAILURE" ? deliveryEmailTemplates.advisorDeliveryFailure(values) : deliveryEmailTemplates.advisorExpired(values), submissionId: Number(row.id)};
    }
    throw new Error("UNKNOWN_OUTBOX_TEMPLATE");
  }

  private async refreshDeliveryStatus(submissionId: number): Promise<void> {
    await this.pool.query(`with state as(select count(*)::int total,count(*) filter(where status in('SENT','OPENED','CLOSED'))::int sent,count(*) filter(where status='FAILED')::int failed from submission_contact_invitations where company_submission_id=$1)
      update company_submissions cs set delivery_status=(case when state.sent=state.total and state.total>0 then 'SENT' when state.sent>0 and state.failed>0 then 'PARTIALLY_SENT' when state.failed=state.total and state.total>0 then 'FAILED' else 'QUEUED' end)::company_delivery_status,updated_at=now() from state where cs.id=$1`, [submissionId]);
  }

  private async processOutbox(): Promise<void> {
    const due = await this.pool.query("select * from email_outbox where status='PENDING' and available_at <= now() order by id limit 25");
    for (const item of due.rows) {
      const claimed = await this.pool.query("update email_outbox set status='PROCESSING',locked_at=now(),attempts=attempts+1,updated_at=now() where id=$1 and status='PENDING' returning *", [item.id]); if (!claimed.rows[0]) continue;
      try {
        const rendered = await this.outboxContent(claimed.rows[0]); const sent = await this.email.send(item.recipient, rendered.content.subject, rendered.content.html, {text: rendered.content.text});
        await this.pool.query("update email_outbox set status='SENT',sent_at=now(),message_id=$2,locked_at=null,updated_at=now() where id=$1", [item.id, sent.messageId]); await this.pool.query("insert into email_logs(recipient,template,message_id,status,sent_at) values($1,$2,$3,'SENT',now())", [item.recipient, item.template, sent.messageId]);
        if (rendered.invitationId) { await this.pool.query("update submission_contact_invitations set status=case when status='OPENED' then status else 'SENT' end,email_sent_at=now(),email_failed_at=null,email_failure_reason=null,updated_at=now() where id=$1", [rendered.invitationId]); if (rendered.submissionId) await this.refreshDeliveryStatus(rendered.submissionId); }
        if (rendered.submissionId) await this.event(this.pool, {submissionId: rendered.submissionId, invitationId: rendered.invitationId, actorType: "SYSTEM", type: item.template === "LENDER_REMINDER" ? "REMINDER_SENT" : "EMAIL_SENT", metadata: {template: item.template}}, {requestId: `job-${item.id}`});
      } catch {
        const attempts = Number(claimed.rows[0].attempts); const final = attempts >= 3; await this.pool.query("update email_outbox set status=$2,available_at=$3,locked_at=null,sanitized_error=$4,updated_at=now() where id=$1", [item.id, final ? "FAILED" : "PENDING", new Date(this.now().getTime() + Math.pow(2, attempts) * 60_000), sanitizeEmailError()]); await this.pool.query("insert into email_logs(recipient,template,status,sanitized_error,failed_at) values($1,$2,'FAILED',$3,now())", [item.recipient, item.template, sanitizeEmailError()]);
        if (final && item.invitation_id) { await this.pool.query("update submission_contact_invitations set status='FAILED',email_failed_at=now(),email_failure_reason=$2,updated_at=now() where id=$1", [item.invitation_id, sanitizeEmailError()]); if (item.company_submission_id) { const submissionId = Number(item.company_submission_id); await this.refreshDeliveryStatus(submissionId); await this.event(this.pool, {submissionId, invitationId: Number(item.invitation_id), actorType: "SYSTEM", type: "EMAIL_FAILED", metadata: {template: item.template}}, {requestId: `job-${item.id}`}); const advisor = await this.pool.query(`select u.id,u.email,cs.advisor_id,cv.client_id,cs.public_id from company_submissions cs join case_versions cv on cv.id=cs.case_version_id join advisor_profiles ap on ap.id=cs.advisor_id join users u on u.id=ap.user_id where cs.id=$1`, [submissionId]); if (advisor.rows[0]) { await this.pool.query("insert into notifications(user_id,type,title,body) values($1,'DELIVERY_FAILED','שליחת הזמנה לחברת מימון נכשלה','ניתן לצפות בפרטים המסוננים במסך תגובות החברות.')", [advisor.rows[0].id]); await this.pool.query(`insert into email_outbox(idempotency_key,template,recipient,payload,status,available_at,company_submission_id) values($1,'ADVISOR_DELIVERY_FAILURE',$2,$3,'PENDING',now(),$4) on conflict(idempotency_key) do nothing`, [`advisor-delivery-failure:${submissionId}:${item.invitation_id}`, advisor.rows[0].email, {submissionId}, submissionId]); this.broker.publish({type: "DELIVERY_FAILED", advisorId: Number(advisor.rows[0].advisor_id), clientId: Number(advisor.rows[0].client_id), submissionPublicId: advisor.rows[0].public_id}); } } }
      }
    }
  }

  private async processSchedules(): Promise<void> {
    const context = {requestId: `scheduler-${this.now().toISOString()}`}; const now = this.now(); const calendar = await this.calendar();
    const pending = await this.pool.query(`select cs.id submission_id,cs.response_deadline_at,cs.decision_status,cs.advisor_id,cs.public_id submission_public_id,l.name company_name,c.id client_id,c.public_case_number from company_submissions cs join lenders l on l.id=cs.company_id join case_versions cv on cv.id=cs.case_version_id join clients c on c.id=cv.client_id where cs.decision_status in('PENDING','PENDING_VERIFICATION')`);
    for (const row of pending.rows) {
      const deadline = new Date(row.response_deadline_at); if (deadline.getTime() <= now.getTime()) { await this.expireSubmission(row, context); continue; }
      const [first, second] = calendar.calculateReminderSchedule(new Date(0), deadline); const invitations = await this.pool.query("select sci.id,lc.email,sci.reminder_one_sent_at,sci.reminder_two_sent_at from submission_contact_invitations sci join lender_contacts lc on lc.id=sci.contact_id where sci.company_submission_id=$1 and sci.closed_at is null", [row.submission_id]);
      for (const invitation of invitations.rows) {
        if (now >= first && !invitation.reminder_one_sent_at) { await this.pool.query(`insert into email_outbox(idempotency_key,template,recipient,payload,status,available_at,company_submission_id,invitation_id) values($1,'LENDER_REMINDER',$2,$3,'PENDING',now(),$4,$5) on conflict(idempotency_key) do nothing`, [`reminder1:${invitation.id}`, invitation.email, {invitationId: invitation.id}, row.submission_id, invitation.id]); await this.pool.query("update submission_contact_invitations set reminder_one_sent_at=now(),updated_at=now() where id=$1", [invitation.id]); }
        if (now >= second && !invitation.reminder_two_sent_at) { await this.pool.query(`insert into email_outbox(idempotency_key,template,recipient,payload,status,available_at,company_submission_id,invitation_id) values($1,'LENDER_REMINDER',$2,$3,'PENDING',now(),$4,$5) on conflict(idempotency_key) do nothing`, [`reminder2:${invitation.id}`, invitation.email, {invitationId: invitation.id}, row.submission_id, invitation.id]); await this.pool.query("update submission_contact_invitations set reminder_two_sent_at=now(),updated_at=now() where id=$1", [invitation.id]); }
      }
    }
    const expiredAccess = await this.pool.query("update company_submissions set access_status='EXPIRED',updated_at=now() where access_status='ACTIVE' and full_access_expires_at <= now() returning id");
    for (const row of expiredAccess.rows) { await this.pool.query("update external_portal_sessions set revoked_at=coalesce(revoked_at,now()) where access_grant_id in(select id from company_portal_access_grants where company_submission_id=$1)", [row.id]); await this.event(this.pool, {submissionId: Number(row.id), actorType: "SYSTEM", type: "FULL_ACCESS_EXPIRED"}, context); }
    await this.pool.query("update otp_challenges set cancelled_at=now(),updated_at=now() where expires_at <= now() and used_at is null and cancelled_at is null"); await this.pool.query("update external_portal_sessions set revoked_at=now() where revoked_at is null and (expires_at <= now() or idle_expires_at <= now())");
  }

  async processJobs(): Promise<void> {
    const connection = await this.pool.connect();
    try {
      const lock = await connection.query("select pg_try_advisory_lock(8247331) locked"); if (!lock.rows[0].locked) return;
      try { await this.processSchedules(); await this.processOutbox(); } finally { await connection.query("select pg_advisory_unlock(8247331)"); }
    } finally { connection.release(); }
  }
}
