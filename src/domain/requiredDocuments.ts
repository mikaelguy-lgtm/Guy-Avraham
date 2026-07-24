import { REQUIRED_BORROWER_DOCUMENT_TYPES, REQUIRED_CLIENT_DOCUMENT_TYPES } from "./clientFields.js";

export interface RequiredDocumentOwner {
  id: number;
  borrowerOrder: number;
}

export interface ExistingRequiredDocument {
  borrowerId: number | null;
  documentType: string;
  status: string;
  deletedAt?: Date | string | null;
}

export interface MissingRequiredDocument {
  documentType: string;
  borrowerId: number | null;
  borrowerOrder: number | null;
  label: string;
}

const labels: Record<string, string> = {
  ID_FRONT: "תעודת זהות — צד קדמי",
  ID_BACK: "תעודת זהות — צד אחורי",
  ID_APPENDIX: "ספח תעודת זהות",
  PROPERTY_RIGHTS: "נסח טאבו או אישור זכויות",
  POWER_OF_ATTORNEY: "כתב הסמכה"
};

export function requiredDocumentLabel(documentType: string, borrowerOrder?: number | null): string {
  const label = labels[documentType] ?? "מסמך חובה";
  return borrowerOrder ? `${label} — לווה ${borrowerOrder}` : label;
}

export function listMissingRequiredDocuments(borrowers: RequiredDocumentOwner[], documents: ExistingRequiredDocument[]): MissingRequiredDocument[] {
  const valid = documents.filter((document) => !document.deletedAt && ["UPLOADED", "VERIFIED", "REPLACED"].includes(document.status));
  const missing: MissingRequiredDocument[] = [];
  for (const borrower of borrowers) {
    for (const documentType of REQUIRED_BORROWER_DOCUMENT_TYPES) {
      if (!valid.some((document) => document.borrowerId === borrower.id && document.documentType === documentType)) {
        missing.push({documentType, borrowerId: borrower.id, borrowerOrder: borrower.borrowerOrder, label: requiredDocumentLabel(documentType, borrower.borrowerOrder)});
      }
    }
  }
  for (const documentType of REQUIRED_CLIENT_DOCUMENT_TYPES) {
    if (!valid.some((document) => document.borrowerId === null && document.documentType === documentType)) {
      missing.push({documentType, borrowerId: null, borrowerOrder: null, label: requiredDocumentLabel(documentType)});
    }
  }
  return missing;
}
