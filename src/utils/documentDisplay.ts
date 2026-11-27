import type {DocumentRecord} from "../types.js";
import {formatDocumentType} from "./formatters.js";

type DisplayableDocument = Pick<DocumentRecord, "customTitle" | "documentType">;
type DownloadableDocument = DisplayableDocument & Pick<DocumentRecord, "mimeType">;

const fileExtensions: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png"
};

export function getDocumentDisplayName(document: DisplayableDocument, borrowerOrder?: number | null): string {
  const base = document.documentType !== "OTHER"
    ? formatDocumentType(document.documentType)
    : (document.customTitle?.trim() ? `מסמך נוסף — ${document.customTitle.trim()}` : "מסמך נוסף");
  return borrowerOrder ? `${base} — לווה ${borrowerOrder}` : base;
}

export function getDocumentDownloadName(document: DownloadableDocument, borrowerOrder?: number | null): string {
  return `${getDocumentDisplayName(document, borrowerOrder)}${fileExtensions[document.mimeType] ?? ""}`;
}

// שם קטע בטוח לנתיב בתוך ZIP: כותרת מסמך היא טקסט חופשי של היועץ, ולכן "/", "\", ".." ותווי
// בקרה יכלו ליצור zip-slip (כתיבה מחוץ לתיקיית החילוץ) אצל גוף המימון.
export function safeArchiveSegment(value: string): string {
  const withoutControls = Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code === 0x7f ? "_" : character;
  }).join("");
  const cleaned = withoutControls
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, 120);
  return cleaned || "מסמך";
}
