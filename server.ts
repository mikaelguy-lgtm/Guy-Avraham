import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import https from "https";

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

// Font paths for PDF generation (Hebrew support)
const FONT_PATH = path.join(DATA_DIR, "Heebo-Regular.ttf");
const FONT_BOLD_PATH = path.join(DATA_DIR, "Heebo-Bold.ttf");

// Recursive download helper to download font files following redirects
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (res.headers.location) {
          downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        } else {
          reject(new Error("Redirect status code but no location header"));
        }
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Server returned status code ${res.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
      file.on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

// Function to ensure Hebrew fonts exist in the data folder
async function ensureFontsExist(): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const fonts = [
    {
      path: FONT_PATH,
      url: "https://github.com/google/fonts/raw/main/ofl/heebo/Heebo-Regular.ttf"
    },
    {
      path: FONT_BOLD_PATH,
      url: "https://github.com/google/fonts/raw/main/ofl/heebo/Heebo-Bold.ttf"
    }
  ];

  for (const font of fonts) {
    if (!fs.existsSync(font.path)) {
      console.log(`Downloading font ${path.basename(font.path)}...`);
      try {
        await downloadFile(font.url, font.path);
        console.log(`Font ${path.basename(font.path)} downloaded successfully.`);
      } catch (err) {
        console.error(`Failed to download font ${path.basename(font.path)}:`, err);
      }
    }
  }
}

// Helper to reverse Hebrew words for PDFKit right-to-left layout
function toRTL(text: string): string {
  if (!text) return "";
  if (!/[\u0590-\u05FF]/.test(text)) {
    return text;
  }
  const words = text.split(" ");
  const reversedWords = words.map(word => {
    if (/[\u0590-\u05FF]/.test(word)) {
      return word.split("").reverse().join("");
    }
    return word;
  });
  return reversedWords.reverse().join(" ");
}

// Generate the beautiful client profile PDF
async function generateClientPdf(client: any, aiGeneratedPart: string, baseUrl: string): Promise<Buffer> {
  await ensureFontsExist();
  
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const buffers: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      // Register Hebrew Fonts
      const hasFonts = fs.existsSync(FONT_PATH) && fs.existsSync(FONT_BOLD_PATH);
      if (hasFonts) {
        doc.registerFont("Heebo", FONT_PATH);
        doc.registerFont("Heebo-Bold", FONT_BOLD_PATH);
      }

      const getFont = (bold: boolean) => hasFonts ? (bold ? "Heebo-Bold" : "Heebo") : (bold ? "Helvetica-Bold" : "Helvetica");

      // --- PDF Header ---
      // Top bar
      doc.rect(0, 0, 595, 20).fill("#0f172a");
      doc.rect(0, 20, 595, 60).fill("#1e293b");

      // Header Text
      doc.font(getFont(true)).fontSize(18).fillColor("#ffffff");
      doc.text(toRTL("SynCash - פרופיל עסקת אשראי"), 50, 30, { align: "right" });
      
      doc.font(getFont(false)).fontSize(10).fillColor("#38bdf8");
      doc.text(toRTL("בקשת מימון חוץ-בנקאית אנונימית ומאובטחת"), 50, 52, { align: "right" });

      // Metadata under header
      doc.font(getFont(false)).fontSize(9).fillColor("#64748b");
      const refStr = `מספר סימוכין: SYNCASH-CL-${client.id}`;
      const dateStr = `תאריך שידור: ${new Date().toLocaleDateString('he-IL')} (UTC)`;
      doc.text(toRTL(refStr), 50, 95, { align: "right" });
      doc.text(toRTL(dateStr), 50, 110, { align: "right" });

      doc.moveDown(1.5);
      doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Helper for sections
      const addSectionTitle = (title: string) => {
        doc.moveDown(1.2);
        doc.font(getFont(true)).fontSize(12).fillColor("#0284c7");
        doc.text(toRTL(title), 50, doc.y, { align: "right" });
        doc.moveDown(0.3);
        doc.strokeColor("#e2e8f0").lineWidth(1.5).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
      };

      const addDetailLine = (label: string, value: string) => {
        doc.font(getFont(true)).fontSize(9).fillColor("#334155");
        const fullText = `- ${label}: ${value}`;
        doc.text(toRTL(fullText), 50, doc.y, { align: "right" });
        doc.moveDown(0.3);
      };

      // --- SECTION 1: פרטי העסקה והבטוחה ---
      addSectionTitle("1. פרטי העסקה והנכס המשועבד (Deal & Collateral)");
      
      const anonymizedName = client.name ? `${client.name.substring(0, 1)}***` : "לקוח אנונימי";
      const anonymizedId = client.idNumber ? `${client.idNumber.substring(0, 3)}******` : "לא צוין";
      
      let propertyAddressStr = "לא צוינה";
      if (client.propertyCity) {
        propertyAddressStr = client.propertyCity + (client.propertyStreet ? ` ${client.propertyStreet}` : "");
      }

      addDetailLine("שם הלווה (אנונימי)", anonymizedName);
      addDetailLine("תעודת זהות (אנונימי)", anonymizedId);
      addDetailLine("סוג העסקה", client.dealType || "לא צוין");
      addDetailLine("סוג נכס/מטרה", client.propertyType || "לא צוין");
      addDetailLine("כתובת הנכס לשעבוד", propertyAddressStr);
      addDetailLine("שווי נכס מוערך (עפ\"י יועץ/שמאי)", `₪${Number(client.propertyValue || 0).toLocaleString()}`);
      addDetailLine("סכום הלוואה מבוקש", `₪${Number(client.requestedAmount || 0).toLocaleString()}`);
      addDetailLine("אחוז המימון המבוקש מהנכס", `${client.financingPercentage}%`);

      // --- SECTION 2: פרופיל פיננסי ---
      addSectionTitle("2. פרופיל פיננסי ויכולת החזר (Financial Profile)");
      
      addDetailLine("מצב תעסוקתי", client.employmentType || "שכיר");
      addDetailLine("מקום עבודה / שם העסק הפעיל", client.workplace || "לא צוין");
      addDetailLine("ותק בשנים", `${client.seniority || 0} שנים`);
      addDetailLine("הכנסה חודשית נטו מוכחת", `₪${Number(client.income || 0).toLocaleString()}`);
      addDetailLine("הכנסות חודשיות נוספות", `₪${Number(client.additionalIncomeAmount || 0).toLocaleString()} (${client.additionalIncomeType || "אין"})`);
      addDetailLine("הוצאות משפחתיות שוטפות", `₪${Number(client.expenses || 0).toLocaleString()}`);
      addDetailLine("החזרי הלוואות חודשיים מחוץ למשכנתא", `₪${Number(client.expensesLoans || 0).toLocaleString()}`);
      addDetailLine("החזר משכנתא נוכחית", `₪${Number(client.expensesMortgage || 0).toLocaleString()} (יתרה לסילוק: ₪${Number(client.expensesMortgageBalance || 0).toLocaleString()})`);

      // --- SECTION 3: מסמכים ---
      addSectionTitle("3. מסמכי התיק המאומתים (Verified Documents)");
      const uploadedDocs = client.documents.filter((d: any) => d.status === "uploaded");
      if (uploadedDocs.length > 0) {
        uploadedDocs.forEach((d: any) => {
          doc.font(getFont(false)).fontSize(9).fillColor("#059669");
          doc.text(toRTL(`[מסמך מאומת] - ${d.name} (${d.date || "הועלה"})`), 50, doc.y, { align: "right" });
          doc.moveDown(0.2);
          
          const docLink = `${baseUrl}/api/documents/download?clientId=${client.id}&docId=${d.id}`;
          doc.font(getFont(false)).fontSize(8).fillColor("#0284c7");
          doc.text(toRTL(`להורדה ישירה לחץ כאן`), 50, doc.y, { align: "right", link: docLink });
          doc.moveDown(0.4);
        });
      } else {
        doc.font(getFont(false)).fontSize(9).fillColor("#64748b");
        doc.text(toRTL("טרם הועלו או אומתו מסמכים בתיק זה"), 50, doc.y, { align: "right" });
        doc.moveDown(0.4);
      }

      // --- SECTION 4: הערות יועץ ---
      addSectionTitle("4. הערות ודגשים מיועץ המשכנתאות (Advisor Insight)");
      doc.font(getFont(false)).fontSize(9).fillColor("#334155");
      doc.text(toRTL(client.notes || "אין הערות מיוחדות שהוזנו בתיק."), 50, doc.y, { align: "right", width: 495, lineGap: 2 });
      doc.moveDown(0.4);

      // --- SECTION 5: ניתוח חכם ---
      addSectionTitle("5. ניתוח תיק חכם וייעוץ מבוסס AI (Smart Analysis)");
      
      const lines = aiGeneratedPart.split("\n");
      for (const line of lines) {
        let cleanLine = line.trim();
        if (!cleanLine) {
          doc.moveDown(0.2);
          continue;
        }

        if (cleanLine === "---" || cleanLine === "---" || cleanLine.startsWith("===")) {
          doc.moveDown(0.4);
          doc.strokeColor("#cbd5e1").lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.4);
          continue;
        }

        let fontSize = 9;
        let isBold = false;
        let indent = 0;

        if (cleanLine.startsWith("###")) {
          fontSize = 10;
          isBold = true;
          cleanLine = cleanLine.replace(/^###\s*/, "");
          doc.moveDown(0.3);
        } else if (cleanLine.startsWith("##")) {
          fontSize = 11;
          isBold = true;
          cleanLine = cleanLine.replace(/^##\s*/, "");
          doc.moveDown(0.3);
        } else if (cleanLine.startsWith("#")) {
          fontSize = 12;
          isBold = true;
          cleanLine = cleanLine.replace(/^#\s*/, "");
          doc.moveDown(0.3);
        } else if (cleanLine.startsWith("*") || cleanLine.startsWith("-")) {
          indent = 15;
          cleanLine = cleanLine.replace(/^[*+-]\s*/, "");
        }

        let fontName = getFont(isBold);
        if (cleanLine.includes("**")) {
          cleanLine = cleanLine.replace(/\*\*/g, "");
          fontName = getFont(true);
        }

        doc.font(fontName).fontSize(fontSize).fillColor("#1e293b");

        const rtlText = toRTL(cleanLine);

        if (indent > 0) {
          doc.text(rtlText, 50, doc.y, {
            align: "right",
            width: 475,
            lineGap: 2
          });
          doc.circle(538, doc.y - doc.currentLineHeight() / 2, 2.5).fill("#06b6d4");
        } else {
          doc.text(rtlText, 50, doc.y, {
            align: "right",
            width: 495,
            lineGap: 2
          });
        }

        if (doc.y > 750) {
          doc.addPage();
        }
      }

      // Finalize PDF
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

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

const INITIAL_LENDERS = [
  { id: "BTB", name: "BTB (בנקינג טו ביזנס)", email: "credit@btb.co.il", description: "קרן חברתית להלוואות, מצוינת לעסקים, עצמאיים ורכישות מורכבות.", specialty: "עצמאיים ויזמות", status: "active" },
  { id: "Tarya", name: "טריא (Tarya)", email: "underwriting@tarya.co.il", description: "פלטפורמת המימון ההמוני הגדולה בישראל. מעולה לגישורים וקבוצות רכישה.", specialty: "גישורים וקבוצות רכישה", status: "active" },
  { id: "Peninsula", name: "פנינסולה (Peninsula)", email: "deals@peninsula.co.il", description: "חברת אשראי ציבורית גדולה, מתמחה במימון נדל\"ן וקבוצות רוכשים.", specialty: "מימון יזמי וקבוצות", status: "active" },
  { id: "Gamma", name: "גמא (Gamma)", email: "mortgage@gamma.co.il", description: "מקבוצת הפניקס, פתרונות מימון ומשכנתאות לנכסים מסחריים ויוקרה.", specialty: "מסחרי ונכסי יוקרה", status: "active" },
  { id: "Clal", name: "כלל מימון (Clal)", email: "clalfinance@clal.co.il", description: "זרוע המימון החוץ-בנקאית של כלל ביטוח, אשראי רחב היקף.", specialty: "אחוזי מימון גבוהים", status: "active" },
  { id: "Harel", name: "הראל אשראי (Harel)", email: "harelfinance@harel.co.il", description: "קרן חוב ומימון מבית הראל, מתמחה בפרויקטים ובטוחות מורכבות.", specialty: "תיקים מורכבים במיוחד", status: "active" }
];

const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const DEFAULT_SETTINGS = {
  systemSenderEmail: "requests@syncash-mail.co.il",
  smtpPassword: "",
  smtpHost: "smtp.gmail.com",
  smtpPort: 465,
  smtpSecure: true,
  lenders: INITIAL_LENDERS,
  lenderEmails: {
    "BTB": "credit@btb.co.il",
    "Tarya": "underwriting@tarya.co.il",
    "Peninsula": "deals@peninsula.co.il",
    "Gamma": "mortgage@gamma.co.il",
    "Clal": "clalfinance@clal.co.il",
    "Harel": "harelfinance@harel.co.il"
  }
};

function loadSettings() {
  try {
    let settings;
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
      settings = JSON.parse(data);
    } else {
      settings = DEFAULT_SETTINGS;
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
    }

    // Auto-migration to ensure settings has the lenders array
    if (!settings.lenders) {
      settings.lenders = INITIAL_LENDERS;
      if (settings.lenderEmails) {
        settings.lenders = settings.lenders.map((l: any) => ({
          ...l,
          email: settings.lenderEmails[l.id] || l.email
        }));
      }
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
    }

    return settings;
  } catch (error) {
    console.error("Error reading settings file, fallback to default", error);
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: any) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing settings file", error);
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
    maritalStatus: req.body.maritalStatus || "",
    childrenCount: req.body.childrenCount || "0",
    childrenAges: req.body.childrenAges || "",
    seniority: req.body.seniority || "1",
    income: req.body.income || "0",
    workplace: req.body.workplace || "",
    additionalIncomeType: req.body.additionalIncomeType || "",
    additionalIncomeAmount: req.body.additionalIncomeAmount || "0",
    expenses: req.body.expenses || "0",
    expensesLoans: req.body.expensesLoans || "0",
    expensesMortgage: req.body.expensesMortgage || "0",
    expensesMortgageBalance: req.body.expensesMortgageBalance || "0",
    dealType: req.body.dealType || "רכישה מקבלן",
    propertyType: req.body.propertyType || "דירה ראשונה",
    propertyCity: req.body.propertyCity || "",
    propertyStreet: req.body.propertyStreet || "",
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
    lendersState: (() => {
      const settings = loadSettings();
      const state: any = {};
      if (settings.lenders && Array.isArray(settings.lenders)) {
        settings.lenders.forEach((l: any) => {
          state[l.id] = { status: "not_sent" };
        });
      } else {
        ["BTB", "Tarya", "Peninsula", "Gamma", "Clal", "Harel"].forEach((id) => {
          state[id] = { status: "not_sent" };
        });
      }
      return state;
    })()
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

// Helper to send real emails via Nodemailer with optional attachments
async function sendRealEmail(to: string, replyTo: string, subject: string, text: string, attachments?: Array<{ filename: string; content: Buffer }>) {
  const settings = loadSettings();
  
  const senderEmail = settings.systemSenderEmail || "requests@syncash-mail.co.il";
  const smtpPass = settings.smtpPassword || process.env.SMTP_PASSWORD || "";
  
  if (!smtpPass) {
    console.warn("SMTP password not set, skipping real email send.");
    return { success: false, reason: "SMTP App Password (סיסמת אפליקציה של גוגל) אינה מוגדרת. אנא הגדר אותה בטאב שידור תחת הגדרות דואר מנהל." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost || "smtp.gmail.com",
      port: parseInt(settings.smtpPort || "465", 10),
      secure: settings.smtpSecure !== undefined ? settings.smtpSecure : true,
      auth: {
        user: senderEmail,
        pass: smtpPass
      }
    });

    const mailOptions: any = {
      from: `"מערכת SynCash" <${senderEmail}>`,
      to,
      replyTo,
      subject,
      text
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("Nodemailer failed to send email:", error);
    return { success: false, reason: `שגיאת התחברות לשרת הדואר: ${error.message}` };
  }
}

// POST /api/clients/:id/send-to-lenders (Generate anonymous cover pitch & set lenders status to sent_anonymous)
app.post("/api/clients/:id/send-to-lenders", async (req, res) => {
  const { lenders, selectedLenders } = req.body; // Array of lender names e.g. ["BTB", "Tarya"]
  const targetLenders = lenders || selectedLenders;
  if (!targetLenders || !Array.isArray(targetLenders) || targetLenders.length === 0) {
    return res.status(400).json({ error: "Please select at least one out-of-bank lender." });
  }

  const clients = loadClients();
  const clientIndex = clients.findIndex(c => c.id === req.params.id);
  if (clientIndex === -1) {
    return res.status(404).json({ error: "Client not found" });
  }

  const client = clients[clientIndex];
  const settings = loadSettings();
  
  // Mark overall client status as 'sent'
  client.status = "sent";

  // Prepare client details for Gemini
  const promptData = {
    name: client.name,
    employmentType: client.employmentType,
    seniority: client.seniority,
    income: client.income,
    expenses: client.expenses,
    dealType: client.dealType,
    propertyCity: client.propertyCity,
    propertyStreet: client.propertyStreet,
    propertyValue: client.propertyValue,
    requestedAmount: client.requestedAmount,
    financingPercentage: client.financingPercentage,
    notes: client.notes,
  };

  const propertyAddressStr = client.propertyCity 
    ? `${client.propertyCity}${client.propertyStreet ? `, ${client.propertyStreet}` : ""}`
    : "לא צוינה";

  // 1. Generate the anonymous pitch letter in Hebrew (AI dynamic part)
  let aiGeneratedPart = "פניית אשראי חוץ-בנקאית מפורטת למשכנתא.";
  if (ai) {
    try {
      const systemInstruction = 
        "You are an expert Israeli mortgage advisor. Generate an incredibly professional, detailed, persuasive, and custom cover letter/pitch " +
        "in Hebrew, sent to non-bank lenders (חברות מימון חוץ-בנקאיות) like BTB, Tarya, Peninsula etc. The goal is to highlight the strengths of the borrower, " +
        "explain the reason for needing out-of-bank financing (e.g. self-employed, bank bureaucracy, high-leverage), address risks, and pitch why " +
        "this is an excellent collateral/borrower profile. Include clear Hebrew financial terminology (יחס החזר, אחוז מימון, בטוחות, נכס, כושר החזר).\n" +
        "CRITICAL RULE: The pitch MUST BE COMPLETELY ANONYMOUS regarding the mortgage advisor. Do NOT write any advisor name, company name, license number, phone, email, or direct contact details. " +
        "Use placeholder words or generic terms like 'יועץ פיננסי מוסמך' or 'מערכת SynCash'.";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `אנא צור מכתב פנייה מקצועי, אנונימי ומשכנע עבור התיק הבא:\n${JSON.stringify(promptData, null, 2)}`,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      if (response.text) {
        aiGeneratedPart = response.text;
      }
    } catch (err) {
      console.error("Gemini failed to generate anonymous pitch part, using default.", err);
    }
  }

  // 2. Resolve the Base URL for links
  let baseUrl = "";
  if (req.body.origin) {
    baseUrl = req.body.origin;
  } else if (req.headers.referer) {
    try {
      const refUrl = new URL(req.headers.referer);
      baseUrl = refUrl.origin;
    } catch (e) {
      // ignore
    }
  }

  if (!baseUrl) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    baseUrl = `${protocol}://${host}`;
  }

  // 3. Generate PDF Buffer containing full details and AI pitch analysis
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generateClientPdf(client, aiGeneratedPart, baseUrl);
    console.log(`PDF successfully generated for client SYNCASH-CL-${client.id}`);
  } catch (pdfErr) {
    console.error("Failed to generate client profile PDF:", pdfErr);
  }

  const advisors = loadAdvisors();
  const advisor = advisors.find(a => a.id === (client.advisorId || "advisor-1")) || advisors[0];
  const advisorEmail = advisor ? advisor.email : "";

  // 4. Setup anonymous state for each selected lender (awaiting reply) & send real email
  client.lendersState = client.lendersState || {};
  
  for (const lender of targetLenders) {
    const lenderObj = settings.lenders ? settings.lenders.find((l: any) => l.id === lender) : null;
    const lenderEmail = lenderObj ? lenderObj.email : (settings.lenderEmails ? settings.lenderEmails[lender] : "credit@lender.co.il");
    
    // We will append a direct link for the lender to reply in SynCash!
    const directReplyUrl = `${baseUrl}/?refId=SYNCASH-CL-${client.id}-LD-${lender}`;

    // Build the short, neat fixed email body with only the response link
    const emailBodyText = 
      `==================================================\n` +
      `       בקשת מימון חוץ-בנקאית רשמית ומאובטחת\n` +
      `       נשלח באמצעות פלטפורמת SynCash המרכזית\n` +
      `==================================================\n\n` +
      `שלום רב,\n\n` +
      `מצורפת בזאת פניית אשראי חוץ-בנקאית חדשה ומאובטחת עבור לקוח אנונימי (קוד פנייה: SYNCASH-CL-${client.id}).\n\n` +
      `כלל פרטי העסקה, הנתונים הפיננסיים המלאים וניתוח התיק החכם מצורפים בקובץ ה-PDF המאובטח המצורף למייל זה.\n\n` +
      `--------------------------------------------------\n` +
      `   מענה ישיר והגשת הצעת מימון מקוונת בזירה:\n` +
      `--------------------------------------------------\n` +
      `למענה מהיר, עדכון סטטוס תיק או הגשת ריביות/אישור רשמי ישירות ליועץ:\n` +
      `🔗 לחץ כאן למענה מיידי מקוון:\n` +
      `${directReplyUrl}\n\n` +
      `הודעתכם וריביתכם יעודכנו בזמן אמת בלוח הבקרה של היועץ ${advisor.name}.\n` +
      `--------------------------------------------------\n\n` +
      `בברכה,\n` +
      `מערכת SynCash`;

    // Setup attachment option
    const attachments = pdfBuffer ? [
      {
        filename: `SynCash_Profile_SYNCASH-CL-${client.id.substring(0, 8)}.pdf`,
        content: pdfBuffer
      }
    ] : undefined;

    // Attempt to send real email
    const subject = `[SynCash] פניית אשראי חוץ-בנקאית חדשה - סימוכין SYNCASH-CL-${client.id.substring(0, 8)}`;
    const mailResult = await sendRealEmail(lenderEmail, advisorEmail || settings.systemSenderEmail, subject, emailBodyText, attachments);

    let statusMsg = "";
    if (mailResult.success) {
      statusMsg = `הבקשה נשלחה אנונימית בהצלחה לכתובת ${lenderEmail} עם קובץ פרופיל PDF מצורף.\nהמערכת ממתינה לתשובת עניין מהחברה (מעוניין/לא מעוניין).\n\nניתן להשתמש בקישור הבא למענה ישיר:\n${directReplyUrl}`;
    } else {
      statusMsg = `המערכת ניסתה לשלוח מייל אמת אל ${lenderEmail}, אך השליחה נכשלה מהסיבה הבאה:\n❌ ${mailResult.reason}\n\nסירקולציה חלופית: המערכת עברה למצב סימולטור. תוכל לדמות מענה ישיר לתיק זה בטאב "שידור" בדשבורד מנהל המערכת, או להשתמש בקישור המענה הישיר הבא:\n🔗 ${directReplyUrl}`;
    }

    client.lendersState[lender] = {
      status: "sent_anonymous",
      pitch: emailBodyText,
      reply: statusMsg
    };
  }

  saveClients(clients);
  res.json(client);
});

// GET /api/documents/download (Safe document download simulation)
app.get("/api/documents/download", (req, res) => {
  const { clientId, docId } = req.query;
  if (!clientId || !docId) {
    return res.status(400).send("מזהה לקוח או מסמך חסרים");
  }
  const clients = loadClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) {
    return res.status(404).send("הלקוח לא נמצא");
  }
  const doc = client.documents.find((d: any) => d.id === docId);
  if (!doc) {
    return res.status(404).send("המסמך לא נמצא");
  }

  // Generate a beautiful text-based report that simulates downloading the requested secure document
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.name)}.txt"`);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  const borderLine = "========================================================================\n";
  const content = 
    borderLine +
    `  מערכת SynCash - הורדת קובץ מאובטח (סימולציית שרת אמת)\n` +
    borderLine +
    `שם הלווה: ${client.name}\n` +
    `מספר ת.ז: ${client.idNumber || "לא צוין"}\n` +
    `שם המסמך: ${doc.name}\n` +
    `תאריך העלאת מסמך: ${doc.date || "לא צוין"}\n` +
    `מזהה ייחודי: ${doc.id}\n` +
    `מצב אימות: מאומת ומאושר (VERIFIED)\n\n` +
    `פרטי עסקת משכנתא מבוקשת:\n` +
    `---------------------------\n` +
    `- סוג עסקה: ${client.dealType}\n` +
    `- שווי נכס: ₪${Number(client.propertyValue || 0).toLocaleString()}\n` +
    `- סכום מבוקש: ₪${Number(client.requestedAmount || 0).toLocaleString()} (${client.financingPercentage}% מימון)\n\n` +
    `------------------------------------------------------------------------\n` +
    `זהו קובץ סימולציה מאובטח הנוצר בזמן אמת על ידי פלטפורמת SynCash.\n` +
    `בסביבת פרודקשן (אמת), לחיצה על קישור זה תתחיל הורדה ישירה של הקובץ המקורי\n` +
    `שהועלה על ידי יועץ המשכנתאות (בפורמט PDF, JPG או PNG).\n` +
    `------------------------------------------------------------------------\n\n` +
    `הופק על ידי SynCash - פלטפורמת שידור וזירת הלוואות מבוססת AI.`;

  res.send(content);
});

// GET /api/admin/lenders (Get list of all financing companies for admin panel)
app.get("/api/admin/lenders", (req, res) => {
  const settings = loadSettings();
  res.json(settings.lenders || []);
});

// POST /api/admin/lenders (Add new financing company)
app.post("/api/admin/lenders", (req, res) => {
  const settings = loadSettings();
  const { id, name, email, description, specialty } = req.body;

  if (!id || !name || !email) {
    return res.status(400).json({ error: "נא למלא מזהה, שם ואימייל חברה" });
  }

  const cleanId = id.trim().toUpperCase();
  if (settings.lenders.some((l: any) => l.id === cleanId)) {
    return res.status(400).json({ error: "מזהה חברה זה כבר קיים במערכת" });
  }

  const newLender = {
    id: cleanId,
    name: name.trim(),
    email: email.trim(),
    description: description || "",
    specialty: specialty || "כללי",
    status: "active"
  };

  settings.lenders.push(newLender);
  
  // Backwards compatibility sync
  settings.lenderEmails = settings.lenderEmails || {};
  settings.lenderEmails[cleanId] = email.trim();

  saveSettings(settings);
  res.status(201).json(newLender);
});

// PUT /api/admin/lenders/:id (Update or pause/suspend/activate financing company)
app.put("/api/admin/lenders/:id", (req, res) => {
  const settings = loadSettings();
  const { id } = req.params;
  const { name, email, description, specialty, status } = req.body;

  const idx = settings.lenders.findIndex((l: any) => l.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "חברת המימון לא נמצאה" });
  }

  const current = settings.lenders[idx];
  if (name !== undefined) current.name = name.trim();
  if (email !== undefined) {
    current.email = email.trim();
    settings.lenderEmails = settings.lenderEmails || {};
    settings.lenderEmails[id] = email.trim();
  }
  if (description !== undefined) current.description = description;
  if (specialty !== undefined) current.specialty = specialty;
  if (status !== undefined) current.status = status;

  saveSettings(settings);
  res.json(current);
});

// DELETE /api/admin/lenders/:id (Delete/remove financing company)
app.delete("/api/admin/lenders/:id", (req, res) => {
  const settings = loadSettings();
  const { id } = req.params;

  const idx = settings.lenders.findIndex((l: any) => l.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "חברת המימון לא נמצאה" });
  }

  settings.lenders.splice(idx, 1);
  if (settings.lenderEmails) {
    delete settings.lenderEmails[id];
  }

  saveSettings(settings);
  res.json({ success: true });
});

// GET /api/admin/settings (Get email and broadcaster configuration)
app.get("/api/admin/settings", (req, res) => {
  res.json(loadSettings());
});

// POST /api/admin/settings (Update email and broadcaster configuration)
app.post("/api/admin/settings", (req, res) => {
  const { systemSenderEmail, smtpPassword, smtpHost, smtpPort, smtpSecure, lenderEmails } = req.body;
  const currentSettings = loadSettings();
  
  if (systemSenderEmail !== undefined) {
    currentSettings.systemSenderEmail = systemSenderEmail;
  }
  if (smtpPassword !== undefined) {
    currentSettings.smtpPassword = smtpPassword;
  }
  if (smtpHost !== undefined) {
    currentSettings.smtpHost = smtpHost;
  }
  if (smtpPort !== undefined) {
    currentSettings.smtpPort = parseInt(smtpPort, 10) || 465;
  }
  if (smtpSecure !== undefined) {
    currentSettings.smtpSecure = smtpSecure === true;
  }
  if (lenderEmails !== undefined && typeof lenderEmails === "object") {
    currentSettings.lenderEmails = {
      ...currentSettings.lenderEmails,
      ...lenderEmails
    };
  }
  
  saveSettings(currentSettings);
  res.json(currentSettings);
});

// GET /api/lenders/case-details (Public endpoint to fetch anonymized deal profile for a lender link)
app.get("/api/lenders/case-details", (req, res) => {
  const { refId } = req.query;
  if (!refId || typeof refId !== "string") {
    return res.status(400).json({ error: "Missing refId query parameter" });
  }

  const match = refId.match(/^SYNCASH-CL-(.+)-LD-(.+)$/);
  if (!match) {
    return res.status(400).json({ error: "Invalid refId format" });
  }

  const clientId = match[1];
  const lenderId = match[2];

  const clients = loadClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) {
    return res.status(404).json({ error: "התיק המבוקש לא נמצא במערכת" });
  }

  // Find lender details from settings to show a nice welcome message to the lender
  const settings = loadSettings();
  const lenderObj = settings.lenders ? settings.lenders.find((l: any) => l.id === lenderId) : null;
  const lenderName = lenderObj ? lenderObj.name : lenderId;

  // Render strictly anonymous profile
  const anonymizedName = client.name ? `${client.name.substring(0, 1)}***` : "לקוח אנונימי";
  const anonymizedId = client.idNumber ? `${client.idNumber.substring(0, 3)}******` : "לא צוין";

  const caseProfile = {
    refId,
    clientId: client.id,
    lenderId,
    lenderName,
    anonymizedName,
    anonymizedId,
    dealType: client.dealType || "רכישת דירה",
    propertyType: client.propertyType || "דירת מגורים",
    propertyCity: client.propertyCity || "לא צוין",
    propertyStreet: client.propertyStreet || "",
    propertyValue: client.propertyValue || "0",
    requestedAmount: client.requestedAmount || "0",
    financingPercentage: client.financingPercentage || "0",
    employmentType: client.employmentType || "שכיר",
    workplace: client.workplace || "לא צוין",
    seniority: client.seniority || "0",
    income: client.income || "0",
    expenses: client.expenses || "0",
    notes: client.notes || "",
    documents: client.documents.map((d: any) => ({
      id: d.id,
      name: d.name,
      status: d.status
    })),
    currentState: client.lendersState ? client.lendersState[lenderId] : null
  };

  res.json(caseProfile);
});

// POST /api/lenders/simulated-reply (Endpoint simulating receiving a reply email from a lender)
app.post("/api/lenders/simulated-reply", (req, res) => {
  const { clientRefId, decision, replyText, offerAmount, offerRate, offerYears } = req.body;
  
  if (!clientRefId || !decision) {
    return res.status(400).json({ error: "Missing clientRefId or decision" });
  }

  // Parse SYNCASH-CL-{clientId}-LD-{lenderId}
  const match = clientRefId.match(/^SYNCASH-CL-(.+)-LD-(.+)$/);
  if (!match) {
    return res.status(400).json({ error: "Invalid clientRefId format." });
  }

  const clientId = match[1];
  const lenderId = match[2];

  const clients = loadClients();
  const clientIndex = clients.findIndex(c => c.id === clientId);
  if (clientIndex === -1) {
    return res.status(404).json({ error: "Client not found" });
  }

  const client = clients[clientIndex];
  client.lendersState = client.lendersState || {};
  client.lendersState[lenderId] = client.lendersState[lenderId] || {};

  if (decision === "offer") {
    client.lendersState[lenderId].status = "offer_received";
    client.lendersState[lenderId].offer = {
      amount: offerAmount || client.requestedAmount,
      rate: offerRate || "6.5",
      years: offerYears || "20"
    };
    client.lendersState[lenderId].reply = replyText || `שלום רב,\n\nאנו שמחים להגיש הצעה פיננסית עבור תיק זה:\n- סכום הצעה מאושר: ₪${Number(offerAmount || client.requestedAmount).toLocaleString()}\n- שיעור ריבית: ${offerRate}%\n- תקופת החזר: ${offerYears} שנים.\n\nבברכה,\nמחלקת אשראי וחיתום חוץ-בנקאי, ${lenderId}`;
  } else if (decision === "interested") {
    client.lendersState[lenderId].status = "interested";
    client.lendersState[lenderId].reply = replyText || `שלום רב,\n\nהבקשה האנונימית נבחנה על ידינו בקרן ${lenderId}.\nהנתונים המוצגים מתאימים לפעילותנו. אנו מביעים עניין רב בהגשת הצעה פיננסית תחרותית לתיק זה.\nנשמח אם תחשפו בפנינו את פרטי הקשר והמסמכים המלאים של היועץ והלווה על מנת שנוכל להפיק עבורכם אישור עקרוני וריביות מדויקות.\n\nבברכה,\nמחלקת אשראי וחיתום חוץ-בנקאי, ${lenderId}`;
  } else {
    client.lendersState[lenderId].status = "not_interested";
    client.lendersState[lenderId].reply = replyText || `שלום רב,\n\nתודה על פנייתכם עבור בקשה [${clientRefId}].\nלאחר בחינת נתוני האשראי שהועברו אלינו, לצערנו התיק אינו מתאים למדיניות האשראי הנוכחית של קרן ${lenderId} בשלב זה.\n\nנשמח לעמוד לרשותכם בהגשת תיקים נוספים בהמשך.\n\nבברכה,\nצוות החיתום, ${lenderId}`;
  }

  saveClients(clients);
  res.json({ success: true, client });
});

// POST /api/clients/:id/reveal-lender/:lenderId (Advisor approves contact reveal, generates terms/offer)
app.post("/api/clients/:id/reveal-lender/:lenderId", async (req, res) => {
  const { id, lenderId } = req.params;

  const clients = loadClients();
  const clientIndex = clients.findIndex(c => c.id === id);
  if (clientIndex === -1) {
    return res.status(404).json({ error: "Client not found" });
  }

  const client = clients[clientIndex];
  if (!client.lendersState || !client.lendersState[lenderId]) {
    return res.status(400).json({ error: "Lender state not initialized" });
  }

  const advisors = loadAdvisors();
  const advisor = advisors.find(a => a.id === (client.advisorId || "advisor-1")) || advisors[0];

  // Set to contact revealed first
  client.lendersState[lenderId].status = "contact_revealed";

  const randomRate = (6.4 + Math.random() * 2.8).toFixed(1);
  const offeredAmount = client.requestedAmount;
  let simulatedOfferLetter = `שלום רב, ${advisor.name || "יועץ המשכנתאות"},\n\n` +
    `תודה על חשיפת הפרטים בתיק אנונימי (${client.id}) עבור הלקוח ${client.name}.\n\n` +
    `לאחר בדיקת הנתונים המלאים של היועץ ומסמכי הלווה שהועברו, אנו שמחים להפיק לכם הצעה רשמית ותחרותית ביותר מבית ${lenderId}:\n` +
    `- סכום מאושר: ${Number(offeredAmount).toLocaleString()} ₪\n` +
    `- שיעור ריבית שנתית קבועה: ${randomRate}%\n` +
    `- תקופת החזר: 20 שנים\n\n` +
    `אנו מודים לך על שיתוף הפעולה במערכת SynCash. נשמח לקדם את העסקה במהירות לחתימה.\n\n` +
    `בברכה,\nצוות החיתום הבכיר, ${lenderId}`;

  if (ai) {
    try {
      const promptData = {
        clientName: client.name,
        dealType: client.dealType,
        requestedAmount: client.requestedAmount,
        propertyValue: client.propertyValue,
        income: client.income,
        advisorName: advisor.name,
        advisorCompany: advisor.company,
        advisorPhone: advisor.phone,
        advisorEmail: advisor.email
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `לקוח ויעוץ שנחשפו:\n${JSON.stringify(promptData, null, 2)}\n\nאנא נסח אישור עקרוני וריביות מפורט, מקצועי ואיכותי מאוד בעברית מהקרן ${lenderId} אל היועץ ${advisor.name}.`,
        config: {
          systemInstruction: `You are the chief underwriting officer at non-bank lender '${lenderId}' in Israel. Produce an official, high-quality Hebrew response email to the mortgage advisor. Propose an offered amount of ₪${offeredAmount} with annual interest rate of ${randomRate}% for 20 years. Make it extremely realistic and professional.`,
          temperature: 0.8
        }
      });

      if (response.text) {
        simulatedOfferLetter = response.text;
      }
    } catch (err) {
      console.error("Gemini failed to generate official offer letter:", err);
    }
  }

  client.lendersState[lenderId].status = "offer_received";
  client.lendersState[lenderId].reply = simulatedOfferLetter;
  client.lendersState[lenderId].offer = {
    amount: offeredAmount,
    rate: randomRate,
    years: "20"
  };

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
