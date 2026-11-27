import type { ClientEditSection } from "./clientForm";

export const clientTabs = [
  {id: "summary", label: "תקציר"},
  {id: "personal", label: "פרטים אישיים"},
  {id: "income", label: "הכנסות"},
  {id: "liabilities", label: "התחייבויות"},
  {id: "credit-indication", label: "חיווי אשראי"},
  {id: "property", label: "נכס"},
  {id: "deal-details", label: "פירוט עסקה"},
  {id: "documents", label: "מסמכים"},
  {id: "company-responses", label: "תגובות חברות"}
] as const;

export type ClientTab = typeof clientTabs[number]["id"];

const validTabs = new Set<string>(clientTabs.map((tab) => tab.id));

export function clientTabFromSearch(search: string): ClientTab {
  const requested = new URLSearchParams(search).get("tab");
  return requested && validTabs.has(requested) ? requested as ClientTab : "summary";
}

export const clientTabPath = (clientId: number | string, tab: ClientTab): string => `/advisor/clients/${clientId}?tab=${tab}`;

export const editSectionForTab = (tab: ClientTab): ClientEditSection | null => {
  if (tab === "personal" || tab === "income" || tab === "liabilities" || tab === "credit-indication" || tab === "property" || tab === "deal-details") return tab;
  return null;
};

export const clientEditPath = (clientId: number | string, section?: ClientEditSection): string => `/advisor/clients/${clientId}/edit${section ? `/${section}` : ""}`;

export const editSectionLabels: Record<ClientEditSection, string> = {
  personal: "פרטים אישיים",
  income: "הכנסות",
  liabilities: "התחייבויות",
  "credit-indication": "חיווי אשראי",
  property: "פרטי הנכס",
  "deal-details": "פירוט עסקה"
};
