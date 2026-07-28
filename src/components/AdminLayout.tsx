import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import type { CurrentUser } from "../types";
import { api } from "../utils/apiClient";
import Sidebar from "./Sidebar";
import SynCashLogo from "./SynCashLogo";

export default function AdminLayout({user}: {user: CurrentUser}) {
  const navigate = useNavigate();
  const location = useLocation();
  const showBack = location.pathname !== "/admin";
  const [emailDeliveryEnabled, setEmailDeliveryEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    void api.emailDeliveryStatus().then((result) => setEmailDeliveryEnabled(result.active)).catch(() => setEmailDeliveryEnabled(false));
  }, [location.pathname]);
  return <div className="admin-app" dir="rtl">
    <header className="topbar admin-topbar">
      <SynCashLogo size="sm" showSubtitle={false} />
      <span>{user.firstName} {user.lastName} · {user.roleLabel}</span>
      <div className="header-actions">
        {showBack && <button type="button" className="secondary-button" onClick={() => navigate("/admin")}>חזרה ללוח הבקרה</button>}
        <button type="button" onClick={() => void api.logout()}>יציאה</button>
      </div>
    </header>
    {emailDeliveryEnabled === false && <div className="service-status-banner" role="status">שירות הדוא״ל טרם הוגדר. הרשמה, אימות מייל, OTP והזמנות מושבתים.</div>}
    <div className="admin-layout"><Sidebar onLogout={() => void api.logout()} /><section className="admin-content"><Outlet /></section></div>
  </div>;
}
