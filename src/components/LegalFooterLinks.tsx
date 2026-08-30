import { useState } from "react";
import type { LegalDocumentType } from "../types";
import LegalCenter from "./LegalCenter";

const links: {tab: LegalDocumentType | "REQUESTS"; label: string}[] = [
  {tab: "TERMS", label: "תנאי שימוש"},
  {tab: "PRIVACY", label: "מדיניות פרטיות"},
  {tab: "DPA", label: "DPA"},
  {tab: "REQUESTS", label: "בקשות פרטיות"}
];

export default function LegalFooterLinks() {
  const [openTab, setOpenTab] = useState<LegalDocumentType | "REQUESTS" | null>(null);
  return <>
    <nav className="legal-footer-links" aria-label="מסמכים משפטיים">
      {links.map((link) => <button key={link.tab} type="button" onClick={() => setOpenTab(link.tab)}>{link.label}</button>)}
    </nav>
    {openTab && <LegalCenter initialTab={openTab} onClose={() => setOpenTab(null)} />}
  </>;
}
