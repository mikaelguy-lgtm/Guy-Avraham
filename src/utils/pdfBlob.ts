let activePdfObjectUrl: string | undefined;

export function openFreshPdfBlob(blob: Blob, filename?: string): void {
  if (activePdfObjectUrl) URL.revokeObjectURL(activePdfObjectUrl);
  // עטיפת ה-Blob כ-File עם שם קריא: כך דפדפנים שמציעים "שמירה בשם" מתוך תצוגת ה-PDF המוטמעת
  // (ולא הורדה ישירה דרך <a download>) מציעים את השם הזה במקום מזהה ה-blob: הגולמי.
  const source = filename ? new File([blob], filename, {type: blob.type || "application/pdf"}) : blob;
  const objectUrl = URL.createObjectURL(source);
  activePdfObjectUrl = objectUrl;
  const pdfWindow = window.open(objectUrl, "_blank");
  if (pdfWindow) pdfWindow.opener = null;
  window.setTimeout(() => {
    if (activePdfObjectUrl !== objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    activePdfObjectUrl = undefined;
  }, 60_000);
}

export function revokeActivePdfBlob(): void {
  if (!activePdfObjectUrl) return;
  URL.revokeObjectURL(activePdfObjectUrl);
  activePdfObjectUrl = undefined;
}
