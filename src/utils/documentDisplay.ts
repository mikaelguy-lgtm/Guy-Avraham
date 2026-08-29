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
