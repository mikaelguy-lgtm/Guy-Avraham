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

  it("tells the advisor a 48-hour contact window applies when a lender is interested, without committing on the lender's behalf", () => {
    const interested = deliveryEmailTemplates.advisor({advisorFirstName: "יועץ", companyName: "חברה", interested: true, url: "https://app.syncash.co.il/advisor/clients/1"});
    expect(interested.text).toContain("48 שעות");
    expect(interested.html).toContain("48 שעות");
    expect(interested.text).not.toMatch(/מוסווה/u);
    expect(interested.html).not.toMatch(/מוסווה/u);

    const notInterested = deliveryEmailTemplates.advisor({advisorFirstName: "יועץ", companyName: "חברה", interested: false, url: "https://app.syncash.co.il/advisor/clients/1"});
    expect(notInterested.text).not.toContain("48 שעות");
    expect(notInterested.html).not.toContain("48 שעות");
  });

  it("does not append a lender-contact signature line (name/role/email/phone) to the advisor decision email", () => {
    const interested = deliveryEmailTemplates.advisor({advisorFirstName: "יועץ", companyName: "חברה", interested: true, url: "https://app.syncash.co.il/advisor/clients/1"});
    // Root-caused: lenderDelivery.ts used to build "First Last · role_title ·
    // email · phone" from the deciding lender_contacts row and append it as
    // its own paragraph — e.g. "אריאלה אברהם · בעלים · ...". The advisor()
    // template no longer accepts a contact field at all, so its rendered
    // output can never contain a "·"-joined name/role/email/phone line.
    expect(interested.html).not.toContain("·");
    expect(interested.text).not.toContain("·");
    // Exactly 4 lines: greeting, decision state, 48-hour window, CTA URL —
    // nothing appended after the URL.
    expect(interested.text.split("\n").filter(Boolean)).toEqual([
      "שלום יועץ,",
      "חברת חברה אישרה שהיא מעוניינת להמשיך בטיפול בתיק.",
      "חברת המימון הביעה עניין בתיק. נציג החברה או איש הקשר מטעמה צפוי ליצור איתך קשר בתוך 48 שעות לצורך המשך הטיפול.",
      "https://app.syncash.co.il/advisor/clients/1"
    ]);
  });
});
