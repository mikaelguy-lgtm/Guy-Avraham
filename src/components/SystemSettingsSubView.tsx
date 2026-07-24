import { Link } from "react-router-dom";
import type { CurrentUser } from "../types";

export default function SystemSettingsSubView({user}: {user: CurrentUser}) {
  return <main className="admin-page"><section className="panel"><h1>הגדרות מערכת</h1><p>הגדרות תפעול, אבטחה ושירותים חיצוניים.</p>{user.role === "SUPER_ADMIN" ? <Link className="settings-link" to="/admin/settings/smtp"><strong>דואר יוצא</strong><span>הגדרות SMTP ושליחת הודעת בדיקה</span></Link> : <p className="permission-note">הגדרות דואר יוצא זמינות לסופר אדמין בלבד.</p>}</section></main>;
}
