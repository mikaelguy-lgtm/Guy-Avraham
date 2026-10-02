import { describe, expect, it, vi } from "vitest";
import type { Auth } from "firebase-admin/auth";
import type { EmailService } from "../../src/services/email";
import {
  AdvisorEmailVerificationService,
  EmulatorFirebaseVerificationLinkProvider,
  ProductionFirebaseVerificationLinkProvider
} from "../../src/services/emailVerification";

describe("advisor email verification service", () => {
  it.each([
    ["production", ProductionFirebaseVerificationLinkProvider],
    ["emulator", EmulatorFirebaseVerificationLinkProvider]
  ])("uses APP_URL for the %s Firebase continue URL", async (_name, Provider) => {
    const generateEmailVerificationLink = vi.fn().mockResolvedValue("http://firebase.test/action?oobCode=private");
    const provider = new Provider({generateEmailVerificationLink} as unknown as Auth, "https://app.syncash.test/base");
    await provider.createVerificationLink("advisor@example.com");
    expect(generateEmailVerificationLink).toHaveBeenCalledWith("advisor@example.com", {url: "https://app.syncash.test/verify-email"});
  });

  it("sends RTL HTML and text while keeping the verification link out of logs", async () => {
    const privateLink = "http://localhost:9099/action?oobCode=private-code";
    const send = vi.fn().mockResolvedValue({messageId: "safe-message-id"});
    const addEmailLog = vi.fn().mockResolvedValue(undefined);
    const service = new AdvisorEmailVerificationService(
      {createVerificationLink: vi.fn().mockResolvedValue({url: privateLink})},
      {send} as unknown as EmailService,
      {addEmailLog}
    );
    const result = await service.sendVerificationEmail({firebaseUid: "uid", email: "advisor@example.com", displayName: "דנה"}, {userId: 7, requestId: "request-1"});
    expect(result).toEqual({messageId: "safe-message-id", expiresAt: undefined});
    expect(send).toHaveBeenCalledWith("advisor@example.com", "אימות כתובת הדוא״ל שלך – SynCash", expect.stringContaining('dir="rtl"'), expect.objectContaining({text: expect.stringContaining(privateLink), verifyTransport: true}));
    expect(JSON.stringify(addEmailLog.mock.calls)).not.toContain(privateLink);
    expect(addEmailLog).toHaveBeenCalledWith(expect.objectContaining({template: "ADVISOR_EMAIL_VERIFICATION", messageId: "safe-message-id", status: "SENT"}));
  });
});
