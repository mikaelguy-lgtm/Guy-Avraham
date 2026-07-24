import type { CurrentUser } from "../types";
export default function SettingsView({user}: {user: CurrentUser}) {
  return <section className="panel"><h2>פרופיל</h2><p>{user.firstName} {user.lastName}</p><p>{user.email}</p><p>{user.roleLabel}</p></section>;
}

