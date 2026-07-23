import { useEffect, useState } from "react";
import type { Client } from "../types";
import { api } from "../utils/apiClient";
import DocumentManager from "./DocumentManager";

export default function AdvisorDocumentsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState(0);
  useEffect(() => { void api.clients().then((result) => {setClients(result.items); setClientId(result.items[0]?.id ?? 0);}); }, []);
  const client = clients.find((item) => item.id === clientId);
  return <main className="advisor-page"><section className="page-title"><div><span className="eyebrow">מרכז מסמכים</span><h1>מסמכים</h1><p>העלאה, צפייה וניהול מאובטח של מסמכי הלקוחות.</p></div></section><section className="content-card"><label className="client-picker"><span>בחירת לקוח</span><select aria-label="בחירת לקוח למסמכים" value={clientId} onChange={(event) => setClientId(Number(event.target.value))}>{clients.map((item) => <option value={item.id} key={item.id}>{item.firstName} {item.lastName} — {item.publicCaseNumber}</option>)}</select></label>{client ? <DocumentManager clientId={client.id} borrowers={client.borrowers} /> : <div className="empty-state">יש ליצור תיק לקוח לפני העלאת מסמכים.</div>}</section></main>;
}
