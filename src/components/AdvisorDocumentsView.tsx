import { useEffect, useState } from "react";
import type { Client } from "../types";
import { api } from "../utils/apiClient";
import DocumentManager from "./DocumentManager";

export default function AdvisorDocumentsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState(0);
  useEffect(() => { void api.clients().then((result) => {setClients(result.items); setClientId(result.items[0]?.id ?? 0);}); }, []);
  return <main className="advisor-page"><section className="page-title"><div><span className="eyebrow">מרכז מסמכים</span><h1>מסמכים</h1><p>העלאה, צפייה וניהול מאובטח של מסמכי הלקוחות.</p></div></section><section className="content-card"><label className="client-picker"><span>בחירת לקוח</span><select aria-label="בחירת לקוח למסמכים" value={clientId} onChange={(event) => setClientId(Number(event.target.value))}>{clients.map((client) => <option value={client.id} key={client.id}>{client.firstName} {client.lastName} — {client.publicCaseNumber}</option>)}</select></label>{clientId ? <DocumentManager clientId={clientId} /> : <div className="empty-state">יש ליצור תיק לקוח לפני העלאת מסמכים.</div>}</section></main>;
}
