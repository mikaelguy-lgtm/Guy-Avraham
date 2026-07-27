let activePdfObjectUrl: string | undefined;

export function openFreshPdfBlob(blob: Blob): void {
  if (activePdfObjectUrl) URL.revokeObjectURL(activePdfObjectUrl);
  const objectUrl = URL.createObjectURL(blob);
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
