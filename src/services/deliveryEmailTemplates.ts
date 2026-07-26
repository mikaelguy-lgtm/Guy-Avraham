const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"})[character]!);
const shell = (content: string) => `<div dir="rtl" lang="he" style="font-family:Arial,sans-serif;line-height:1.7;color:#102a43;max-width:640px;margin:auto"><div style="background:#07101f;padding:20px;border-radius:14px;color:#fff"><strong style="color:#35d0ba;font-size:20px">SynCash</strong></div><div style="padding:24px">${content}</div></div>`;
const button = (label: string, url: string) => `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 20px;border-radius:9px;text-decoration:none">${escapeHtml(label)}</a></p>`;

export interface DeliveryEmailContent {subject: string; html: string; text: string}

export const deliveryEmailTemplates = {
  initial(values: {contactFirstName: string; companyName: string; publicCaseNumber: string; deadline: string; url: string}): DeliveryEmailContent {
    const subject = `תיק מימון חדש לבחינתכם | SynCash | תיק ${values.publicCaseNumber}`;
    const text = `שלום ${values.contactFirstName},\n\nהתקבל עבור חברת ${values.companyName} תיק מימון חדש לבחינה. בשלב זה אין גישה לפרטים מזהים, לפרטי היועץ או למסמכים.\nמועד אחרון: ${values.deadline}\n${values.url}\n\nSynCash`;
    return {subject, text, html: shell(`<p>שלום ${escapeHtml(values.contactFirstName)},</p><p>התקבל עבור חברת ${escapeHtml(values.companyName)} תיק מימון חדש לבחינה.</p><p>יש לעבור תחילה על התיק המוסווה ולבחור האם חברתכם מעוניינת להמשיך. בשלב זה אין גישה לפרטי הזיהוי, לפרטי היועץ או למסמכי הלקוח.</p><p><strong>המועד האחרון למתן תשובה:</strong><br>${escapeHtml(values.deadline)}</p>${button("מעבר לבדיקת התיק", values.url)}<p>הקישור אישי ומיועד לאנשי הקשר המורשים בחברתכם.</p><p>בברכה,<br>SynCash</p>`) };
  },
  reminder(values: {contactFirstName: string; companyName: string; publicCaseNumber: string; deadline: string; url: string}): DeliveryEmailContent {
    const subject = `תזכורת: נדרשת תגובתכם לתיק מימון | SynCash | תיק ${values.publicCaseNumber}`;
    const text = `שלום ${values.contactFirstName},\nטרם התקבלה תגובת חברת ${values.companyName}. המועד האחרון: ${values.deadline}\n${values.url}`;
    return {subject, text, html: shell(`<p>שלום ${escapeHtml(values.contactFirstName)},</p><p>טרם התקבלה תגובת חברת ${escapeHtml(values.companyName)} לתיק המימון שנשלח לבחינתכם.</p><p><strong>המועד האחרון:</strong> ${escapeHtml(values.deadline)}</p>${button("מעבר לבדיקת התיק", values.url)}<p>בברכה,<br>SynCash</p>`)};
  },
  otp(values: {contactFirstName: string; companyName: string; publicCaseNumber: string; code: string; portal: boolean}): DeliveryEmailContent {
    const subject = values.portal ? "קוד אימות לפתיחת תיק מלא | SynCash" : "קוד אימות לפתיחת תיק מימון | SynCash";
    const action = values.portal ? "לפתוח את התיק המלא" : `לאשר שחברת ${values.companyName} מעוניינת להמשיך בטיפול בתיק ${values.publicCaseNumber}`;
    const text = `שלום ${values.contactFirstName},\nקוד האימות שלך: ${values.code}\nהקוד תקף ל-10 דקות.`;
    return {subject, text, html: shell(`<p>שלום ${escapeHtml(values.contactFirstName)},</p><p>התקבלה בקשה ${escapeHtml(action)}.</p><p style="font-size:30px;letter-spacing:8px;font-weight:bold">${escapeHtml(values.code)}</p><p>הקוד תקף ל־10 דקות והוא אישי וחד־פעמי.</p><p>אם לא ביקשת את הקוד, אין לבצע פעולה.</p><p>בברכה,<br>SynCash</p>`)};
  },
  fullAccess(values: {companyName: string; publicCaseNumber: string; expiresAt: string; url: string}): DeliveryEmailContent {
    const subject = `גישה מלאה לתיק מימון נפתחה | SynCash | תיק ${values.publicCaseNumber}`;
    const text = `חברת ${values.companyName} אישרה התעניינות. הגישה המלאה פתוחה עד ${values.expiresAt}.\n${values.url}`;
    return {subject, text, html: shell(`<p>חברת ${escapeHtml(values.companyName)} אישרה שהיא מעוניינת להמשיך בטיפול בתיק ${escapeHtml(values.publicCaseNumber)}.</p><p>נפתחה גישה מלאה לפרטי התיק, למסמכים ולפרטי היועץ למשך 7 ימים.</p>${button("מעבר לתיק המלא", values.url)}<p><strong>תוקף הגישה:</strong> ${escapeHtml(values.expiresAt)}</p><p>מטעמי אבטחה יישלח קוד אישי בעת הכניסה.</p><p>בברכה,<br>SynCash</p>`)};
  },
  decision(values: {companyName: string; publicCaseNumber: string; interested: boolean}): DeliveryEmailContent {
    const subject = values.interested ? `חברתכם ממשיכה בטיפול | SynCash | תיק ${values.publicCaseNumber}` : `תודה על תגובתכם | SynCash | תיק ${values.publicCaseNumber}`;
    const state = values.interested ? "חברתכם אישרה שהיא מעוניינת להמשיך בטיפול בתיק." : "התיק סומן כלא מתאים עבור חברתכם.";
    return {subject, text: `${state}\nתודה על המענה.`, html: shell(`<p>התקבלה תגובה מטעם חברת ${escapeHtml(values.companyName)} לתיק ${escapeHtml(values.publicCaseNumber)}.</p><p>${escapeHtml(state)}</p><p>תודה על המענה.<br>SynCash</p>`)};
  },
  advisor(values: {advisorFirstName: string; companyName: string; interested: boolean; url: string; contact?: string}): DeliveryEmailContent {
    const subject = values.interested ? `חברת ${values.companyName} מעוניינת בתיק` : `חברת ${values.companyName} אינה מעוניינת בתיק`;
    const state = values.interested ? "אישרה שהיא מעוניינת להמשיך בטיפול בתיק." : "השיבה שאינה מעוניינת להמשיך בטיפול בתיק.";
    return {subject, text: `שלום ${values.advisorFirstName},\nחברת ${values.companyName} ${state}\n${values.contact ?? ""}\n${values.url}`, html: shell(`<p>שלום ${escapeHtml(values.advisorFirstName)},</p><p>חברת ${escapeHtml(values.companyName)} ${escapeHtml(state)}</p>${values.contact ? `<p>${escapeHtml(values.contact)}</p>` : ""}${button("מעבר לסטטוס החברות בתיק", values.url)}`)};
  },
  advisorDeliveryFailure(values: {advisorFirstName: string; companyName: string; publicCaseNumber: string; url: string}): DeliveryEmailContent {
    const subject = `נדרש טיפול בכשל שליחת תיק | SynCash | תיק ${values.publicCaseNumber}`;
    const text = `שלום ${values.advisorFirstName},\nשליחת ההזמנה לחברת ${values.companyName} נכשלה לאחר ניסיונות חוזרים. ניתן לצפות בפרטים המסוננים במסך תגובות החברות.\n${values.url}`;
    return {subject, text, html: shell(`<p>שלום ${escapeHtml(values.advisorFirstName)},</p><p>שליחת אחת ההזמנות לחברת ${escapeHtml(values.companyName)} נכשלה לאחר ניסיונות חוזרים.</p><p>לא נכללו בהודעה פרטי SMTP או מידע רגיש.</p>${button("מעבר לסטטוס החברות בתיק", values.url)}`)};
  },
  advisorExpired(values: {advisorFirstName: string; companyName: string; publicCaseNumber: string; url: string}): DeliveryEmailContent {
    const subject = `מועד תגובת חברה הסתיים | SynCash | תיק ${values.publicCaseNumber}`;
    const text = `שלום ${values.advisorFirstName},\nחברת ${values.companyName} לא השלימה תגובה לתיק ${values.publicCaseNumber} במועד.\n${values.url}`;
    return {subject, text, html: shell(`<p>שלום ${escapeHtml(values.advisorFirstName)},</p><p>חברת ${escapeHtml(values.companyName)} לא השלימה תגובה לתיק ${escapeHtml(values.publicCaseNumber)} במועד.</p>${button("מעבר לסטטוס החברות בתיק", values.url)}`)};
  }
};
