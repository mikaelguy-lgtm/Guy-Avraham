import { Link } from "react-router-dom";
import type { CurrentUser } from "../types";

export default function SystemSettingsSubView({user}: {user: CurrentUser}) {
  return <main className="admin-page"><section className="panel"><h1>הגדרות מערכת</h1><p>הגדרות תפעול, אבטחה ושירותים חיצוניים.</p>
    {user.role === "SUPER_ADMIN" ? <>
      <Link className="settings-link" to="/admin/settings/smtp"><strong>דואר יוצא</strong><span>הגדרות SMTP ושליחת הודעת בדיקה</span></Link>
      <Link className="settings-link" to="/admin/settings/legal"><strong>מסמכים משפטיים</strong><span>תנאי שימוש, מדיניות פרטיות ו-DPA — עריכה, תצוגה מקדימה ופרסום גרסאות</span></Link>
      <Link className="settings-link" to="/admin/settings/privacy-requests"><strong>בקשות פרטיות</strong><span>עיון/תיקון/מחיקה/סגירת חשבון שהתקבלו ממרכז המסמכים המשפטיים</span></Link>
    </> : <p className="permission-note">הגדרות דואר יוצא, מסמכים משפטיים ובקשות פרטיות זמינות לסופר אדמין בלבד.</p>}
  </section></main>;
}
