import { Client, AdvisorProfile } from "../types";

// Default advisor list for frontend fallback
const DEFAULT_ADVISORS: (AdvisorProfile & { id: string; password?: string; registeredAt?: string; status?: string })[] = [
  {
    id: "advisor-1",
    name: "דוד כהן",
    role: "יועץ משכנתאות בכיר",
    email: "david.c@syncash.co.il",
    phone: "050-1234567",
    company: "כהן פיננסיים ומשכנתאות",
    licenseNumber: "MC-77402",
    registeredAt: "2026-06-01T12:00:00.000Z",
    status: "active",
    password: "123456"
  },
  {
    id: "advisor-2",
    name: "מיכל אהרוני",
    role: "יועצת משכנתאות מומחית",
    email: "michal.a@aharoni-finance.co.il",
    phone: "052-7654321",
    company: "אהרוני פתרונות מימון",
    licenseNumber: "MC-99213",
    registeredAt: "2026-06-15T09:30:00.000Z",
    status: "active",
    password: "123456"
  }
];

// Default clients list for frontend fallback
const DEFAULT_CLIENTS: Client[] = [
  {
    id: "client-1",
    advisorId: "advisor-1",
    name: "אילן רוזנברג",
    idNumber: "034567891",
    email: "ilan.r@example.com",
    phone: "054-7654321",
    address: "רוטשילד 45, תל אביב",
    employmentType: "עצמאי",
    seniority: "5",
    income: "22000",
    expenses: "4500",
    dealType: "רכישת דירה (יד שנייה)",
    propertyCity: "תל אביב-יפו",
    propertyStreet: "רוטשילד 45",
    propertyValue: "3200000",
    requestedAmount: "1800000",
    financingPercentage: "56",
    notes: "עצמאי בעל עסק לעיצוב פנים. הבנקים הרגילים מקשים עקב תנודתיות בהכנסות של השנה האחרונה למרות רווחיות מצוינת בעסק. צריך אישור מהיר.",
    createdAt: new Date().toISOString(),
    status: "active",
    documents: [
      { id: "doc-id", name: "צילום תעודת זהות וספח", status: "uploaded", date: "2026-06-28" },
      { id: "doc-bank", name: "דפי עובר ושב (3 חודשים אחרונים)", status: "uploaded", date: "2026-06-29" },
      { id: "doc-tax", name: "אישור שומה שנתי (לעצמאי)", status: "uploaded", date: "2026-06-29" },
      { id: "doc-property", name: "נסח טאבו עדכני", status: "uploaded", date: "2026-06-30" }
    ],
    lendersState: {
      "BTB": { status: "offer_received", pitch: "", reply: "התיק נבחן. אנו מאשרים עקרונית מימון של 1.8 מיליון ש\"ח בריבית של 6.9% + פריים לתקופה של 20 שנה, בכפוף לשעבוד מדרגה ראשונה ושמאי שיאשר את שווי הנכס.", offer: { amount: "1800000", rate: "6.9", years: "20" } },
      "Tarya": { status: "sent", pitch: "", reply: "הבקשה התקבלה במערכת טריא ונמצאת בבחינת חתם. תשובה תתקבל בתוך 24 שעות." },
      "Peninsula": { status: "not_sent" },
      "Gamma": { status: "not_sent" },
      "Clal": { status: "not_sent" },
      "Harel": { status: "not_sent" }
    }
  },
  {
    id: "client-2",
    advisorId: "advisor-1",
    name: "מירי ואבי לוי",
    idNumber: "312456789",
    email: "mivi.levy@example.com",
    phone: "052-8884433",
    address: "הסיגליות 12, ראשון לציון",
    employmentType: "שכיר",
    seniority: "8",
    income: "16500",
    expenses: "2000",
    dealType: "מיחזור משכנתא",
    propertyCity: "ראשון לציון",
    propertyStreet: "הסיגליות 12",
    propertyValue: "2400000",
    requestedAmount: "1200000",
    financingPercentage: "50",
    notes: "מחזור משכנתא קיימת וסגירת חובות נוספים של 150 אלף ש\"ח. יחס החזר בבנקים גבולי עקב הלוואות קצרות מועד רבות, רוצים לאחד הכל למשכנתא חוץ-בנקאית אחת ארוכת טווח שתפחית את ההחזר החודשי.",
    createdAt: new Date().toISOString(),
    status: "draft",
    documents: [
      { id: "doc-id", name: "צילום תעודת זהות וספח", status: "uploaded", date: "2026-06-30" },
      { id: "doc-bank", name: "דפי עובר ושב (3 חודשים אחרונים)", status: "uploaded", date: "2026-06-30" },
      { id: "doc-salary", name: "3 תלושי שכר אחרונים", status: "pending", date: "" },
      { id: "doc-mortgage", name: "דוח יתרות לסילוק משכנתא קיימת", status: "pending", date: "" }
    ],
    lendersState: {
      "BTB": { status: "not_sent" },
      "Tarya": { status: "not_sent" },
      "Peninsula": { status: "not_sent" },
      "Gamma": { status: "not_sent" },
      "Clal": { status: "not_sent" },
      "Harel": { status: "not_sent" }
    }
  }
];

// Initialize localStorage keys if empty
const initLocalStorage = () => {
  if (!localStorage.getItem("syncash_advisors")) {
    localStorage.setItem("syncash_advisors", JSON.stringify(DEFAULT_ADVISORS));
  }
  if (!localStorage.getItem("syncash_clients")) {
    localStorage.setItem("syncash_clients", JSON.stringify(DEFAULT_CLIENTS));
  }
};

// Check if we should use local fallback (Netlify or direct static deploys)
const isStaticOrOffline = () => {
  return (
    window.location.hostname.includes("netlify.app") ||
    window.location.hostname.includes("github.io") ||
    window.location.hostname.includes("vercel.app") ||
    window.location.hash.includes("force-local")
  );
};

// Helper to query localStorage
const getLocalAdvisors = () => {
  initLocalStorage();
  return JSON.parse(localStorage.getItem("syncash_advisors") || "[]");
};

const saveLocalAdvisors = (advisors: any[]) => {
  localStorage.setItem("syncash_advisors", JSON.stringify(advisors));
};

const getLocalClients = (): Client[] => {
  initLocalStorage();
  return JSON.parse(localStorage.getItem("syncash_clients") || "[]");
};

const saveLocalClients = (clients: Client[]) => {
  localStorage.setItem("syncash_clients", JSON.stringify(clients));
};

// Unified API Client
export const api = {
  // ADVISORS
  async getAdvisors() {
    if (isStaticOrOffline()) {
      return getLocalAdvisors().map(({ password, ...rest }: any) => rest);
    }
    try {
      const res = await fetch("/api/advisors");
      if (res.ok) return await res.json();
      throw new Error();
    } catch {
      return getLocalAdvisors().map(({ password, ...rest }: any) => rest);
    }
  },

  async registerAdvisor(data: any) {
    if (isStaticOrOffline()) {
      const advisors = getLocalAdvisors();
      if (advisors.some((a: any) => a.email.toLowerCase() === data.email.toLowerCase())) {
        throw new Error("אימייל זה כבר רשום במערכת");
      }
      const newAdvisor = {
        id: "advisor-" + Date.now(),
        name: data.name,
        role: data.role || "יועץ משכנתאות",
        email: data.email.toLowerCase(),
        phone: data.phone || "",
        company: data.company || "",
        licenseNumber: data.licenseNumber || "",
        password: data.password,
        registeredAt: new Date().toISOString(),
        status: "active"
      };
      advisors.push(newAdvisor);
      saveLocalAdvisors(advisors);
      const { password, ...rest } = newAdvisor;
      return rest;
    }

    const res = await fetch("/api/advisors/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "שגיאה ברישום יועץ");
    }
    return await res.json();
  },

  async loginAdvisor(data: any) {
    if (isStaticOrOffline()) {
      const { email, password } = data;
      if (email.toLowerCase() === "admin@syncash.co.il" && password === "admin123") {
        return {
          id: "admin",
          name: "מנהל מערכת ADMIN",
          role: "סופר אדמין",
          email: "admin@syncash.co.il",
          phone: "03-9998888",
          company: "SynCash HQ",
          licenseNumber: "ADMIN-001",
          isAdmin: true,
          status: "active"
        };
      }
      const advisors = getLocalAdvisors();
      const advisor = advisors.find((a: any) => a.email.toLowerCase() === email.toLowerCase());
      if (!advisor) throw new Error("המשתמש אינו קיים במערכת");
      if (advisor.password !== password) throw new Error("סיסמה שגויה");
      const { password: _, ...rest } = advisor;
      return rest;
    }

    const res = await fetch("/api/advisors/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "פרטי התחברות שגויים");
    }
    return await res.json();
  },

  async deleteAdvisor(id: string) {
    if (isStaticOrOffline()) {
      let advisors = getLocalAdvisors();
      advisors = advisors.filter((a: any) => a.id !== id);
      saveLocalAdvisors(advisors);
      return { success: true };
    }
    const res = await fetch(`/api/advisors/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    return await res.json();
  },

  async updateAdvisor(id: string, data: any) {
    if (isStaticOrOffline()) {
      const advisors = getLocalAdvisors();
      const idx = advisors.findIndex((a: any) => a.id === id);
      if (idx !== -1) {
        advisors[idx] = { ...advisors[idx], ...data };
        saveLocalAdvisors(advisors);
        const { password, ...rest } = advisors[idx];
        return rest;
      }
      throw new Error("Advisor not found");
    }
    const res = await fetch(`/api/advisors/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "שגיאה בעדכון פרטי יועץ");
    }
    return await res.json();
  },

  // CLIENTS
  async getClients() {
    if (isStaticOrOffline()) {
      return getLocalClients();
    }
    try {
      const res = await fetch("/api/clients");
      if (res.ok) return await res.json();
      throw new Error();
    } catch {
      return getLocalClients();
    }
  },

  async getClient(id: string) {
    if (isStaticOrOffline()) {
      const clients = getLocalClients();
      const client = clients.find(c => c.id === id);
      if (!client) throw new Error("Client not found");
      return client;
    }
    try {
      const res = await fetch(`/api/clients/${id}`);
      if (res.ok) return await res.json();
      throw new Error();
    } catch {
      const clients = getLocalClients();
      const client = clients.find(c => c.id === id);
      if (!client) throw new Error("Client not found");
      return client;
    }
  },

  async createClient(data: any) {
    if (isStaticOrOffline()) {
      const clients = getLocalClients();
      const newClient: Client = {
        id: "client-" + Date.now(),
        advisorId: data.advisorId || "advisor-1",
        name: data.name || "לקוח ללא שם",
        idNumber: data.idNumber || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        employmentType: data.employmentType || "שכיר",
        maritalStatus: data.maritalStatus || "",
        childrenCount: data.childrenCount || "0",
        childrenAges: data.childrenAges || "",
        seniority: data.seniority || "1",
        income: data.income || "0",
        workplace: data.workplace || "",
        additionalIncomeType: data.additionalIncomeType || "",
        additionalIncomeAmount: data.additionalIncomeAmount || "0",
        expenses: data.expenses || "0",
        expensesLoans: data.expensesLoans || "0",
        expensesMortgage: data.expensesMortgage || "0",
        expensesMortgageBalance: data.expensesMortgageBalance || "0",
        dealType: data.dealType || "רכישה מקבלן",
        propertyType: data.propertyType || "דירה ראשונה",
        propertyCity: data.propertyCity || "",
        propertyStreet: data.propertyStreet || "",
        propertyValue: data.propertyValue || "0",
        requestedAmount: data.requestedAmount || "0",
        financingPercentage: data.financingPercentage || "50",
        notes: data.notes || "",
        createdAt: new Date().toISOString(),
        status: "draft",
        documents: [
          { id: "doc-id-" + Date.now(), name: "צילום תעודת זהות וספח", status: "pending", date: "" },
          { id: "doc-bank-" + Date.now(), name: "דפי עובר ושב (3 חודשים אחרונים)", status: "pending", date: "" },
          { id: "doc-salary-" + Date.now(), name: "3 תלושי שכר אחרונים", status: "pending", date: "" },
          { id: "doc-prop-" + Date.now(), name: "נסח טאבו או אישור זכויות נכס", status: "pending", date: "" }
        ],
        lendersState: {
          "BTB": { status: "not_sent" },
          "Tarya": { status: "not_sent" },
          "Peninsula": { status: "not_sent" },
          "Gamma": { status: "not_sent" },
          "Clal": { status: "not_sent" },
          "Harel": { status: "not_sent" }
        }
      };
      clients.unshift(newClient);
      saveLocalClients(clients);
      return newClient;
    }

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error();
    return await res.json();
  },

  async updateClient(id: string, data: Partial<Client>) {
    if (isStaticOrOffline()) {
      const clients = getLocalClients();
      const index = clients.findIndex(c => c.id === id);
      if (index === -1) throw new Error("Client not found");
      clients[index] = { ...clients[index], ...data };
      saveLocalClients(clients);
      return clients[index];
    }

    const res = await fetch(`/api/clients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error();
    return await res.json();
  },

  async deleteClient(id: string) {
    if (isStaticOrOffline()) {
      let clients = getLocalClients();
      clients = clients.filter(c => c.id !== id);
      saveLocalClients(clients);
      return { success: true };
    }
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    return await res.json();
  },

  // DOCUMENTS
  async uploadDoc(clientId: string, docId: string, name?: string) {
    if (isStaticOrOffline()) {
      const clients = getLocalClients();
      const client = clients.find(c => c.id === clientId);
      if (!client) throw new Error("Client not found");
      const docIndex = client.documents.findIndex((d: any) => d.id === docId);
      
      if (docIndex !== -1) {
        client.documents[docIndex].status = "uploaded";
        client.documents[docIndex].date = new Date().toISOString().split("T")[0];
      } else {
        client.documents.push({
          id: docId || "custom-" + Date.now(),
          name: name || "מסמך נוסף",
          status: "uploaded",
          date: new Date().toISOString().split("T")[0]
        });
      }

      if (client.status === "draft") {
        client.status = "active";
      }

      saveLocalClients(clients);
      return client;
    }

    const res = await fetch(`/api/clients/${clientId}/upload-doc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId, name })
    });
    if (!res.ok) throw new Error();
    return await res.json();
  },

  async deleteDoc(clientId: string, docId: string) {
    if (isStaticOrOffline()) {
      const clients = getLocalClients();
      const client = clients.find(c => c.id === clientId);
      if (!client) throw new Error("Client not found");
      client.documents = client.documents.map((doc: any) => {
        if (doc.id === docId) {
          return { ...doc, status: "pending", date: "" };
        }
        return doc;
      });
      saveLocalClients(clients);
      return client;
    }

    const res = await fetch(`/api/clients/${clientId}/delete-doc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId })
    });
    if (!res.ok) throw new Error();
    return await res.json();
  },

  // SEND TO LENDERS (SUBMISSION ROUND)
  async sendToLenders(clientId: string, selectedLenders: string[], advisorId?: string) {
    if (isStaticOrOffline()) {
      const clients = getLocalClients();
      const client = clients.find(c => c.id === clientId);
      if (!client) throw new Error("Client not found");

      // Mock sending state updates
      selectedLenders.forEach(lender => {
        const replyOptions = [
          `שלום, תיק הלקוח ${client.name} נבחן על ידינו. אנו שמחים להציע מסגרת אשראי של עד ${Number(client.requestedAmount).toLocaleString()} ש"ח בריבית שנתית קבועה של ${(5.5 + Math.random() * 2).toFixed(1)}% לתקופה של ${20} שנה.`,
          `אישור עקרוני התקבל במערכת! מימון מבוקש בגובה ₪${Number(client.requestedAmount).toLocaleString()} אושר בריבית אטרקטיבית של ${(5.0 + Math.random() * 1.5).toFixed(1)}% + פריים לתקופה של 25 שנה.`,
          `התיק התקבל ונבחן בהצלחה. החלטת החיתום הינה חיובית: אישור עקרוני ל-₪${Number(client.requestedAmount).toLocaleString()} בריבית אטרקטיבית של ${(6.2 + Math.random() * 1.2).toFixed(1)}% קבועה.`
        ];
        const randomReply = replyOptions[Math.floor(Math.random() * replyOptions.length)];

        client.lendersState = client.lendersState || {};
        client.lendersState[lender] = {
          status: "offer_received",
          pitch: `פנייה יזומה לקבלת משכנתא חוץ-בנקאית עבור ${client.name}. שווי נכס: ${Number(client.propertyValue).toLocaleString()} ש"ח, מימון מבוקש: ${Number(client.requestedAmount).toLocaleString()} ש"ח.`,
          reply: randomReply,
          offer: {
            amount: client.requestedAmount,
            rate: (5.5 + Math.random() * 2).toFixed(1),
            years: "20"
          }
        };
      });

      client.status = "sent";
      saveLocalClients(clients);
      return client;
    }

    const res = await fetch(`/api/clients/${clientId}/send-to-lenders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedLenders, origin: window.location.origin, advisorId })
    });
    if (!res.ok) throw new Error();
    return await res.json();
  },

  // ASK ADVISOR (GEMINI AI CHAT FALLBACK)
  async askAdvisor(clientId: string, question: string) {
    if (isStaticOrOffline()) {
      const clients = getLocalClients();
      const client = clients.find(c => c.id === clientId);
      if (!client) throw new Error("Client not found");

      // Custom rule-based intelligent response in Hebrew mirroring "SynCash AI"
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulating delay
      const name = client.name;
      const amount = Number(client.requestedAmount).toLocaleString();
      const val = Number(client.propertyValue).toLocaleString();
      const pct = client.financingPercentage;

      return {
        advice: `שלום! כיועץ העל של SynCash AI, ניתחתי לעומק את התיק של **${name}** (שווי נכס: ₪${val}, הלוואה מבוקשת: ₪${amount}, אחוז מימון: ${pct}%).\n\n` +
          `**הנה הניתוח המקצועי שלי לתיק:**\n\n` +
          `1. **אפיקי מימון מומלצים:**\n` +
          `   - **BTB / טריא:** מתאימים מאוד לפרופיל תעסוקתי של **${client.employmentType}** עם רמות הכנסה של ₪${Number(client.income).toLocaleString()} לחודש. BTB יודעים לתמחר יפה עסקאות מורכבות.\n` +
          `   - **גמא / פנינסולה:** אם יש מורכבות עסקית מיוחדת, הם מציעים גמישות חיתומית מדהימה למרות אחוז המימון הגבוה יחסית (${pct}%).\n\n` +
          `2. **חוזקות מרכזיות בתיק:**\n` +
          `   - ההכנסה החודשית עומדת על ₪${Number(client.income).toLocaleString()} נטו, שזהו יחס החזר מצוין לעומת הוצאות חודשיות של ₪${Number(client.expenses).toLocaleString()}.\n` +
          `   - שווי הנכס באזור הליבה המבוקש (**${client.propertyCity || "מרכז"}**) מעניק ביטחון מצוין למשעבד.\n\n` +
          `3. **אתגרים ופתרונות מומלצים:**\n` +
          `   - יש לוודא שדפי העובר ושב נקיים מהחזרות או אכ\"מים כדי למנוע דחיות חיתום.\n` +
          `   - מומלץ להעלות את כל מסמכי ההכנסה המשלימים לחלון הניהול כדי שנוכל לשדר את הבקשה עם דירוג אשראי מקסימלי.\n\n` +
          `האם תרצה שאפיק עבורך מכתב חיתום ייעודי המדגיש את יציבות התיק לקראת שידור לחברות המימון?`
      };
    }

    const res = await fetch(`/api/clients/${clientId}/ask-advisor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    if (!res.ok) throw new Error();
    return await res.json();
  },

  // EMAIL & SENDER CONFIGURATION SETTINGS
  async getAdminSettings() {
    if (isStaticOrOffline()) {
      const stored = localStorage.getItem("syncash_settings");
      let settings = stored ? JSON.parse(stored) : null;
      
      const defaultEmails = {
        "BTB": "credit@btb.co.il",
        "Tarya": "underwriting@tarya.co.il",
        "Peninsula": "deals@peninsula.co.il",
        "Gamma": "mortgage@gamma.co.il",
        "Clal": "clalfinance@clal.co.il",
        "Harel": "harelfinance@harel.co.il"
      };

      if (!settings) {
        settings = {
          systemSenderEmail: "requests@syncash-mail.co.il",
          lenderEmails: defaultEmails
        };
      }

      // Sync with syncash_lenders from localStorage
      const lendersList = await this.getAdminLenders();
      settings.lenderEmails = settings.lenderEmails || {};
      
      const syncedEmails: Record<string, string> = {};
      lendersList.forEach((l: any) => {
        if (l.id && l.email) {
          syncedEmails[l.id] = l.email;
        }
      });

      settings.lenderEmails = {
        ...settings.lenderEmails,
        ...syncedEmails
      };

      // Clean up deleted ones
      const currentIds = new Set(lendersList.map((l: any) => l.id));
      Object.keys(settings.lenderEmails).forEach((id) => {
        if (!currentIds.has(id)) {
          delete settings.lenderEmails[id];
        }
      });

      localStorage.setItem("syncash_settings", JSON.stringify(settings));
      return settings;
    }

    const res = await fetch("/api/admin/settings");
    if (!res.ok) throw new Error();
    return await res.json();
  },

  async saveAdminSettings(settings: { systemSenderEmail?: string; lenderEmails?: Record<string, string> }) {
    if (isStaticOrOffline()) {
      const current = await this.getAdminSettings();
      const updated = {
        systemSenderEmail: settings.systemSenderEmail ?? current.systemSenderEmail,
        lenderEmails: {
          ...current.lenderEmails,
          ...settings.lenderEmails
        }
      };
      localStorage.setItem("syncash_settings", JSON.stringify(updated));

      // Also update the email in syncash_lenders!
      if (settings.lenderEmails) {
        const lenders = await this.getAdminLenders();
        const updatedLenders = lenders.map((l: any) => {
          if (settings.lenderEmails && settings.lenderEmails[l.id] !== undefined) {
            return {
              ...l,
              email: settings.lenderEmails[l.id]
            };
          }
          return l;
        });
        localStorage.setItem("syncash_lenders", JSON.stringify(updatedLenders));
      }

      return updated;
    }

    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error();
    return await res.json();
  },

  // REVEAL LENDER IDENTITY (Transition from interested to offer)
  async revealLenderIdentity(clientId: string, lenderId: string) {
    if (isStaticOrOffline()) {
      const clients = getLocalClients();
      const client = clients.find(c => c.id === clientId);
      if (!client) throw new Error("Client not found");

      client.lendersState = client.lendersState || {};
      const randomRate = (6.4 + Math.random() * 2.8).toFixed(1);
      client.lendersState[lenderId] = {
        status: "offer_received",
        pitch: client.lendersState[lenderId]?.pitch || "מכתב אנונימי",
        reply: `שלום רב,\n\nשמחנו לקבל את פרטי הקשר עבור התיק הלא-אנונימי של ${client.name}.\nאנו שמחים לאשר עקרונית את בקשת המימון.\n\nסכום מאושר: ₪${Number(client.requestedAmount).toLocaleString()}\nריבית שנתית קבועה: ${randomRate}%\nתקופה: 20 שנים.\n\nנשמח להתקדם במהירות.`,
        offer: {
          amount: client.requestedAmount,
          rate: randomRate,
          years: "20"
        }
      };
      saveLocalClients(clients);
      return client;
    }

    const res = await fetch(`/api/clients/${clientId}/reveal-lender/${lenderId}`, {
      method: "POST"
    });
    if (!res.ok) throw new Error();
    return await res.json();
  },

  // SIMULATE LENDER REPLY (INBOUND EMAIL SIMULATOR Webhook)
  async simulateLenderReply(clientRefId: string, decision: "interested" | "not_interested", replyText?: string) {
    if (isStaticOrOffline()) {
      const match = clientRefId.match(/^SYNCASH-CL-(.+)-LD-(.+)$/);
      if (!match) throw new Error("Invalid ref format");
      const clientId = match[1];
      const lenderId = match[2];

      const clients = getLocalClients();
      const client = clients.find(c => c.id === clientId);
      if (!client) throw new Error("Client not found");

      client.lendersState = client.lendersState || {};
      client.lendersState[lenderId] = client.lendersState[lenderId] || { status: "not_sent" };

      if (decision === "interested") {
        client.lendersState[lenderId].status = "interested";
        client.lendersState[lenderId].reply = replyText || `שלום רב,\n\nהבקשה האנונימית נבחנה על ידינו בקרן ${lenderId}.\nאנו מביעים עניין רב ומבקשים לחשוף פרטי קשר.`;
      } else {
        client.lendersState[lenderId].status = "not_interested";
        client.lendersState[lenderId].reply = replyText || `שלום רב,\n\nהבקשה [${clientRefId}] נדחתה עקב אי עמידה במדיניות הנוכחית של קרן ${lenderId}.`;
      }

      saveLocalClients(clients);
      return { success: true, client };
    }

    const res = await fetch("/api/lenders/simulated-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientRefId, decision, replyText })
    });
    if (!res.ok) throw new Error();
    return await res.json();
  },

  // Lenders Admin CRUD
  async getAdminLenders() {
    if (isStaticOrOffline()) {
      const stored = localStorage.getItem("syncash_lenders");
      if (stored) return JSON.parse(stored);
      // Fallback default list
      const defaults = [
        { id: "BTB", name: "BTB (בנקינג טו ביזנס)", email: "credit@btb.co.il", description: "קרן חברתית להלוואות, מצוינת לעסקים, עצמאיים ורכישות מורכבות.", specialty: "עצמאיים ויזמות", status: "active" },
        { id: "Tarya", name: "טריא (Tarya)", email: "underwriting@tarya.co.il", description: "פלטפורמת המימון ההמוני הגדולה בישראל. מעולה לגישורים וקבוצות רכישה.", specialty: "גישורים וקבוצות רכישה", status: "active" },
        { id: "Peninsula", name: "פנינסולה (Peninsula)", email: "deals@peninsula.co.il", description: "חברת אשראי ציבורית גדולה, מתמחה במימון נדל\"ן וקבוצות רוכשים.", specialty: "מימון יזמי וקבוצות", status: "active" },
        { id: "Gamma", name: "גמא (Gamma)", email: "mortgage@gamma.co.il", description: "מקבוצת הפניקס, פתרונות מימון ומשכנתאות לנכסים מסחריים ויוקרה.", specialty: "מסחרי ונכסי יוקרה", status: "active" },
        { id: "Clal", name: "כלל מימון (Clal)", email: "clalfinance@clal.co.il", description: "זרוע המימון החוץ-בנקאית של כלל ביטוח, אשראי רחב היקף.", specialty: "אחוזי מימון גבוהים", status: "active" },
        { id: "Harel", name: "הראל אשראי (Harel)", email: "harelfinance@harel.co.il", description: "קרן חוב ומימון מבית הראל, מתמחה בפרויקטים ובטוחות מורכבות.", specialty: "תיקים מורכבים במיוחד", status: "active" }
      ];
      localStorage.setItem("syncash_lenders", JSON.stringify(defaults));
      return defaults;
    }
    const res = await fetch("/api/admin/lenders");
    if (!res.ok) throw new Error();
    return await res.json();
  },

  async addAdminLender(data: any) {
    if (isStaticOrOffline()) {
      const lenders = await this.getAdminLenders();
      if (lenders.some((l: any) => l.id.toLowerCase() === data.id.toLowerCase())) {
        throw new Error("מזהה חברה זה כבר קיים במערכת");
      }
      const newL = {
        id: data.id.toUpperCase(),
        name: data.name,
        email: data.email,
        description: data.description || "",
        specialty: data.specialty || "כללי",
        status: "active" as const
      };
      lenders.push(newL);
      localStorage.setItem("syncash_lenders", JSON.stringify(lenders));
      return newL;
    }
    const res = await fetch("/api/admin/lenders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "שגיאה בהוספת חברת מימון");
    }
    return await res.json();
  },

  async updateAdminLender(id: string, data: any) {
    if (isStaticOrOffline()) {
      const lenders = await this.getAdminLenders();
      const idx = lenders.findIndex((l: any) => l.id === id);
      if (idx === -1) throw new Error("חברת מימון לא נמצאה");
      lenders[idx] = { ...lenders[idx], ...data };
      localStorage.setItem("syncash_lenders", JSON.stringify(lenders));
      return lenders[idx];
    }
    const res = await fetch(`/api/admin/lenders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error();
    return await res.json();
  },

  async deleteAdminLender(id: string) {
    if (isStaticOrOffline()) {
      let lenders = await this.getAdminLenders();
      lenders = lenders.filter((l: any) => l.id !== id);
      localStorage.setItem("syncash_lenders", JSON.stringify(lenders));
      return { success: true };
    }
    const res = await fetch(`/api/admin/lenders/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error();
    return await res.json();
  }
};
