import {existsSync} from "node:fs";
import PDFDocument from "pdfkit";
import type {FullCaseSnapshot, MaskedCaseSnapshot} from "../domain/lenderDelivery.js";
import type {AnonymousSubmissionSnapshot} from "../domain/types.js";
import {snapshotDisplayEntries} from "../utils/snapshotDisplay.js";

const fontCandidates = [process.env.PDF_FONT_PATH, "C:/Windows/Fonts/arial.ttf", "/usr/share/fonts/noto/NotoSansHebrew-Regular.ttf", "/usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf"].filter(Boolean) as string[];

function visualHebrew(value: string): string {
  return value.replace(/[\u0590-\u05ff\u05f3\u05f4 ]+/gu, (segment) => [...segment].reverse().join(""));
}

function currency(value: number): string {
  return new Intl.NumberFormat("he-IL", {style: "currency", currency: "ILS", maximumFractionDigits: 0}).format(value);
}

function createDocument(title: string): PDFKit.PDFDocument {
  const document = new PDFDocument({size: "A4", margin: 48, bufferPages: true, info: {Title: title, Author: "SynCash"}});
  const font = fontCandidates.find(existsSync);
  if (font) document.font(font);
  return document;
}

function section(document: PDFKit.PDFDocument, title: string): void {
  if (document.y > 700) document.addPage();
  document.moveDown(0.6).fontSize(15).fillColor("#0b2940").text(visualHebrew(title), {align: "right"}).moveDown(0.35);
}

function line(document: PDFKit.PDFDocument, label: string, value: string | number | null): void {
  const displayed = value === null || value === "" ? "לא צוין" : String(value);
  document.fontSize(10.5).fillColor("#1f3342").text(`${visualHebrew(label)}: ${visualHebrew(displayed)}`, {align: "right"});
}

function finish(document: PDFKit.PDFDocument): void {
  const range = document.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    document.switchToPage(index);
    document.fontSize(8).fillColor("#6b7280").text(visualHebrew(`SynCash · מידע סודי · עמוד ${index + 1} מתוך ${range.count}`), 48, 805, {align: "center", width: 499});
  }
  document.end();
}

function toBuffer(document: PDFKit.PDFDocument, render: () => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    render();
  });
}

export async function createMaskedCasePdf(snapshot: MaskedCaseSnapshot, metadata: {versionNumber: number; createdAt: Date}): Promise<Buffer> {
  const document = createDocument(`SynCash masked case ${snapshot.publicCaseNumber}`);
  return toBuffer(document, () => {
    document.fontSize(21).fillColor("#0b2940").text(visualHebrew("תיק מימון מוסווה לבחינה"), {align: "center"});
    document.fontSize(10).fillColor("#64748b").text(visualHebrew(`תיק ${snapshot.publicCaseNumber} · גרסה ${metadata.versionNumber} · ${metadata.createdAt.toLocaleDateString("he-IL")}`), {align: "center"});
    section(document, "תקציר העסקה");
    line(document, "מטרת ההלוואה", snapshot.loanRequest.purpose); line(document, "סכום מבוקש", currency(snapshot.loanRequest.requestedAmount)); line(document, "שווי הנכס", currency(snapshot.property.value)); line(document, "אחוז מימון", `${snapshot.loanRequest.loanToValue}%`);
    section(document, "לווים מוסווים");
    for (const borrower of snapshot.borrowers) {
      line(document, "לווה", borrower.label); line(document, "גיל", borrower.age); line(document, "עיר מגורים", borrower.residenceCity); line(document, "מצב משפחתי", borrower.maritalStatus); line(document, "סוג תעסוקה", borrower.employment.employmentType); line(document, "תפקיד", borrower.employment.jobTitle); line(document, "הכנסה נטו", currency(borrower.employment.monthlyNetIncome)); line(document, "הכנסה נוספת", currency(borrower.employment.additionalIncomeAmount));
      for (const liability of borrower.liabilities) { line(document, "התחייבות", `${liability.type} · ${currency(liability.currentBalance)} · ${currency(liability.monthlyPayment)} לחודש · ${liability.notes}`); }
      document.moveDown(0.4);
    }
    if (snapshot.householdLiabilities.length) { section(document, "התחייבויות משק הבית"); for (const liability of snapshot.householdLiabilities) line(document, "התחייבות", `${liability.type} · יתרה ${currency(liability.currentBalance)} · החזר ${currency(liability.monthlyPayment)} · ${liability.notes}`); }
    section(document, "נכס ופירוט עסקה"); line(document, "סוג נכס", snapshot.property.propertyType); line(document, "עיר הנכס", snapshot.property.city); line(document, "פירוט העסקה", snapshot.dealDetails);
    section(document, "סיכום פיננסי"); line(document, "סך הכנסה חודשית", currency(snapshot.totals.monthlyIncome)); line(document, "סך יתרות התחייבויות", currency(snapshot.totals.liabilityBalance)); line(document, "סך החזרים חודשיים", currency(snapshot.totals.monthlyPayments)); line(document, "סטטוס מסמכים", snapshot.documentStatus);
    document.moveDown().fontSize(9).fillColor("#7c2d12").text(visualHebrew("מסמך זה מוסווה ומיועד לבחינה ראשונית בלבד. אין בו פרטים מזהים, פרטי יועץ או מסמכי לקוח."), {align: "right"});
    finish(document);
  });
}

export async function createFullCasePdf(snapshot: FullCaseSnapshot, metadata: {versionNumber: number; createdAt: Date}): Promise<Buffer> {
  const document = createDocument(`SynCash full case ${snapshot.publicCaseNumber}`);
  return toBuffer(document, () => {
    document.fontSize(21).fillColor("#0b2940").text(visualHebrew("תיק מימון מלא"), {align: "center"});
    document.fontSize(10).fillColor("#64748b").text(visualHebrew(`תיק ${snapshot.publicCaseNumber} · גרסה ${metadata.versionNumber} · ${metadata.createdAt.toLocaleDateString("he-IL")}`), {align: "center"});
    section(document, "פרטי לווים");
    for (const borrower of snapshot.borrowers) {
      line(document, "שם מלא", `${borrower.firstName} ${borrower.lastName}`); line(document, "תעודת זהות", borrower.identityNumber); line(document, "תאריך לידה", borrower.dateOfBirth); line(document, "טלפון", borrower.phone); line(document, "דוא״ל", borrower.email); line(document, "כתובת", borrower.address); line(document, "מצב משפחתי", borrower.maritalStatus); line(document, "ילדים", `${borrower.numberOfChildren} · גילאים ${borrower.childrenAges.join(", ")}`);
      line(document, "סוג תעסוקה", borrower.employment.employmentType); line(document, "מעסיק או עסק", borrower.employment.employerName); line(document, "תפקיד", borrower.employment.jobTitle); line(document, "ותק", `${borrower.employment.employmentSeniorityYears} שנים`); line(document, "הכנסה נטו", currency(borrower.employment.monthlyNetIncome)); line(document, "הכנסה נוספת", currency(borrower.employment.additionalIncomeAmount));
      for (const liability of borrower.liabilities) line(document, "התחייבות", `${liability.type} · יתרה ${currency(liability.currentBalance)} · החזר ${currency(liability.monthlyPayment)} · ${liability.notes}`);
      document.moveDown(0.5);
    }
    section(document, "נכס ובקשת מימון"); line(document, "מטרת ההלוואה", snapshot.loanRequest.purpose); line(document, "סוג נכס", snapshot.property.propertyType); line(document, "עיר", snapshot.property.city); line(document, "כתובת", snapshot.property.address); line(document, "שווי", currency(snapshot.property.value)); line(document, "סכום מבוקש", currency(snapshot.loanRequest.requestedAmount)); line(document, "פירוט העסקה", snapshot.dealDetails);
    section(document, "מסמכים"); for (const item of snapshot.documents) line(document, "מסמך", `${item.documentType}${item.customTitle ? ` — ${item.customTitle}` : ""}`);
    section(document, "פרטי היועץ"); line(document, "שם", snapshot.advisor.fullName); line(document, "עסק", snapshot.advisor.businessName); line(document, "טלפון", snapshot.advisor.phone); line(document, "דוא״ל", snapshot.advisor.email); line(document, "אתר", snapshot.advisor.website);
    finish(document);
  });
}

export async function createAnonymousPdf(snapshot: AnonymousSubmissionSnapshot): Promise<Buffer> {
  const document = createDocument(`SynCash case ${snapshot.publicCaseNumber}`);
  return toBuffer(document, () => {
    document.fontSize(18).text("SynCash Anonymous Financing Case", {align: "center"}).moveDown();
    for (const [key, value] of snapshotDisplayEntries(snapshot)) document.fontSize(11).text(`${visualHebrew(key)}: ${visualHebrew(value)}`, {align: "right"});
    finish(document);
  });
}
