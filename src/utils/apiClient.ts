import { createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import type { AdvisorAdminRecord, Client, ClientList, ClientSubmission, CurrentUser, DocumentRecord, IdentityRequest, Lender, LoanOffer, NotificationRecord } from "../types";
import type { AdvisorRegistrationInput } from "../domain/advisorRegistration";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly requestId?: string,
    readonly fields: string[] = [],
    readonly fieldErrors: Record<string, string> = {},
    readonly accountCreated = false,
    readonly retryAfterSeconds?: number,
    readonly publicMessage?: string
  ) {
    super(code);
  }
}

async function parseError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({})) as {error?: string; message?: string; requestId?: string; fields?: string[]; fieldErrors?: Record<string, string>; accountCreated?: boolean; retryAfterSeconds?: number};
  return new ApiError(body.error || `HTTP_${response.status}`, response.status, body.requestId ?? response.headers.get("x-request-id") ?? undefined, body.fields ?? [], body.fieldErrors ?? {}, body.accountCreated === true, body.retryAfterSeconds, body.message);
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

export const api = {
  async login(email: string, password: string): Promise<CurrentUser> {
    await publicFetch<{allowed: true}>("/api/auth/login-attempt", {method: "POST"});
    await signInWithEmailAndPassword(auth, email, password);
    return authFetch<CurrentUser>("/api/auth/me");
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
  deleteClient: (id: number) => authFetch<void>(`/api/clients/${id}`, {method: "DELETE"}),
  documents: (clientId: number) => authFetch<DocumentRecord[]>(`/api/clients/${clientId}/documents`),
  uploadDocument: (clientId: number, file: File, documentType: string) => {
    const body = new FormData(); body.append("file", file); body.append("documentType", documentType);
    return authFetch<DocumentRecord>(`/api/clients/${clientId}/documents`, {method: "POST", body});
  },
  downloadDocument: (documentId: number) => authBlob(`/api/documents/${documentId}/download`),
  deleteDocument: (documentId: number) => authFetch<void>(`/api/documents/${documentId}`, {method: "DELETE"}),
  lenders: () => authFetch<Lender[]>("/api/lenders"),
  submissions: (clientId: number) => authFetch<ClientSubmission[]>(`/api/clients/${clientId}/submissions`),
  submit: (clientId: number, lenderIds: number[]) => authFetch<{results: Array<{lenderId: number; status: string}>}>(`/api/clients/${clientId}/submissions`, {method: "POST", body: JSON.stringify({lenderIds})}),
  offers: (clientId: number) => authFetch<LoanOffer[]>(`/api/clients/${clientId}/offers`),
  identityRequests: () => authFetch<IdentityRequest[]>("/api/advisor/identity-requests"),
  decideIdentity: (id: number, approve: boolean, approvedFields: string[], approvedDocumentIds: number[]) => authFetch(`/api/advisor/identity-requests/${id}/${approve ? "approve" : "reject"}`, {method: "POST", body: JSON.stringify({approvedFields, approvedDocumentIds})}),
  validateInvite: (token: string) => publicFetch<{lenderName: string; requiresAuthentication: boolean}>("/api/lender/invites/validate", {method: "POST", body: JSON.stringify({token})}),
  consumeInvite: (token: string) => authFetch<{submissionId: number}>("/api/lender/invites/consume", {method: "POST", body: JSON.stringify({token})}),
  lenderSubmission: (id: number) => authFetch<{id: number; status: string; anonymousSnapshot: Record<string, unknown>}>(`/api/lender/submissions/${id}`),
  lenderSubmissions: () => authFetch<Array<{id: number; status: string; anonymousSnapshot: Record<string, unknown>}>>("/api/lender/submissions"),
  lenderReply: (id: number, responseType: string, message: string) => authFetch(`/api/lender/submissions/${id}/reply`, {method: "POST", body: JSON.stringify({responseType, message})}),
  identityRequest: (id: number, reason: string, requestedFields: string[]) => authFetch(`/api/lender/submissions/${id}/identity-request`, {method: "POST", body: JSON.stringify({reason, requestedFields})}),
  revealedData: (id: number) => authFetch<{approvedFields: string[]; approvedDocumentIds: number[]; data: Record<string, string>}>(`/api/lender/submissions/${id}/revealed-data`),
  createOffer: (id: number, offer: Record<string, unknown>) => authFetch(`/api/lender/submissions/${id}/offers`, {method: "POST", body: JSON.stringify(offer)}),
  analyze: (clientId: number, question: string) => authFetch<{answer: string}>(`/api/clients/${clientId}/analysis`, {method: "POST", body: JSON.stringify({question})}),
  smtpSettings: () => authFetch<Record<string, string | boolean | null>>("/api/admin/settings/email"),
  updateSmtpSettings: (settings: Record<string, string>) => authFetch<{updated: boolean; passwordConfigured: boolean}>("/api/admin/settings/email", {method: "PATCH", body: JSON.stringify(settings)}),
  testSmtp: (recipientEmail?: string) => authFetch<{messageId: string}>("/api/admin/settings/email/test", {method: "POST", body: JSON.stringify({recipientEmail})}),
  notifications: () => authFetch<NotificationRecord[]>("/api/notifications"),
  markNotificationRead: (id: number) => authFetch(`/api/notifications/${id}/read`, {method: "PATCH"}),
  updateAdvisorProfile: (values: {firstName: string; lastName: string; phone: string; businessName: string}) => authFetch<CurrentUser>("/api/advisor/profile", {method: "PATCH", body: JSON.stringify(values)}),
  adminAdvisors: () => authFetch<AdvisorAdminRecord[]>("/api/admin/advisors"),
  updateAdvisorStatus: (id: number, status: "ACTIVE" | "SUSPENDED" | "DISABLED") => authFetch<AdvisorAdminRecord>(`/api/admin/advisors/${id}/status`, {method: "PATCH", body: JSON.stringify({status})}),
  adminResendAdvisorVerification: (id: number) => authFetch<{success: true; verificationEmailSent: true}>(`/api/admin/advisors/${id}/resend-verification`, {method: "POST"}),
  testEmailLogs: (recipient: string) => authFetch<Array<{recipient: string; template: string | null; messageId: string | null; status: string; sentAt: string | null; failedAt: string | null; requestId: string | null}>>(`/api/test/email-logs?recipient=${encodeURIComponent(recipient)}`)
};
