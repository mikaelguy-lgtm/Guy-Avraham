let activePdfObjectUrl: string | undefined;

// שם קובץ לא תקין בהורדה — root cause: openFreshPdfBlob() עוטף את ה-Blob באובייקט File עם שם
// קריא, אבל window.open() על blob: URL אינו שומר את המטא-דאטה הזו כלל — מאומת ישירות (בדיקת
// Playwright שהורידה PDF אמיתי מהאפליקציה קיבלה UUID גולמי, בדיוק כמו התקלה שדווחה). שם קובץ
// אמין ב-100% מתקבל רק דרך תג <a download="..."> אמיתי, ולכן זו הדרך היחידה שנתמכת כאן להורדה.
export function downloadPdfBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export function openFreshPdfBlob(blob: Blob, filename?: string): void {
  if (activePdfObjectUrl) URL.revokeObjectURL(activePdfObjectUrl);
  // עטיפת ה-Blob כ-File עם שם קריא: כך דפדפנים שמציעים "שמירה בשם" מתוך תצוגת ה-PDF המוטמעת
  // (ולא הורדה ישירה דרך <a download>) מציעים את השם הזה במקום מזהה ה-blob: הגולמי.
  const source = filename ? new File([blob], filename, {type: blob.type || "application/pdf"}) : blob;
  const objectUrl = URL.createObjectURL(source);
  activePdfObjectUrl = objectUrl;
  const pdfWindow = window.open(objectUrl, "_blank");
  if (pdfWindow) pdfWindow.opener = null;
  // אין הפעלת טיימר שמבטל את ה-URL אחרי זמן קבוע: כך היה בעבר (60 שניות), וזה בדיוק מה שגרם
  // ל"תצוגה המקדימה פגה" — ה-blob: URL היה מתבטל מתחת ללשונית הפתוחה גם אם המשתמש עדיין צופה
  // בה. הניקוי היחיד שנדרש הוא בפתיחת PDF הבא (השורה הראשונה כאן) ובעת פירוק הרכיב הקורא
  // (revokeActivePdfBlob, שכבר מחובר ל-unmount ב-LoanArena) — לא טיימר גלובלי שלא יודע אם
  // המשתמש עדיין צריך את ה-URL.
}

export function revokeActivePdfBlob(): void {
  if (!activePdfObjectUrl) return;
  URL.revokeObjectURL(activePdfObjectUrl);
  activePdfObjectUrl = undefined;
}
