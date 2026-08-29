import PDFDocument from "pdfkit";
import {createRequire} from "node:module";
import type {CreditIndicationSnapshot, FullCaseBorrowerSnapshot, FullCaseLiabilitySnapshot, FullCaseSelfEmployedSnapshot, FullCaseSnapshot, MaskedCaseSnapshot, VersionDocumentSnapshot} from "../domain/lenderDelivery.js";
import type {AnonymousSubmissionSnapshot} from "../domain/types.js";
import {requiredDocumentLabel} from "../domain/requiredDocuments.js";
import {getDocumentDisplayName} from "../utils/documentDisplay.js";
import {REQUIRED_BORROWER_DOCUMENT_TYPES, REQUIRED_CLIENT_DOCUMENT_TYPES, currentIsraelYear} from "../domain/clientFields.js";
import {
  formatAdditionalIncomeType, formatBorrowerRelationship, formatClientStatus, formatCurrency, formatDate, formatDealType,
  formatEmploymentType, formatLiabilityType, formatMaritalStatus, formatPropertyType
} from "../utils/formatters.js";
import {snapshotDisplayEntries} from "../utils/snapshotDisplay.js";
import {loadPdfHebrewFonts, PDF_BOLD_FONT_NAME, PDF_REGULAR_FONT_NAME, PDF_RENDERER_VERSION} from "./pdfFonts.js";

export {PDF_RENDERER_VERSION} from "./pdfFonts.js";

const colors = {
  navy: "#071a2b", blue: "#0b2940", cyan: "#06b6d4", cyanSoft: "#e6f8fb", gold: "#d4af37",
  goldSoft: "#fbf5df", ink: "#172b3a", muted: "#64748b", line: "#dbe5ec", paper: "#f7fafc", white: "#ffffff"
};

const page = {left: 42, right: 553, top: 118, bottom: 760, width: 511};
const require = createRequire(import.meta.url);
const bidiFactory = require("bidi-js") as () => {
  getEmbeddingLevels(text: string, direction?: "ltr" | "rtl"): {levels: Uint8Array; paragraphs: Array<{start: number; end: number; level: number}>};
  getReorderedString(text: string, levels: {levels: Uint8Array; paragraphs: Array<{start: number; end: number; level: number}>}, start?: number, end?: number): string;
};
const bidi = bidiFactory();
export function formatPdfBidi(value: string | number | null | undefined, direction: "rtl" | "ltr" = "rtl"): string {
  const text = value === null || value === undefined || value === "" ? "לא צוין" : String(value);
  const normalized = text.normalize("NFC");
  return direction === "ltr" ? normalized : normalized;
}

export function formatVisiblePdfText(value: string, direction: "rtl" | "ltr" = "rtl"): string {
  const normalized = value.normalize("NFC");
  if (direction === "ltr") return normalized;
  return normalized.split("\n").map((line) => bidi.getReorderedString(line, bidi.getEmbeddingLevels(line, "rtl"))).join("\n");
}

function visualTextWidth(document: PDFKit.PDFDocument, value: string, characterSpacing = 0): number {
  const characters = [...formatVisiblePdfText(value)];
  return characters.reduce((width, character) => width + document.widthOfString(character), 0) + Math.max(0, characters.length - 1) * characterSpacing;
}

function wrapLogicalRtlText(document: PDFKit.PDFDocument, value: string, width: number): string {
  const lines: string[] = [];
  for (const paragraph of value.normalize("NFC").split(/\r?\n/u)) {
    const words = paragraph.trim().split(/\s+/u).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && visualTextWidth(document, candidate) > width) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines.join("\n");
}

function createDocument(title: string, producedAt: Date): PDFKit.PDFDocument {
  const fonts = loadPdfHebrewFonts();
  const document = new PDFDocument({
    size: "A4",
    margin: 42,
    bufferPages: true,
    info: {Title: title, Author: "SynCash", Subject: "SynCash financing case", CreationDate: producedAt, ModDate: producedAt}
  });
  const documentInfo = document.info as PDFKit.DocumentInfo & Record<string, string>;
  documentInfo.PDFRendererVersion = String(PDF_RENDERER_VERSION);
  documentInfo.PDFFontFingerprint = fonts.fingerprint;
  document.registerFont(PDF_REGULAR_FONT_NAME, fonts.regular.buffer);
  document.registerFont(PDF_BOLD_FONT_NAME, fonts.bold.buffer);
  document.font(PDF_REGULAR_FONT_NAME);
  return document;
}

function pdfText(
  document: PDFKit.PDFDocument,
  value: string | number | null | undefined,
  x: number,
  y: number,
  options: PDFKit.Mixins.TextOptions & {direction?: "rtl" | "ltr"}
): void {
  const isMissing = value === null || value === undefined || value === "";
  const logicalText = isMissing ? "לא צוין" : String(value);
  const {direction: requestedDirection = "rtl", ...textOptions} = options;
  // The "לא צוין" fallback is always Hebrew — never render it through the
  // LTR path even when the field itself (e.g. a URL or phone number) is
  // normally LTR-flagged, or it draws backwards (PDFKit does not shape
  // Hebrew on the plain document.text() path used for LTR fields).
  const direction = isMissing ? "rtl" : requestedDirection;
  document.markContent("Span", {actual: logicalText, lang: direction === "rtl" ? "he-IL" : "en"});
  if (direction === "ltr") document.text(formatPdfBidi(logicalText, direction), x, y, textOptions);
  else drawVisualRtlText(document, formatPdfBidi(logicalText, direction), x, y, textOptions);
  document.endMarkedContent();
  if (direction === "rtl" && /\s/u.test(logicalText)) drawLogicalSearchLayer(document, logicalText);
}

function drawVisualRtlText(
  document: PDFKit.PDFDocument,
  logicalText: string,
  x: number,
  y: number,
  options: PDFKit.Mixins.TextOptions
): void {
  const originalX = document.x;
  const originalY = document.y;
  const width = options.width ?? document.page.width - x - document.page.margins.right;
  const characterSpacing = options.characterSpacing ?? 0;
  const lineGap = options.lineGap ?? 0;
  const lines = logicalText.split("\n");
  const lineHeight = document.currentLineHeight(true) + lineGap;
  document.save().rect(x, y, width, Math.max(lineHeight, lines.length * lineHeight)).clip();
  lines.forEach((line, lineIndex) => {
    const visualText = formatVisiblePdfText(line);
    const characters = [...visualText];
    const renderedWidth = visualTextWidth(document, line, characterSpacing);
    const align = options.align ?? "right";
    let cursor = align === "center" ? x + (width - renderedWidth) / 2 : align === "left" ? x : x + width - renderedWidth;
    const lineY = y + lineIndex * lineHeight;
    for (const character of characters) {
      const characterWidth = document.widthOfString(character);
      if (!/\s/u.test(character)) document.text(character, cursor, lineY, {lineBreak: false});
      cursor += characterWidth + characterSpacing;
    }
  });
  document.restore();
  document.x = originalX;
  document.y = originalY;
}

function drawLogicalSearchLayer(document: PDFKit.PDFDocument, logicalText: string): void {
  const originalX = document.x;
  const originalY = document.y;
  const tokens = logicalText.normalize("NFC").trim().split(/\s+/u).filter(Boolean);
  document.save().fillOpacity(0).fontSize(1);
  let cursor = 1;
  for (const token of tokens) {
    document.text(token, cursor, 1, {lineBreak: false});
    cursor += document.widthOfString(token) + 0.8;
  }
  document.restore();
  document.x = originalX;
  document.y = originalY;
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

export function drawPageHeader(document: PDFKit.PDFDocument, title: string, subtitle: string): void {
  document.rect(0, 0, 595.28, 96).fill(colors.navy);
  document.rect(0, 92, 595.28, 4).fill(colors.gold);
  drawLogo(document, 506, 17);
  document.font(PDF_BOLD_FONT_NAME).fontSize(19).fillColor(colors.white);
  pdfText(document, title, page.left, 25, {width: 445, align: "right"});
  document.font(PDF_REGULAR_FONT_NAME).fontSize(9.5).fillColor("#b9c9d8");
  pdfText(document, subtitle, page.left, 57, {width: 445, align: "right"});
  document.y = page.top;
}

export function addContentPage(document: PDFKit.PDFDocument, title: string, subtitle: string): void {
  document.addPage();
  drawPageHeader(document, title, subtitle);
}

export function ensureSpace(document: PDFKit.PDFDocument, needed: number, title: string, subtitle: string): void {
  if (document.y + needed <= page.bottom) return;
  addContentPage(document, title, subtitle);
}

function sectionTitle(document: PDFKit.PDFDocument, label: string, title: string, subtitle: string): void {
  ensureSpace(document, 42, title, subtitle);
  const y = document.y;
  document.roundedRect(page.left, y, page.width, 31, 8).fill(colors.blue);
  document.circle(page.right - 16, y + 15.5, 4).fill(colors.gold);
  document.font(PDF_BOLD_FONT_NAME).fontSize(12.5).fillColor(colors.white);
  pdfText(document, label, page.left + 12, y + 8, {width: page.width - 38, align: "right"});
  document.y = y + 41;
}

interface PdfField {label: string; value: string | number | null | undefined; ltr?: boolean}

function fieldRowsHeight(fields: PdfField[]): number {
  return Math.ceil(fields.length / 2) * 53;
}

// A lighter-weight heading than sectionTitle(), for a card/block nested
// inside a section (e.g. one borrower, one liability). Does not reserve
// its own page-break space — callers pair it with keepTogether() so the
// heading and its fields never get separated across a page boundary.
function subHeading(document: PDFKit.PDFDocument, label: string): void {
  const y = document.y;
  document.font(PDF_BOLD_FONT_NAME).fontSize(11.5).fillColor(colors.blue);
  pdfText(document, label, page.left, y, {width: page.width, align: "right"});
  document.moveTo(page.left, y + 19).lineTo(page.right, y + 19).lineWidth(0.75).strokeColor(colors.line).stroke();
  document.y = y + 27;
}

// Reserves `height` in one page-break check, then runs `render` — used so
// a heading and the fields/paragraph that belong with it are never split
// across a page break.
function keepTogether(document: PDFKit.PDFDocument, height: number, title: string, subtitle: string, render: () => void): void {
  ensureSpace(document, height, title, subtitle);
  render();
}

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
      document.font(PDF_REGULAR_FONT_NAME).fontSize(8).fillColor(colors.muted);
      pdfText(document, field.label, x + 10, y + 8, {width: width - 20, align: "right"});
      document.font(PDF_BOLD_FONT_NAME).fontSize(10.2).fillColor(colors.ink);
      pdfText(document, field.value, x + 10, y + 23, {width: width - 20, align: "right", ellipsis: true, direction: field.ltr ? "ltr" : "rtl"});
    });
    document.y = y + 53;
  }
}

function measureParagraph(document: PDFKit.PDFDocument, value: string): {text: string; height: number} {
  document.font(PDF_REGULAR_FONT_NAME).fontSize(9.5);
  const text = wrapLogicalRtlText(document, formatPdfBidi(value), page.width - 24);
  const lineCount = text.split("\n").length;
  const height = Math.max(48, lineCount * (document.currentLineHeight(true) + 3) + 22);
  return {text, height};
}

function paragraph(document: PDFKit.PDFDocument, value: string, title: string, subtitle: string, tone: "default" | "notice" = "default"): void {
  const {text, height} = measureParagraph(document, value);
  ensureSpace(document, height + 8, title, subtitle);
  const y = document.y;
  document.roundedRect(page.left, y, page.width, height, 8).fillAndStroke(tone === "notice" ? colors.goldSoft : colors.paper, tone === "notice" ? colors.gold : colors.line);
  document.font(PDF_REGULAR_FONT_NAME).fontSize(9.5).fillColor(colors.ink);
  pdfText(document, text, page.left + 12, y + 11, {width: page.width - 24, align: "right", lineGap: 3});
  document.y = y + height + 8;
}

function liabilityHeading(liability: FullCaseLiabilitySnapshot, index: number): string {
  const formattedType = formatLiabilityType(liability.type);
  const title = liability.otherTypeDescription ? `${formattedType} — ${liability.otherTypeDescription}` : formattedType;
  return `התחייבות ${index + 1} — ${title}`;
}

function liabilityFields(liability: FullCaseLiabilitySnapshot): PdfField[] {
  const fields: PdfField[] = [
    {label: "החזר חודשי", value: formatCurrency(liability.monthlyPayment)},
    {label: "תאריך סיום", value: liability.endDate ? formatDate(liability.endDate) : "לא צוין"},
    {label: "הערות", value: liability.notes || "לא צוין"}
  ];
  if (liability.type !== "ALIMONY" && liability.type !== "RENT") fields.unshift({label: "יתרה נוכחית", value: formatCurrency(liability.currentBalance)});
  if ((liability.type === "LOAN" || liability.type === "MORTGAGE") && liability.financialInstitution) fields.unshift({label: "גוף פיננסי", value: liability.financialInstitution});
  return fields;
}

// Renders one liability as a single page-break-protected block: heading
// and every field for that liability stay together on one page.
function drawLiabilityCard(document: PDFKit.PDFDocument, liability: FullCaseLiabilitySnapshot, index: number, title: string, subtitle: string): void {
  const fields = liabilityFields(liability);
  keepTogether(document, 27 + fieldRowsHeight(fields), title, subtitle, () => {
    subHeading(document, liabilityHeading(liability, index));
    fieldRows(document, fields, title, subtitle);
  });
}

function borrowerHeading(borrower: {order?: number; firstName?: string; lastName?: string; label?: string; age: number | null}): string {
  const name = borrower.firstName ? `${borrower.firstName} ${borrower.lastName}` : borrower.label ?? `לווה ${borrower.order}`;
  return `${name} · גיל ${borrower.age ?? "לא צוין"}`;
}

const selfEmployedYearLabels = () => ({previousYear: currentIsraelYear() - 1, currentYear: currentIsraelYear()});

function selfEmployedFields(selfEmployed: FullCaseSelfEmployedSnapshot): PdfField[] {
  const {previousYear, currentYear} = selfEmployedYearLabels();
  return [
    {label: "סוג העיסוק", value: selfEmployed.businessType},
    {label: "שנת פתיחת העסק", value: selfEmployed.businessStartYear},
    {label: "וותק העסק", value: Number.isInteger(selfEmployed.businessStartYear) ? `${Math.max(0, currentYear - Number(selfEmployed.businessStartYear))} שנים` : "לא צוין"},
    {label: "הכנסה משומה אחרונה", value: formatCurrency(selfEmployed.lastAssessedIncome ?? 0)},
    {label: "שנת השומה", value: selfEmployed.assessmentYear},
    {label: `אישור הכנסות רו״ח ${previousYear}`, value: formatCurrency(selfEmployed.accountantIncomePreviousYear ?? 0)},
    {label: `הכנסות רו״ח ${currentYear}`, value: formatCurrency(selfEmployed.accountantIncomeCurrentYear ?? 0)},
    {label: "מספר חודשים", value: selfEmployed.accountantMonthsCount}
  ];
}

// Primary-income fields only (salaried or self-employed) — additional
// incomes are rendered as their own numbered-list section, never mixed in.
function primaryIncomeFields(borrower: FullCaseBorrowerSnapshot | MaskedCaseSnapshot["borrowers"][number], masked: boolean): PdfField[] {
  const isSelfEmployed = borrower.employment.employmentType === "SELF_EMPLOYED";
  const selfEmployed = "selfEmployed" in borrower.employment ? borrower.employment.selfEmployed : null;
  if (isSelfEmployed && selfEmployed) {
    return [{label: "סוג תעסוקה", value: formatEmploymentType(borrower.employment.employmentType)}, ...selfEmployedFields(selfEmployed), {label: "הכנסה חודשית נטו", value: formatCurrency(borrower.employment.monthlyNetIncome)}];
  }
  return [
    {label: "סוג תעסוקה", value: formatEmploymentType(borrower.employment.employmentType)},
    {label: "מקום עבודה", value: masked ? "********" : (borrower as FullCaseBorrowerSnapshot).employment.employerName},
    {label: "תפקיד", value: borrower.employment.jobTitle},
    {label: "ותק", value: `${borrower.employment.employmentSeniorityYears} שנים`},
    {label: "הכנסה חודשית נטו", value: formatCurrency(borrower.employment.monthlyNetIncome)}
  ];
}

function additionalIncomesOf(borrower: FullCaseBorrowerSnapshot | MaskedCaseSnapshot["borrowers"][number]): Array<{type: string; monthlyAmount: number; description: string | null}> {
  return borrower.employment.additionalIncomes ?? (borrower.employment.hasAdditionalIncome && borrower.employment.additionalIncomeType ? [{type: borrower.employment.additionalIncomeType, monthlyAmount: borrower.employment.additionalIncomeAmount, description: borrower.employment.additionalIncomeDescription}] : []);
}

function additionalIncomesText(additionalIncomes: Array<{type: string; monthlyAmount: number; description: string | null}>): string {
  if (!additionalIncomes.length) return "אין הכנסות נוספות ללווה זה.";
  return additionalIncomes.map((income, index) => `${index + 1}. ${formatAdditionalIncomeType(income.type)} — ${formatCurrency(income.monthlyAmount)}${income.description ? ` · ${income.description}` : ""}`).join("\n");
}

function creditIndicationFields(indication: CreditIndicationSnapshot): PdfField[] {
  const yesNo = (value: boolean | null) => value === true ? "כן" : value === false ? "לא" : "לא צוין";
  return [
    {label: "החזרי צ'קים", value: indication.bouncedChecks ? `כן (${indication.bouncedChecksCount ?? "-"})` : yesNo(indication.bouncedChecks)},
    {label: "החזרי הוראות קבע", value: indication.bouncedDirectDebits ? `כן (${indication.bouncedDirectDebitsCount ?? "-"})` : yesNo(indication.bouncedDirectDebits)},
    {label: "הוצאה לפועל", value: yesNo(indication.collectionProceedings)},
    {label: "פשיטת רגל", value: yesNo(indication.bankruptcy)},
    {label: "עיקולים", value: yesNo(indication.liens)},
    {label: "פיגורים במשכנתא", value: yesNo(indication.mortgageArrears)}
  ];
}

function documentStatusFields(documents: VersionDocumentSnapshot[], borrowers: Array<{order: number}>): PdfField[] {
  const fields: PdfField[] = [];
  for (const borrower of borrowers) {
    for (const type of REQUIRED_BORROWER_DOCUMENT_TYPES) {
      fields.push({label: requiredDocumentLabel(type, borrower.order), value: documents.some((item) => item.borrowerOrder === borrower.order && item.documentType === type) ? "קיים בתיק" : "חסר"});
    }
  }
  for (const type of REQUIRED_CLIENT_DOCUMENT_TYPES) fields.push({label: requiredDocumentLabel(type), value: documents.some((item) => item.borrowerId === null && item.documentType === type) ? "קיים בתיק" : "חסר"});
  return fields;
}

export function drawPageFooter(document: PDFKit.PDFDocument, pageNumber: number, pageCount: number, producedAt: Date): void {
  const originalBottomMargin = document.page.margins.bottom;
  document.page.margins.bottom = 0;
  document.rect(0, 782, 595.28, 60).fill(colors.navy);
  document.font(PDF_REGULAR_FONT_NAME).fontSize(8).fillColor("#c9d6e2");
  pdfText(document, `מידע סודי · הופק ${formatDate(producedAt)} · עמוד ${pageNumber} מתוך ${pageCount}`, page.left, 800, {width: page.width, height: 10, align: "center", lineBreak: false});
  document.font(PDF_BOLD_FONT_NAME).fontSize(7).fillColor(colors.gold);
  pdfText(document, "SYNCASH", page.left, 817, {width: page.width, height: 9, align: "center", characterSpacing: 1.4, lineBreak: false, direction: "ltr"});
  document.page.margins.bottom = originalBottomMargin;
}

function finish(document: PDFKit.PDFDocument, producedAt: Date): void {
  const range = document.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    document.switchToPage(range.start + index);
    drawPageFooter(document, index + 1, range.count, producedAt);
    if (document.bufferedPageRange().count !== range.count) throw new Error("PDF_FOOTER_CREATED_UNEXPECTED_PAGE");
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

// No version number in the subtitle: the internal case-version mechanism
// must never surface as "גרסה N" on a user-facing PDF page.
function caseSubtitle(publicCaseNumber: string, createdAt: Date): string {
  return `תיק ${publicCaseNumber} · הופק ${formatDate(createdAt)}`;
}

export async function createMaskedCasePdf(snapshot: MaskedCaseSnapshot, metadata: {versionNumber: number; createdAt: Date}): Promise<Buffer> {
  const title = "תיק מימון לבחינה ראשונית";
  const subtitle = caseSubtitle(snapshot.publicCaseNumber, metadata.createdAt);
  const document = createDocument(`SynCash masked case ${snapshot.publicCaseNumber}`, metadata.createdAt);
  return toBuffer(document, () => {
    drawPageHeader(document, title, subtitle);

    // 1. תקציר העסקה
    sectionTitle(document, "תקציר העסקה", title, subtitle);
    fieldRows(document, [
      {label: "מספר תיק", value: snapshot.publicCaseNumber, ltr: true}, {label: "סטטוס", value: formatClientStatus(snapshot.status ?? "ACTIVE")},
      {label: "מספר לווים", value: snapshot.numberOfBorrowers},
      {label: "סכום מבוקש", value: formatCurrency(snapshot.loanRequest.requestedAmount)}, {label: "שווי הנכס", value: formatCurrency(snapshot.property.value)},
      {label: "אחוז מימון", value: `${snapshot.loanRequest.loanToValue}%`}, {label: "מטרת ההלוואה", value: formatDealType(snapshot.loanRequest.purpose)}
    ], title, subtitle);

    // 2. סיכום פיננסי ומשפחתי
    sectionTitle(document, "סיכום פיננסי ומשפחתי", title, subtitle);
    fieldRows(document, [
      {label: "סך הכנסה חודשית", value: formatCurrency(snapshot.totals.monthlyIncome)}, {label: "סך התחייבויות", value: formatCurrency(snapshot.totals.liabilityBalance)},
      {label: "סך החזרים חודשיים", value: formatCurrency(snapshot.totals.monthlyPayments)}, {label: "מספר לווים", value: snapshot.numberOfBorrowers},
      {label: "קשר בין הלווים", value: formatBorrowerRelationship(snapshot.borrowerRelationship)},
      {label: "גילאי הילדים", value: snapshot.household.childrenAges.length ? snapshot.household.childrenAges.join(", ") : "אין ילדים"}
    ], title, subtitle);

    // 3. חיווי אשראי
    if (snapshot.creditIndication) {
      sectionTitle(document, "חיווי אשראי", title, subtitle);
      paragraph(document, "האם היו ב-3 השנים האחרונות:", title, subtitle);
      fieldRows(document, creditIndicationFields(snapshot.creditIndication), title, subtitle);
    }

    // 4. פרטי לווים מוגבלים
    sectionTitle(document, "פרטי לווים מוגבלים", title, subtitle);
    for (const borrower of snapshot.borrowers) {
      const fields: PdfField[] = [
        {label: "עיר מגורים", value: borrower.residenceCity}, {label: "מצב משפחתי", value: formatMaritalStatus(borrower.maritalStatus)},
        {label: "מספר ילדים", value: borrower.numberOfChildren}, {label: "גילאי ילדים", value: borrower.childrenAges.length ? borrower.childrenAges.join(", ") : "אין"}
      ];
      keepTogether(document, 27 + fieldRowsHeight(fields), title, subtitle, () => {
        subHeading(document, borrowerHeading(borrower));
        fieldRows(document, fields, title, subtitle);
      });
    }

    // 5. הכנסות רלוונטיות לבחינה ראשונית
    sectionTitle(document, "הכנסות רלוונטיות לבחינה ראשונית", title, subtitle);
    for (const borrower of snapshot.borrowers) {
      const fields = primaryIncomeFields(borrower, true);
      const additionalText = additionalIncomesText(additionalIncomesOf(borrower));
      const {height: additionalHeight} = measureParagraph(document, additionalText);
      keepTogether(document, 27 + fieldRowsHeight(fields), title, subtitle, () => {
        subHeading(document, borrowerHeading(borrower));
        fieldRows(document, fields, title, subtitle);
      });
      keepTogether(document, additionalHeight + 8, title, subtitle, () => paragraph(document, additionalText, title, subtitle));
    }

    // 6. התחייבויות
    sectionTitle(document, "התחייבויות", title, subtitle);
    const liabilities = [...snapshot.borrowers.flatMap((borrower) => borrower.liabilities), ...snapshot.householdLiabilities];
    if (liabilities.length) liabilities.forEach((liability, index) => drawLiabilityCard(document, liability, index, title, subtitle));
    else paragraph(document, "לא דווחו התחייבויות פעילות.", title, subtitle);

    // 7. נכס ובקשת מימון
    sectionTitle(document, "נכס ובקשת מימון", title, subtitle);
    fieldRows(document, [
      {label: "סוג נכס", value: formatPropertyType(snapshot.property.propertyType)}, {label: "עיר הנכס", value: snapshot.property.city},
      {label: "שווי הנכס", value: formatCurrency(snapshot.property.value)}, {label: "סכום מבוקש", value: formatCurrency(snapshot.loanRequest.requestedAmount)},
      {label: "תקופה מבוקשת", value: `${snapshot.loanRequest.requestedTermMonths} חודשים`}, {label: "אחוז מימון", value: `${snapshot.loanRequest.loanToValue}%`}
    ], title, subtitle);

    // 8. פירוט העסקה
    sectionTitle(document, "פירוט העסקה", title, subtitle);
    paragraph(document, snapshot.dealDetails, title, subtitle);

    // 9. סטטוס מסמכי חובה
    sectionTitle(document, "סטטוס מסמכי חובה", title, subtitle);
    paragraph(document, snapshot.documentStatus, title, subtitle);

    paragraph(document, "מסמך זה מיועד לבחינה ראשונית בלבד. פרטים מזהים מסוימים אינם מוצגים בשלב זה.", title, subtitle, "notice");
    finish(document, metadata.createdAt);
  });
}

export async function createFullCasePdf(snapshot: FullCaseSnapshot, metadata: {versionNumber: number; createdAt: Date}): Promise<Buffer> {
  const title = "תיק מימון מלא";
  const subtitle = caseSubtitle(snapshot.publicCaseNumber, metadata.createdAt);
  const document = createDocument(`SynCash full case ${snapshot.publicCaseNumber}`, metadata.createdAt);
  return toBuffer(document, () => {
    drawPageHeader(document, title, subtitle);

    // 1. תקציר בקשת המימון
    sectionTitle(document, "תקציר בקשת המימון", title, subtitle);
    fieldRows(document, [
      {label: "מספר תיק", value: snapshot.publicCaseNumber, ltr: true}, {label: "סטטוס", value: formatClientStatus(snapshot.status ?? "ACTIVE")},
      {label: "מספר לווים", value: snapshot.numberOfBorrowers},
      {label: "קשר בין הלווים", value: formatBorrowerRelationship(snapshot.borrowerRelationship)}, {label: "מטרת ההלוואה", value: formatDealType(snapshot.loanRequest.purpose)},
      {label: "סכום מבוקש", value: formatCurrency(snapshot.loanRequest.requestedAmount)}, {label: "שווי הנכס", value: formatCurrency(snapshot.property.value)}
    ], title, subtitle);

    // 2. סיכום פיננסי ומשפחתי
    sectionTitle(document, "סיכום פיננסי ומשפחתי", title, subtitle);
    fieldRows(document, [
      {label: "סך הכנסה", value: formatCurrency(snapshot.totals.monthlyIncome)}, {label: "סך התחייבויות", value: formatCurrency(snapshot.totals.liabilityBalance)},
      {label: "סך החזרים", value: formatCurrency(snapshot.totals.monthlyPayments)}, {label: "מספר לווים", value: snapshot.numberOfBorrowers},
      {label: "קשר בין הלווים", value: formatBorrowerRelationship(snapshot.borrowerRelationship)},
      {label: "גילאי הילדים", value: snapshot.household.childrenAges.length ? snapshot.household.childrenAges.join(", ") : "אין ילדים"}
    ], title, subtitle);

    // 3. חיווי אשראי (full PDF only)
    if (snapshot.creditIndication) {
      sectionTitle(document, "חיווי אשראי", title, subtitle);
      paragraph(document, "האם היו ב-3 השנים האחרונות:", title, subtitle);
      fieldRows(document, creditIndicationFields(snapshot.creditIndication), title, subtitle);
    }

    // 4/7. פרטי לווה N, 5/8. הכנסות לווה N, 6. הכנסות נוספות לווה N
    for (const borrower of snapshot.borrowers) {
      sectionTitle(document, `פרטי לווה ${borrower.order} — ${borrowerHeading(borrower)}`, title, subtitle);
      fieldRows(document, [
        {label: "שם מלא", value: `${borrower.firstName} ${borrower.lastName}`}, {label: "מספר תעודת זהות", value: borrower.identityNumber, ltr: true},
        {label: "תאריך לידה", value: formatDate(borrower.dateOfBirth)}, {label: "טלפון", value: borrower.phone, ltr: true},
        {label: "דוא״ל", value: borrower.email, ltr: true}, {label: "עיר מגורים", value: borrower.city},
        {label: "רחוב ומספר בית", value: borrower.streetAddress}, {label: "מצב משפחתי", value: formatMaritalStatus(borrower.maritalStatus)},
        {label: "מספר ילדים", value: borrower.numberOfChildren}, {label: "גילאי ילדים", value: borrower.childrenAges.length ? borrower.childrenAges.join(", ") : "אין"}
      ], title, subtitle);

      sectionTitle(document, `הכנסות — לווה ${borrower.order}`, title, subtitle);
      fieldRows(document, primaryIncomeFields(borrower, false), title, subtitle);

      sectionTitle(document, `הכנסות נוספות — לווה ${borrower.order}`, title, subtitle);
      paragraph(document, additionalIncomesText(additionalIncomesOf(borrower)), title, subtitle);
    }

    // 9. התחייבויות
    sectionTitle(document, "התחייבויות", title, subtitle);
    const liabilities = [...snapshot.borrowers.flatMap((borrower) => borrower.liabilities), ...snapshot.householdLiabilities];
    if (liabilities.length) liabilities.forEach((liability, index) => drawLiabilityCard(document, liability, index, title, subtitle));
    else paragraph(document, "לא דווחו התחייבויות פעילות.", title, subtitle);

    // 10. נכס
    sectionTitle(document, "נכס ובקשת מימון", title, subtitle);
    fieldRows(document, [
      {label: "סוג נכס", value: formatPropertyType(snapshot.property.propertyType)}, {label: "עיר", value: snapshot.property.city},
      {label: "כתובת הנכס", value: snapshot.property.address}, {label: "שווי הנכס", value: formatCurrency(snapshot.property.value)},
      {label: "סכום מבוקש", value: formatCurrency(snapshot.loanRequest.requestedAmount)}, {label: "תקופה מבוקשת", value: `${snapshot.loanRequest.requestedTermMonths} חודשים`},
      {label: "אחוז מימון", value: `${snapshot.loanRequest.loanToValue}%`}, {label: "מטרת ההלוואה", value: formatDealType(snapshot.loanRequest.purpose)}
    ], title, subtitle);

    // 11. פירוט העסקה
    sectionTitle(document, "פירוט העסקה", title, subtitle);
    paragraph(document, snapshot.dealDetails, title, subtitle);

    // 12. מסמכי התיק
    sectionTitle(document, "סטטוס מסמכי חובה", title, subtitle);
    const requiredDocuments = documentStatusFields(snapshot.documents, snapshot.borrowers);
    paragraph(document, requiredDocuments.every((field) => field.value === "קיים בתיק") ? "כל מסמכי החובה קיימים בתיק." : "חסרים מסמכי חובה בתיק.", title, subtitle);
    fieldRows(document, requiredDocuments, title, subtitle);
    if (snapshot.documents.length) {
      sectionTitle(document, "מסמכים בתיק", title, subtitle);
      fieldRows(document, snapshot.documents.flatMap((item, index) => [
        {label: `מסמך ${index + 1}`, value: getDocumentDisplayName(item, item.borrowerOrder)},
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
  const document = createDocument(`SynCash case ${snapshot.publicCaseNumber}`, createdAt);
  return toBuffer(document, () => {
    drawPageHeader(document, title, subtitle);
    sectionTitle(document, "תקציר אנונימי", title, subtitle);
    fieldRows(document, snapshotDisplayEntries(snapshot).map(([label, value]) => ({label, value})), title, subtitle);
    paragraph(document, "המסמך אינו כולל פרטים המאפשרים לזהות את הלקוח או את היועץ.", title, subtitle, "notice");
    finish(document, createdAt);
  });
}
