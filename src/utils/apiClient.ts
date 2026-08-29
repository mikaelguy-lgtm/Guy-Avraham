import { createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import {requireFrontendConfig} from "../config/frontend";
import type { AdminEmailLogRecord, AdvisorAdminRecord, BusinessCalendarExceptionRecord, Client, ClientList, ClientSubmission, CompanyResponse, CurrentUser, DeliveryBlocker, DeliveryCompany, DeliveryPreflight, DeliveryPreview, DocumentRecord, ExternalAccess, ExternalPortalCase, ExternalPortalDocument, ExternalReview, FinancingCompanyAdmin, IdentityRequest, Lender, MissingRequiredDocument, NotificationRecord } from "../types";
import type { AdvisorRegistrationInput } from "../domain/advisorRegistration";

const API_URL = requireFrontendConfig().apiBaseUrl;

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly requestId?: string,
    readonly fields: string[] = [],
    readonly fieldErrors: Record<string, string> = {},
    readonly accountCreated = false,
    readonly retryAfterSeconds?: number,
    readonly publicMessage?: string,
    readonly missingDocuments: MissingRequiredDocument[] = [],
    readonly blockers: DeliveryBlocker[] = []
  ) {
    super(code);
  }
}

async function parseError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({})) as {error?: string; message?: string; requestId?: string; fields?: string[]; fieldErrors?: Record<string, string>; accountCreated?: boolean; retryAfterSeconds?: number; missingDocuments?: MissingRequiredDocument[]; blockers?: DeliveryBlocker[]};
  return new ApiError(body.error || `HTTP_${response.status}`, response.status, body.requestId ?? response.headers.get("x-request-id") ?? undefined, body.fields ?? [], body.fieldErrors ?? {}, body.accountCreated === true, body.retryAfterSeconds, body.message, body.missingDocuments ?? [], body.blockers ?? []);
}

async function publicFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {"content-type": "application/json", ...(options.headers || {})}
  });
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type EmailProvider = "GMAIL" | "BREVO" | "CUSTOM";
export type EmailSecurityMode = "NONE" | "STARTTLS" | "TLS";
export type EmailConfigurationStatus = "DRAFT" | "TESTED" | "ACTIVE" | "FAILED" | "SUPERSEDED";
export interface EmailConfigurationView {
  id: number;
  provider: EmailProvider;
  status: EmailConfigurationStatus;
  host: string;
  port: number;
  securityMode: EmailSecurityMode;
  username: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  passwordConfigured: boolean;
  lastTestedAt: string | null;
  lastTestFailureCode: string | null;
  activatedAt: string | null;
  updatedAt: string;
}
export type EmailConfigurationBootstrap = Omit<EmailConfigurationView, "id" | "status" | "lastTestedAt" | "lastTestFailureCode" | "activatedAt" | "updatedAt">;
export interface EmailSettingsResponse {
  active: EmailConfigurationView | null;
  draft: EmailConfigurationView | null;
  history: EmailConfigurationView[];
  canRollback: boolean;
  bootstrap: EmailConfigurationBootstrap;
}

async function externalFetch<T>(path: string, options: RequestInit = {}, csrfToken?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("content-type", "application/json");
  if (csrfToken) headers.set("x-csrf-token", csrfToken);
  const response = await fetch(`${API_URL}${path}`, {...options, credentials: "include", headers});
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function externalBlob(path: string): Promise<Blob> {
  const response = await fetch(`${API_URL}${path}`, {credentials: "include"});
  if (!response.ok) throw await parseError(response);
  return response.blob();
}

export async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("AUTH_REQUIRED");
  const token = await user.getIdToken();
  const headers = new Headers(options.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (!(options.body instanceof FormData)) headers.set("content-type", "application/json");
  let response = await fetch(`${API_URL}${path}`, {...options, headers});
  if (response.status === 401) {
    headers.set("authorization", `Bearer ${await user.getIdToken(true)}`);
    response = await fetch(`${API_URL}${path}`, {...options, headers});
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function authBlob(path: string): Promise<Blob> {
  const user = auth.currentUser;
  if (!user) throw new Error("AUTH_REQUIRED");
  const response = await fetch(`${API_URL}${path}`, {headers: {authorization: `Bearer ${await user.getIdToken()}`}});
  if (!response.ok) throw await parseError(response);
  return response.blob();
}

export async function subscribeDeliveryEvents(signal: AbortSignal, onEvent: () => void): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const response = await fetch(`${API_URL}/api/delivery/events`, {headers: {authorization: `Bearer ${await user.getIdToken()}`}, signal});
  if (!response.ok || !response.body) throw await parseError(response);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (!signal.aborted) {
    const {done, value} = await reader.read();
    if (done) break;
    buffer += value;
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) if (frame.split("\n").some((line) => line.startsWith("data:"))) onEvent();
  }
}

export const api = {
  async login(email: string, password: string): Promise<CurrentUser> {
    await publicFetch<{allowed: true}>("/api/auth/login-attempt", {method: "POST"});
    await signInWithEmailAndPassword(auth, email, password);
    try { return await authFetch<CurrentUser>("/api/auth/me"); }
    catch (error) { await signOut(auth).catch(() => undefined); throw error; }
  },
  async registerAdvisor(input: AdvisorRegistrationInput & {password: string}): Promise<{success: true; verificationEmailSent: true}> {
    const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
    try {
      const {password: _password, ...registration} = input;
      void _password;
      return await authFetch<{success: true; verificationEmailSent: true}>("/api/auth/register-advisor", {method: "POST", body: JSON.stringify(registration)});
    } catch (error) {
      if (!(error instanceof ApiError && error.accountCreated)) await deleteUser(credential.user).catch(() => undefined);
      throw error;
    }
  },
  me: () => authFetch<CurrentUser>("/api/auth/me"),
  async refreshMe(): Promise<CurrentUser> {
    if (!auth.currentUser) throw new Error("AUTH_REQUIRED");
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    return authFetch<CurrentUser>("/api/auth/me");
  },
  emailVerificationStatus: () => authFetch<{email: string; emailVerified: boolean; status: "SENT" | "FAILED" | "NOT_SENT"; lastSentAt: string | null}>("/api/auth/email-verification/status"),
  resendEmailVerification: () => authFetch<{success: true; verificationEmailSent: true; lastSentAt: string}>("/api/auth/email-verification/resend", {method: "POST"}),
  logout: () => signOut(auth),
  clients: (search = "") => authFetch<ClientList>(`/api/clients?pageSize=100&search=${encodeURIComponent(search)}`),
  client: (id: number) => authFetch<Client>(`/api/clients/${id}`),
  createClient: (data: Record<string, unknown>) => authFetch<Client>("/api/clients", {method: "POST", body: JSON.stringify(data)}),
  updateClient: (id: number, data: Record<string, unknown>) => authFetch<Client>(`/api/clients/${id}`, {method: "PATCH", body: JSON.stringify(data)}),
  updateClientPersonal: (id: number, data: Record<string, unknown>) => authFetch<Client>(`/api/clients/${id}/personal`, {method: "PATCH", body: JSON.stringify(data)}),
  updateClientIncome: (id: number, data: Record<string, unknown>) => authFetch<Client>(`/api/clients/${id}/income`, {method: "PATCH", body: JSON.stringify(data)}),
  updateClientLiabilities: (id: number, data: Record<string, unknown>) => authFetch<Client>(`/api/clients/${id}/liabilities`, {method: "PATCH", body: JSON.stringify(data)}),
  updateClientCreditIndication: (id: number, data: Record<string, unknown>) => authFetch<Client>(`/api/clients/${id}/credit-indication`, {method: "PATCH", body: JSON.stringify(data)}),
  updateClientProperty: (id: number, data: Record<string, unknown>) => authFetch<Client>(`/api/clients/${id}/property`, {method: "PATCH", body: JSON.stringify(data)}),
  updateClientDealDetails: (id: number, data: Record<string, unknown>) => authFetch<Client>(`/api/clients/${id}/deal-details`, {method: "PATCH", body: JSON.stringify(data)}),
  deleteClient: (id: number) => authFetch<void>(`/api/clients/${id}`, {method: "DELETE"}),
  documents: (clientId: number) => authFetch<DocumentRecord[]>(`/api/clients/${clientId}/documents`),
  uploadDocument: (clientId: number, file: File, documentType: string, metadata: {borrowerId?: number | null; customTitle?: string; description?: string} = {}) => {
    const body = new FormData(); body.append("file", file); body.append("documentType", documentType);
    if (metadata.borrowerId) body.append("borrowerId", String(metadata.borrowerId));
    if (metadata.customTitle) body.append("customTitle", metadata.customTitle);
    if (metadata.description) body.append("description", metadata.description);
    return authFetch<DocumentRecord>(`/api/clients/${clientId}/documents`, {method: "POST", body});
  },
  documentRequirements: (clientId: number) => authFetch<{missingDocuments: MissingRequiredDocument[]}>(`/api/clients/${clientId}/documents/requirements`),
  downloadDocument: (documentId: number) => authBlob(`/api/documents/${documentId}/download`),
  deleteDocument: (documentId: number) => authFetch<void>(`/api/documents/${documentId}`, {method: "DELETE"}),
  lenders: () => authFetch<Lender[]>("/api/lenders"),
  submissions: (clientId: number) => authFetch<ClientSubmission[]>(`/api/clients/${clientId}/submissions`),
  submit: (clientId: number, lenderIds: number[]) => authFetch<{results: Array<{lenderId: number; status: string}>}>(`/api/clients/${clientId}/submissions`, {method: "POST", body: JSON.stringify({lenderIds})}),
  identityRequests: () => authFetch<IdentityRequest[]>("/api/advisor/identity-requests"),
  decideIdentity: (id: number, approve: boolean, approvedFields: string[], approvedDocumentIds: number[]) => authFetch(`/api/advisor/identity-requests/${id}/${approve ? "approve" : "reject"}`, {method: "POST", body: JSON.stringify({approvedFields, approvedDocumentIds})}),
  validateInvite: (token: string) => publicFetch<{lenderName: string; requiresAuthentication: boolean}>("/api/lender/invites/validate", {method: "POST", body: JSON.stringify({token})}),
  consumeInvite: (token: string) => authFetch<{submissionId: number}>("/api/lender/invites/consume", {method: "POST", body: JSON.stringify({token})}),
  lenderSubmission: (id: number) => authFetch<{id: number; status: string; anonymousSnapshot: Record<string, unknown>}>(`/api/lender/submissions/${id}`),
  lenderSubmissions: () => authFetch<Array<{id: number; status: string; anonymousSnapshot: Record<string, unknown>}>>("/api/lender/submissions"),
  lenderReply: (id: number, responseType: string, message: string) => authFetch(`/api/lender/submissions/${id}/reply`, {method: "POST", body: JSON.stringify({responseType, message})}),
  identityRequest: (id: number, reason: string, requestedFields: string[]) => authFetch(`/api/lender/submissions/${id}/identity-request`, {method: "POST", body: JSON.stringify({reason, requestedFields})}),
  revealedData: (id: number) => authFetch<{approvedFields: string[]; approvedDocumentIds: number[]; data: Record<string, string>}>(`/api/lender/submissions/${id}/revealed-data`),
  analyze: (clientId: number, question: string) => authFetch<{answer: string}>(`/api/clients/${clientId}/analysis`, {method: "POST", body: JSON.stringify({question})}),
  smtpSettings: () => authFetch<EmailSettingsResponse>("/api/admin/settings/email"),
  emailDeliveryStatus: () => authFetch<{active: boolean}>("/api/email/status"),
  updateSmtpSettings: (settings: Record<string, unknown>) => authFetch<{draft: EmailConfigurationView}>("/api/admin/settings/email", {method: "PATCH", body: JSON.stringify(settings)}),
  clearSmtpPassword: (configurationId: number) => authFetch<{draft: EmailConfigurationView}>(`/api/admin/settings/email/${configurationId}/password`, {method: "DELETE"}),
  testSmtp: (configurationId: number, recipientEmail: string) => authFetch<{messageId: string; draft: EmailConfigurationView}>(`/api/admin/settings/email/${configurationId}/test`, {method: "POST", body: JSON.stringify({recipientEmail})}),
  activateSmtp: (configurationId: number) => authFetch<{active: EmailConfigurationView}>(`/api/admin/settings/email/${configurationId}/activate`, {method: "POST"}),
  rollbackSmtp: () => authFetch<{active: EmailConfigurationView}>("/api/admin/settings/email/rollback", {method: "POST"}),
  notifications: () => authFetch<NotificationRecord[]>("/api/notifications"),
  markNotificationRead: (id: number) => authFetch(`/api/notifications/${id}/read`, {method: "PATCH"}),
  markAllNotificationsRead: () => authFetch<{read: true; count: number}>("/api/notifications/read-all", {method: "PATCH"}),
  updateAdvisorProfile: (values: {firstName: string; lastName: string; phone: string; businessName: string}) => authFetch<CurrentUser>("/api/advisor/profile", {method: "PATCH", body: JSON.stringify(values)}),
  adminAdvisors: () => authFetch<AdvisorAdminRecord[]>("/api/admin/advisors"),
  adminEmailLogs: () => authFetch<AdminEmailLogRecord[]>("/api/admin/email-logs"),
  updateAdvisorStatus: (id: number, status: "ACTIVE" | "SUSPENDED" | "DISABLED") => authFetch<AdvisorAdminRecord>(`/api/admin/advisors/${id}/status`, {method: "PATCH", body: JSON.stringify({status})}),
  adminResendAdvisorVerification: (id: number) => authFetch<{success: true; verificationEmailSent: true}>(`/api/admin/advisors/${id}/resend-verification`, {method: "POST"}),
  deliveryCompanies: (clientId: number) => authFetch<DeliveryCompany[]>(`/api/advisor/financing-companies?clientId=${clientId}`),
  deliveryPreflight: (clientId: number) => authFetch<DeliveryPreflight>(`/api/clients/${clientId}/delivery/preflight`),
  deliveryPreview: (clientId: number) => authFetch<DeliveryPreview>(`/api/clients/${clientId}/delivery/preview`, {method: "POST", body: JSON.stringify({})}),
  deliverySend: (clientId: number, values: {idempotencyKey: string; previewConfirmation: string}) => authFetch<Record<string, unknown>>(`/api/clients/${clientId}/delivery/send`, {method: "POST", body: JSON.stringify(values)}),
  companyResponses: (clientId: number) => authFetch<CompanyResponse[]>(`/api/clients/${clientId}/company-responses`),
  companyResponse: (clientId: number, publicId: string) => authFetch<CompanyResponse>(`/api/clients/${clientId}/company-responses/${encodeURIComponent(publicId)}`),
  adminFinancingCompanies: () => authFetch<FinancingCompanyAdmin[]>("/api/admin/financing-companies"),
  createFinancingCompany: (values: Record<string, unknown>) => authFetch<FinancingCompanyAdmin>("/api/admin/financing-companies", {method: "POST", body: JSON.stringify(values)}),
  updateFinancingCompany: (id: number, values: Record<string, unknown>) => authFetch<FinancingCompanyAdmin>(`/api/admin/financing-companies/${id}`, {method: "PATCH", body: JSON.stringify(values)}),
  deleteFinancingCompany: (id: number) => authFetch<void>(`/api/admin/financing-companies/${id}`, {method: "DELETE"}),
  uploadFinancingCompanyLogo: (id: number, file: File) => {const body = new FormData(); body.append("file", file); return authFetch<FinancingCompanyAdmin>(`/api/admin/financing-companies/${id}/logo`, {method: "POST", body});},
  createFinancingContact: (companyId: number, values: Record<string, unknown>) => authFetch(`/api/admin/financing-companies/${companyId}/contacts`, {method: "POST", body: JSON.stringify(values)}),
  updateFinancingContact: (companyId: number, contactId: number, values: Record<string, unknown>) => authFetch(`/api/admin/financing-companies/${companyId}/contacts/${contactId}`, {method: "PATCH", body: JSON.stringify(values)}),
  deleteFinancingContact: (companyId: number, contactId: number) => authFetch<void>(`/api/admin/financing-companies/${companyId}/contacts/${contactId}`, {method: "DELETE"}),
  businessCalendar: () => authFetch<BusinessCalendarExceptionRecord[]>("/api/admin/business-calendar"),
  createBusinessCalendarException: (values: Record<string, unknown>) => authFetch<BusinessCalendarExceptionRecord>("/api/admin/business-calendar", {method: "POST", body: JSON.stringify(values)}),
  updateBusinessCalendarException: (id: number, values: Record<string, unknown>) => authFetch<BusinessCalendarExceptionRecord>(`/api/admin/business-calendar/${id}`, {method: "PATCH", body: JSON.stringify(values)}),
  deleteBusinessCalendarException: (id: number) => authFetch<void>(`/api/admin/business-calendar/${id}`, {method: "DELETE"}),
  adminCompanySubmissions: () => authFetch<CompanyResponse[]>("/api/admin/company-submissions"),
  adminCompanySubmission: (publicId: string) => authFetch<CompanyResponse>(`/api/admin/company-submissions/${encodeURIComponent(publicId)}`),
  adminCompanySubmissionPdf: (publicId: string, kind: "masked-pdf" | "full-pdf") => authBlob(`/api/admin/company-submissions/${encodeURIComponent(publicId)}/${kind}`),
  adminCompanySubmissionAction: (publicId: string, action: string, values: Record<string, unknown> = {}) => authFetch<CompanyResponse>(`/api/admin/company-submissions/${encodeURIComponent(publicId)}/${action}`, {method: "POST", body: JSON.stringify(values)}),
  externalReview: (token: string) => externalFetch<ExternalReview>(`/api/external/review/${encodeURIComponent(token)}`),
  externalMaskedPdf: (token: string, download = false) => externalBlob(`/api/external/review/${encodeURIComponent(token)}/masked-pdf${download ? "?download=1" : ""}`),
  externalNotInterested: (token: string, csrfToken: string) => externalFetch<{decisionStatus: string}>(`/api/external/review/${encodeURIComponent(token)}/not-interested`, {method: "POST", body: "{}"}, csrfToken),
  externalStartInterest: (token: string, csrfToken: string) => externalFetch<{status: "SMTP_ACCEPTED" | "QUEUED"; expiresAt: string; recipientMasked: string; lastSentAt: string; resendAvailableAt: string; attemptsRemaining: number}>(`/api/external/review/${encodeURIComponent(token)}/interested/start`, {method: "POST", body: "{}"}, csrfToken),
  externalResendInterest: (token: string, csrfToken: string) => externalFetch<{status: "SMTP_ACCEPTED" | "QUEUED"; expiresAt: string; recipientMasked: string; lastSentAt: string; resendAvailableAt: string; attemptsRemaining: number}>(`/api/external/review/${encodeURIComponent(token)}/interested/resend-code`, {method: "POST", body: "{}"}, csrfToken),
  externalVerifyInterest: (token: string, code: string, csrfToken: string) => externalFetch<{authenticated: true; decisionStatus: string; accessStatus: string; fullAccessExpiresAt: string; expiresAt: string}>(`/api/external/review/${encodeURIComponent(token)}/interested/verify`, {method: "POST", body: JSON.stringify({code})}, csrfToken),
  externalAccess: (token: string) => externalFetch<ExternalAccess>(`/api/external/access/${encodeURIComponent(token)}`),
  externalSendAccessCode: (token: string, csrfToken: string) => externalFetch<{status: "SMTP_ACCEPTED" | "QUEUED"; expiresAt: string; recipientMasked: string; lastSentAt: string; resendAvailableAt: string; attemptsRemaining: number}>(`/api/external/access/${encodeURIComponent(token)}/send-code`, {method: "POST", body: "{}"}, csrfToken),
  externalVerifyAccessCode: (token: string, code: string, csrfToken: string) => externalFetch<{authenticated: true; expiresAt: string}>(`/api/external/access/${encodeURIComponent(token)}/verify-code`, {method: "POST", body: JSON.stringify({code})}, csrfToken),
  externalPortalCase: () => externalFetch<ExternalPortalCase>("/api/external/portal/case"),
  externalPortalDocuments: () => externalFetch<ExternalPortalDocument[]>("/api/external/portal/documents"),
  externalPortalPdf: () => externalBlob("/api/external/portal/full-pdf"),
  externalPortalDocument: (publicId: string, download = false) => externalBlob(`/api/external/portal/documents/${encodeURIComponent(publicId)}/${download ? "download" : "view"}`),
  externalPortalZip: () => externalBlob("/api/external/portal/download-all"),
  externalPortalLogout: (csrfToken: string) => externalFetch<void>("/api/external/portal/logout", {method: "POST", body: "{}"}, csrfToken),
  testEmailLogs: (recipient: string) => authFetch<Array<{recipient: string; template: string | null; messageId: string | null; status: string; sentAt: string | null; failedAt: string | null; requestId: string | null}>>(`/api/test/email-logs?recipient=${encodeURIComponent(recipient)}`)
};
