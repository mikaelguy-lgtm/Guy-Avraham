import type { CurrentUser } from "../types";
import {useIsraelTimeGreeting} from "../hooks/useIsraelTimeGreeting";
export default function SettingsView({user}: {user: CurrentUser}) {
  const greeting = useIsraelTimeGreeting(user.firstName);
  return <section className="panel"><p className="eyebrow">{greeting}</p><h2>פרופיל</h2><p>{user.firstName} {user.lastName}</p><p>{user.email}</p><p>{user.roleLabel}</p></section>;
}

