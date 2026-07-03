import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Gemini API client safely
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini client initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Gemini client:", error);
  }
} else {
  console.log("No valid GEMINI_API_KEY found, running in fallback mode.");
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable CORS for cross-origin requests
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Body parser
app.use(express.json());

// Path to client database file for simple persistent data
const DATA_DIR = path.join(process.cwd(), "data");
const CLIENTS_FILE = path.join(DATA_DIR, "clients.json");
const ADVISORS_FILE = path.join(DATA_DIR, "advisors.json");

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial default advisors list
const DEFAULT_ADVISORS = [
  {
    id: "advisor-1",
    name: "דוד כהן",
    role: "יועץ משכנתאות בכיר",
    email: "david.c@syncash.co.il",
    phone: "050-1234567",
    company: "כהן פיננסיים ומשכנתאות",
    licenseNumber: "MC-77402",
    registeredAt: "2026-06-01T12:00:00.000Z",
    status: "active"
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
    status: "active"
  }
];

// Initial default clients in Hebrew to populate the system beautifully
const DEFAULT_CLIENTS = [
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
    propertyValue: "3200000",
    requestedAmount: "1800000",
    financingPercentage: "56",
    notes: "עצמאי בעל עסק לעיצוב פנים. הבנקים הרגילים מקשים עקב תנודתיות בהכנסות של השנה האחרונה למרות רווחיות מצוינת בעסק. צריך אישור מהיר.",
    createdAt: new Date().toISOString(),
    status: "active", // draft, active, sent, closed
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

// Load advisors helper
function loadAdvisors(): any[] {
  try {
    if (fs.existsSync(ADVISORS_FILE)) {
      const data = fs.readFileSync(ADVISORS_FILE, "utf-8");
      return JSON.parse(data);
    } else {
      fs.writeFileSync(ADVISORS_FILE, JSON.stringify(DEFAULT_ADVISORS, null, 2), "utf-8");
      return DEFAULT_ADVISORS;
    }
  } catch (error) {
    console.error("Error reading advisors file, fallback to default", error);
    return DEFAULT_ADVISORS;
  }
}

// Save advisors helper
function saveAdvisors(advisors: any[]) {
  try {
    fs.writeFileSync(ADVISORS_FILE, JSON.stringify(advisors, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing advisors file", error);
  }
}

// Load clients helper
function loadClients(): any[] {
  try {
    if (fs.existsSync(CLIENTS_FILE)) {
      const data = fs.readFileSync(CLIENTS_FILE, "utf-8");
      const list = JSON.parse(data);
      // Ensure existing items have an advisorId field
      return list.map((c: any) => ({
        ...c,
        advisorId: c.advisorId || "advisor-1"
      }));
    } else {
      fs.writeFileSync(CLIENTS_FILE, JSON.stringify(DEFAULT_CLIENTS, null, 2), "utf-8");
      return DEFAULT_CLIENTS;
    }
  } catch (error) {
    console.error("Error reading clients file, fallback to default", error);
    return DEFAULT_CLIENTS;
  }
}

// Save clients helper
function saveClients(clients: any[]) {
  try {
    fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing clients file", error);
  }
}

// REST API Endpoints

// GET /api/advisors
app.get("/api/advisors", (req, res) => {
  const advisors = loadAdvisors();
  // Don't send passwords
  const cleanAdvisors = advisors.map(({ password, ...rest }) => rest);
  res.json(cleanAdvisors);
});

// POST /api/advisors/register
app.post("/api/advisors/register", (req, res) => {
  const advisors = loadAdvisors();
  const { name, role, email, phone, company, licenseNumber, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: "נא למלא שם, אימייל וסיסמה" });
  }

  if (advisors.some(a => a.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: "אימייל זה כבר רשום במערכת" });
  }

  const newAdvisor = {
    id: "advisor-" + Date.now(),
    name,
    role: role || "יועץ משכנתאות",
    email: email.toLowerCase(),
    phone: phone || "",
    company: company || "",
    licenseNumber: licenseNumber || "",
    password, // Plain text for mock persistence
    registeredAt: new Date().toISOString(),
    status: "active"
  };

  advisors.push(newAdvisor);
  saveAdvisors(advisors);

  const { password: _, ...advisorWithoutPassword } = newAdvisor;
  res.status(201).json(advisorWithoutPassword);
});

// POST /api/advisors/login
app.post("/api/advisors/login", (req, res) => {
  const advisors = loadAdvisors();
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "נא למלא אימייל וסיסמה" });
  }

  // Super admin credentials bypass
  if (email.toLowerCase() === "admin@syncash.co.il" && password === "admin123") {
    return res.json({
      id: "admin",
      name: "מנהל מערכת ADMIN",
      role: "סופר אדמין",
      email: "admin@syncash.co.il",
      phone: "03-9998888",
      company: "SynCash HQ",
      licenseNumber: "ADMIN-001",
      isAdmin: true,
      status: "active"
    });
  }

  const advisor = advisors.find(a => a.email.toLowerCase() === email.toLowerCase());
  if (!advisor) {
    return res.status(401).json({ error: "המשתמש אינו קיים במערכת" });
  }

  if (advisor.password && advisor.password !== password) {
    return res.status(401).json({ error: "סיסמה שגויה" });
  }

  const { password: _, ...advisorWithoutPassword } = advisor;
  res.json(advisorWithoutPassword);
});

// DELETE /api/advisors/:id
app.delete("/api/advisors/:id", (req, res) => {
  let advisors = loadAdvisors();
  const exists = advisors.some(a => a.id === req.params.id);
  if (exists) {
    advisors = advisors.filter(a => a.id !== req.params.id);
    saveAdvisors(advisors);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Advisor not found" });
  }
});

// GET /api/clients
app.get("/api/clients", (req, res) => {
  const clients = loadClients();
  res.json(clients);
});

// POST /api/clients
app.post("/api/clients", (req, res) => {
  const clients = loadClients();
  const newClient = {
    id: "client-" + Date.now(),
    advisorId: req.body.advisorId || "advisor-1",
    name: req.body.name || "לקוח ללא שם",
    idNumber: req.body.idNumber || "",
    email: req.body.email || "",
    phone: req.body.phone || "",
    address: req.body.address || "",
    employmentType: req.body.employmentType || "שכיר",
    seniority: req.body.seniority || "1",
    income: req.body.income || "0",
    expenses: req.body.expenses || "0",
    dealType: req.body.dealType || "רכישת דירה (יד שנייה)",
    propertyValue: req.body.propertyValue || "0",
    requestedAmount: req.body.requestedAmount || "0",
    financingPercentage: req.body.financingPercentage || "50",
    notes: req.body.notes || "",
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
  saveClients(clients);
  res.status(201).json(newClient);
});

// GET /api/clients/:id
app.get("/api/clients/:id", (req, res) => {
  const clients = loadClients();
  const client = clients.find(c => c.id === req.params.id);
  if (client) {
    res.json(client);
  } else {
    res.status(404).json({ error: "Client not found" });
  }
});

// PUT /api/clients/:id
app.put("/api/clients/:id", (req, res) => {
  const clients = loadClients();
  const index = clients.findIndex(c => c.id === req.params.id);
  if (index !== -1) {
    clients[index] = { ...clients[index], ...req.body };
    saveClients(clients);
    res.json(clients[index]);
  } else {
    res.status(404).json({ error: "Client not found" });
  }
});

// DELETE /api/clients/:id
app.delete("/api/clients/:id", (req, res) => {
  let clients = loadClients();
  const exists = clients.some(c => c.id === req.params.id);
  if (exists) {
    clients = clients.filter(c => c.id !== req.params.id);
    saveClients(clients);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Client not found" });
  }
});

// POST /api/clients/:id/upload-doc (Simulate doc uploading)
app.post("/api/clients/:id/upload-doc", (req, res) => {
  const { docId, name } = req.body;
  const clients = loadClients();
  const clientIndex = clients.findIndex(c => c.id === req.params.id);
  
  if (clientIndex !== -1) {
    const client = clients[clientIndex];
    const docIndex = client.documents.findIndex((d: any) => d.id === docId);
    
    if (docIndex !== -1) {
      client.documents[docIndex].status = "uploaded";
      client.documents[docIndex].date = new Date().toISOString().split("T")[0];
    } else {
      // Add as custom doc
      client.documents.push({
        id: docId || "custom-" + Date.now(),
        name: name || "מסמך נוסף",
        status: "uploaded",
        date: new Date().toISOString().split("T")[0]
      });
    }

    // If at least one document uploaded, we can upgrade state to active from draft
    if (client.status === "draft") {
      client.status = "active";
    }

    saveClients(clients);
    res.json(client);
  } else {
    res.status(404).json({ error: "Client not found" });
  }
});

// POST /api/clients/:id/delete-doc (Simulate deleting or resetting an uploaded document)
app.post("/api/clients/:id/delete-doc", (req, res) => {
  const { docId } = req.body;
  const clients = loadClients();
  const clientIndex = clients.findIndex(c => c.id === req.params.id);
  
  if (clientIndex !== -1) {
    const client = clients[clientIndex];
    const docIndex = client.documents.findIndex((d: any) => d.id === docId);
    
    if (docIndex !== -1) {
      const doc = client.documents[docIndex];
      // If it is a template/system document (starts with doc- or contains -), reset it. Otherwise remove.
      if (doc.id.startsWith("doc-")) {
        doc.status = "pending";
        doc.date = "";
      } else {
        client.documents.splice(docIndex, 1);
      }
      
      saveClients(clients);
      res.json(client);
    } else {
      res.status(404).json({ error: "Document not found" });
    }
  } else {
    res.status(404).json({ error: "Client not found" });
  }
});

// POST /api/clients/:id/send-to-lenders (Generate cover pitch & simulate lender offers via Gemini)
app.post("/api/clients/:id/send-to-lenders", async (req, res) => {
  const { lenders } = req.body; // Array of lender names e.g. ["BTB", "Tarya"]
  if (!lenders || !Array.isArray(lenders) || lenders.length === 0) {
    return res.status(400).json({ error: "Please select at least one out-of-bank lender." });
  }

  const clients = loadClients();
  const clientIndex = clients.findIndex(c => c.id === req.params.id);
  if (clientIndex === -1) {
    return res.status(404).json({ error: "Client not found" });
  }

  const client = clients[clientIndex];
  
  // Mark status as 'sent'
  client.status = "sent";

  // Prepare client details for Gemini
  const promptData = {
    name: client.name,
    employmentType: client.employmentType,
    seniority: client.seniority,
    income: client.income,
    expenses: client.expenses,
    dealType: client.dealType,
    propertyValue: client.propertyValue,
    requestedAmount: client.requestedAmount,
    financingPercentage: client.financingPercentage,
    notes: client.notes,
  };

  // 1. Generate the master professional pitch letter in Hebrew using Gemini
  let generatedPitch = `שלום רב,\n\nפנייה זו מיועדת עבור בחינת תיק אשראי חוץ-בנקאי חדש במערכת SynCash.\n\n` +
    `פרטי הלקוח:\n` +
    `- שם הלקוח: ${client.name}\n` +
    `- סוג עסקה: ${client.dealType}\n` +
    `- שווי נכס מוערך: ${Number(client.propertyValue).toLocaleString()} ₪\n` +
    `- סכום הלוואה מבוקש: ${Number(client.requestedAmount).toLocaleString()} ₪ (${client.financingPercentage}% מימון)\n` +
    `- הכנסה חודשית נטו: ${Number(client.income).toLocaleString()} ₪ (סטטוס: ${client.employmentType})\n\n` +
    `הערות וניתוח תיק:\n${client.notes || "תיק משכנתא חוץ-בנקאי סטנדרטי למטרת מימון מיוחד."}\n\n` +
    `נשמח לקבלת הצעתכם המימונית הראשונית.\nבברכה,\nדוד כהן - יועץ משכנתאות בכיר`;

  if (ai) {
    try {
      const systemInstruction = 
        "You are an expert Israeli mortgage advisor. Generate an incredibly professional, detailed, persuasive, and custom cover letter/pitch " +
        "in Hebrew, sent to non-bank lenders (חברות מימון חוץ-בנקאיות) like BTB, Tarya, Peninsula etc. The goal is to highlight the strengths of the borrower, " +
        "explain the reason for needing out-of-bank financing (e.g. self-employed, bank bureaucracy, high-leverage), address risks, and pitch why " +
        "this is an excellent collateral/borrower profile. Include clear Hebrew financial terminology (יחס החזר, אחוז מימון, בטוחות, נכס, כושר החזר). " +
        "Keep the tone strictly respectful, corporate, and highly convincing.";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `אנא צור מכתב פנייה מקצועי, משכנע ומותאם אישית לחברות המימון עבור התיק הבא:\n${JSON.stringify(promptData, null, 2)}`,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      if (response.text) {
        generatedPitch = response.text;
      }
    } catch (err) {
      console.error("Gemini failed to generate pitch, using template.", err);
    }
  }

  // 2. Generate simulated replies for each lender
  for (const lender of lenders) {
    client.lendersState[lender] = client.lendersState[lender] || {};
    client.lendersState[lender].status = "sent";
    client.lendersState[lender].pitch = generatedPitch;
    client.lendersState[lender].reply = "הבקשה נשלחה ונמצאת בבחינה ראשונית...";

    // We can simulate an automated realistic reply from Gemini!
    if (ai) {
      try {
        const lenderInstruction = 
          `You are the senior credit underwriting manager (מנהל חיתום ראשי) at '${lender}', a leading non-bank financial institution in Israel. ` +
          `Analyze the following borrower profile and the mortgage pitch. Produce a highly realistic, professional Hebrew email response. ` +
          `The response should be either:\n` +
          `1) An approval-in-principle (אישור עקרונית) with specific loan parameters: an offered amount (often close to requested, but maybe slightly lower if risky), ` +
          `   a realistic interest rate (typically between 6.5% and 9.5% for non-bank in Israel in 2026, depending on profile), and term in years (usually 15-25 years). ` +
          `2) OR a request for more information/documents (דרישה להשלמת מסמכים) e.g. 'We need to see 6 months bank statements instead of 3 due to the self-employed status'.\n` +
          `Give a short professional reasoning in Hebrew that sounds exactly like an underwriting team. Return ONLY the email reply text. Be polite and professional.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `התיק המועבר:\n${JSON.stringify(promptData, null, 2)}\n\nמכתב היועץ:\n${generatedPitch}`,
          config: {
            systemInstruction: lenderInstruction,
            temperature: 0.8,
          }
        });

        if (response.text) {
          const replyText = response.text;
          client.lendersState[lender].reply = replyText;
          
          // Parse out numeric offers if we can find them, or generate structured mock offers based on the text
          // Let's create a structured offer to let the UI render beautiful comparison cards
          const rateMatch = replyText.match(/(\d+(\.\d+)?)\%/);
          const amountMatch = replyText.match(/(\d+(\.\d+)?)\s*(מיליון|אלף|ש"ח|₪)/);
          
          let offeredAmount = client.requestedAmount;
          let offeredRate = (6.5 + Math.random() * 2.5).toFixed(1);
          let offeredYears = "20";

          client.lendersState[lender].status = "offer_received";
          client.lendersState[lender].offer = {
            amount: offeredAmount,
            rate: offeredRate,
            years: offeredYears
          };
        }
      } catch (err) {
        console.error(`Failed to generate Gemini reply for ${lender}, using default fallback.`, err);
        // Fallback realistic responses
        setTimeout(() => {
          // Just in case, the client can use standard fallback
        }, 50);
      }
    }

    // In case of no Gemini API or fallback, ensure we have a structured realistic offer anyway
    if (!client.lendersState[lender].offer) {
      const randomRate = (7.0 + Math.random() * 2.5).toFixed(1);
      client.lendersState[lender].status = "offer_received";
      client.lendersState[lender].reply = `שלום רב,\nשמחנו לקבל את פנייתך עבור הלקוח ${client.name}.\n\nלאחר בדיקה ראשונית של נתוני ההכנסה והנכס, אנו שמחים לאשר את הבקשה עקרונית בתנאים הבאים:\n- סכום מאושר: ${Number(client.requestedAmount).toLocaleString()} ₪\n- שיעור ריבית מוערכת: ${randomRate}%\n- תקופת ההלוואה: 20 שנים\n- פריסת החזרים נוחה.\n\nההצעה כפופה להזמנת שמאי מוסכם מטעמנו ובדיקה מלאה של המסמכים המשפטיים.\n\nבברכה,\nמחלקת חיתום ואשראי, ${lender}`;
      client.lendersState[lender].offer = {
        amount: client.requestedAmount,
        rate: randomRate,
        years: "20"
      };
    }
  }

  saveClients(clients);
  res.json(client);
});

// POST /api/clients/:id/ask-advisor (Gemini Advisor assistant to help advisor refine client's profile/notes)
app.post("/api/clients/:id/ask-advisor", async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: "Please enter your question." });
  }

  const clients = loadClients();
  const client = clients.find(c => c.id === req.params.id);
  if (!client) {
    return res.status(404).json({ error: "Client not found" });
  }

  let advice = "לא ניתן לקבל עצה כרגע עקב חוסר בחיבור לשרת ה-AI.";

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `לקוח:\n${JSON.stringify(client, null, 2)}\n\nשאלה/בקשה של היועץ:\n${question}`,
        config: {
          systemInstruction: "You are SynCash AI, an elite mortgage consultant advisor. Provide extremely clever, accurate, and professional advice in Hebrew on how to position this client's folder, which non-bank companies are best suited for them (BTB, Tarya, Peninsula, Gamma, etc. explain why based on their specialty), how to improve their files, and what challenges might arise with this profile.",
          temperature: 0.7
        }
      });
      if (response.text) {
        advice = response.text;
      }
    } catch (err) {
      console.error("Gemini failed in ask-advisor:", err);
      advice = "שגיאה בחיבור למנוע ה-AI של גוגל. אנא ודא שמפתח ה-API תקין בהגדרות.";
    }
  } else {
    advice = "נראה שמפתח ה-API של Gemini אינו מוגדר בסביבה. הוסף אותו בלוח הבקרה על מנת לקבל המלצות פיננסיות מבוססות AI בזמן אמת!";
  }

  res.json({ advice });
});

// Serve the API and Vite application
async function startServer() {
  // Vite setup for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SynCash Server running on port ${PORT}`);
  });
}

startServer();
