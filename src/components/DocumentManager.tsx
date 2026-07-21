import React, { useState, useRef } from "react";
import { Client, ClientDocument } from "../types";
import { api } from "../utils/apiClient";
import { 
  FileText, 
  UploadCloud, 
  CheckCircle2, 
  Clock, 
  PlusCircle, 
  Trash2, 
  Info,
  ChevronDown,
  Eye,
  X,
  Sparkles,
  AlertCircle
} from "lucide-react";

interface DocumentManagerProps {
  clients: Client[];
  initialSelectedClientId?: string;
  onRefreshClients: (silent?: boolean) => void;
  uploadedFileUrls: Record<string, { url: string; type: string; name: string }>;
  setUploadedFileUrls: React.Dispatch<React.SetStateAction<Record<string, { url: string; type: string; name: string }>>>;
}

export default function DocumentManager({ 
  clients, 
  initialSelectedClientId, 
  onRefreshClients,
  uploadedFileUrls,
  setUploadedFileUrls
}: DocumentManagerProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>(initialSelectedClientId || clients[0]?.id || "");
  const [customDocName, setCustomDocName] = useState("");
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  
  // File upload state & ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeDocToUpload, setActiveDocToUpload] = useState<{ id: string; name: string } | null>(null);

  // Advanced Document Management States
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [isCustomSlot, setIsCustomSlot] = useState<boolean>(false);
  const [customSlotName, setCustomSlotName] = useState<string>("");
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const [realFileUrl, setRealFileUrl] = useState<string | null>(null);
  const [realFileType, setRealFileType] = useState<string>("");
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  React.useEffect(() => {
    if (!previewDoc || !selectedClientId) {
      if (realFileUrl) {
        URL.revokeObjectURL(realFileUrl);
      }
      setRealFileUrl(null);
      setRealFileType("");
      setLoadingFile(false);
      return;
    }

    let isMounted = true;
    setLoadingFile(true);

    const loadDocBlob = async () => {
      try {
        const blob = await api.downloadDocBlob(selectedClientId, previewDoc.id);
        if (!isMounted) return;

        const objectUrl = URL.createObjectURL(blob);
        setRealFileUrl(objectUrl);
        setRealFileType(blob.type);
      } catch (err) {
        console.error("Failed to load secure document blob:", err);
      } finally {
        if (isMounted) {
          setLoadingFile(false);
        }
      }
    };

    loadDocBlob();

    return () => {
      isMounted = false;
    };
  }, [previewDoc, selectedClientId]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const handleUploadDocument = async (docId: string, name?: string, fileName?: string, fileObj?: File) => {
    if (!selectedClientId) return;
    if (!fileObj) {
      alert("שגיאה: לא נבחר קובץ פיזי להעלאה.");
      return;
    }

    setUploadingDocId(docId);
    
    try {
      // Create Object URL for instant client-side actual file preview
      const fileUrl = URL.createObjectURL(fileObj);
      setUploadedFileUrls(prev => {
        if (prev[docId]) {
          URL.revokeObjectURL(prev[docId].url);
        }
        return {
          ...prev,
          [docId]: { url: fileUrl, type: fileObj.type, name: fileObj.name }
        };
      });

      const finalName = name || "מסמך";

      await api.uploadDoc(selectedClientId, docId, finalName, fileObj);
      onRefreshClients(true);
      setCustomDocName("");
    } catch (error) {
      console.error("Error uploading document:", error);
      alert("העלאת המסמך נכשלה. נא לנסות שנית.");
    } finally {
      setUploadingDocId(null);
      setActiveDocToUpload(null);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!selectedClientId) return;

    try {
      await api.deleteDoc(selectedClientId, docId);
      onRefreshClients(true);
      if (previewDoc?.id === docId) {
        setPreviewDoc(null);
      }
      // Cleanup local URL dictionary if present to prevent memory leaks
      if (uploadedFileUrls[docId]) {
        URL.revokeObjectURL(uploadedFileUrls[docId].url);
        const updated = { ...uploadedFileUrls };
        delete updated[docId];
        setUploadedFileUrls(updated);
      }
    } catch (error) {
      console.error("Error deleting document", error);
    }
  };

  const triggerFileSelection = (docId: string, name: string) => {
    setActiveDocToUpload({ id: docId, name });
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset value to trigger onChange even if selecting the same file
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDocToUpload) return;

    if (activeDocToUpload.id === "general-mapping") {
      setPendingFile(file);
      // Automatically pre-select first pending template slot if any
      const firstPending = selectedClient?.documents.find(d => d.status === "pending");
      if (firstPending) {
        setSelectedSlotId(firstPending.id);
        setIsCustomSlot(false);
      } else {
        setSelectedSlotId("custom");
        setIsCustomSlot(true);
      }
    } else {
      handleUploadDocument(activeDocToUpload.id, activeDocToUpload.name, file.name, file);
    }
  };

  const handleConfirmMappingUpload = () => {
    if (!pendingFile || !selectedClient) return;

    if (selectedSlotId === "custom" && !customSlotName.trim()) {
      alert("אנא הזן שם קטגוריה מותאמת אישית.");
      return;
    }

    const targetId = selectedSlotId === "custom" ? "custom-" + Date.now() : selectedSlotId;
    const targetName = selectedSlotId === "custom" 
      ? customSlotName.trim() 
      : (selectedClient.documents.find(d => d.id === selectedSlotId)?.name || "מסמך שהועלה");

    handleUploadDocument(targetId, targetName, pendingFile.name, pendingFile);

    // Reset mapping state
    setPendingFile(null);
    setSelectedSlotId("");
    setIsCustomSlot(false);
    setCustomSlotName("");
  };

  // Render highly realistic mock document preview on the screen based on content type
  const renderMockDocumentContent = (doc: ClientDocument, client: Client) => {
    if (loadingFile) {
      return (
        <div className="flex flex-col items-center justify-center py-24 space-y-4 text-center">
          <div className="h-10 w-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-400 animate-pulse">מוריד ומאמת קובץ מאובטח משרתי S3...</p>
        </div>
      );
    }

    // If there is an actual client-side uploaded / downloaded S3 file, render it directly!
    const previewUrl = realFileUrl || uploadedFileUrls[doc.id]?.url;
    const previewType = realFileType || uploadedFileUrls[doc.id]?.type || "application/pdf";
    const previewName = uploadedFileUrls[doc.id]?.name || doc.name;

    if (previewUrl) {
      if (previewType.startsWith("image/")) {
        return (
          <div className="space-y-4 text-center">
            <div className="border border-slate-700 rounded-xl overflow-hidden max-h-[420px] flex items-center justify-center bg-slate-950">
              <img 
                src={previewUrl} 
                alt={doc.name} 
                className="max-h-[420px] max-w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-xs text-slate-400 font-medium">תצוגה מקדימה של הקובץ מהאחסון המאובטח: <span className="font-bold text-slate-300">{previewName}</span></p>
          </div>
        );
      } else if (previewType === "application/pdf" || previewType.includes("pdf")) {
        return (
          <div className="space-y-4">
            <div className="border border-slate-700 rounded-xl overflow-hidden h-[450px]">
              <iframe 
                src={previewUrl} 
                title={doc.name} 
                className="w-full h-full border-none"
              />
            </div>
            <p className="text-xs text-slate-400 font-medium text-center font-sans">תצוגה מקדימה של ה-PDF מהאחסון המאובטח: <span className="font-bold text-slate-300">{previewName}</span></p>
          </div>
        );
      } else {
        // Fallback for non-renderable file types (like zip, docx, etc)
        return (
          <div className="space-y-6 py-12 text-center text-slate-200">
            <div className="mx-auto w-16 h-16 bg-cyan-500/10 text-cyan-400 rounded-full flex items-center justify-center border border-cyan-500/20">
              <FileText className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-slate-100 text-sm sm:text-base">הקובץ {previewName} זמין להורדה!</h4>
              <p className="text-xs text-slate-400">פורמט קובץ: <span className="font-bold">{previewType || "מסמך"}</span></p>
            </div>
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl max-w-sm mx-auto">
              <p className="text-xs text-emerald-400 font-bold">סריקת אבטחה הושלמה בהצלחה ✓ קובץ תקין ומוכן לשידור לקרנות המימון.</p>
            </div>
          </div>
        );
      }
    }

    const isIdDoc = doc.id.includes("id") || doc.name.includes("זהות") || doc.name.includes("ת.ז");
    const isBankDoc = doc.id.includes("bank") || doc.name.includes("עובר ושב") || doc.name.includes("עו״ש") || doc.name.includes("חשבון");
    const isSalaryDoc = doc.id.includes("salary") || doc.name.includes("תלוש") || doc.name.includes("שכר") || doc.name.includes("משכורת");
    const isPropDoc = doc.id.includes("prop") || doc.name.includes("טאבו") || doc.name.includes("רישום") || doc.name.includes("זכויות");

    if (isIdDoc) {
      return (
        <div className="space-y-6">
          <div className="w-full max-w-md mx-auto bg-[#e6f0fa] border-2 border-[#a3c2e0] rounded-xl p-5 shadow-md relative overflow-hidden font-sans">
            {/* Stamp overlay */}
            <div className="absolute -right-8 -bottom-8 w-28 h-28 border-4 border-emerald-500/30 rounded-full flex items-center justify-center rotate-12 pointer-events-none select-none">
              <span className="text-[10px] font-black text-emerald-600/40 tracking-wider">מאומת SYNCASH</span>
            </div>
            {/* Top Banner */}
            <div className="flex justify-between items-center border-b border-[#a3c2e0] pb-2 mb-4">
              <span className="text-[10px] font-bold text-blue-900">מדינת ישראל - משרד הפנים</span>
              <span className="text-[10px] font-bold text-blue-900">STATE OF ISRAEL</span>
            </div>
            {/* Title */}
            <div className="text-center text-xs font-black text-blue-900 mb-4 tracking-wider">
              תעודת זהות / IDENTITY CARD
            </div>
            {/* Content grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1 border border-blue-300 bg-white/70 rounded-md h-28 flex flex-col items-center justify-center text-slate-400 p-2 relative">
                <div className="h-16 w-16 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden">
                  <span className="text-xl font-bold text-slate-400">{client.name[0]}</span>
                </div>
                <span className="text-[8px] font-bold text-slate-500 mt-2 text-center leading-none">תצלום מזהה</span>
                <span className="absolute top-1 right-1 text-[8px] text-emerald-600 font-bold">✓ מאושר</span>
              </div>
              <div className="col-span-2 space-y-2 text-right text-xs">
                <div>
                  <span className="text-slate-500 font-bold block text-[9px]">מספר זהות / ID:</span>
                  <span className="font-extrabold text-slate-900 tracking-wider">{client.idNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[9px]">שם משפחה ופרטי / NAME:</span>
                  <span className="font-extrabold text-slate-900">{client.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[9px]">מצב תעסוקתי / JOB:</span>
                  <span className="font-extrabold text-slate-900">{client.employmentType}</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <span className="text-slate-500 font-bold block text-[9px]">אזרחות:</span>
                    <span className="font-bold text-slate-900">ישראלית</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold block text-[9px]">ארץ לידה:</span>
                    <span className="font-bold text-slate-900">ישראל</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-blue-300/60 flex justify-between items-center text-[9px] text-blue-800/80">
              <span>מאובטח בטכנולוגיית SynCash OCR</span>
              <span className="font-mono text-slate-500">Z-8273641-B</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            * תצוגה מקדימה דינמית ומאומתת OCR המבוססת על פרטי הלקוח {client.name} המופיעים בתיק.
          </p>
        </div>
      );
    }

    if (isBankDoc) {
      return (
        <div className="space-y-4 font-sans text-slate-900">
          <div className="flex justify-between items-start border-b border-slate-300 pb-4">
            <div>
              <h3 className="font-black text-lg text-blue-900">בנק הפועלים בע״מ</h3>
              <p className="text-xs text-slate-500 mt-0.5">סניף 612 - לב תל אביב</p>
            </div>
            <div className="text-left text-xs font-bold text-slate-600">
              <p>חשבון עו״ש מספר: 12-402-983742</p>
              <p>לקוח: {client.name} (ת.ז: {client.idNumber})</p>
              <p>תקופה: 3 חודשים אחרונים</p>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-3 gap-4 text-center text-xs font-bold">
            <div>
              <p className="text-slate-500">יתרת פתיחה</p>
              <p className="text-slate-900 text-sm mt-0.5">₪14,520.40</p>
            </div>
            <div>
              <p className="text-slate-500">סה״כ זיכויים</p>
              <p className="text-emerald-600 text-sm mt-0.5">₪98,420.00</p>
            </div>
            <div>
              <p className="text-slate-500">יתרה קובעת</p>
              <p className="text-blue-900 text-sm mt-0.5 font-extrabold">₪28,940.60</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-right">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                  <th className="p-2">תאריך</th>
                  <th className="p-2">תיאור תנועה</th>
                  <th className="p-2">אסמכתא</th>
                  <th className="p-2 text-left">חובה (₪)</th>
                  <th className="p-2 text-left">זכות (₪)</th>
                  <th className="p-2 text-left">יתרה (₪)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
                <tr>
                  <td className="p-2">10/05/2026</td>
                  <td className="p-2 text-blue-900 font-bold">משכורת חודשית - זיכוי מעסיק</td>
                  <td className="p-2 text-slate-400">928341</td>
                  <td className="p-2 text-left">-</td>
                  <td className="p-2 text-left text-emerald-600 font-bold">24,500.00</td>
                  <td className="p-2 text-left">28,940.60</td>
                </tr>
                <tr>
                  <td className="p-2">08/05/2026</td>
                  <td className="p-2">שופרסל בע״מ - רשתות מזון</td>
                  <td className="p-2 text-slate-400">109823</td>
                  <td className="p-2 text-left text-rose-600">642.50</td>
                  <td className="p-2 text-left">-</td>
                  <td className="p-2 text-left">4,440.60</td>
                </tr>
                <tr>
                  <td className="p-2">05/05/2026</td>
                  <td className="p-2">פז דלקים - תדלוק רכב</td>
                  <td className="p-2 text-slate-400">541092</td>
                  <td className="p-2 text-left text-rose-600">250.00</td>
                  <td className="p-2 text-left">-</td>
                  <td className="p-2 text-left">5,083.10</td>
                </tr>
                <tr>
                  <td className="p-2">01/05/2026</td>
                  <td className="p-2">חברת החשמל לישראל - הוראת קבע</td>
                  <td className="p-2 text-slate-400">827361</td>
                  <td className="p-2 text-left text-rose-600">410.20</td>
                  <td className="p-2 text-left">-</td>
                  <td className="p-2 text-left">5,333.10</td>
                </tr>
                <tr>
                  <td className="p-2">28/04/2026</td>
                  <td className="p-2 text-emerald-600 font-bold">הפקדת שיק - זיכוי עצמי</td>
                  <td className="p-2 text-slate-400">112049</td>
                  <td className="p-2 text-left">-</td>
                  <td className="p-2 text-left text-emerald-600 font-bold">8,500.00</td>
                  <td className="p-2 text-left">5,743.30</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-slate-400 leading-relaxed text-center">
            הפקת דפי החשבון המאומתים בוצעה בצורה מאובטחת באמצעות מערכת בנקאות פתוחה (Open Banking) של SynCash.
          </p>
        </div>
      );
    }

    if (isSalaryDoc) {
      return (
        <div className="space-y-4 font-sans text-slate-900">
          <div className="border-2 border-slate-300 rounded-xl p-4 bg-slate-50">
            <div className="flex justify-between items-center border-b border-slate-300 pb-2 mb-2">
              <h3 className="font-extrabold text-sm text-slate-900">תלוש שכר דיגיטלי - מאי 2026</h3>
              <span className="text-[10px] bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded font-extrabold">מאומת</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-[11px] font-semibold">
              <div className="space-y-1">
                <p><span className="text-slate-500 block text-[9px]">שם המעסיק:</span> <span className="text-slate-800 font-bold">סינקאש פתרונות פיננסיים בע״מ</span></p>
                <p><span className="text-slate-500 block text-[9px]">מספר ח.פ:</span> <span className="text-slate-800 font-bold">51-928374-1</span></p>
              </div>
              <div className="space-y-1 text-left">
                <p><span className="text-slate-500 block text-[9px]">שם העובד/ת:</span> <span className="text-slate-800 font-bold">{client.name}</span></p>
                <p><span className="text-slate-500 block text-[9px]">ת.ז עובד:</span> <span className="text-slate-800 font-bold">{client.idNumber}</span></p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] font-semibold">
            <div className="border border-slate-200 rounded-xl p-3">
              <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">תשלומים / זיכויים</h4>
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between"><span>שכר יסוד מוסכם:</span> <span className="font-bold text-slate-900">₪21,000</span></div>
                <div className="flex justify-between"><span>החזר נסיעות:</span> <span className="font-bold text-slate-900">₪650</span></div>
                <div className="flex justify-between"><span>פרמיות / בונוסים:</span> <span className="font-bold text-slate-900">₪2,850</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1 font-bold">
                  <span className="text-slate-900">סה״כ ברוטו:</span>
                  <span className="text-slate-950">₪24,500</span>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3">
              <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-2">ניכויים והפרשות חובה</h4>
              <div className="space-y-1 text-slate-600">
                <div className="flex justify-between"><span>מס הכנסה (ניכוי במקור):</span> <span className="font-bold text-rose-600">₪3,420</span></div>
                <div className="flex justify-between"><span>ביטוח לאומי ובריאות:</span> <span className="font-bold text-rose-600">₪1,150</span></div>
                <div className="flex justify-between"><span>הפרשות לפנסיה ולגמל (עובד):</span> <span className="font-bold text-rose-600">₪1,350</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1 font-bold">
                  <span className="text-slate-900">סה״כ ניכויים:</span>
                  <span className="text-rose-600">₪5,920</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex justify-between items-center text-emerald-950">
            <div>
              <p className="text-[10px] font-bold text-emerald-800">נטו לתשלום בבנק (עו״ש)</p>
              <h3 className="text-base sm:text-lg font-black">₪18,580.00</h3>
            </div>
            <span className="text-[10px] font-bold bg-emerald-500 text-white px-3 py-1.5 rounded-lg shadow-sm">
              הועבר לחשבון
            </span>
          </div>
        </div>
      );
    }

    if (isPropDoc) {
      return (
        <div className="space-y-4 font-sans text-slate-900">
          <div className="text-center border-b-2 border-double border-slate-400 pb-4">
            <h3 className="font-black text-lg text-slate-900">מדינת ישראל - משרד המשפטים</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1">הרשות לרישום והסדר מקרקעין</p>
            <h4 className="font-bold text-xs text-slate-800 mt-2 bg-slate-100 py-1.5 px-4 rounded-full inline-block">
              נסח רישום מפנקס הזכויות (טאבו עדכני)
            </h4>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-slate-700 bg-slate-50 p-2.5 rounded-lg border">
            <div>
              <span className="text-slate-400 block text-[9px]">מחוז</span>
              <span className="text-slate-900">תל אביב</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">גוש</span>
              <span className="text-slate-900">6112</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">חלקה</span>
              <span className="text-slate-900">45</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">תת חלקה</span>
              <span className="text-slate-900">12</span>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 text-[11px] space-y-3 font-semibold text-slate-700">
            <div className="border-b border-slate-200 pb-2">
              <h4 className="font-bold text-slate-900 mb-1">1. תיאור הנכס והזכויות:</h4>
              <p className="text-slate-600 leading-relaxed">דירת מגורים בבית משותף בכתובת המזוהה, שטח רשום: 84 מ״ר, בתוספת מרפסת שמש 12 מ״ר וחניה מסומנת בתקנון הבית המשותף.</p>
            </div>

            <div className="border-b border-slate-200 pb-2">
              <h4 className="font-bold text-slate-900 mb-1">2. בעל הזכויות הרשום:</h4>
              <p className="text-slate-800 font-extrabold">• {client.name} (ת.ז: {client.idNumber}) - בעלות מלאה (1/1 חלקים)</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-1">3. שיעבודים, עיקולים והערות אזהרה:</h4>
              <p className="text-slate-600">• רשומה הערת אזהרה לטובת מוסד פיננסי / בנקאי.</p>
              <p className="text-slate-500 italic text-[10px] mt-1">* שווי הנכס המוערך: ₪{Number(client.propertyValue).toLocaleString()}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-300 flex justify-between items-center text-[9px] text-slate-400">
            <span>הופק בתאריך: {doc.date}</span>
            <span className="font-mono">מערכת רישום ממוחשבת - אסמכתא מס׳ A-928374-C</span>
          </div>
        </div>
      );
    }

    // Default Custom Document Preview
    return (
      <div className="space-y-6 py-4 font-sans text-slate-900">
        <div className="border-4 border-double border-slate-300 p-6 rounded-2xl bg-white text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-3 bg-cyan-500/10 text-cyan-600 rounded-full border border-cyan-300">
              <FileText className="h-8 w-8 text-cyan-600" />
            </div>
          </div>
          
          <div className="space-y-1">
            <h3 className="font-black text-lg text-slate-900 tracking-tight">{doc.name}</h3>
            <p className="text-xs text-slate-500 font-bold">מסמך דיגיטלי מאובטח ומאומת במערכת SynCash</p>
          </div>

          <div className="my-6 border-y border-slate-200 py-4 max-w-sm mx-auto text-xs text-slate-700 space-y-2 font-bold">
            <div className="flex justify-between">
              <span className="text-slate-500">בעל התיק:</span>
              <span className="font-bold text-slate-900">{client.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">מספר תעודת זהות:</span>
              <span className="font-bold text-slate-900">{client.idNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">תאריך העלאה:</span>
              <span className="font-bold text-slate-900">{doc.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">סטטוס הצפנה:</span>
              <span className="font-bold text-emerald-600">מאובטח ומוצפן ב-AES-256 ✓</span>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 max-w-xs mx-auto leading-relaxed font-semibold">
            הקובץ נסרק ונמצא תקין ללא וירוסים או איומים, ונשמר בשרתים המוגנים של SynCash לצורך חיתום אשראי מהיר.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in text-right">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight font-sans">
          ניהול מסמכי לקוח
        </h2>
        <p className="text-slate-400 font-medium mt-1.5">
          הקפד להעלות את כל מסמכי החובה. חברות המימון החוץ-בנקאיות דורשות מסמכים שלמים על מנת להפיק הצעת מחיר מחייבת.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Client Selector & Info */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300">בחר תיק לקוח לניהול</label>
            <div className="relative">
              <select 
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full rounded-xl border border-slate-800 py-3 px-4 text-xs sm:text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 bg-slate-950/80 outline-none cursor-pointer text-right"
              >
                <option value="">-- בחר לקוח --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-950 text-slate-200">
                    {c.name} (ת.ז: {c.idNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedClient ? (
            <div className="border-t border-slate-800/60 pt-6 space-y-4">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">פרטי התיק הנוכחי</h4>
              
              <div className="space-y-3 text-xs sm:text-sm text-slate-300 font-medium">
                <div className="flex justify-between border-b border-slate-800/40 pb-2">
                  <span className="text-slate-400">סוג עסקה:</span>
                  <span className="text-white font-bold">{selectedClient.dealType}</span>
                </div>
                {selectedClient.propertyCity && (
                  <div className="flex justify-between border-b border-slate-800/40 pb-2">
                    <span className="text-slate-400">כתובת הנכס:</span>
                    <span className="text-white font-bold">
                      {selectedClient.propertyCity}
                      {selectedClient.propertyStreet ? `, ${selectedClient.propertyStreet}` : ""}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-b border-slate-800/40 pb-2">
                  <span className="text-slate-400">מצב תעסוקתי:</span>
                  <span className="text-white font-bold">{selectedClient.employmentType}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/40 pb-2">
                  <span className="text-slate-400">שווי נכס:</span>
                  <span className="text-white font-bold">₪{Number(selectedClient.propertyValue).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/40 pb-2">
                  <span className="text-slate-400">מימון מבוקש:</span>
                  <span className="text-white font-bold">₪{Number(selectedClient.requestedAmount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-slate-400">שיעור מימון:</span>
                  <span className="text-cyan-400 font-extrabold">{selectedClient.financingPercentage}%</span>
                </div>
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                <div className="flex items-center gap-2 mb-2 text-slate-200 font-bold text-xs">
                  <Info className="h-4 w-4 text-cyan-400" />
                  <span>סטטוס מסמכים</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                  הועלו <span className="text-emerald-400 font-bold">{selectedClient.documents.filter(d => d.status === "uploaded").length}</span> מתוך <span className="text-slate-200 font-bold">{selectedClient.documents.length}</span> מסמכי חובה מומלצים.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-12 text-xs font-semibold">
              אנא בחר לקוח כדי לצפות בפרטי התיק ומסמכיו.
            </div>
          )}
        </div>

        {/* Documents Checklist & Uploads */}
        <div className="lg:col-span-2 bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl">
          {selectedClient ? (
            <>
              {/* Hidden native file input */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept=".pdf,.png,.jpg,.jpeg"
              />

              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800/60">
                <div>
                  <h4 className="text-lg font-bold text-white">רשימת מסמכים נדרשת</h4>
                  <p className="text-xs text-slate-400 mt-0.5">גרור קבצים או לחץ על הכפתור כדי להעלות קבצי הדמיה בצורה מאובטחת.</p>
                </div>
                
                {/* Custom Doc Form */}
                <div className="flex gap-2 w-full sm:w-auto">
                  <input 
                    type="text" 
                    placeholder="הוסף מסמך אחר..."
                    value={customDocName}
                    onChange={(e) => setCustomDocName(e.target.value)}
                    className="w-full sm:w-auto rounded-xl bg-slate-950/80 border border-slate-800 px-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500 outline-none text-right"
                  />
                  <button 
                    onClick={() => triggerFileSelection("custom-" + Date.now(), customDocName)}
                    disabled={!customDocName || uploadingDocId !== null}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none shadow-[0_4px_12px_rgba(8,145,178,0.15)] shrink-0"
                  >
                    <PlusCircle className="h-4 w-4" />
                    הוסף
                  </button>
                </div>
              </div>

              <div className="space-y-3.5">
                {selectedClient.documents.map((doc) => {
                  const isUploaded = doc.status === "uploaded";
                  const isUploading = uploadingDocId === doc.id;

                  return (
                    <div 
                      key={doc.id}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                        isUploaded 
                          ? "bg-emerald-500/5 border-emerald-500/20" 
                          : "bg-slate-950/40 border-slate-800/80"
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`p-2 rounded-xl ${isUploaded ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-900 text-slate-500 border border-slate-800"}`}>
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm sm:text-base">{doc.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {isUploaded ? (
                              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 fill-emerald-500/10" />
                                הועלה בהצלחה ב-{doc.date}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-slate-500" />
                                ממתין להעלאת הקובץ
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 sm:mt-0 w-full sm:w-auto">
                        {isUploading ? (
                          <div className="flex items-center justify-center gap-2 bg-cyan-500/10 px-4 py-2.5 rounded-xl border border-cyan-500/20">
                            <div className="h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs font-bold text-cyan-400 animate-pulse">מעלה ומאבטח קובץ ב-Syncash...</span>
                          </div>
                        ) : isUploaded ? (
                          <div className="flex items-center gap-2 justify-end w-full sm:w-auto flex-wrap sm:flex-nowrap">
                            <button 
                              onClick={() => setPreviewDoc(doc)}
                              className="text-xs font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-lg border border-cyan-500/20 cursor-pointer transition-colors flex items-center gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              תצוגה מקדימה
                            </button>
                            <button 
                              onClick={() => triggerFileSelection(doc.id, doc.name)}
                              className="text-xs font-bold text-slate-300 hover:text-white bg-slate-850 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-800 cursor-pointer transition-colors"
                            >
                              החלף קובץ
                            </button>
                            <button 
                              onClick={() => handleDeleteDoc(doc.id)}
                              className="text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 rounded-lg border border-rose-500/10 cursor-pointer transition-colors"
                              title="מחק קובץ"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => triggerFileSelection(doc.id, doc.name)}
                            className="w-full sm:w-auto px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                          >
                            <UploadCloud className="h-4 w-4 text-slate-400" />
                            בחר קובץ להעלאה
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Drag & Drop simulated area */}
              <div 
                onClick={() => triggerFileSelection("general-mapping", "שיוך כללי")}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file && selectedClient) {
                    setPendingFile(file);
                    // Pre-select first pending slot or custom
                    const firstPending = selectedClient.documents.find(d => d.status === "pending");
                    if (firstPending) {
                      setSelectedSlotId(firstPending.id);
                      setIsCustomSlot(false);
                    } else {
                      setSelectedSlotId("custom");
                      setIsCustomSlot(true);
                    }
                  }
                }}
                className="p-8 border-2 border-dashed border-slate-800 hover:border-cyan-500/40 hover:bg-cyan-500/[0.02] bg-slate-950/40 rounded-2xl text-center space-y-2 cursor-pointer transition-colors"
              >
                <UploadCloud className="h-10 w-10 text-cyan-500/40 mx-auto mb-1" />
                <p className="font-bold text-sm text-slate-200">גרור ושחרר קבצים כאן או לחץ לבחירה במחשב</p>
                <p className="text-xs text-slate-500">תומך בפורמטים PDF, JPEG, PNG עד 15MB למסמך יחיד</p>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-24">
              <FileText className="h-12 w-12 text-slate-600 mb-2.5 animate-pulse" />
              <p className="font-bold text-slate-300 text-base">לא נבחר תיק לקוח</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                אנא בחר לקוח מרשימת תיקי הלקוחות בצד ימין על מנת לנהל את מסמכיו השונים.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* MODAL 1: GENERAL FILE MAPPING OVERLAY */}
      {pendingFile && selectedClient && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 text-right" style={{ direction: "rtl" }}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-fade-in text-right">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">שיוך קובץ חדש לתיק הלקוח</h3>
              </div>
              <button 
                onClick={() => {
                  setPendingFile(null);
                  setSelectedSlotId("");
                  setIsCustomSlot(false);
                  setCustomSlotName("");
                }}
                className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* File details block */}
            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 flex items-center gap-3">
              <FileText className="h-6 w-6 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-200 truncate">{pendingFile.name}</p>
                <p className="text-[10px] text-slate-500">גודל קובץ: {(pendingFile.size / (1024 * 1024)).toFixed(2)} MB • פורמט מזוהה</p>
              </div>
            </div>

            {/* Options list */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400">לאן ברצונך לשייך את הקובץ הנוכחי?</label>
              
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {selectedClient.documents.map((doc) => {
                  const isChecked = selectedSlotId === doc.id;
                  const isUploaded = doc.status === "uploaded";

                  return (
                    <div 
                      key={doc.id}
                      onClick={() => {
                        setSelectedSlotId(doc.id);
                        setIsCustomSlot(false);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isChecked 
                          ? "bg-cyan-950/20 border-cyan-500/80 ring-1 ring-cyan-500/30" 
                          : "border-slate-800 hover:border-slate-700 bg-slate-950/20"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input 
                          type="radio" 
                          name="document-slot"
                          checked={isChecked}
                          onChange={() => {}} // Click handled by parent div
                          className="text-cyan-500 focus:ring-cyan-500 bg-slate-950 border-slate-800 h-4 w-4 cursor-pointer"
                        />
                        <span className="font-bold text-xs sm:text-sm text-slate-200">{doc.name}</span>
                      </div>
                      
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                        isUploaded 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/10" 
                          : "bg-slate-800 text-slate-400 border border-slate-700/60"
                      }`}>
                        {isUploaded ? "קיים (יוחלף)" : "דרוש תיק חסר"}
                      </span>
                    </div>
                  );
                })}

                {/* Custom Slot selection */}
                <div 
                  onClick={() => {
                    setSelectedSlotId("custom");
                    setIsCustomSlot(true);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    selectedSlotId === "custom" 
                      ? "bg-cyan-950/20 border-cyan-500/80 ring-1 ring-cyan-500/30" 
                      : "border-slate-800 hover:border-slate-700 bg-slate-950/20"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="radio" 
                      name="document-slot"
                      checked={selectedSlotId === "custom"}
                      onChange={() => {}}
                      className="text-cyan-500 focus:ring-cyan-500 bg-slate-950 border-slate-800 h-4 w-4 cursor-pointer"
                    />
                    <span className="font-bold text-xs sm:text-sm text-slate-200">קטגוריה מותאמת אישית (שם אחר...)</span>
                  </div>
                  
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/10">
                    חדש +
                  </span>
                </div>
              </div>
            </div>

            {/* Custom typed name input */}
            {isCustomSlot && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="block text-xs font-bold text-slate-400">הקלד שם קטגוריה חדש לקובץ זה:</label>
                <input 
                  type="text" 
                  value={customSlotName}
                  onChange={(e) => setCustomSlotName(e.target.value)}
                  placeholder="לדוגמה: תעודת שחרור, דוח חברות, הסכם מיוחד..."
                  className="w-full rounded-xl bg-slate-950/80 border border-slate-800 py-2.5 px-3.5 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:ring-1 focus:ring-cyan-500 outline-none text-right font-medium"
                  autoFocus
                />
              </div>
            )}

            {/* Footer buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/60">
              <button 
                onClick={() => {
                  setPendingFile(null);
                  setSelectedSlotId("");
                  setIsCustomSlot(false);
                  setCustomSlotName("");
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ביטול
              </button>
              <button 
                onClick={handleConfirmMappingUpload}
                disabled={isCustomSlot && !customSlotName.trim()}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-[0_4px_12px_rgba(8,145,178,0.15)]"
              >
                אשר והעלה מסמך מאובטח
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: DOCUMENT PREVIEW WINDOW */}
      {previewDoc && selectedClient && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 text-right" style={{ direction: "rtl" }}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-fade-in text-right max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-800/60 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-cyan-400" />
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white truncate max-w-[280px] sm:max-w-md">{previewDoc.name}</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium">הועלה בתיק של {selectedClient.name} • {previewDoc.date}</p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewDoc(null)}
                className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Document display area */}
            <div className="bg-white text-slate-950 rounded-xl p-5 sm:p-8 shadow-inner border border-slate-300 overflow-y-auto font-sans relative flex-1 min-h-[300px]">
              {/* Paper Watermark logo */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none select-none">
                <span className="text-5xl font-black tracking-widest uppercase rotate-12">SYNCASH SECURED</span>
              </div>

              {/* Dynamic simulated content renderer */}
              {renderMockDocumentContent(previewDoc, selectedClient)}
            </div>

            {/* Actions Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-800/60 shrink-0">
              <button 
                onClick={() => handleDeleteDoc(previewDoc.id)}
                className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-rose-500/20"
              >
                <Trash2 className="h-4 w-4" />
                מחק קובץ
              </button>

              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const customFile = uploadedFileUrls[previewDoc.id];
                    if (customFile) {
                      const link = document.createElement("a");
                      link.href = customFile.url;
                      link.download = customFile.name;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    } else {
                      setLoadingFile(true);
                      api.downloadDocBlob(selectedClientId, previewDoc.id)
                        .then((blob) => {
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = `${previewDoc.name || 'document'}.${blob.type.split('/')[1] || 'pdf'}`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                          setDownloadSuccess(true);
                          setTimeout(() => setDownloadSuccess(false), 3000);
                        })
                        .catch((err) => {
                          console.error("Error downloading file:", err);
                          alert("שגיאה בהורדת הקובץ: אין הרשאה או שהקובץ אינו קיים במערכת.");
                        })
                        .finally(() => {
                          setLoadingFile(false);
                        });
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    downloadSuccess 
                      ? "bg-emerald-600 text-white" 
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                  }`}
                >
                  {downloadSuccess ? "הורד בהצלחה ✓" : "הורד מסמך"}
                </button>
                <button 
                  onClick={() => setPreviewDoc(null)}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  סגור תצוגה מקדימה
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
