import type { AppEnv } from "../../src/config/env";
import type { DatabaseUser } from "../../src/domain/types";
import type { TokenVerifier } from "../../src/middleware/auth";
import type { RateLimitStore } from "../../src/services/rateLimiter";
import type { AppStore } from "../../src/services/store";
import type { StorageService, StoredObject } from "../../src/services/storage";
import { EncryptionService } from "../../src/utils/crypto";
import { InMemorySecretProvider } from "../../src/utils/secretManager";

export const env: AppEnv = {
  NODE_ENV: "test", APP_URL: "http://localhost:5173", API_URL: "http://localhost:3000", ALLOWED_ORIGINS: "http://localhost:5173",
  DATABASE_URL: "postgresql://unused", REDIS_URL: "redis://unused", FIREBASE_PROJECT_ID: "", FIREBASE_CLIENT_EMAIL: "",
  FIREBASE_PRIVATE_KEY: "", FIREBASE_AUTH_EMULATOR_HOST: "", SECRET_PROVIDER: "environment", GOOGLE_CLOUD_PROJECT: "", LOCAL_SECRET_STORE_PATH: "", LOCAL_SECRET_MASTER_KEY: "", FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 4).toString("base64"),
  S3_ENDPOINT: "http://minio:9000", S3_REGION: "us-east-1", S3_BUCKET: "syncash-documents", S3_ACCESS_KEY_ID: "test",
  S3_SECRET_KEY: "test-secret", S3_FORCE_PATH_STYLE: true, SMTP_HOST: "mailpit", SMTP_PORT: 1025, SMTP_SECURE: false,
  SMTP_USER: "", SMTP_PASSWORD: "", EMAIL_FROM: "no-reply@syncash.local", EMAIL_FROM_NAME: "SynCash",
  EMAIL_REPLY_TO: "support@syncash.local", GEMINI_API_KEY: "", GEMINI_MODEL: "test-model", MAX_UPLOAD_SIZE_MB: 15,
  LENDER_INVITE_EXPIRY_HOURS: 72, PASSWORD_RESET_EXPIRY_MINUTES: 30
};

export const users: Record<string, DatabaseUser> = {
  advisor: {id: 1, firebaseUid: "advisor", email: "advisor@test", firstName: "A", lastName: "One", role: "ADVISOR", roleLabel: "Advisor", status: "ACTIVE", emailVerified: true, deletedAt: null, advisorId: 10, lenderId: null},
  advisor2: {id: 2, firebaseUid: "advisor2", email: "advisor2@test", firstName: "A", lastName: "Two", role: "ADVISOR", roleLabel: "Advisor", status: "ACTIVE", emailVerified: true, deletedAt: null, advisorId: 20, lenderId: null},
  suspended: {id: 3, firebaseUid: "suspended", email: "suspended@test", firstName: "S", lastName: "User", role: "ADVISOR", roleLabel: "Advisor", status: "SUSPENDED", emailVerified: true, deletedAt: null, advisorId: 10, lenderId: null},
  admin: {id: 4, firebaseUid: "admin", email: "admin@test", firstName: "Admin", lastName: "User", role: "ADMIN", roleLabel: "Admin", status: "ACTIVE", emailVerified: true, deletedAt: null, advisorId: null, lenderId: null},
  super: {id: 5, firebaseUid: "super", email: "super@test", firstName: "Super", lastName: "Admin", role: "SUPER_ADMIN", roleLabel: "Super Admin", status: "ACTIVE", emailVerified: true, deletedAt: null, advisorId: null, lenderId: null},
  lender: {id: 6, firebaseUid: "lender", email: "lender@test", firstName: "L", lastName: "One", role: "LENDER_UNDERWRITER", roleLabel: "Underwriter", status: "ACTIVE", emailVerified: true, deletedAt: null, advisorId: null, lenderId: 100},
  lender2: {id: 7, firebaseUid: "lender2", email: "lender2@test", firstName: "L", lastName: "Two", role: "LENDER_UNDERWRITER", roleLabel: "Underwriter", status: "ACTIVE", emailVerified: true, deletedAt: null, advisorId: null, lenderId: 200},
  pending: {id: 8, firebaseUid: "pending", email: "pending@test", firstName: "Pending", lastName: "Advisor", role: "ADVISOR", roleLabel: "Advisor", status: "PENDING", emailVerified: false, deletedAt: null, advisorId: 30, lenderId: null}
};

export const verifier: TokenVerifier = {verify: async (token) => {
  if (token === "invalid") throw new Error("invalid");
  if (token === "new-advisor") return {uid: "new-advisor-uid", email: "new-advisor@example.com", emailVerified: false};
  if (token === "duplicate-email") return {uid: "unique-registration-uid", email: "registered@example.com", emailVerified: false};
  if (token === "duplicate-uid") return {uid: "advisor", email: "fresh@example.com", emailVerified: false};
  if (token === "pending-verified") return {uid: "pending", email: "pending@test", emailVerified: true};
  return {uid: token, email: users[token]?.email, emailVerified: users[token]?.emailVerified ?? false};
}};

export function makeStore(overrides: Partial<AppStore> = {}): AppStore {
  const encryption = new EncryptionService(Buffer.alloc(32, 4));
  const defaults: Partial<AppStore> = {
    findUserByFirebaseUid: async (uid) => users[uid] ?? null,
    findUserByEmail: async (email) => Object.values(users).find((user) => user.email === email) ?? null,
    recordLogin: async () => undefined,
    getAdvisorAccount: async (userId) => {
      const user = Object.values(users).find((candidate) => candidate.id === userId && candidate.role === "ADVISOR");
      return user ? {...user, phoneEncrypted: encryption.encrypt("+972501234567"), businessName: "Test Business", businessPhoneEncrypted: encryption.encrypt("+972501234567"), businessEmail: user.email, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: null} : null;
    },
    activateVerifiedAdvisor: async (userId) => {
      const user = Object.values(users).find((candidate) => candidate.id === userId && candidate.role === "ADVISOR");
      return user ? {...user, status: "ACTIVE", emailVerified: true, phoneEncrypted: encryption.encrypt("+972501234567"), businessName: "Test Business", businessPhoneEncrypted: encryption.encrypt("+972501234567"), businessEmail: user.email, createdAt: new Date(), updatedAt: new Date(), lastLoginAt: new Date()} : null;
    },
    getClientAdvisorId: async (id) => id === 1 ? 10 : id === 2 ? 20 : null,
    getClient: async (id) => id === 1 ? {id: 1, publicCaseNumber: "SC-1", advisorId: 10, status: "ACTIVE", firstNameEncrypted: encryption.encrypt("Dana"), lastNameEncrypted: encryption.encrypt("Levi"), identityNumberEncrypted: encryption.encrypt("123456789"), phoneEncrypted: encryption.encrypt("0500000000"), emailEncrypted: encryption.encrypt("dana@example.com"), addressEncrypted: encryption.encrypt("Street 1"), notesEncrypted: encryption.encrypt("Professional notes"), maritalStatus: "MARRIED", numberOfChildren: 2, childrenAges: [4, 8], borrowerCount: 2, deletedAt: null, createdAt: new Date(), updatedAt: new Date()} : null,
    getClientDetails: async (id) => id === 1 ? {birthDate: new Date("1985-06-15"), employmentType: "SALARIED", employerNameEncrypted: encryption.encrypt("Employer"), jobTitle: "Manager", employmentStartDate: new Date("2020-01-01"), monthlyNetIncome: 30000, hasAdditionalIncome: true, additionalIncomeType: "RENTAL_INCOME", additionalIncomeAmount: 5000, additionalIncomeDescriptionEncrypted: null, monthlyLiabilities: 2000, existingMortgageMonthlyPayment: 3000, dealType: "SECOND_HAND_PURCHASE", propertyType: "APARTMENT", propertyTypeOtherDescriptionEncrypted: null, propertyRegion: "CENTER", propertyCity: "Tel Aviv", propertyAddressEncrypted: encryption.encrypt("Street 1"), propertyValue: 2000000, existingMortgageBalance: 400000, requestedAmount: 1000000, requestedTermMonths: 240, financingPercentage: 50, latestSubmissionStatus: null, offerCount: 0} : null,
    listClientSubmissions: async () => [],
    getSubmissionAccess: async (id) => id === 1 ? {id: 1, lenderId: 100, clientId: 1, anonymousSnapshot: {publicCaseNumber: "SC-1"}} : null,
    getLenderSubmission: async (id) => id === 1 ? {id: 1, lenderId: 100, clientId: 1, status: "SENT", anonymousSnapshot: {publicCaseNumber: "SC-1", dealType: "SECOND_HAND_PURCHASE", propertyType: "APARTMENT", propertyRegion: "CENTER", propertyValue: 2_000_000, requestedAmount: 1_000_000, financingPercentage: 50, employmentType: "SALARIED", totalMonthlyIncome: 35_000, totalMonthlyPayments: 5_000, existingMortgageBalance: 400_000, requestedTermMonths: 240}} : null,
    createLenderResponse: async () => ({id: 1}),
    createIdentityRequest: async () => ({id: 1}),
    createOffer: async () => ({id: 1}),
    notifyAdvisor: async () => undefined,
    addAudit: async () => undefined,
    getSettings: async () => [],
    setSettings: async () => undefined,
    addEmailLog: async () => undefined,
    getLatestEmailLog: async () => null,
    listEmailLogs: async () => [],
    getDocument: async (id) => id === 1 ? {id: 1, clientId: 1, storageKey: "doc", originalFileName: "doc.pdf", documentType: "FINANCIAL", mimeType: "application/pdf", sizeBytes: 10, checksumSha256: "a".repeat(64), status: "UPLOADED", deletedAt: null} : null,
    createDocument: async (values) => ({id: 1, ...values, status: "UPLOADED", deletedAt: null}),
    getRevealedData: async () => null
  };
  const values = {...defaults, ...overrides} as Record<string, unknown>;
  return new Proxy(values, {get(target, property) {
    if (property in target) return target[property as string];
    return async () => { throw new Error(`Unexpected store call: ${String(property)}`); };
  }}) as unknown as AppStore;
}

export class MemoryStorage implements StorageService {
  values = new Map<string, StoredObject>();
  async initialize() {}
  async put(key: string, body: Buffer, contentType: string) { this.values.set(key, {body, contentType}); }
  async get(key: string) { return this.values.get(key) ?? {body: Buffer.from("%PDF-test"), contentType: "application/pdf"}; }
  async signedDownloadUrl(key: string) { return `memory://${key}`; }
  async delete(key: string) { this.values.delete(key); }
}

export class MemoryLimiter implements RateLimitStore {
  private counts = new Map<string, number>();
  async increment(key: string) { const value = (this.counts.get(key) ?? 0) + 1; this.counts.set(key, value); return value; }
}

export const secrets = new InMemorySecretProvider({"syncash-smtp-password": "configured"});
