import {describe, expect, it} from "vitest";
import {deliveryEmailTemplates} from "../../src/services/deliveryEmailTemplates";

describe("delivery email templates", () => {
  it("provides simple RTL HTML and matching plain text for every delivery flow", () => {
    const messages = [
      deliveryEmailTemplates.initial({contactFirstName: "דנה", companyName: "חברה", publicCaseNumber: "SC-1", deadline: "01/08/2026 18:00", url: "https://app.syncash.co.il/external/review/token"}),
      deliveryEmailTemplates.reminder({contactFirstName: "דנה", companyName: "חברה", publicCaseNumber: "SC-1", deadline: "01/08/2026 18:00", url: "https://app.syncash.co.il/external/review/token"}),
      deliveryEmailTemplates.otp({contactFirstName: "דנה", companyName: "חברה", publicCaseNumber: "SC-1", code: "123456", portal: false}),
      deliveryEmailTemplates.fullAccess({companyName: "חברה", publicCaseNumber: "SC-1", expiresAt: "01/08/2026 18:00", url: "https://app.syncash.co.il/external/access/token"}),
      deliveryEmailTemplates.decision({companyName: "חברה", publicCaseNumber: "SC-1", interested: true}),
      deliveryEmailTemplates.advisor({advisorFirstName: "יועץ", companyName: "חברה", interested: true, url: "https://app.syncash.co.il/advisor/clients/1"}),
      deliveryEmailTemplates.advisorDeliveryFailure({advisorFirstName: "יועץ", companyName: "חברה", publicCaseNumber: "SC-1", url: "https://app.syncash.co.il/advisor/clients/1"}),
      deliveryEmailTemplates.advisorExpired({advisorFirstName: "יועץ", companyName: "חברה", publicCaseNumber: "SC-1", url: "https://app.syncash.co.il/advisor/clients/1"})
    ];
    for (const message of messages) {
      expect(message.subject.trim().length).toBeGreaterThan(5);
      expect(message.html).toContain('dir="rtl"');
      expect(message.html).not.toMatch(/<img|bit\.ly|tinyurl/iu);
      expect(message.text.trim().length).toBeGreaterThan(10);
    }
  });

  it("keeps OTP values out of subjects and uses no attachments", () => {
    const message = deliveryEmailTemplates.otp({contactFirstName: "דנה", companyName: "חברה", publicCaseNumber: "SC-1", code: "654321", portal: true});
    expect(message.subject).not.toContain("654321");
    expect(message.text).toContain("654321");
    expect(Object.keys(message)).toEqual(["subject", "text", "html"]);
  });
});
