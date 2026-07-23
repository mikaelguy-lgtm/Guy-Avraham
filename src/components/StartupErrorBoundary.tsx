import {Component, type ReactNode} from "react";
import {createStartupRequestId, type FrontendConfigurationIssue} from "../config/frontend";
import SynCashLogo from "./SynCashLogo";

type StartupErrorScreenProps = {code: string; requestId: string};

export function StartupErrorScreen({code, requestId}: StartupErrorScreenProps) {
  return <main className="auth-shell startup-error-shell" dir="rtl" lang="he">
    <section className="panel auth-card startup-error-card" role="alert" data-testid="startup-configuration-error">
      <SynCashLogo size="md" />
      <h1>סביבת הבדיקה אינה זמינה</h1>
      <p>המערכת אינה מוגדרת לסביבת הבדיקה. חסרה כתובת שרת או הגדרת אימות.</p>
      <dl className="startup-error-details">
        <div><dt>קוד שגיאה</dt><dd>{code}</dd></div>
        <div><dt>מזהה בקשה</dt><dd>{requestId}</dd></div>
      </dl>
      <p className="field-hint">לא הוצגו פרטי תצורה או נתונים רגישים.</p>
    </section>
  </main>;
}

export function ConfigurationErrorScreen({issue}: {issue: FrontendConfigurationIssue}) {
  return <StartupErrorScreen code={issue.code} requestId={issue.requestId} />;
}

type BoundaryState = {failed: boolean; requestId: string};

export class StartupErrorBoundary extends Component<{children: ReactNode}, BoundaryState> {
  state: BoundaryState = {failed: false, requestId: ""};

  static getDerivedStateFromError(): BoundaryState {
    return {failed: true, requestId: createStartupRequestId()};
  }

  componentDidCatch(): void {}

  render() {
    if (this.state.failed) return <StartupErrorScreen code="SC-RUNTIME-001" requestId={this.state.requestId} />;
    return this.props.children;
  }
}
