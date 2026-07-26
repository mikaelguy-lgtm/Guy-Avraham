import request from "supertest";
import {describe, expect, it, vi} from "vitest";
import {createApp} from "../../src/server/app";
import type {LenderDeliveryApplication} from "../../src/services/lenderDelivery";
import {AdvisorEmailVerificationService} from "../../src/services/emailVerification";
import {EncryptionService} from "../../src/utils/crypto";
import {env, makeStore, MemoryLimiter, MemoryStorage, secrets, verifier} from "../helpers/fakes";

function fakeDelivery(overrides: Partial<LenderDeliveryApplication> = {}): LenderDeliveryApplication {
  const defaults: Partial<LenderDeliveryApplication> = {
    listAdvisorCompanies: vi.fn().mockResolvedValue([{id: 7, name: "מימון בטוח", activeContactCount: 2, activityAreas: [], logoUrl: null, lastSentAt: null, alreadySentCurrentVersion: false}]),
    preview: vi.fn().mockResolvedValue({maskedSnapshot: {publicCaseNumber: "SC-1"}, maskedPdfBase64: "JVBERg==", companies: [], selectedCompanyCount: 1, selectedContactCount: 2, responseDeadlineAt: new Date().toISOString(), previewConfirmation: "signed-preview"}),
    send: vi.fn().mockResolvedValue({batchId: "batch-public", companies: []}),
    listClientResponses: vi.fn().mockResolvedValue([]), getClientResponse: vi.fn().mockResolvedValue({publicId: "submission-public", timeline: []}),
    listCompaniesForAdmin: vi.fn().mockResolvedValue([]), createCompany: vi.fn().mockResolvedValue({id: 1}), updateCompany: vi.fn(), deleteCompany: vi.fn(), createContact: vi.fn(), updateContact: vi.fn(), deleteContact: vi.fn(),
    listCalendar: vi.fn().mockResolvedValue([]), createCalendarException: vi.fn(), updateCalendarException: vi.fn(), deleteCalendarException: vi.fn(), listAdminSubmissions: vi.fn().mockResolvedValue([]), getAdminSubmission: vi.fn(), getAdminPdf: vi.fn().mockResolvedValue({body: Buffer.from("%PDF-secure"), filename: "תיק-מימון-מוסווה.pdf"}), adminAction: vi.fn(),
    getReview: vi.fn().mockResolvedValue({companyName: "מימון בטוח", publicCaseNumber: "SC-MASKED", versionNumber: 1, maskedSnapshot: {borrowers: [{label: "לווה 1"}]}, closed: false}),
    getMaskedPdf: vi.fn().mockResolvedValue({body: Buffer.from("%PDF-test"), filename: "תיק-מוסווה.pdf"}), decideNotInterested: vi.fn().mockResolvedValue({decisionStatus: "NOT_INTERESTED"}), startInterest: vi.fn(), resendInterestCode: vi.fn(), verifyInterest: vi.fn(),
    getAccess: vi.fn().mockResolvedValue({companyName: "מימון בטוח", publicCaseNumber: "SC-MASKED", versionNumber: 1, expiresAt: new Date().toISOString(), requiresOtp: true}), sendAccessCode: vi.fn(), verifyAccessCode: vi.fn(), getPortalCase: vi.fn(), getPortalPdf: vi.fn(), listPortalDocuments: vi.fn(), getPortalDocument: vi.fn(), getPortalZip: vi.fn(), logoutPortal: vi.fn(), processJobs: vi.fn()
  };
  return {...defaults, ...overrides} as LenderDeliveryApplication;
}

function application(delivery = fakeDelivery()) {
  const email = {send: vi.fn(), verify: vi.fn(), test: vi.fn(), reload: vi.fn()} as never;
  const store = makeStore();
  return createApp({env, store, verifier, encryption: new EncryptionService(Buffer.alloc(32, 4)), storage: new MemoryStorage(), limiter: new MemoryLimiter(), secrets, email, emailVerification: new AdvisorEmailVerificationService({createVerificationLink: vi.fn()}, email, store), gemini: {analyze: vi.fn()} as never, firebaseAccounts: {deleteUser: vi.fn()}, delivery});
}

describe("secure lender delivery API", () => {
  it("allows only the owning advisor to list companies and preview a delivery", async () => {
    await request(application()).get("/api/advisor/financing-companies?clientId=1").set("authorization", "Bearer advisor").expect(200);
    await request(application()).post("/api/clients/1/delivery/preview").set("authorization", "Bearer advisor").send({companyIds: [7]}).expect(200);
    await request(application()).get("/api/advisor/financing-companies?clientId=1").set("authorization", "Bearer admin").expect(403);
    await request(application()).post("/api/clients/1/delivery/preview").set("authorization", "Bearer advisor2").send({companyIds: [7]}).expect(403);
  });

  it("allows admins and blocks advisors from financing-company administration", async () => {
    await request(application()).get("/api/admin/financing-companies").set("authorization", "Bearer admin").expect(200);
    await request(application()).get("/api/admin/financing-companies").set("authorization", "Bearer super").expect(200);
    await request(application()).get("/api/admin/financing-companies").set("authorization", "Bearer advisor").expect(403);
  });

  it("streams immutable delivery PDFs only to authenticated admins", async () => {
    const delivery = fakeDelivery(); const app = application(delivery);
    await request(app).get("/api/admin/company-submissions/submission-public/masked-pdf").set("authorization", "Bearer admin").expect("content-type", /application\/pdf/).expect(200);
    await request(app).get("/api/admin/company-submissions/submission-public/full-pdf").set("authorization", "Bearer super").expect("content-type", /application\/pdf/).expect(200);
    await request(app).get("/api/admin/company-submissions/submission-public/full-pdf").set("authorization", "Bearer advisor").expect(403);
    expect(delivery.getAdminPdf).toHaveBeenCalledTimes(2);
  });

  it("returns a masked public review without authentication or internal identifiers", async () => {
    const response = await request(application()).get("/api/external/review/personal-token").expect(200);
    expect(response.body).toEqual(expect.objectContaining({companyName: "מימון בטוח", publicCaseNumber: "SC-MASKED", csrfToken: expect.any(String)}));
    expect(JSON.stringify(response.body)).not.toMatch(/clientId|companyId|contactId|tokenHash|identityNumber/i);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.headers["x-robots-tag"]).toContain("noindex");
  });

  it("requires double-submit CSRF for a public decision", async () => {
    const delivery = fakeDelivery(); const app = application(delivery);
    await request(app).post("/api/external/review/personal-token/not-interested").send({}).expect(403);
    const review = await request(app).get("/api/external/review/personal-token").expect(200);
    const cookie = (review.headers["set-cookie"] as unknown as string[])[0];
    await request(app).post("/api/external/review/personal-token/not-interested").set("cookie", cookie).set("x-csrf-token", review.body.csrfToken).send({}).expect(200, {decisionStatus: "NOT_INTERESTED"});
    expect(delivery.decideNotInterested).toHaveBeenCalledOnce();
  });
});
