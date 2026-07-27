import {existsSync} from "node:fs";
import PDFDocument from "pdfkit";
import type {FullCaseBorrowerSnapshot, FullCaseLiabilitySnapshot, FullCaseSnapshot, MaskedCaseSnapshot, VersionDocumentSnapshot} from "../domain/lenderDelivery.js";
import type {AnonymousSubmissionSnapshot} from "../domain/types.js";
import {requiredDocumentLabel} from "../domain/requiredDocuments.js";
import {
  formatAdditionalIncomeType, formatBorrowerRelationship, formatClientStatus, formatCurrency, formatDate, formatDealType,
  formatDocumentType, formatEmploymentType, formatLiabilityType, formatMaritalStatus, formatPropertyType
} from "../utils/formatters.js";
import {snapshotDisplayEntries} from "../utils/snapshotDisplay.js";

const regularFontCandidates = [
  process.env.PDF_FONT_PATH,
  "C:/Windows/Fonts/arial.ttf",
  "/usr/share/fonts/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/noto/NotoSansHebrew-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
].filter(Boolean) as string[];

const boldFontCandidates = [
  process.env.PDF_BOLD_FONT_PATH,
  "C:/Windows/Fonts/arialbd.ttf",
  "/usr/share/fonts/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/noto/NotoSansHebrew-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSansHebrew-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
].filter(Boolean) as string[];

const colors = {
  navy: "#071a2b", blue: "#0b2940", cyan: "#06b6d4", cyanSoft: "#e6f8fb", gold: "#d4af37",
  goldSoft: "#fbf5df", ink: "#172b3a", muted: "#64748b", line: "#dbe5ec", paper: "#f7fafc", white: "#ffffff"
};

const page = {left: 42, right: 553, top: 118, bottom: 760, width: 511};

function resolveFont(candidates: string[], description: string): string {
  const font = candidates.find(existsSync);
  if (!font) throw new Error(`SYNCASH_PDF_${description}_FONT_NOT_FOUND`);
  return font;
}

function createDocument(title: string): PDFKit.PDFDocument {
  const document = new PDFDocument({size: "A4", margin: 42, bufferPages: true, info: {Title: title, Author: "SynCash", Subject: "SynCash financing case"}});
  document.registerFont("SynCash", resolveFont(regularFontCandidates, "HEBREW"));
  document.registerFont("SynCashBold", resolveFont(boldFontCandidates, "HEBREW_BOLD"));
  document.font("SynCash");
  return document;
}

function rtl(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === "" ? "לא צוין" : String(value);
}

function drawLogo(document: PDFKit.PDFDocument, x: number, y: number, scale = 0.24): void {
  document.save().translate(x, y).scale(scale);
  document.path("M170,45 C150,25 100,25 70,45 C40,65 42,105 75,120 C85,125 105,125 125,120 C110,123 90,121 82,115 C62,100 58,75 80,62 C95,52 135,52 150,65 L170,45 Z").fill(colors.gold);
  document.path("M70,155 C90,175 140,175 170,155 C200,135 198,95 165,80 C155,75 135,75 115,80 C130,77 150,79 158,85 C178,100 182,125 160,138 C145,148 105,148 90,135 L70,155 Z").fill("#cbd5e1");
  document.roundedRect(100, 110, 12, 18, 2).fill(colors.gold);
  document.roundedRect(118, 95, 12, 33, 2).fill(colors.gold);
  document.roundedRect(136, 75, 12, 53, 2).fill(colors.gold);
  document.restore();
}

function drawPageChrome(document: PDFKit.PDFDocument, title: string, subtitle: string): void {
  document.rect(0, 0, 595.28, 96).fill(colors.navy);
  document.rect(0, 92, 595.28, 4).fill(colors.gold);
  drawLogo(document, 506, 17);
  document.font("SynCashBold").fontSize(19).fillColor(colors.white).text(rtl(title), page.left, 25, {width: 445, align: "right"});
  document.font("SynCash").fontSize(9.5).fillColor("#b9c9d8").text(rtl(subtitle), page.left, 57, {width: 445, align: "right"});
  document.y = page.top;
}

function ensureSpace(document: PDFKit.PDFDocument, needed: number, title: string, subtitle: string): void {
  if (document.y + needed <= page.bottom) return;
  document.addPage();
  drawPageChrome(document, title, subtitle);
}

function sectionTitle(document: PDFKit.PDFDocument, label: string, title: string, subtitle: string): void {
  ensureSpace(document, 42, title, subtitle);
  const y = document.y;
  document.roundedRect(page.left, y, page.width, 31, 8).fill(colors.blue);
  document.circle(page.right - 16, y + 15.5, 4).fill(colors.gold);
  document.font("SynCashBold").fontSize(12.5).fillColor(colors.white).text(rtl(label), page.left + 12, y + 8, {width: page.width - 38, align: "right"});
  document.y = y + 41;
}

interface PdfField {label: string; value: string | number | null | undefined; ltr?: boolean}

function fieldRows(document: PDFKit.PDFDocument, fields: PdfField[], title: string, subtitle: string): void {
  for (let index = 0; index < fields.length; index += 2) {
    ensureSpace(document, 55, title, subtitle);
    const row = fields.slice(index, index + 2);
    const y = document.y;
    const gap = 10;
    const width = (page.width - gap) / 2;
    row.forEach((field, column) => {
      const x = page.right - width - column * (width + gap);
      document.roundedRect(x, y, width, 45, 7).fillAndStroke(colors.paper, colors.line);
      document.font("SynCash").fontSize(8).fillColor(colors.muted).text(rtl(field.label), x + 10, y + 8, {width: width - 20, align: "right"});
      document.font("SynCashBold").fontSize(10.2).fillColor(colors.ink).text(field.ltr ? String(field.value ?? "לא צוין") : rtl(field.value), x + 10, y + 23, {width: width - 20, align: "right", ellipsis: true});
    });
    document.y = y + 53;
  }
}

function paragraph(document: PDFKit.PDFDocument, value: string, title: string, subtitle: string, tone: "default" | "notice" = "default"): void {
  const text = rtl(value);
  const height = Math.max(48, document.heightOfString(text, {width: page.width - 24, align: "right", lineGap: 3}) + 22);
  ensureSpace(document, height + 8, title, subtitle);
  const y = document.y;
  document.roundedRect(page.left, y, page.width, height, 8).fillAndStroke(tone === "notice" ? colors.goldSoft : colors.paper, tone === "notice" ? colors.gold : colors.line);
  document.font("SynCash").fontSize(9.5).fillColor(colors.ink).text(text, page.left + 12, y + 11, {width: page.width - 24, align: "right", lineGap: 3});
  document.y = y + height + 8;
}

function liabilityFields(liability: FullCaseLiabilitySnapshot, prefix = ""): PdfField[] {
  return [
    {label: `${prefix}סוג התחייבות`, value: formatLiabilityType(liability.type)},
    {label: "יתרה נוכחית", value: formatCurrency(liability.currentBalance)},
    {label: "החזר חודשי", value: formatCurrency(liability.monthlyPayment)},
    {label: "תאריך סיום", value: liability.endDate ? formatDate(liability.endDate) : "לא צוין"},
    {label: "הערות", value: liability.notes || "לא צוין"}
  ];
}

function borrowerIncomeFields(borrower: FullCaseBorrowerSnapshot | MaskedCaseSnapshot["borrowers"][number], masked: boolean): PdfField[] {
  return [
    {label: "סוג תעסוקה", value: formatEmploymentType(borrower.employment.employmentType)},
    {label: "מקום עבודה", value: masked ? "פרט מוסווה" : (borrower as FullCaseBorrowerSnapshot).employment.employerName},
    {label: "תפקיד", value: borrower.employment.jobTitle},
    {label: "ותק", value: `${borrower.employment.employmentSeniorityYears} שנים`},
    {label: "הכנסה חודשית נטו", value: formatCurrency(borrower.employment.monthlyNetIncome)},
    {label: "הכנסה נוספת", value: borrower.employment.hasAdditionalIncome ? "כן" : "לא"},
    {label: "סוג הכנסה נוספת", value: formatAdditionalIncomeType(borrower.employment.additionalIncomeType)},
    {label: "סכום הכנסה נוספת", value: formatCurrency(borrower.employment.additionalIncomeAmount)}
  ];
}

function documentStatusFields(documents: VersionDocumentSnapshot[], borrowers: Array<{order: number}>): PdfField[] {
  const fields: PdfField[] = [];
  for (const borrower of borrowers) {
    for (const type of ["ID_FRONT", "ID_BACK", "ID_APPENDIX"]) {
      fields.push({label: requiredDocumentLabel(type, borrower.order), value: documents.some((item) => item.borrowerOrder === borrower.order && item.documentType === type) ? "קיים בתיק" : "חסר"});
    }
  }
  for (const type of ["PROPERTY_RIGHTS", "POWER_OF_ATTORNEY"]) fields.push({label: requiredDocumentLabel(type), value: documents.some((item) => item.borrowerId === null && item.documentType === type) ? "קיים בתיק" : "חסר"});
  return fields;
}

function finish(document: PDFKit.PDFDocument, producedAt: Date): void {
  const range = document.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    document.switchToPage(index);
    document.rect(0, 782, 595.28, 60).fill(colors.navy);
    document.font("SynCash").fontSize(8).fillColor("#c9d6e2").text(rtl(`מידע סודי · הופק ${formatDate(producedAt)} · עמוד ${index + 1} מתוך ${range.count}`), page.left, 800, {width: page.width, align: "center"});
    document.font("SynCashBold").fontSize(7).fillColor(colors.gold).text("SYNCASH", page.left, 817, {width: page.width, align: "center", characterSpacing: 1.4});
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

function caseSubtitle(publicCaseNumber: string, versionNumber: number, createdAt: Date): string {
  return `תיק ${publicCaseNumber} · גרסה ${versionNumber} · הופק ${formatDate(createdAt)}`;
}

export async function createMaskedCasePdf(snapshot: MaskedCaseSnapshot, metadata: {versionNumber: number; createdAt: Date}): Promise<Buffer> {
  const title = "תיק מימון מוסווה לבחינה";
  const subtitle = caseSubtitle(snapshot.publicCaseNumber, metadata.versionNumber, metadata.createdAt);
  const document = createDocument(`SynCash masked case ${snapshot.publicCaseNumber}`);
  return toBuffer(document, () => {
    drawPageChrome(document, title, subtitle);
    sectionTitle(document, "תקציר התיק", title, subtitle);
    fieldRows(document, [
      {label: "מספר תיק", value: snapshot.publicCaseNumber, ltr: true}, {label: "סטטוס", value: formatClientStatus(snapshot.status ?? "ACTIVE")},
      {label: "מספר לווים", value: snapshot.numberOfBorrowers},
      {label: "סכום מבוקש", value: formatCurrency(snapshot.loanRequest.requestedAmount)}, {label: "שווי הנכס", value: formatCurrency(snapshot.property.value)},
      {label: "אחוז מימון", value: `${snapshot.loanRequest.loanToValue}%`}, {label: "מטרת ההלוואה", value: formatDealType(snapshot.loanRequest.purpose)}
    ], title, subtitle);
    sectionTitle(document, "פרטים אישיים מוסווים", title, subtitle);
    for (const borrower of snapshot.borrowers) {
      fieldRows(document, [
        {label: "לווה", value: borrower.label}, {label: "שם", value: "פרט מוסווה"},
        {label: "גיל", value: borrower.age}, {label: "עיר מגורים", value: borrower.residenceCity},
        {label: "מצב משפחתי", value: formatMaritalStatus(borrower.maritalStatus)}, {label: "מספר ילדים", value: borrower.numberOfChildren}
      ], title, subtitle);
    }
    sectionTitle(document, "הכנסות", title, subtitle);
    snapshot.borrowers.forEach((borrower) => fieldRows(document, [{label: "לווה", value: borrower.label}, ...borrowerIncomeFields(borrower, true)], title, subtitle));
    sectionTitle(document, "התחייבויות", title, subtitle);
    const liabilities = [...snapshot.borrowers.flatMap((borrower) => borrower.liabilities), ...snapshot.householdLiabilities];
    if (liabilities.length) liabilities.forEach((liability, index) => fieldRows(document, liabilityFields(liability, `התחייבות ${index + 1} — `), title, subtitle));
    else paragraph(document, "לא דווחו התחייבויות פעילות.", title, subtitle);
    sectionTitle(document, "נכס ובקשת מימון", title, subtitle);
    fieldRows(document, [
      {label: "סוג נכס", value: formatPropertyType(snapshot.property.propertyType)}, {label: "עיר הנכס", value: snapshot.property.city},
      {label: "שווי הנכס", value: formatCurrency(snapshot.property.value)}, {label: "סכום מבוקש", value: formatCurrency(snapshot.loanRequest.requestedAmount)},
      {label: "תקופה מבוקשת", value: `${snapshot.loanRequest.requestedTermMonths} חודשים`}, {label: "אחוז מימון", value: `${snapshot.loanRequest.loanToValue}%`}
    ], title, subtitle);
    sectionTitle(document, "פירוט העסקה", title, subtitle);
    paragraph(document, snapshot.dealDetails, title, subtitle);
    sectionTitle(document, "סטטוס מסמכי חובה", title, subtitle);
    paragraph(document, snapshot.documentStatus, title, subtitle);
    sectionTitle(document, "סיכום פיננסי", title, subtitle);
    fieldRows(document, [
      {label: "סך הכנסה חודשית", value: formatCurrency(snapshot.totals.monthlyIncome)}, {label: "סך יתרות התחייבויות", value: formatCurrency(snapshot.totals.liabilityBalance)},
      {label: "סך החזרים חודשיים", value: formatCurrency(snapshot.totals.monthlyPayments)}, {label: "מספר לווים", value: snapshot.numberOfBorrowers}
    ], title, subtitle);
    paragraph(document, "מסמך זה מוסווה ומיועד לבחינה ראשונית בלבד. שמות הלווים, פרטי הזיהוי, מקום העבודה ופרטי היועץ אינם נכללים בו.", title, subtitle, "notice");
    finish(document, metadata.createdAt);
  });
}

export async function createFullCasePdf(snapshot: FullCaseSnapshot, metadata: {versionNumber: number; createdAt: Date}): Promise<Buffer> {
  const title = "תיק מימון מלא";
  const subtitle = caseSubtitle(snapshot.publicCaseNumber, metadata.versionNumber, metadata.createdAt);
  const document = createDocument(`SynCash full case ${snapshot.publicCaseNumber}`);
  return toBuffer(document, () => {
    drawPageChrome(document, title, subtitle);
    sectionTitle(document, "תקציר התיק", title, subtitle);
    fieldRows(document, [
      {label: "מספר תיק", value: snapshot.publicCaseNumber, ltr: true}, {label: "סטטוס", value: formatClientStatus(snapshot.status ?? "ACTIVE")},
      {label: "מספר לווים", value: snapshot.numberOfBorrowers},
      {label: "קשר בין הלווים", value: formatBorrowerRelationship(snapshot.borrowerRelationship)}, {label: "מטרת ההלוואה", value: formatDealType(snapshot.loanRequest.purpose)},
      {label: "סכום מבוקש", value: formatCurrency(snapshot.loanRequest.requestedAmount)}, {label: "שווי הנכס", value: formatCurrency(snapshot.property.value)}
    ], title, subtitle);
    sectionTitle(document, "פרטים אישיים", title, subtitle);
    for (const borrower of snapshot.borrowers) {
      fieldRows(document, [
        {label: `לווה ${borrower.order} — שם מלא`, value: `${borrower.firstName} ${borrower.lastName}`}, {label: "מספר תעודת זהות", value: borrower.identityNumber, ltr: true},
        {label: "תאריך לידה", value: formatDate(borrower.dateOfBirth)}, {label: "גיל", value: borrower.age},
        {label: "טלפון", value: borrower.phone, ltr: true}, {label: "דוא״ל", value: borrower.email, ltr: true},
        {label: "כתובת מגורים", value: borrower.address}, {label: "מצב משפחתי", value: formatMaritalStatus(borrower.maritalStatus)},
        {label: "מספר ילדים", value: borrower.numberOfChildren}, {label: "גילאי ילדים", value: borrower.childrenAges.length ? borrower.childrenAges.join(", ") : "אין"}
      ], title, subtitle);
    }
    sectionTitle(document, "הכנסות", title, subtitle);
    snapshot.borrowers.forEach((borrower) => fieldRows(document, [{label: "לווה", value: `${borrower.firstName} ${borrower.lastName}`}, ...borrowerIncomeFields(borrower, false)], title, subtitle));
    sectionTitle(document, "התחייבויות", title, subtitle);
    const liabilities = [...snapshot.borrowers.flatMap((borrower) => borrower.liabilities), ...snapshot.householdLiabilities];
    if (liabilities.length) liabilities.forEach((liability, index) => fieldRows(document, liabilityFields(liability, `התחייבות ${index + 1} — `), title, subtitle));
    else paragraph(document, "לא דווחו התחייבויות פעילות.", title, subtitle);
    sectionTitle(document, "נכס ובקשת מימון", title, subtitle);
    fieldRows(document, [
      {label: "סוג נכס", value: formatPropertyType(snapshot.property.propertyType)}, {label: "עיר", value: snapshot.property.city},
      {label: "כתובת הנכס", value: snapshot.property.address}, {label: "שווי הנכס", value: formatCurrency(snapshot.property.value)},
      {label: "סכום מבוקש", value: formatCurrency(snapshot.loanRequest.requestedAmount)}, {label: "תקופה מבוקשת", value: `${snapshot.loanRequest.requestedTermMonths} חודשים`},
      {label: "אחוז מימון", value: `${snapshot.loanRequest.loanToValue}%`}, {label: "מטרת ההלוואה", value: formatDealType(snapshot.loanRequest.purpose)}
    ], title, subtitle);
    sectionTitle(document, "פירוט העסקה", title, subtitle);
    paragraph(document, snapshot.dealDetails, title, subtitle);
    sectionTitle(document, "סטטוס מסמכי חובה", title, subtitle);
    fieldRows(document, documentStatusFields(snapshot.documents, snapshot.borrowers), title, subtitle);
    if (snapshot.documents.length) {
      sectionTitle(document, "מסמכים בתיק", title, subtitle);
      fieldRows(document, snapshot.documents.flatMap((item, index) => [
        {label: `מסמך ${index + 1}`, value: item.documentType === "OTHER" && item.customTitle ? `מסמך נוסף — ${item.customTitle}` : formatDocumentType(item.documentType)},
        {label: "תאריך העלאה", value: formatDate(item.createdAt)}
      ]), title, subtitle);
    }
    sectionTitle(document, "פרטי היועץ", title, subtitle);
    fieldRows(document, [
      {label: "שם", value: snapshot.advisor.fullName}, {label: "שם העסק", value: snapshot.advisor.businessName},
      {label: "טלפון", value: snapshot.advisor.phone, ltr: true}, {label: "דוא״ל", value: snapshot.advisor.email, ltr: true},
      {label: "אתר", value: snapshot.advisor.website ?? "לא צוין", ltr: true}
    ], title, subtitle);
    finish(document, metadata.createdAt);
  });
}

export async function createAnonymousPdf(snapshot: AnonymousSubmissionSnapshot): Promise<Buffer> {
  const createdAt = new Date();
  const title = "תיק מימון אנונימי";
  const subtitle = `תיק ${snapshot.publicCaseNumber} · הופק ${formatDate(createdAt)}`;
  const document = createDocument(`SynCash case ${snapshot.publicCaseNumber}`);
  return toBuffer(document, () => {
    drawPageChrome(document, title, subtitle);
    sectionTitle(document, "תקציר אנונימי", title, subtitle);
    fieldRows(document, snapshotDisplayEntries(snapshot).map(([label, value]) => ({label, value})), title, subtitle);
    paragraph(document, "המסמך אינו כולל פרטים המאפשרים לזהות את הלקוח או את היועץ.", title, subtitle, "notice");
    finish(document, createdAt);
  });
}
