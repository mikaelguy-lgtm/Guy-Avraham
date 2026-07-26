import type {DocumentRecord} from "../types";
import {formatDocumentType} from "./formatters";

type DisplayableDocument = Pick<DocumentRecord, "customTitle" | "documentType">;
type DownloadableDocument = DisplayableDocument & Pick<DocumentRecord, "mimeType">;

const fileExtensions: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png"
};

export function getDocumentDisplayName(document: DisplayableDocument): string {
  if (document.documentType !== "OTHER") return formatDocumentType(document.documentType);

  const customTitle = document.customTitle?.trim();
  return customTitle ? `מסמך נוסף — ${customTitle}` : "מסמך נוסף";
}

export function getDocumentDownloadName(document: DownloadableDocument): string {
  return `${getDocumentDisplayName(document)}${fileExtensions[document.mimeType] ?? ""}`;
}
