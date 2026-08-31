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
