import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { auth } from "./lib/firebase";
import type { CurrentUser } from "./types";
import { api } from "./utils/apiClient";
import { canAccessAdmin, canAccessSmtpSettings, homePathForRole } from "./utils/roleRoutes";
import AuthScreen from "./components/AuthScreen";
import DashboardView from "./components/DashboardView";
import LenderPortal from "./components/LenderPortal";
import SynCashLogo from "./components/SynCashLogo";
import AdminDashboard from "./components/AdminDashboard";
import SettingsView from "./components/SettingsView";
import AdminLayout from "./components/AdminLayout";
import AdminHome from "./components/AdminHome";
import AdminSectionPage from "./components/AdminSectionPage";
import SystemSettingsSubView from "./components/SystemSettingsSubView";
import AdvisorLayout from "./components/AdvisorLayout";
import AdvisorDocumentsView from "./components/AdvisorDocumentsView";
import AdvisorArenaView from "./components/AdvisorArenaView";
import AdvisorNotificationsView from "./components/AdvisorNotificationsView";
import AdvisorProfileView from "./components/AdvisorProfileView";
import ClientDetailView from "./components/ClientDetailView";
import NewClientWizard from "./components/NewClientWizard";
import AdvisorRegistrationScreen from "./components/AdvisorRegistrationScreen";
import EmailVerificationScreen from "./components/EmailVerificationScreen";
import AdminAdvisorsView from "./components/AdminAdvisorsView";

function InviteRoute({user, onAuthenticated}: {user: CurrentUser | null; onAuthenticated: (user: CurrentUser) => void}) {
  const {token = ""} = useParams();
  return <LenderPortal token={decodeURIComponent(token)} user={user} onAuthenticated={onAuthenticated} />;
}

function StandardHeader({user}: {user: CurrentUser}) {
  return <header className="topbar"><SynCashLogo size="sm" showSubtitle={false} /><span>{user.firstName} {user.lastName} · {user.roleLabel}</span><button onClick={() => void api.logout()}>יציאה</button></header>;
}

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => onAuthStateChanged(auth, async (firebaseUser) => {
    try { setUser(firebaseUser ? await api.me() : null); } catch { setUser(null); }
    finally { setReady(true); }
  }), []);
  if (!ready) return <main className="auth-shell"><SynCashLogo size="lg" /></main>;
  if (!user) return <Routes>
    <Route path="/lender/invite/:token" element={<InviteRoute user={null} onAuthenticated={setUser} />} />
    <Route path="/register/advisor" element={<AdvisorRegistrationScreen />} />
    <Route path="/verify-email" element={<EmailVerificationScreen onAuthenticated={setUser} />} />
    <Route path="*" element={<AuthScreen onAuthenticated={setUser} />} />
  </Routes>;

  const homePath = homePathForRole(user.role);
  return <Routes>
    <Route path="/lender/invite/:token" element={<InviteRoute user={user} onAuthenticated={setUser} />} />
    <Route path="/admin" element={canAccessAdmin(user.role) ? <AdminLayout user={user} /> : <Navigate to={homePath} replace />}>
      <Route index element={<AdminHome user={user} />} />
      <Route path="advisors" element={user.role === "SUPER_ADMIN" ? <AdminAdvisorsView /> : <AdminSectionPage title="יועצים" description="אין הרשאה לניהול יועצים." />} />
      <Route path="clients" element={<AdminSectionPage title="לקוחות" description="סקירת לקוחות ותיקי מימון במערכת." />} />
      <Route path="lenders" element={<AdminSectionPage title="חברות מימון" description="ניהול חברות מימון ומשתמשי חיתום." />} />
      <Route path="settings" element={<SystemSettingsSubView user={user} />} />
      <Route path="settings/smtp" element={canAccessSmtpSettings(user.role) ? <AdminDashboard userEmail={user.email} /> : <Navigate to="/admin/settings" replace />} />
      <Route path="audit" element={user.role === "SUPER_ADMIN" ? <AdminSectionPage title="יומן פעילות" description="מעקב אחר פעולות מערכת ואירועי אבטחה." /> : <AdminSectionPage title="יומן פעילות" description="אין הרשאה לצפייה ביומן הפעילות." />} />
    </Route>
    <Route path="/advisor" element={user.role === "ADVISOR" ? <AdvisorLayout user={user} /> : <Navigate to={homePath} replace />}>
      <Route index element={<DashboardView user={user} />} />
      <Route path="clients" element={<DashboardView user={user} clientsOnly />} />
      <Route path="clients/:id" element={<ClientDetailView />} />
      <Route path="new" element={<NewClientWizard />} />
      <Route path="arena" element={<AdvisorArenaView />} />
      <Route path="documents" element={<AdvisorDocumentsView />} />
      <Route path="notifications" element={<AdvisorNotificationsView />} />
      <Route path="profile" element={<AdvisorProfileView user={user} />} />
    </Route>
    <Route path="/lender" element={user.role === "LENDER_ADMIN" || user.role === "LENDER_UNDERWRITER" ? <><StandardHeader user={user} /><main className="portal"><SettingsView user={user} /></main></> : <Navigate to={homePath} replace />} />
    <Route path="*" element={<Navigate to={homePath} replace />} />
  </Routes>;
}
