import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, FileCheck2, FileUp, RefreshCw, Trash2, UploadCloud, X } from "lucide-react";
import type { DocumentRecord } from "../types";
import { api } from "../utils/apiClient";
import { formatDate, formatDocumentStatus, formatDocumentType, formatFileSize } from "../utils/formatters";

export default function DocumentManager({clientId}: {clientId: number}) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{name: string; url: string} | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => setDocuments(await api.documents(clientId)), [clientId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const upload = async (selectedFile = file) => {
    if (!selectedFile) return;
    setBusy(true); setMessage("");
    try {
      await api.uploadDocument(clientId, selectedFile, "FINANCIAL");
      setFile(null); if (uploadInput.current) uploadInput.current.value = "";
      await load(); setMessage("המסמך הועלה בהצלחה.");
    } catch { setMessage("העלאת המסמך נכשלה. ניתן להעלות PDF, PNG או JPG בלבד."); }
    finally { setBusy(false); }
  };

  const download = async (document: DocumentRecord, preview = false) => {
    try {
      const blob = await api.downloadDocument(document.id);
      const url = URL.createObjectURL(blob);
      if (preview) setPreview({name: document.originalFileName, url});
      else {
        const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = document.originalFileName; anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch { setMessage("לא ניתן לפתוח את המסמך כרגע."); }
  };

  const remove = async (document: DocumentRecord) => {
    if (!window.confirm(`למחוק את המסמך ${document.originalFileName}?`)) return;
    setBusy(true);
    try { await api.deleteDocument(document.id); await load(); setMessage("המסמך נמחק בהצלחה."); }
    catch { setMessage("מחיקת המסמך נכשלה."); }
    finally { setBusy(false); }
  };

  const replace = async (document: DocumentRecord, replacement: File | undefined) => {
    if (!replacement) return;
    setBusy(true); setMessage("");
    try { await api.uploadDocument(clientId, replacement, document.documentType); await api.deleteDocument(document.id); await load(); setMessage("המסמך הוחלף בהצלחה."); }
    catch { setMessage("החלפת המסמך נכשלה. המסמך הקודם נשמר."); }
    finally { setBusy(false); }
  };

  return <section className="documents-workspace">
    <div className={`drop-zone${dragging ? " dragging" : ""}`} onDragOver={(event) => {event.preventDefault(); setDragging(true);}} onDragLeave={() => setDragging(false)} onDrop={(event) => {event.preventDefault(); setDragging(false); const dropped = event.dataTransfer.files[0]; if (dropped) setFile(dropped);}}>
      <span className="drop-icon"><UploadCloud /></span><div><h3>גרירת מסמך לכאן</h3><p>או בחירת קובץ מהמחשב. ניתן להעלות PDF, PNG או JPG עד לגודל המותר.</p></div>
      <input ref={uploadInput} id={`document-upload-${clientId}`} aria-label="בחירת מסמך" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <label htmlFor={`document-upload-${clientId}`} className="secondary-action">בחירת קובץ</label>
      {file && <div className="selected-file"><FileCheck2 size={18} /><span>{file.name}</span><button type="button" className="primary-action" disabled={busy} onClick={() => void upload()}><FileUp size={17} />{busy ? "מעלה…" : "העלאה"}</button></div>}
    </div>
    {message && <p className={message.includes("נכשלה") || message.includes("לא ניתן") ? "form-message error" : "form-message success"} role="status">{message}</p>}
    <div className="section-heading compact"><div><h3>מסמכי הלקוח</h3><p>{documents.length} מסמכים בתיק</p></div></div>
    {documents.length === 0 ? <div className="empty-state"><FileUp size={34} /><h3>עדיין לא הועלו מסמכים</h3><p>המסמכים יוצגו כאן לאחר העלאתם.</p></div> : <div className="documents-grid">{documents.map((document) => <article className="document-card" key={document.id}><div className="document-icon"><FileCheck2 /></div><div className="document-title"><h4>{document.originalFileName}</h4><p>{formatDocumentType(document.documentType)}</p></div><dl><div><dt>תאריך העלאה</dt><dd>{formatDate(document.createdAt)}</dd></div><div><dt>סטטוס</dt><dd><span className="status-badge status-active">{formatDocumentStatus(document.status)}</span></dd></div><div><dt>גודל</dt><dd>{formatFileSize(document.sizeBytes)}</dd></div></dl><div className="document-actions"><button type="button" className="icon-text-button" onClick={() => void download(document, true)}><Eye size={17} />צפייה</button><button type="button" className="icon-text-button" onClick={() => void download(document)}><Download size={17} />הורדה</button><label className="icon-text-button replacement-button"><RefreshCw size={17} />החלפה<input aria-label={`החלפת ${document.originalFileName}`} type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => void replace(document, event.target.files?.[0])} /></label><button type="button" className="icon-text-button danger" disabled={busy} onClick={() => void remove(document)}><Trash2 size={17} />מחיקה</button></div></article>)}</div>}
    {preview && <div className="modal-backdrop"><section className="modal document-preview-modal content-card" role="dialog" aria-modal="true" aria-labelledby="document-preview-title"><header className="modal-heading"><div><span className="eyebrow">צפייה מאובטחת</span><h2 id="document-preview-title">{preview.name}</h2></div><button type="button" className="icon-action" aria-label="סגירת תצוגת מסמך" onClick={() => setPreview(null)}><X /></button></header><iframe title={`תצוגת ${preview.name}`} src={preview.url} /></section></div>}
  </section>;
}
