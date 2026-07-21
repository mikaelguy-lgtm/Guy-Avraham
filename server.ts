import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import https from "https";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "./src/db";
import {
  users,
  advisorProfiles,
  clients as dbClients,
  borrowers,
  employmentRecords,
  properties,
  loanRequests,
  documents as dbDocs,
  lenderSubmissions,
  lenderResponses,
  loanOffers,
  lenders,
  auditLogs,
  lenderUsers,
  identityRevealRequests,
  emailLogs,
  lenderInviteTokens
} from "./src/db/schema";
import {
  requireFirebaseAuth,
  loadDatabaseUser,
  requireActiveUser,
  requireRole,
  requireAdvisorClientAccess,
  requireLenderSubmissionAccess
} from "./src/middleware/auth";
import { encryptField, decryptField, hashNormalizedIdentityNumber, maskIdentityNumber } from "./src/utils/crypto";
import { writeAuditLog } from "./src/utils/audit";
import { mapDbClientToFrontend, buildAnonymousSubmissionSnapshot } from "./src/utils/clientMapper";
import { getSecret, setSecret, isSecretConfigured } from "./src/utils/secretManager";
import { getSetting, setSetting, clearSettingsCache } from "./src/utils/settingsService";

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
async function generateClientPdf(client: any, baseUrl: string): Promise<Buffer> {
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
    }

    // Dynamic sync: Always update settings.lenderEmails based on actual settings.lenders array
    settings.lenderEmails = settings.lenderEmails || {};
    if (settings.lenders && Array.isArray(settings.lenders)) {
      const syncedEmails: Record<string, string> = {};
      settings.lenders.forEach((l: any) => {
        if (l.id && l.email) {
          syncedEmails[l.id] = l.email;
        }
      });
      // Merge: syncedEmails takes precedence
      settings.lenderEmails = {
        ...settings.lenderEmails,
        ...syncedEmails
      };

      // Clean up deleted ones
      const currentLenderIds = new Set(settings.lenders.map((l: any) => l.id));
      Object.keys(settings.lenderEmails).forEach((id) => {
        if (!currentLenderIds.has(id)) {
          delete settings.lenderEmails[id];
        }
      });
    }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
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

// GET /api/auth/sync - Register/Sync newly registered Firebase users into PostgreSQL
app.post("/api/auth/sync", requireFirebaseAuth, async (req: any, res) => {
  const fbUser = req.firebaseUser;
  
  try {
    let [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, fbUser.uid)).limit(1);
    
    if (!dbUser) {
      const { firstName, lastName, phone, businessName, licenseNumber } = req.body;
      
      const [newUser] = await db.insert(users).values({
        firebaseUid: fbUser.uid,
        email: fbUser.email || "",
        role: "ADVISOR",
        status: "ACTIVE"
      }).returning();
      
      dbUser = newUser;
      
      await db.insert(advisorProfiles).values({
        userId: dbUser.id,
        businessName: businessName || "",
        licenseNumber: licenseNumber || "",
        businessPhone: phone || "",
        businessEmail: fbUser.email || ""
      });
      
      await writeAuditLog(
        dbUser.id,
        "USER_REGISTER",
        "USERS",
        dbUser.id,
        `User successfully synchronized and registered from Firebase UID: ${fbUser.uid}`
      );
    }
    
    res.status(201).json(dbUser);
  } catch (err: any) {
    console.error("Failed to sync user profile with Postgres:", err);
    res.status(500).json({ error: "שגיאה בסנכרון פרופיל המשתמש מול מסד הנתונים" });
  }
});

// GET /api/auth/me - Load current authenticated Postgres user profile and role details
app.get("/api/auth/me", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, async (req: any, res) => {
  const dbUser = req.dbUser;
  
  try {
    const [profile] = await db.select().from(advisorProfiles).where(eq(advisorProfiles.userId, dbUser.id)).limit(1);
    
    res.json({
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      status: dbUser.status,
      firstName: dbUser.email.split("@")[0],
      lastName: "",
      phone: profile?.businessPhone || "",
      businessName: profile?.businessName || "",
      licenseNumber: profile?.licenseNumber || "",
      disableGemini: profile?.disableGemini || false
    });
  } catch (err) {
    console.error("Failed loading profile details:", err);
    res.status(500).json({ error: "שגיאה בטעינת נתוני הפרופיל" });
  }
});

// GET /api/advisors - Admin or Super-admin only list of advisors
app.get("/api/advisors", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN", "ADMIN"]), async (req, res) => {
  try {
    const allAdvisors = await db.select().from(users).where(eq(users.role, "ADVISOR"));
    const profiles = await db.select().from(advisorProfiles);
    
    const formatted = allAdvisors.map(adv => {
      const p = profiles.find(profile => profile.userId === adv.id);
      return {
        id: String(adv.id),
        name: adv.email.split("@")[0],
        role: "יועץ משכנתאות",
        email: adv.email,
        phone: p?.businessPhone || "",
        company: p?.businessName || "",
        licenseNumber: p?.licenseNumber || "",
        status: adv.status === 'ACTIVE' ? 'active' : 'suspended',
        registeredAt: adv.createdAt?.toISOString() || new Date().toISOString()
      };
    });
    
    res.json(formatted);
  } catch (err) {
    console.error("Failed loading advisors:", err);
    res.status(500).json({ error: "שגיאה בטעינת רשימת היועצים" });
  }
});

// PUT /api/advisors/:id - Edit profile settings (Owner or Admin)
app.put("/api/advisors/:id", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, async (req: any, res) => {
  const currentUserId = req.dbUser.id;
  const targetUserId = parseInt(req.params.id, 10);
  
  if (req.dbUser.role !== "SUPER_ADMIN" && req.dbUser.role !== "ADMIN" && currentUserId !== targetUserId) {
    return res.status(403).json({ error: "אין לך הרשאה לערוך פרופיל זה" });
  }
  
  try {
    const { name, company, licenseNumber, phone, disableGemini } = req.body;
    
    await db.update(advisorProfiles).set({
      businessName: company !== undefined ? company : null,
      licenseNumber: licenseNumber !== undefined ? licenseNumber : null,
      businessPhone: phone !== undefined ? phone : null,
      disableGemini: disableGemini !== undefined ? disableGemini : false,
      updatedAt: new Date()
    }).where(eq(advisorProfiles.userId, targetUserId));
    
    await writeAuditLog(
      currentUserId,
      "USER_UPDATE",
      "ADVISOR_PROFILES",
      targetUserId,
      `Updated profile properties for user ID: ${targetUserId}`
    );
    
    const [p] = await db.select().from(advisorProfiles).where(eq(advisorProfiles.userId, targetUserId)).limit(1);
    
    res.json({
      id: String(targetUserId),
      company: p?.businessName || "",
      licenseNumber: p?.licenseNumber || "",
      phone: p?.businessPhone || "",
      disableGemini: p?.disableGemini || false
    });
  } catch (err) {
    console.error("Failed editing profile settings:", err);
    res.status(500).json({ error: "שגיאה בעדכון פרטי הפרופיל" });
  }
});

// DELETE /api/advisors/:id - Soft delete advisor (Super Admin only)
app.delete("/api/advisors/:id", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN"]), async (req: any, res) => {
  const targetUserId = parseInt(req.params.id, 10);
  
  try {
    await db.update(users).set({
      status: "DISABLED"
    }).where(eq(users.id, targetUserId));
    
    await writeAuditLog(
      req.dbUser.id,
      "USER_DELETE",
      "USERS",
      targetUserId,
      `Soft-deleted advisor user ID: ${targetUserId}`
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error("Failed deleting advisor:", err);
    res.status(500).json({ error: "שגיאה במחיקת היועץ" });
  }
});

// CLIENTS ENDPOINTS

const clientBodySchema = z.object({
  name: z.string().min(2, "שם מלא הוא שדה חובה"),
  idNumber: z.string().min(5, "מספר תעודת זהות שגוי"),
  email: z.string().email("כתובת מייל שגויה").or(z.literal("")),
  phone: z.string().or(z.literal("")),
  address: z.string().or(z.literal("")),
  employmentType: z.string().default("SALARIED"),
  maritalStatus: z.string().default("SINGLE"),
  childrenCount: z.string().default("0"),
  income: z.string().default("0"),
  workplace: z.string().or(z.literal("")),
  propertyCity: z.string().default(""),
  propertyValue: z.string().default("0"),
  requestedAmount: z.string().default("0"),
  financingPercentage: z.string().default("50"),
  notes: z.string().or(z.literal("")),
  dealType: z.string().default("PURCHASE"),
  propertyType: z.string().default("APARTMENT")
});

// GET /api/clients - Retrieves list of clients. Advisors see only their clients, Admins see all.
app.get("/api/clients", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, async (req: any, res) => {
  const dbUser = req.dbUser;
  
  try {
    let rawClients;
    if (dbUser.role === "SUPER_ADMIN" || dbUser.role === "ADMIN") {
      rawClients = await db.select().from(dbClients).where(eq(dbClients.status, "ACTIVE"));
    } else {
      rawClients = await db.select().from(dbClients).where(
        and(eq(dbClients.advisorId, dbUser.id), eq(dbClients.status, "ACTIVE"))
      );
    }
    
    const formatted = [];
    for (const c of rawClients) {
      const fc = await mapDbClientToFrontend(c.id, dbUser.role);
      if (fc) formatted.push(fc);
    }
    
    res.json(formatted);
  } catch (err) {
    console.error("Failed retrieving clients list:", err);
    res.status(500).json({ error: "שגיאה בטעינת רשימת הלקוחות" });
  }
});

// GET /api/clients/:id - Fetch single client details with proper RBAC
app.get("/api/clients/:id", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireAdvisorClientAccess, async (req: any, res) => {
  const clientId = parseInt(req.params.id, 10);
  
  try {
    const fc = await mapDbClientToFrontend(clientId, req.dbUser.role);
    if (!fc) return res.status(404).json({ error: "הלקוח לא נמצא" });
    res.json(fc);
  } catch (err) {
    console.error("Failed fetching client detail:", err);
    res.status(500).json({ error: "שגיאה בטעינת נתוני הלקוח" });
  }
});

// POST /api/clients - Create new client mortgage record in Postgres
app.post("/api/clients", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, async (req: any, res) => {
  const dbUser = req.dbUser;
  
  try {
    const validated = clientBodySchema.parse(req.body);
    
    const nameParts = validated.name.trim().split(" ");
    const firstName = nameParts[0] || validated.name;
    const lastName = nameParts.slice(1).join(" ") || "";
    
    const [newClient] = await db.insert(dbClients).values({
      advisorId: dbUser.id,
      caseNumber: `SYNCASH-CL-${Date.now()}`,
      status: "DRAFT",
      firstName,
      lastName,
      identityNumberEncrypted: encryptField(validated.idNumber),
      identityNumberHash: hashNormalizedIdentityNumber(validated.idNumber),
      identityNumberLast4: maskIdentityNumber(validated.idNumber),
      phoneEncrypted: encryptField(validated.phone),
      emailEncrypted: encryptField(validated.email),
      maritalStatus: validated.maritalStatus,
      numberOfChildren: parseInt(validated.childrenCount, 10) || 0,
      city: validated.propertyCity,
      addressEncrypted: encryptField(validated.address),
      notesEncrypted: encryptField(validated.notes)
    }).returning();
    
    const [newBorrower] = await db.insert(borrowers).values({
      clientId: newClient.id,
      firstName,
      lastName,
      borrowerType: "PRIMARY",
      identityNumberEncrypted: encryptField(validated.idNumber),
      identityNumberHash: hashNormalizedIdentityNumber(validated.idNumber),
      phoneEncrypted: encryptField(validated.phone),
      emailEncrypted: encryptField(validated.email)
    }).returning();
    
    await db.insert(employmentRecords).values({
      borrowerId: newBorrower.id,
      employmentType: validated.employmentType as any,
      employerNameEncrypted: encryptField(validated.workplace),
      monthlyNetIncome: validated.income,
      startDate: new Date().toISOString()
    });
    
    await db.insert(properties).values({
      clientId: newClient.id,
      city: validated.propertyCity,
      addressEncrypted: encryptField(validated.address),
      propertyType: validated.propertyType,
      estimatedValue: validated.propertyValue,
      existingMortgageBalance: "0"
    });
    
    await db.insert(loanRequests).values({
      clientId: newClient.id,
      requestedAmount: validated.requestedAmount,
      loanToValue: validated.financingPercentage,
      purpose: validated.dealType
    });
    
    const defaultDocTypes = [
      "צילום תעודת זהות וספח",
      "דפי עובר ושב (3 חודשים אחרונים)",
      "3 תלושי שכר אחרונים",
      "נסח טאבו או אישור זכויות נכס"
    ];
    for (const docType of defaultDocTypes) {
      await db.insert(dbDocs).values({
        clientId: newClient.id,
        documentType: docType,
        status: "UPLOADING",
        originalFilename: "",
        storageKey: "",
        mimeType: "",
        sizeBytes: 0
      });
    }
    
    await writeAuditLog(
      dbUser.id,
      "CLIENT_CREATE",
      "CLIENTS",
      newClient.id,
      `Created new mortgage case profile with masked ID last 4: ${newClient.identityNumberLast4}`
    );
    
    const fc = await mapDbClientToFrontend(newClient.id, dbUser.role);
    res.status(201).json(fc);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || "שגיאה בוולידציית השדות" });
    }
    console.error("Failed creating mortgage case profile:", err);
    res.status(500).json({ error: "שגיאה פנימית בשמירת נתוני הלקוח" });
  }
});

// PUT /api/clients/:id - Edit client mortgage profile
app.put("/api/clients/:id", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireAdvisorClientAccess, async (req: any, res) => {
  const clientId = parseInt(req.params.id, 10);
  const dbUser = req.dbUser;
  
  try {
    const validated = clientBodySchema.partial().parse(req.body);
    
    const nameParts = validated.name?.trim().split(" ") || [];
    const firstName = nameParts[0] || validated.name;
    const lastName = nameParts.slice(1).join(" ") || "";
    
    await db.update(dbClients).set({
      firstName: firstName !== undefined ? firstName : undefined,
      lastName: lastName !== undefined ? lastName : undefined,
      identityNumberEncrypted: validated.idNumber ? encryptField(validated.idNumber) : undefined,
      identityNumberHash: validated.idNumber ? hashNormalizedIdentityNumber(validated.idNumber) : undefined,
      identityNumberLast4: validated.idNumber ? maskIdentityNumber(validated.idNumber) : undefined,
      phoneEncrypted: validated.phone ? encryptField(validated.phone) : undefined,
      emailEncrypted: validated.email ? encryptField(validated.email) : undefined,
      maritalStatus: validated.maritalStatus || undefined,
      numberOfChildren: validated.childrenCount ? parseInt(validated.childrenCount, 10) : undefined,
      city: validated.propertyCity || undefined,
      addressEncrypted: validated.address ? encryptField(validated.address) : undefined,
      notesEncrypted: validated.notes ? encryptField(validated.notes) : undefined,
      updatedAt: new Date()
    }).where(eq(dbClients.id, clientId));
    
    const [primaryBorrower] = await db.select().from(borrowers).where(
      and(eq(borrowers.clientId, clientId), eq(borrowers.borrowerType, "PRIMARY"))
    ).limit(1);
    
    if (primaryBorrower) {
      await db.update(borrowers).set({
        firstName: firstName !== undefined ? firstName : undefined,
        lastName: lastName !== undefined ? lastName : undefined,
        identityNumberEncrypted: validated.idNumber ? encryptField(validated.idNumber) : undefined,
        identityNumberHash: validated.idNumber ? hashNormalizedIdentityNumber(validated.idNumber) : undefined,
        phoneEncrypted: validated.phone ? encryptField(validated.phone) : undefined,
        emailEncrypted: validated.email ? encryptField(validated.email) : undefined
      }).where(eq(borrowers.id, primaryBorrower.id));
      
      if (validated.employmentType || validated.workplace || validated.income) {
        await db.update(employmentRecords).set({
          employmentType: validated.employmentType as any || undefined,
          employerNameEncrypted: validated.workplace ? encryptField(validated.workplace) : undefined,
          monthlyNetIncome: validated.income || undefined
        }).where(eq(employmentRecords.borrowerId, primaryBorrower.id));
      }
    }
    
    if (validated.propertyCity || validated.address || validated.propertyType || validated.propertyValue) {
      await db.update(properties).set({
        city: validated.propertyCity || undefined,
        addressEncrypted: validated.address ? encryptField(validated.address) : undefined,
        propertyType: validated.propertyType || undefined,
        estimatedValue: validated.propertyValue || undefined
      }).where(eq(properties.clientId, clientId));
    }
    
    if (validated.requestedAmount || validated.financingPercentage || validated.dealType) {
      await db.update(loanRequests).set({
        requestedAmount: validated.requestedAmount || undefined,
        loanToValue: validated.financingPercentage || undefined,
        purpose: validated.dealType || undefined
      }).where(eq(loanRequests.clientId, clientId));
    }
    
    await writeAuditLog(
      dbUser.id,
      "CLIENT_UPDATE",
      "CLIENTS",
      clientId,
      `Updated mortgage case profile details for Client ID: ${clientId}`
    );
    
    const fc = await mapDbClientToFrontend(clientId, dbUser.role);
    res.json(fc);
  } catch (err) {
    console.error("Failed editing client profile:", err);
    res.status(500).json({ error: "שגיאה פנימית בעדכון נתוני הלקוח" });
  }
});

// DELETE /api/clients/:id - Soft-delete a client mortgage case
app.delete("/api/clients/:id", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireAdvisorClientAccess, async (req: any, res) => {
  const clientId = parseInt(req.params.id, 10);
  
  try {
    await db.update(dbClients).set({
      deletedAt: new Date()
    }).where(eq(dbClients.id, clientId));
    
    await writeAuditLog(
      req.dbUser.id,
      "CLIENT_DELETE",
      "CLIENTS",
      clientId,
      `Soft-deleted Client ID: ${clientId}`
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error("Failed deleting client case:", err);
    res.status(500).json({ error: "שגיאה פנימית במחיקת התיק" });
  }
});

// DOCUMENT ENDPOINTS

import multer from "multer";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB default limit
  }
});

function getS3Client() {
  const endpoint = process.env.S3_ENDPOINT || process.env.AWS_S3_ENDPOINT || "https://play.min.io";
  const region = process.env.S3_REGION || process.env.AWS_REGION || "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "minioadmin";
  const secretAccessKey = process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || "minioadmin";
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3 object storage is not configured properly. Missing accessKeyId or secretAccessKey.");
  }

  return new S3Client({
    endpoint: endpoint || undefined,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    forcePathStyle: true
  });
}

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  if (mimeType === "application/pdf") {
    // %PDF-
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }
  if (mimeType === "image/png") {
    // PNG signature
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    // JPEG SOI
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  return false;
}

function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// POST /api/clients/:id/upload-doc - Secure actual document upload
app.post("/api/clients/:id/upload-doc", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireAdvisorClientAccess, upload.single("file"), async (req: any, res) => {
  const clientId = parseInt(req.params.id, 10);
  const { docId, name } = req.body;
  const file = req.file;
  
  if (!file) {
    return res.status(400).json({ error: "לא נבחר קובץ להעלאה" });
  }

  // 1. Verify file size
  const maxUploadSizeMB = await getSetting("MAX_UPLOAD_SIZE_MB", "10");
  const maxSizeBytes = parseInt(maxUploadSizeMB, 10) * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return res.status(400).json({ error: `גודל הקובץ חורג מהרף המקסימלי של ${maxUploadSizeMB}MB` });
  }

  // 2. Verify MIME type and Magic Bytes
  const mimeType = file.mimetype;
  const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
  if (!allowedMimeTypes.includes(mimeType)) {
    return res.status(400).json({ error: "פורמט הקובץ אינו נתמך. המערכת תומכת ב-PDF ובתמונות (PNG, JPEG) בלבד." });
  }

  if (!validateMagicBytes(file.buffer, mimeType)) {
    return res.status(400).json({ error: "תוכן הקובץ אינו תואם לסיומת שלו (זיהוי Magic Bytes נכשל)." });
  }

  // 3. Generate random storageKey
  const fileExt = path.extname(file.originalname) || (mimeType === "application/pdf" ? ".pdf" : ".jpg");
  const storageKey = `clients/${clientId}/${crypto.randomBytes(16).toString("hex")}${fileExt}`;
  
  // 4. Save checksum
  const checksum = calculateChecksum(file.buffer);

  try {
    const s3 = getS3Client();
    const bucketName = process.env.S3_BUCKET || "syncash-private-documents";

    // Auto-create bucket if missing
    try {
      const { CreateBucketCommand } = await import("@aws-sdk/client-s3");
      await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
    } catch (e) {
      // Ignore existing bucket errors
    }

    // Upload to S3 private bucket
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
      Body: file.buffer,
      ContentType: mimeType
    }));

    let doc;
    if (docId) {
      const numericDocId = parseInt(docId, 10);
      if (!isNaN(numericDocId)) {
        [doc] = await db.update(dbDocs).set({
          status: "UPLOADED",
          originalFilename: file.originalname,
          storageKey,
          mimeType,
          sizeBytes: file.size,
          checksum,
          uploadedAt: new Date(),
          uploadedByUserId: req.dbUser.id,
          updatedAt: new Date()
        }).where(eq(dbDocs.id, numericDocId)).returning();
      }
    }
    
    if (!doc) {
      [doc] = await db.insert(dbDocs).values({
        clientId,
        documentType: name || "מסמך נוסף",
        status: "UPLOADED",
        originalFilename: file.originalname,
        storageKey,
        mimeType,
        sizeBytes: file.size,
        checksum,
        uploadedAt: new Date(),
        uploadedByUserId: req.dbUser.id,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
    }
    
    const [client] = await db.select().from(dbClients).where(eq(dbClients.id, clientId)).limit(1);
    if (client && client.status === "DRAFT") {
      await db.update(dbClients).set({ status: "ACTIVE" }).where(eq(dbClients.id, clientId));
    }
    
    await writeAuditLog(
      req.dbUser.id,
      "DOCUMENT_UPLOAD",
      "DOCUMENTS",
      doc.id,
      `Uploaded real document: '${doc.documentType}' (Key: ${storageKey}) for Client ID: ${clientId}`
    );
    
    const fc = await mapDbClientToFrontend(clientId, req.dbUser.role);
    res.json(fc);
  } catch (err: any) {
    console.error("Document upload processing failed:", err);
    res.status(500).json({ error: `כשילוב בהעלאת קובץ לשרת האחסון המאובטח: ${err.message || String(err)}` });
  }
});

// Helper to physically delete file from S3 (Hard Delete)
async function hardDeleteS3File(storageKey: string) {
  try {
    const s3 = getS3Client();
    const bucketName = process.env.S3_BUCKET || "syncash-private-documents";
    await s3.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: storageKey
    }));
    console.log(`Hard deleted file from S3: ${storageKey}`);
  } catch (err) {
    console.error(`Failed to hard delete file from S3: ${storageKey}`, err);
  }
}

// POST /api/clients/:id/delete-doc - Mark document as deleted (Soft and Hard Delete support)
app.post("/api/clients/:id/delete-doc", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireAdvisorClientAccess, async (req: any, res) => {
  const { docId, permanent } = req.body;
  const numericDocId = parseInt(docId, 10);
  
  if (isNaN(numericDocId)) {
    return res.status(400).json({ error: "Invalid document ID" });
  }
  
  try {
    const [doc] = await db.select().from(dbDocs).where(eq(dbDocs.id, numericDocId)).limit(1);
    if (!doc) {
      return res.status(404).json({ error: "המסמך לא נמצא" });
    }

    const isPermanent = permanent === true || permanent === "true" || req.query.permanent === "true";

    if (isPermanent) {
      // 1. Hard Delete S3 object first
      if (doc.storageKey) {
        await hardDeleteS3File(doc.storageKey);
      }
      // 2. Hard Delete database record
      await db.delete(dbDocs).where(eq(dbDocs.id, numericDocId));
    } else {
      // Soft Delete: update status to 'DELETED' and set deletedAt
      await db.update(dbDocs).set({
        status: "DELETED",
        deletedAt: new Date(),
        updatedAt: new Date()
      }).where(eq(dbDocs.id, numericDocId));
    }
    
    await writeAuditLog(
      req.dbUser.id,
      isPermanent ? "DOCUMENT_HARD_DELETE" : "DOCUMENT_DELETE",
      "DOCUMENTS",
      numericDocId,
      `${isPermanent ? "Permanently hard" : "Soft"} deleted document ID: ${numericDocId}`
    );
    
    const fc = await mapDbClientToFrontend(parseInt(req.params.id, 10), req.dbUser.role);
    res.json(fc);
  } catch (err) {
    console.error("Failed deleting document:", err);
    res.status(500).json({ error: "שגיאה במחיקת המסמך" });
  }
});

// Helper to send real emails via Nodemailer with database configurations and SecretProvider
async function sendRealEmail(to: string, replyTo: string, subject: string, text: string, attachments?: Array<{ filename: string; content: Buffer }>) {
  try {
    const host = await getSetting("SMTP_HOST", "smtp.gmail.com");
    const portStr = await getSetting("SMTP_PORT", "465");
    const port = parseInt(portStr, 10);
    const secureVal = await getSetting("SMTP_SECURE", "ssl_tls");
    const secure = secureVal === "ssl_tls" || secureVal === "true" || port === 465;
    const user = await getSetting("SMTP_USER", "requests@syncash-mail.co.il");
    const fromAddress = await getSetting("EMAIL_FROM", user);
    const fromName = await getSetting("EMAIL_FROM_NAME", "מערכת SynCash");
    const systemReplyTo = await getSetting("EMAIL_REPLY_TO", fromAddress);

    // Load password strictly via SecretProvider
    const password = await getSecret("syncash-smtp-password");
    
    if (!password) {
      console.warn("SMTP password not configured in Secret Manager, skipping real mail dispatch.");
      
      await db.insert(emailLogs).values({
        recipient: to,
        template: "LENDER_SUBMISSION",
        status: "FAILED",
        errorMessage: "SMTP password not set in Secret Provider",
        failedAt: new Date(),
        createdAt: new Date()
      });

      return { success: false, reason: "סיסמת שרת הדואר (SMTP Password) אינה מוגדרת במערכת." };
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass: password
      }
    });

    // Verification check as required in Requirement 8
    await transporter.verify();

    const mailOptions: any = {
      from: `"${fromName}" <${fromAddress}>`,
      to,
      replyTo: replyTo || systemReplyTo,
      subject,
      text
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await transporter.sendMail(mailOptions);
    const messageId = info.messageId || `MSG-${crypto.randomBytes(8).toString("hex")}`;
    
    // Create record in email_logs table as requested
    await db.insert(emailLogs).values({
      recipient: to,
      template: "LENDER_SUBMISSION",
      status: "SENT",
      providerMessageId: messageId,
      sentAt: new Date(),
      createdAt: new Date()
    });

    return { success: true, messageId };
  } catch (error: any) {
    console.error("Nodemailer failed to send email:", error);
    
    // Ensure no secret is saved inside the error message
    let safeError = error.message || String(error);
    const password = await getSecret("syncash-smtp-password");
    if (password) {
      safeError = safeError.replace(new RegExp(password, "g"), "[REDACTED]");
    }

    await db.insert(emailLogs).values({
      recipient: to,
      template: "LENDER_SUBMISSION",
      status: "FAILED",
      errorMessage: safeError,
      failedAt: new Date(),
      createdAt: new Date()
    });

    return { success: false, reason: `שגיאת התחברות לשרת הדואר: ${safeError}` };
  }
}

// POST /api/clients/:id/send-to-lenders (Generate anonymous cover pitch & dispatch to lenders securely via invite tokens)
app.post("/api/clients/:id/send-to-lenders", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireAdvisorClientAccess, async (req: any, res) => {
  const clientId = parseInt(req.params.id, 10);
  const { lenders: reqLenders, selectedLenders } = req.body;
  const targetLenders = reqLenders || selectedLenders;
  
  if (!targetLenders || !Array.isArray(targetLenders) || targetLenders.length === 0) {
    return res.status(400).json({ error: "נא לבחור לפחות חברת מימון אחת לשליחה" });
  }

  // Enforce selectedLenders is an array of numbers (lender IDs)
  const lenderIds = targetLenders.map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
  if (lenderIds.length === 0) {
    return res.status(400).json({ error: "נא לבחור לפחות חברת מימון אחת עם מזהה תקין" });
  }

  try {
    const [client] = await db.select().from(dbClients).where(eq(dbClients.id, clientId)).limit(1);
    if (!client) {
      return res.status(404).json({ error: "הלקוח לא נמצא" });
    }

    // Validate that ALL chosen lenders exist and are ACTIVE
    for (const lenderId of lenderIds) {
      const [lendingCompany] = await db.select().from(lenders).where(eq(lenders.id, lenderId)).limit(1);
      if (!lendingCompany) {
        return res.status(400).json({ error: `חברת המימון עם מזהה ${lenderId} אינה קיימת במערכת. אין לבצע יצירה אוטומטית.` });
      }
      if (lendingCompany.status !== "ACTIVE") {
        return res.status(400).json({ error: `חברת המימון ${lendingCompany.name} אינה פעילה.` });
      }
    }
    
    // Update overall client status to SUBMITTED
    await db.update(dbClients).set({
      status: "SUBMITTED",
      updatedAt: new Date()
    }).where(eq(dbClients.id, clientId));
    
    // Resolve base URL
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
    
    const anonymizedClientForPdf = await mapDbClientToFrontend(clientId, "LENDER");
    if (!anonymizedClientForPdf) {
      return res.status(500).json({ error: "שגיאה בטעינת נתוני הלקוח לצורך הפקת PDF" });
    }
    
    // Generate secure anonymous PDF profile
    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await generateClientPdf(anonymizedClientForPdf, baseUrl);
    } catch (pdfErr) {
      console.error("Failed generating client PDF profile:", pdfErr);
    }

    // Build the clean anonymous snapshot using buildAnonymousSubmissionSnapshot
    const anonymousSnapshot = buildAnonymousSubmissionSnapshot(anonymizedClientForPdf);
    
    // Execute all updates inside a single database transaction for consistency and absolute safety
    const dispatches: Array<{ submissionId: number; companyEmail: string; companyName: string; rawToken: string }> = [];

    await db.transaction(async (tx) => {
      for (const lenderId of lenderIds) {
        const [lendingCompany] = await tx.select().from(lenders).where(eq(lenders.id, lenderId)).limit(1);
        const companyEmail = lendingCompany!.generalEmail || `${lendingCompany!.name.toLowerCase()}@lender.co.il`;
        const companyName = lendingCompany!.name;

        // Save or update dispatch state in database
        const [existingState] = await tx.select().from(lenderSubmissions).where(
          and(eq(lenderSubmissions.clientId, clientId), eq(lenderSubmissions.lenderId, lenderId))
        ).limit(1);
        
        let submissionId: number;
        if (existingState) {
          await tx.update(lenderSubmissions).set({
            status: "PENDING_DELIVERY",
            anonymousSnapshot,
            updatedAt: new Date()
          }).where(eq(lenderSubmissions.id, existingState.id));
          submissionId = existingState.id;
        } else {
          const [newSub] = await tx.insert(lenderSubmissions).values({
            clientId,
            advisorId: req.dbUser.id,
            lenderId,
            status: "PENDING_DELIVERY",
            anonymousSnapshot
          }).returning();
          submissionId = newSub.id;
        }

        // Generate secure invite token
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
        
        const expiryHoursStr = await getSetting("LENDER_INVITE_EXPIRY_HOURS", "48");
        const expiresAt = new Date(Date.now() + parseInt(expiryHoursStr, 10) * 60 * 60 * 1000);
        
        await tx.insert(lenderInviteTokens).values({
          submissionId,
          tokenHash,
          expiresAt,
          createdAt: new Date()
        });

        dispatches.push({
          submissionId,
          companyEmail,
          companyName,
          rawToken
        });
      }
    });

    // Execute SMTP email dispatches outside the database transaction to prevent blocking locks
    for (const disp of dispatches) {
      const { submissionId, companyEmail, companyName, rawToken } = disp;
      const directReplyUrl = `${baseUrl}/lender/invite/${rawToken}`;
      
      const emailBodyText = 
        `==================================================\n` +
        `       בקשת מימון חוץ-בנקאית רשמית ומאובטחת\n` +
        `       נשלח באמצעות פלטפורמת SynCash המרכזית\n` +
        `==================================================\n\n` +
        `שלום רב,\n\n` +
        `מצורפת בזאת פניית אשראי חוץ-בנקאית חדשה ומאובטחת עבור לקוח אנונימי (קוד פנייה: SYNCASH-CL-${clientId}).\n\n` +
        `כלל פרטי העסקה והנתונים הפיננסיים המלאים והמאומתים מצורפים בקובץ ה-PDF המאובטח המצורף למייל זה.\n\n` +
        `--------------------------------------------------\n` +
        `   מענה ישיר והגשת הצעת מימון מקוונת בזירה:\n` +
        `--------------------------------------------------\n` +
        `למענה מהיר, עדכון סטטוס תיק או הגשת ריביות/אישור רשמי ישירות ליועץ:\n` +
        `🔗 לחץ כאן למענה מיידי מאובטח:\n` +
        `${directReplyUrl}\n\n` +
        `הודעתכם וריביתכם יעודכנו בזמן אמת בלוח הבקרה של היועץ ${req.dbUser.email.split("@")[0]}.\n` +
        `--------------------------------------------------\n\n` +
        `בברכה,\n` +
        `מערכת SynCash`;
        
      const attachments = pdfBuffer ? [
        {
          filename: `SynCash_Profile_SYNCASH-CL-${clientId}.pdf`,
          content: pdfBuffer
        }
      ] : undefined;
      
      const subject = `[SynCash] פניית אשראי חוץ-בנקאית חדשה - סימוכין SYNCASH-CL-${clientId}`;
      const mailResult = await sendRealEmail(companyEmail, req.dbUser.email, subject, emailBodyText, attachments);
      
      if (!mailResult.success) {
        // Enforce DELIVERY_FAILED status on failure
        await db.update(lenderSubmissions).set({
          status: "DELIVERY_FAILED",
          updatedAt: new Date()
        }).where(eq(lenderSubmissions.id, submissionId));

        continue;
      }
      
      // Update status to SENT on SMTP success
      await db.update(lenderSubmissions).set({
        status: "SENT",
        updatedAt: new Date()
      }).where(eq(lenderSubmissions.id, submissionId));
      
      await writeAuditLog(
        req.dbUser.id,
        "LENDER_DISPATCH",
        "LENDER_SUBMISSIONS",
        clientId,
        `Dispatched client case anonymously to ${companyName} (${companyEmail}) with token`
      );
    }
    
    const updatedClient = await mapDbClientToFrontend(clientId, req.dbUser.role);
    res.json(updatedClient);
  } catch (err) {
    console.error("Failed sending to lenders:", err);
    res.status(500).json({ error: "שגיאה פנימית בשליחת הבקשות לחברות המימון" });
  }
});

// POST /api/lender/submissions/:id/retry (Explicitly retry a failed email dispatch)
app.post("/api/lender/submissions/:id/retry", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, async (req: any, res) => {
  const submissionId = parseInt(req.params.id, 10);
  if (isNaN(submissionId)) {
    return res.status(400).json({ error: "Invalid submission ID" });
  }

  try {
    const [sub] = await db.select().from(lenderSubmissions).where(eq(lenderSubmissions.id, submissionId)).limit(1);
    if (!sub) {
      return res.status(404).json({ error: "הגשה לא נמצאה" });
    }

    // Verify access
    const [client] = await db.select().from(dbClients).where(eq(dbClients.id, sub.clientId)).limit(1);
    if (!client) {
      return res.status(404).json({ error: "לקוח משויך לא נמצא" });
    }
    if (req.dbUser.role === "ADVISOR" && client.advisorId !== req.dbUser.id) {
      return res.status(403).json({ error: "אין לך הרשאה לגשת לתיק זה" });
    }

    const [lendingCompany] = await db.select().from(lenders).where(eq(lenders.id, sub.lenderId)).limit(1);
    if (!lendingCompany || lendingCompany.status !== "ACTIVE") {
      return res.status(400).json({ error: "חברת המימון אינה קיימת או אינה פעילה" });
    }

    // Update status to PENDING_DELIVERY first
    await db.update(lenderSubmissions).set({
      status: "PENDING_DELIVERY",
      updatedAt: new Date()
    }).where(eq(lenderSubmissions.id, submissionId));

    // Resolve base URL
    let baseUrl = `${req.protocol}://${req.get('host')}`;
    const anonymizedClientForPdf = await mapDbClientToFrontend(sub.clientId, "LENDER");
    if (!anonymizedClientForPdf) {
      return res.status(500).json({ error: "שגיאה בטעינת נתוני הלקוח לצורך הפקת PDF" });
    }

    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await generateClientPdf(anonymizedClientForPdf, baseUrl);
    } catch (pdfErr) {
      console.error("Failed generating client PDF profile on retry:", pdfErr);
    }

    // Generate token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiryHoursStr = await getSetting("LENDER_INVITE_EXPIRY_HOURS", "48");
    const expiresAt = new Date(Date.now() + parseInt(expiryHoursStr, 10) * 60 * 60 * 1000);

    await db.insert(lenderInviteTokens).values({
      submissionId,
      tokenHash,
      expiresAt,
      createdAt: new Date()
    });

    const directReplyUrl = `${baseUrl}/lender/invite/${rawToken}`;
    const emailBodyText = 
      `==================================================\n` +
      `   [RETRY] בקשת מימון חוץ-בנקאית רשמית ומאובטחת\n` +
      `==================================================\n\n` +
      `שלום רב,\n\n` +
      `זהו ניסיון חוזר לשליחת פניית האשראי המאובטח עבור לקוח אנונימי (קוד פנייה: SYNCASH-CL-${sub.clientId}).\n\n` +
      `🔗 לחץ כאן למענה מיידי מאובטח:\n` +
      `${directReplyUrl}\n\n` +
      `בברכה,\n` +
      `מערכת SynCash`;

    const attachments = pdfBuffer ? [
      {
        filename: `SynCash_Profile_SYNCASH-CL-${sub.clientId}.pdf`,
        content: pdfBuffer
      }
    ] : undefined;

    const companyEmail = lendingCompany.generalEmail || "credit@lender.co.il";
    const subject = `[Retry] פניית אשראי חוץ-בנקאית - סימוכין SYNCASH-CL-${sub.clientId}`;
    const mailResult = await sendRealEmail(companyEmail, req.dbUser.email, subject, emailBodyText, attachments);

    if (!mailResult.success) {
      await db.update(lenderSubmissions).set({
        status: "DELIVERY_FAILED",
        updatedAt: new Date()
      }).where(eq(lenderSubmissions.id, submissionId));

      return res.status(500).json({ error: `שליחת המייל נכשלה שנית: ${mailResult.reason}` });
    }

    const anonymousSnapshot = buildAnonymousSubmissionSnapshot(anonymizedClientForPdf);
    await db.update(lenderSubmissions).set({
      anonymousSnapshot,
      status: "SENT",
      updatedAt: new Date()
    }).where(eq(lenderSubmissions.id, submissionId));

    await writeAuditLog(
      req.dbUser.id,
      "LENDER_DISPATCH_RETRY",
      "LENDER_SUBMISSIONS",
      sub.clientId,
      `Successfully retried dispatch to ${lendingCompany.name} (${companyEmail})`
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error("Retry failed:", err);
    res.status(500).json({ error: "שגיאה פנימית בביצוע ניסיון חוזר" });
  }
});

// POST /api/auth/register-lender (Unified registration for lender underwriters via invite token)
app.post("/api/auth/register-lender", requireFirebaseAuth, async (req: any, res) => {
  const fbUser = req.firebaseUser;
  const { token, firstName, lastName, phone, jobTitle } = req.body;

  if (!token) {
    return res.status(400).json({ error: "טוקן הזמנה חסר" });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [invite] = await db.select().from(lenderInviteTokens).where(eq(lenderInviteTokens.tokenHash, tokenHash)).limit(1);

    if (!invite || (invite.expiresAt && new Date() > invite.expiresAt) || invite.revokedAt) {
      return res.status(403).json({ error: "קישור הזמנה פג תוקף, מבוטל או שאינו קיים" });
    }

    const [sub] = await db.select().from(lenderSubmissions).where(eq(lenderSubmissions.id, invite.submissionId)).limit(1);
    if (!sub) {
      return res.status(404).json({ error: "הגשה משויכת לא נמצאה" });
    }

    // Check if user already exists in PostgreSQL
    let [dbUser] = await db.select().from(users).where(eq(users.firebaseUid, fbUser.uid)).limit(1);

    if (!dbUser) {
      // Create user
      const [newUser] = await db.insert(users).values({
        firebaseUid: fbUser.uid,
        email: fbUser.email || "",
        role: "LENDER_UNDERWRITER",
        status: "ACTIVE",
        firstName: firstName || "",
        lastName: lastName || "",
        phone: phone || "",
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      dbUser = newUser;

      // Link to lender
      await db.insert(lenderUsers).values({
        userId: dbUser.id,
        lenderId: sub.lenderId,
        jobTitle: jobTitle || "חתם",
        isPrimaryContact: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await writeAuditLog(
        dbUser.id,
        "USER_REGISTER_LENDER",
        "USERS",
        dbUser.id,
        `Lender user registered and linked to lender ID: ${sub.lenderId}`
      );
    }

    res.status(201).json(dbUser);
  } catch (err: any) {
    console.error("Failed to register lender profile:", err);
    res.status(500).json({ error: "שגיאה ברישום חתם מול מסד הנתונים" });
  }
});

// POST /api/lender/submissions/:id/identity-request (Lender Requests Identity Reveal)
app.post("/api/lender/submissions/:id/identity-request", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireLenderSubmissionAccess, async (req: any, res) => {
  const submissionId = parseInt(req.params.id, 10);
  const { reason } = req.body;

  try {
    const sub = req.authorizedSubmission; // Loaded by requireLenderSubmissionAccess middleware!

    // Check if there is already an active request
    const [existing] = await db.select().from(identityRevealRequests).where(
      and(eq(identityRevealRequests.submissionId, submissionId), eq(identityRevealRequests.status, "PENDING"))
    ).limit(1);

    if (existing) {
      return res.status(400).json({ error: "כבר קיימת בקשת חשיפת זהות ממתינה עבור פנייה זו" });
    }

    // Insert new request
    await db.insert(identityRevealRequests).values({
      submissionId,
      requestedByUserId: req.dbUser.id,
      reason: reason || "מבקש גישה לצורך אימות זהות ומסמכי מקור",
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Update submission status to IDENTITY_REQUESTED
    await db.update(lenderSubmissions).set({
      status: "IDENTITY_REQUESTED",
      updatedAt: new Date()
    }).where(eq(lenderSubmissions.id, submissionId));

    await writeAuditLog(
      req.dbUser.id,
      "IDENTITY_REVEAL_REQUESTED",
      "SUBMISSIONS",
      submissionId,
      `Lender user requested identity reveal for submission ID: ${submissionId}`
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error creating identity request:", err);
    res.status(500).json({ error: "שגיאה פנימית ביצירת בקשת חשיפת זהות" });
  }
});

// GET /api/advisor/reveal-requests (Get all pending reveal requests for the advisor's cases)
app.get("/api/advisor/reveal-requests", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, async (req: any, res) => {
  if (req.dbUser.role !== "ADVISOR" && req.dbUser.role !== "SUPER_ADMIN" && req.dbUser.role !== "ADMIN") {
    return res.status(403).json({ error: "אין הרשאה מתאימה" });
  }

  try {
    const pendingRequests = await db.select({
      id: identityRevealRequests.id,
      submissionId: identityRevealRequests.submissionId,
      reason: identityRevealRequests.reason,
      status: identityRevealRequests.status,
      createdAt: identityRevealRequests.createdAt,
      clientId: lenderSubmissions.clientId,
      lenderId: lenderSubmissions.lenderId
    })
    .from(identityRevealRequests)
    .innerJoin(lenderSubmissions, eq(identityRevealRequests.submissionId, lenderSubmissions.id))
    .where(
      and(
        req.dbUser.role === "ADVISOR" ? eq(lenderSubmissions.advisorId, req.dbUser.id) : undefined,
        eq(identityRevealRequests.status, "PENDING")
      )
    );

    const hydrated = [];
    for (const r of pendingRequests) {
      const [lendingCompany] = await db.select().from(lenders).where(eq(lenders.id, r.lenderId)).limit(1);
      const [clientRecord] = await db.select().from(dbClients).where(eq(dbClients.id, r.clientId)).limit(1);
      if (clientRecord) {
        hydrated.push({
          ...r,
          lenderName: lendingCompany?.name || "חברת מימון",
          clientName: `${clientRecord.firstName} ${clientRecord.lastName}`
        });
      }
    }

    res.json(hydrated);
  } catch (err) {
    console.error("Error fetching advisor reveal requests:", err);
    res.status(500).json({ error: "שגיאה באחזור בקשות חשיפת זהות" });
  }
});

// POST /api/advisor/reveal-requests/:id/respond (Advisor Responds to Identity Reveal Request)
app.post("/api/advisor/reveal-requests/:id/respond", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, async (req: any, res) => {
  const requestId = parseInt(req.params.id, 10);
  const { decision } = req.body; // "APPROVED" or "REJECTED"

  if (!["APPROVED", "REJECTED"].includes(decision)) {
    return res.status(400).json({ error: "החלטה לא תקינה (חייב להיות APPROVED או REJECTED)" });
  }

  try {
    // 1. Get the request
    const [revealReq] = await db.select().from(identityRevealRequests).where(eq(identityRevealRequests.id, requestId)).limit(1);
    if (!revealReq) {
      return res.status(404).json({ error: "בקשת חשיפת זהות לא נמצאה" });
    }

    // 2. Get submission
    const [sub] = await db.select().from(lenderSubmissions).where(eq(lenderSubmissions.id, revealReq.submissionId)).limit(1);
    if (!sub) {
      return res.status(404).json({ error: "הגשה משויכת לא נמצאה" });
    }

    // 3. Get client
    const [client] = await db.select().from(dbClients).where(eq(dbClients.id, sub.clientId)).limit(1);
    if (!client) {
      return res.status(404).json({ error: "לקוח משויך לא נמצא" });
    }

    // 4. Verify access
    if (req.dbUser.role === "ADVISOR" && client.advisorId !== req.dbUser.id) {
      return res.status(403).json({ error: "אין לך הרשאה להגיב לבקשה בתיק זה" });
    }

    // 5. Perform the update inside a transaction for complete safety!
    await db.transaction(async (tx) => {
      await tx.update(identityRevealRequests).set({
        status: decision,
        reviewedByUserId: req.dbUser.id,
        reviewedAt: new Date(),
        updatedAt: new Date()
      }).where(eq(identityRevealRequests.id, requestId));

      const subStatus = decision === "APPROVED" ? "IDENTITY_APPROVED" : "IDENTITY_REJECTED";
      await tx.update(lenderSubmissions).set({
        status: subStatus,
        updatedAt: new Date()
      }).where(eq(lenderSubmissions.id, sub.id));
    });

    await writeAuditLog(
      req.dbUser.id,
      decision === "APPROVED" ? "IDENTITY_REVEAL_APPROVED" : "IDENTITY_REVEAL_REJECTED",
      "SUBMISSIONS",
      sub.id,
      `Advisor ${decision === "APPROVED" ? "approved" : "rejected"} identity reveal request for submission ID: ${sub.id}`
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error responding to identity request:", err);
    res.status(500).json({ error: "שגיאה פנימית בעדכון בקשת חשיפת זהות" });
  }
});

// GET /api/documents/download (Safe secure document download)
app.get("/api/documents/download", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, async (req: any, res) => {
  const { clientId, docId } = req.query;
  if (!clientId || !docId) {
    return res.status(400).send("מזהה לקוח או מסמך חסרים");
  }
  
  const numericClientId = parseInt(clientId as string, 10);
  const numericDocId = parseInt(docId as string, 10);
  
  if (isNaN(numericClientId) || isNaN(numericDocId)) {
    return res.status(400).send("מזהי לקוח או מסמך לא תקינים");
  }

  try {
    // 1. Check access / owner relationship
    if (req.dbUser.role === "ADVISOR") {
      const [advisorClient] = await db.select().from(dbClients).where(
        and(eq(dbClients.id, numericClientId), eq(dbClients.advisorId, req.dbUser.id))
      ).limit(1);
      if (!advisorClient) {
        return res.status(403).send("אין הרשאה לגשת למסמכי לקוח זה");
      }
    } else if (["LENDER_ADMIN", "LENDER_UNDERWRITER"].includes(req.dbUser.role)) {
      // Lender role: Check active submission, reveal request approval, and matching company
      const [lenderUser] = await db.select().from(lenderUsers).where(eq(lenderUsers.userId, req.dbUser.id)).limit(1);
      if (!lenderUser) {
        return res.status(403).send("אינך משויך לגוף מימון מורשה");
      }

      const [sub] = await db.select().from(lenderSubmissions).where(
        and(eq(lenderSubmissions.clientId, numericClientId), eq(lenderSubmissions.lenderId, lenderUser.lenderId))
      ).limit(1);

      if (!sub) {
        return res.status(403).send("אין לגוף המימון שלך גישה לתיק זה");
      }

      const allowedLenderStatuses = ["IDENTITY_APPROVED", "OFFER_RECEIVED", "APPROVED", "ACCEPTED"];
      const isStatusRevealed = allowedLenderStatuses.includes(sub.status || "");

      const [revealReq] = await db.select().from(identityRevealRequests).where(
        and(eq(identityRevealRequests.submissionId, sub.id), eq(identityRevealRequests.status, "APPROVED"))
      ).limit(1);

      if (!isStatusRevealed && !revealReq) {
        return res.status(403).send("טרם אושרה חשיפת פרטי זיהוי ומסמכים מלאים עבור גוף המימון שלך");
      }
    }
    
    const [client] = await db.select().from(dbClients).where(eq(dbClients.id, numericClientId)).limit(1);
    if (!client) {
      return res.status(404).send("הלקוח לא נמצא");
    }
    
    const [doc] = await db.select().from(dbDocs).where(
      and(eq(dbDocs.id, numericDocId), eq(dbDocs.clientId, numericClientId))
    ).limit(1);
    if (!doc || !doc.storageKey) {
      return res.status(404).send("המסמך לא נמצא או שטרם הועלה בפועל");
    }

    // 2. Obtain pre-signed secure download URL from private S3 bucket
    const s3 = getS3Client();
    const bucketName = process.env.S3_BUCKET || "syncash-private-documents";
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: doc.storageKey
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    // 3. Write Audit Log for view/download
    await writeAuditLog(
      req.dbUser.id,
      "DOCUMENT_VIEW",
      "DOCUMENTS",
      numericDocId,
      `Downloaded real document: '${doc.documentType}' via pre-signed URL (Key: ${doc.storageKey}) for Client ID: ${numericClientId}`
    );

    // Redirect to private S3 pre-signed URL securely
    res.redirect(signedUrl);
  } catch (err) {
    console.error("Failed to download document:", err);
    res.status(500).send("שגיאה פנימית בהורדת הקובץ מהאחסון המאובטח");
  }
});

// GET /api/documents/download-by-token (Public secure download of a document using an invite token after reveal approval)
app.get("/api/documents/download-by-token", async (req: any, res) => {
  const { token, docId } = req.query;
  if (!token || !docId) {
    return res.status(400).send("מזהה מסמך או טוקן חסרים");
  }

  const numericDocId = parseInt(docId as string, 10);
  if (isNaN(numericDocId)) {
    return res.status(400).send("מזהה מסמך לא תקין");
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token as string).digest("hex");
    const [invite] = await db.select().from(lenderInviteTokens).where(eq(lenderInviteTokens.tokenHash, tokenHash)).limit(1);
    
    if (!invite || (invite.expiresAt && new Date() > invite.expiresAt) || invite.revokedAt) {
      return res.status(403).send("קישור ההזמנה פג תוקף, מבוטל או שאינו קיים במערכת");
    }

    const [sub] = await db.select().from(lenderSubmissions).where(eq(lenderSubmissions.id, invite.submissionId)).limit(1);
    if (!sub) {
      return res.status(404).send("הגשה לא נמצאה");
    }

    // Verify identity reveal is approved
    const [revealReq] = await db.select().from(identityRevealRequests).where(
      and(eq(identityRevealRequests.submissionId, sub.id), eq(identityRevealRequests.status, "APPROVED"))
    ).limit(1);

    const allowedLenderStatuses = ["IDENTITY_APPROVED", "OFFER_RECEIVED", "APPROVED", "ACCEPTED"];
    const isStatusRevealed = allowedLenderStatuses.includes(sub.status || "");

    if (!isStatusRevealed && !revealReq) {
      return res.status(403).send("טרם אושרה חשיפת פרטי זיהוי ומסמכים מלאים עבור גוף המימון שלך");
    }

    const [doc] = await db.select().from(dbDocs).where(
      and(eq(dbDocs.id, numericDocId), eq(dbDocs.clientId, sub.clientId))
    ).limit(1);

    if (!doc || !doc.storageKey) {
      return res.status(404).send("המסמך לא נמצא או שטרם הועלה בפועל");
    }

    // Generate pre-signed URL
    const s3 = getS3Client();
    const bucketName = process.env.S3_BUCKET || "syncash-private-documents";
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: doc.storageKey
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 900 });

    // Write Audit Log for public download
    await writeAuditLog(
      sub.advisorId,
      "DOCUMENT_VIEW_BY_TOKEN",
      "DOCUMENTS",
      numericDocId,
      `Downloaded real document: '${doc.documentType}' via pre-signed URL using token for Client ID: ${sub.clientId}`
    );

    res.redirect(url);
  } catch (err) {
    console.error("Error downloading document by token:", err);
    res.status(500).send("שגיאה פנימית בהורדת המסמך");
  }
});

// GET /api/admin/lenders (Get list of all financing companies for admin panel from PostgreSQL)
app.get("/api/admin/lenders", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN", "ADMIN"]), async (req: any, res) => {
  try {
    const list = await db.select().from(lenders).where(eq(lenders.status, "ACTIVE"));
    res.json(list.map(l => ({
      id: String(l.id),
      name: l.name,
      email: l.generalEmail || "",
      description: l.legalName || "",
      specialty: l.website || "",
      status: l.status.toLowerCase()
    })));
  } catch (error: any) {
    console.error("GET /api/admin/lenders error:", error);
    res.status(500).json({ error: "שגיאה בטעינת חברות מימון" });
  }
});

// POST /api/admin/lenders (Add new financing company to PostgreSQL)
app.post("/api/admin/lenders", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN", "ADMIN"]), async (req: any, res) => {
  const { name, email, description, specialty } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "נא למלא שם ואימייל חברה" });
  }

  try {
    const [newLender] = await db.insert(lenders).values({
      name: name.trim(),
      legalName: description || "",
      generalEmail: email.trim(),
      website: specialty || "",
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    res.status(201).json({
      id: String(newLender.id),
      name: newLender.name,
      email: newLender.generalEmail,
      description: newLender.legalName,
      specialty: newLender.website,
      status: "active"
    });
  } catch (error: any) {
    console.error("POST /api/admin/lenders error:", error);
    res.status(500).json({ error: "שגיאה בהוספת חברת מימון" });
  }
});

// PUT /api/admin/lenders/:id (Update or pause/suspend/activate financing company in PostgreSQL)
app.put("/api/admin/lenders/:id", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN", "ADMIN"]), async (req: any, res) => {
  const lenderId = parseInt(req.params.id, 10);
  if (isNaN(lenderId)) {
    return res.status(400).json({ error: "מזהה חברה לא תקין" });
  }
  const { name, email, description, specialty, status } = req.body;

  try {
    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.generalEmail = email.trim();
    if (description !== undefined) updates.legalName = description;
    if (specialty !== undefined) updates.website = specialty;
    if (status !== undefined) updates.status = status.toUpperCase();

    const [updatedLender] = await db.update(lenders).set(updates).where(eq(lenders.id, lenderId)).returning();
    if (!updatedLender) {
      return res.status(404).json({ error: "חברת המימון לא נמצאה" });
    }

    res.json({
      id: String(updatedLender.id),
      name: updatedLender.name,
      email: updatedLender.generalEmail,
      description: updatedLender.legalName,
      specialty: updatedLender.website,
      status: updatedLender.status.toLowerCase()
    });
  } catch (error: any) {
    console.error("PUT /api/admin/lenders error:", error);
    res.status(500).json({ error: "שגיאה בעדכון חברת מימון" });
  }
});

// DELETE /api/admin/lenders/:id (Delete/remove financing company from PostgreSQL)
app.delete("/api/admin/lenders/:id", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN"]), async (req: any, res) => {
  const lenderId = parseInt(req.params.id, 10);
  if (isNaN(lenderId)) {
    return res.status(400).json({ error: "מזהה חברה לא תקין" });
  }

  try {
    const [deleted] = await db.update(lenders).set({
      status: "DELETED",
      deletedAt: new Date()
    }).where(eq(lenders.id, lenderId)).returning();

    if (!deleted) {
      return res.status(404).json({ error: "חברת המימון לא נמצאה" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/lenders error:", error);
    res.status(500).json({ error: "שגיאה במחיקת חברת מימון" });
  }
});

// GET /api/admin/settings (Legacy fallback support - reads from system_settings DB)
app.get("/api/admin/settings", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN", "ADMIN"]), async (req: any, res) => {
  try {
    const keys = ["SYSTEM_NAME", "APP_URL", "SUPPORT_EMAIL", "EMAIL_FROM_NAME"];
    const settings: Record<string, any> = { lenders: [] };
    for (const key of keys) {
      settings[key] = await getSetting(key);
    }
    const dbLenders = await db.select().from(lenders).where(eq(lenders.status, "ACTIVE"));
    settings.lenders = dbLenders.map(l => ({
      id: String(l.id),
      name: l.name,
      email: l.generalEmail || ""
    }));
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: "שגיאה בקבלת הגדרות" });
  }
});

// POST /api/admin/settings (Legacy fallback support)
app.post("/api/admin/settings", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN"]), async (req: any, res) => {
  res.json({ success: true });
});

// --- NEW SECURE SYSTEM SETTINGS API ENDPOINTS ---

// 1. GET /api/admin/settings/general
app.get("/api/admin/settings/general", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN", "ADMIN"]), async (req: any, res) => {
  try {
    const keys = [
      "SYSTEM_NAME", "APP_URL", "SUPPORT_EMAIL", "EMAIL_FROM_NAME", "EMAIL_REPLY_TO",
      "DEFAULT_TIMEZONE", "DEFAULT_LOCALE", "LENDER_INVITE_EXPIRY_HOURS",
      "PASSWORD_RESET_EXPIRY_MINUTES", "MAX_UPLOAD_SIZE_MB", "MAINTENANCE_MODE"
    ];
    
    const settingsObj: Record<string, string> = {};
    for (const key of keys) {
      settingsObj[key] = await getSetting(key);
    }
    
    res.json({
      success: true,
      data: settingsObj
    });
  } catch (error: any) {
    console.error("GET /api/admin/settings/general error:", error);
    res.status(500).json({ error: "שגיאה בטעינת הגדרות כלליות" });
  }
});

// 2. PATCH /api/admin/settings/general
app.patch("/api/admin/settings/general", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN", "ADMIN"]), async (req: any, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== "object") {
      return res.status(400).json({ error: "נתונים לא תקינים לעדכון" });
    }
    
    const changedFields: string[] = [];
    const ALLOWED_KEYS = [
      "SYSTEM_NAME", "APP_URL", "SUPPORT_EMAIL", "EMAIL_FROM_NAME", "EMAIL_REPLY_TO",
      "DEFAULT_TIMEZONE", "DEFAULT_LOCALE", "LENDER_INVITE_EXPIRY_HOURS",
      "PASSWORD_RESET_EXPIRY_MINUTES", "MAX_UPLOAD_SIZE_MB", "MAINTENANCE_MODE"
    ];
    
    for (const [key, val] of Object.entries(settings)) {
      if (!ALLOWED_KEYS.includes(key)) {
        return res.status(400).json({ error: `עדכון ההגדרה ${key} אינו מורשה.` });
      }

      const stringVal = String(val);
      
      // Validation
      if (key === "MAX_UPLOAD_SIZE_MB" || key === "LENDER_INVITE_EXPIRY_HOURS" || key === "PASSWORD_RESET_EXPIRY_MINUTES") {
        const num = parseInt(stringVal, 10);
        if (isNaN(num) || num <= 0) {
          return res.status(400).json({ error: `הערך עבור ${key} חייב להיות מספר חיובי גדול מאפס` });
        }
      }
      if (key === "MAINTENANCE_MODE") {
        if (stringVal !== "true" && stringVal !== "false") {
          return res.status(400).json({ error: "מצב תחזוקה חייב להיות true או false" });
        }
      }
      
      await setSetting(key, stringVal, "GENERAL", req.dbUser.id);
      changedFields.push(key);
    }
    
    clearSettingsCache();
    
    await writeAuditLog(
      req.dbUser.id,
      "SYSTEM_SETTING_UPDATED",
      "SYSTEM_SETTINGS",
      null,
      { changedFields }
    );
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("PATCH /api/admin/settings/general error:", error);
    res.status(500).json({ error: "שגיאה בעדכון הגדרות כלליות" });
  }
});

// 3. GET /api/admin/settings/email
app.get("/api/admin/settings/email", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN"]), async (req: any, res) => {
  try {
    const host = await getSetting("SMTP_HOST", "smtp.gmail.com");
    const port = await getSetting("SMTP_PORT", "587");
    const secureMode = await getSetting("SMTP_SECURE", "starttls");
    const username = await getSetting("SMTP_USER", "");
    const fromAddress = await getSetting("EMAIL_FROM", "");
    const fromName = await getSetting("EMAIL_FROM_NAME", "");
    const replyTo = await getSetting("EMAIL_REPLY_TO", "");
    const passwordConfigured = await isSecretConfigured("syncash-smtp-password");

    res.json({
      success: true,
      data: {
        host,
        port: parseInt(port, 10) || 587,
        secureMode,
        username,
        passwordConfigured,
        fromAddress,
        fromName,
        replyTo
      }
    });
  } catch (error: any) {
    console.error("GET /api/admin/settings/email error:", error);
    res.status(500).json({ error: "שגיאה בטעינת הגדרות דואר" });
  }
});

// 4. PATCH /api/admin/settings/email
app.patch("/api/admin/settings/email", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN"]), async (req: any, res) => {
  try {
    const { host, port, secureMode, username, fromAddress, fromName, replyTo } = req.body;
    
    if (!host || !port || !username || !fromAddress) {
      return res.status(400).json({ error: "נא למלא את כל שדות החובה עבור הגדרת הדואר" });
    }
    
    const numericPort = parseInt(port, 10);
    if (isNaN(numericPort) || numericPort < 1 || numericPort > 65535) {
      return res.status(400).json({ error: "פורט SMTP לא תקין (חייב להיות בין 1 ל-65535)" });
    }
    
    await setSetting("SMTP_HOST", host, "EMAIL", req.dbUser.id);
    await setSetting("SMTP_PORT", String(numericPort), "EMAIL", req.dbUser.id);
    await setSetting("SMTP_SECURE", secureMode, "EMAIL", req.dbUser.id);
    await setSetting("SMTP_USER", username, "EMAIL", req.dbUser.id);
    await setSetting("EMAIL_FROM", fromAddress, "EMAIL", req.dbUser.id);
    await setSetting("EMAIL_FROM_NAME", fromName || "", "EMAIL", req.dbUser.id);
    await setSetting("EMAIL_REPLY_TO", replyTo || "", "EMAIL", req.dbUser.id);
    
    clearSettingsCache();
    
    await writeAuditLog(
      req.dbUser.id,
      "SMTP_CONFIGURATION_UPDATED",
      "SYSTEM_SETTINGS",
      null,
      { changedFields: ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "EMAIL_FROM", "EMAIL_FROM_NAME", "EMAIL_REPLY_TO"] }
    );
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("PATCH /api/admin/settings/email error:", error);
    res.status(500).json({ error: "שגיאה בעדכון הגדרות דואר" });
  }
});

// 5. POST /api/admin/settings/email/smtp-password
app.post("/api/admin/settings/email/smtp-password", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN"]), async (req: any, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "הסיסמה החדשה ריקה" });
    }
    
    // Write new version to Secret Manager fallback securely
    await setSecret("syncash-smtp-password", password);
    
    // Also update the system_settings table to have isSecret = true and hold the reference
    await setSetting("SMTP_PASSWORD", "syncash-smtp-password", "EMAIL", req.dbUser.id, true, "סיסמת שרת הדואר");
    
    clearSettingsCache();
    
    await writeAuditLog(
      req.dbUser.id,
      "SMTP_PASSWORD_REPLACED",
      "SYSTEM_SETTINGS",
      null,
      { changedFields: ["SMTP_PASSWORD"] }
    );
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/admin/settings/email/smtp-password error:", error);
    res.status(500).json({ error: "שגיאה בשמירת סיסמת SMTP" });
  }
});

// 6. POST /api/admin/settings/email/test
app.post("/api/admin/settings/email/test", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN"]), async (req: any, res) => {
  try {
    const { recipientEmail } = req.body;
    const targetEmail = recipientEmail || req.dbUser.email;
    
    if (!targetEmail) {
      return res.status(400).json({ error: "מייל יעד לא תקין" });
    }
    
    // Resolve email settings dynamically from PostgreSQL and Secret Manager
    const smtpHost = await getSetting("SMTP_HOST", "smtp.gmail.com");
    const smtpPort = parseInt(await getSetting("SMTP_PORT", "587"), 10);
    const smtpSecureMode = await getSetting("SMTP_SECURE", "starttls");
    const smtpUser = await getSetting("SMTP_USER", "");
    const smtpPass = await getSecret("syncash-smtp-password");
    const senderEmail = await getSetting("EMAIL_FROM", "");
    const senderName = await getSetting("EMAIL_FROM_NAME", "מערכת SynCash");
    const replyTo = await getSetting("EMAIL_REPLY_TO", "");
    
    if (!smtpPass) {
      await writeAuditLog(req.dbUser.id, "TEST_EMAIL_FAILED", "SYSTEM_SETTINGS", null, { reason: "SMTP_PASSWORD_NOT_CONFIGURED" });
      return res.status(400).json({ error: "סיסמת שרת הדואר (SMTP Password) אינה מוגדרת. נא להגדיר סיסמה תחילה." });
    }
    
    // Build Nodemailer transport securely on the fly
    const secure = smtpSecureMode === "ssl_tls";
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: secure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
    
    const testId = `TEST-${Math.floor(100000 + Math.random() * 900000)}`;
    const subject = `בדיקת הגדרות דואר – SynCash`;
    const mailText = `שלום,\n\nהודעה זו נשלחה כדי לוודא שהגדרות הדואר של SynCash פועלות בהצלחה.\n\nתאריך ושעה: ${new Date().toLocaleString('he-IL')} (UTC)\nסביבת מערכת: ${process.env.NODE_ENV || "development"}\nמזהה בדיקה: ${testId}\n`;
    
    const mailOptions = {
      from: `"${senderName}" <${senderEmail || smtpUser}>`,
      to: targetEmail,
      replyTo: replyTo || senderEmail || smtpUser,
      subject,
      text: mailText
    };
    
    try {
      await transporter.sendMail(mailOptions);
      
      await writeAuditLog(
        req.dbUser.id,
        "SMTP_CONNECTION_TESTED",
        "SYSTEM_SETTINGS",
        null,
        { recipient: targetEmail, testId, result: "SUCCESS" }
      );
      
      res.json({
        success: true,
        message: `מייל בדיקה נשלח בהצלחה אל ${targetEmail} עם מזהה בדיקה ${testId}`
      });
    } catch (sendErr: any) {
      console.error("Nodemailer SMTP test transport failed:", sendErr);
      await writeAuditLog(
        req.dbUser.id,
        "TEST_EMAIL_FAILED",
        "SYSTEM_SETTINGS",
        null,
        { recipient: targetEmail, testId, reason: sendErr.message }
      );
      // Strip passwords or sensitive credentials
      const cleanMessage = sendErr.message.replace(smtpPass, "****").replace(smtpUser, "****");
      res.status(500).json({
        error: `שגיאת התחברות לשרת הדואר: ${cleanMessage}`
      });
    }
  } catch (error: any) {
    console.error("POST /api/admin/settings/email/test error:", error);
    res.status(500).json({ error: "שגיאה פנימית בבדיקת חיבור דואר" });
  }
});

// 7. GET /api/admin/settings/database/status
app.get("/api/admin/settings/database/status", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN"]), async (req: any, res) => {
  try {
    const startTime = Date.now();
    await db.execute("SELECT 1;");
    const responseTimeMs = Date.now() - startTime;
    
    // Query version info
    const versionResult = await db.execute("SELECT version();");
    const versionStr = String(versionResult.rows[0]?.version || "PostgreSQL");
    
    // Query current database
    const dbNameResult = await db.execute("SELECT current_database();");
    const dbName = String(dbNameResult.rows[0]?.current_database || "syncash");
    
    res.json({
      success: true,
      data: {
        status: "מחובר",
        engine: "PostgreSQL",
        service: "Google Cloud SQL",
        region: "europe-west2",
        version: versionStr,
        databaseName: dbName,
        responseTimeMs,
        lastTestedAt: new Date().toISOString(),
        migrationsStatus: "מעודכן"
      }
    });
  } catch (error: any) {
    console.error("GET /api/admin/settings/database/status error:", error);
    res.status(500).json({ error: "שגיאה בקבלת סטטוס מסד נתונים" });
  }
});

// 8. POST /api/admin/settings/database/test
app.post("/api/admin/settings/database/test", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN"]), async (req: any, res) => {
  try {
    const startTime = Date.now();
    await db.execute("SELECT 1;");
    const responseTimeMs = Date.now() - startTime;
    
    await writeAuditLog(
      req.dbUser.id,
      "DATABASE_CONNECTION_TESTED",
      "SYSTEM_SETTINGS",
      null,
      { responseTimeMs }
    );
    
    res.json({
      success: true,
      responseTimeMs
    });
  } catch (error: any) {
    console.error("POST /api/admin/settings/database/test error:", error);
    res.status(500).json({ error: `שגיאה בבדיקת חיבור מסד הנתונים: ${error.message}` });
  }
});

// 9. GET /api/admin/settings/database/schema-status
app.get("/api/admin/settings/database/schema-status", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN"]), async (req: any, res) => {
  try {
    const tablesChecked = ["users", "clients", "system_settings", "borrowers", "loan_offers", "audit_logs", "email_logs"];
    
    // Check if tables exist in information_schema
    const tablesResult = await db.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('users', 'clients', 'system_settings', 'borrowers', 'loan_offers', 'audit_logs', 'email_logs');
    `);
    
    const existingTables = tablesResult.rows.map((r: any) => String(r.table_name));
    const allExist = tablesChecked.every((t) => existingTables.includes(t));
    
    await writeAuditLog(
      req.dbUser.id,
      "DATABASE_SCHEMA_TESTED",
      "SYSTEM_SETTINGS",
      null,
      { allExist, tablesCount: existingTables.length }
    );
    
    res.json({
      success: true,
      data: {
        tablesExist: allExist,
        tablesChecked,
        status: allExist ? "תקין" : "חסרים רכיבים"
      }
    });
  } catch (error: any) {
    console.error("GET /api/admin/settings/database/schema-status error:", error);
    res.status(500).json({ error: "שגיאה בבדיקת מבנה מסד הנתונים" });
  }
});

// 10. GET /api/admin/settings/security/status
app.get("/api/admin/settings/security/status", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN"]), async (req: any, res) => {
  try {
    const keyConfigured = await isSecretConfigured("syncash-field-encryption-key");
    
    res.json({
      success: true,
      data: {
        encryptionKeyConfigured: keyConfigured,
        activeVersion: "v1",
        lastRotationAt: "טרם בוצעה",
        status: keyConfigured ? "תקין" : "דורש הגדרה"
      }
    });
  } catch (error: any) {
    console.error("GET /api/admin/settings/security/status error:", error);
    res.status(500).json({ error: "שגיאה בטעינת סטטוס אבטחה והצפנה" });
  }
});

// 11. POST /api/admin/settings/security/encryption-test
app.post("/api/admin/settings/security/encryption-test", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN"]), async (req: any, res) => {
  try {
    const originalText = "SynCash-Secure-Test-2026";
    const encrypted = encryptField(originalText);
    const decrypted = decryptField(encrypted);
    
    const match = decrypted === originalText;
    if (!match) {
      throw new Error("תוצאת הפענוח אינה תואמת לטקסט המקורי");
    }
    
    await writeAuditLog(
      req.dbUser.id,
      "ENCRYPTION_SERVICE_TESTED",
      "SYSTEM_SETTINGS",
      null,
      { match }
    );
    
    res.json({
      success: true,
      result: "תקין"
    });
  } catch (error: any) {
    console.error("POST /api/admin/settings/security/encryption-test error:", error);
    res.status(500).json({ error: `כשל בשירות הצפנה ופענוח: ${error.message}` });
  }
});

// 12. GET /api/admin/settings/audit
app.get("/api/admin/settings/audit", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireRole(["SUPER_ADMIN"]), async (req: any, res) => {
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    res.json({
      success: true,
      data: logs
    });
  } catch (error: any) {
    console.error("GET /api/admin/settings/audit error:", error);
    res.status(500).json({ error: "שגיאה בטעינת יומן שינויים" });
  }
});

// GET /api/lender/validate-invite (Public validation endpoint)
app.get("/api/lender/validate-invite", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "טוקן הזמנה חסר" });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [invite] = await db.select().from(lenderInviteTokens).where(eq(lenderInviteTokens.tokenHash, tokenHash)).limit(1);
    
    if (!invite) {
      return res.status(404).json({ error: "קישור הזמנה פג תוקף או שאינו קיים" });
    }

    if (new Date() > invite.expiresAt) {
      return res.status(410).json({ error: "קישור ההזמנה פג תוקף" });
    }

    res.json({ valid: true, submissionId: invite.submissionId });
  } catch (error) {
    console.error("GET /api/lender/validate-invite error:", error);
    res.status(500).json({ error: "שגיאה באחזור נתוני הבקשה" });
  }
});

// In-memory brute-force protection for failed invite token checks
const failedTokenAttempts = new Map<string, { count: number, resetAt: number }>();

// GET /api/lenders/invite/:token (Public secure endpoint to validate invite tokens and fetch anonymized client profiles)
app.get("/api/lenders/invite/:token", async (req, res) => {
  const { token } = req.params;
  if (!token) {
    return res.status(400).json({ error: "טוקן הזמנה חסר" });
  }

  const ip = req.ip || "unknown-ip";
  const now = Date.now();
  const attempt = failedTokenAttempts.get(ip);
  if (attempt && attempt.resetAt > now && attempt.count >= 5) {
    return res.status(429).json({ error: "נרשמו יותר מדי ניסיונות כושלים. אנא נסה שוב מאוחר יותר." });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [invite] = await db.select().from(lenderInviteTokens).where(eq(lenderInviteTokens.tokenHash, tokenHash)).limit(1);
    
    if (!invite) {
      const current = failedTokenAttempts.get(ip) || { count: 0, resetAt: now + 15 * 60 * 1000 };
      if (current.resetAt <= now) {
        current.count = 0;
        current.resetAt = now + 15 * 60 * 1000;
      }
      current.count++;
      failedTokenAttempts.set(ip, current);
      return res.status(404).json({ error: "קישור הזמנה פג תוקף או שאינו קיים" });
    }

    if (invite.revokedAt) {
      return res.status(403).json({ error: "קישור ההזמנה בוטל" });
    }

    if (invite.usedAt) {
      return res.status(403).json({ error: "קישור ההזמנה כבר נוצל" });
    }

    if (new Date() > invite.expiresAt) {
      return res.status(410).json({ error: "קישור ההזמנה פג תוקף" });
    }

    const [sub] = await db.select().from(lenderSubmissions).where(eq(lenderSubmissions.id, invite.submissionId)).limit(1);
    if (!sub) {
      return res.status(404).json({ error: "בקשת המימון המשויכת לא נמצאה" });
    }

    // Check if identity reveal has been approved
    const [revealReq] = await db.select().from(identityRevealRequests).where(
      and(eq(identityRevealRequests.submissionId, sub.id), eq(identityRevealRequests.status, "APPROVED"))
    ).limit(1);
    const isRevealed = !!revealReq;

    // Use LENDER role to force anonymized mapping if not revealed yet
    const client = await mapDbClientToFrontend(sub.clientId, isRevealed ? "ADVISOR" : "LENDER");
    if (!client) {
      return res.status(404).json({ error: "התיק המבוקש לא נמצא במערכת" });
    }

    const [lenderCompany] = await db.select().from(lenders).where(eq(lenders.id, sub.lenderId)).limit(1);
    const lenderName = lenderCompany?.name || "חברת מימון";

    // Strictly anonymized details
    const anonymizedName = client.name ? `${client.name.substring(0, 1)}***` : "לקוח אנונימי";
    const anonymizedId = "******";

    // Fetch documents
    const clientDocs = await db.select().from(dbDocs).where(eq(dbDocs.clientId, Number(client.id)));

    const caseProfile: any = {
      token,
      lenderName,
      anonymizedName,
      anonymizedId,
      dealType: client.dealType || "רכישת דירה",
      propertyValue: client.propertyValue || "0",
      requestedAmount: client.requestedAmount || "0",
      financingPercentage: client.financingPercentage || "0",
      propertyCity: client.propertyCity || "לא צוין",
      employmentType: client.employmentType || "שכיר",
      seniority: client.seniority || "0",
      income: client.income || "0",
      expenses: client.expenses || "0",
      documents: clientDocs.map((d: any) => ({
        id: String(d.id),
        name: d.documentType,
        status: d.status
      })),
      currentState: {
        status: sub.status,
        updatedAt: sub.updatedAt
      }
    };

    if (isRevealed) {
      // Return details ONLY when approved!
      caseProfile.submissionId = sub.id;
      caseProfile.clientId = Number(client.id);
      caseProfile.lenderId = sub.lenderId;
      caseProfile.name = client.name;
      caseProfile.idNumber = client.idNumber;
      caseProfile.phone = client.phone;
      caseProfile.email = client.email;
      caseProfile.address = client.address;
      caseProfile.notes = client.notes;
      caseProfile.workplace = client.workplace;
      caseProfile.propertyStreet = client.propertyStreet;
    }

    await writeAuditLog(
      sub.advisorId,
      "TOKEN_VALIDATED",
      "SUBMISSIONS",
      sub.id,
      `Invite token hash verified successfully for IP: ${ip}. Revealed: ${isRevealed}`
    );

    res.json(caseProfile);
  } catch (error) {
    console.error("GET /api/lenders/invite/:token details error:", error);
    res.status(500).json({ error: "שגיאה באחזור נתוני הבקשה" });
  }
});

// POST /api/lenders/invite/:token/identity-request (Public invite token holder requests identity reveal)
app.post("/api/lenders/invite/:token/identity-request", async (req, res) => {
  const { token } = req.params;
  const { reason } = req.body;

  if (!token) {
    return res.status(400).json({ error: "טוקן הזמנה חסר" });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [invite] = await db.select().from(lenderInviteTokens).where(eq(lenderInviteTokens.tokenHash, tokenHash)).limit(1);
    
    if (!invite || new Date() > invite.expiresAt || invite.revokedAt) {
      return res.status(403).json({ error: "קישור הזמנה פג תוקף, מבוטל או לא קיים" });
    }

    const [sub] = await db.select().from(lenderSubmissions).where(eq(lenderSubmissions.id, invite.submissionId)).limit(1);
    if (!sub) {
      return res.status(404).json({ error: "הגשה משויכת לא נמצאה" });
    }

    // Check if there is already an active request
    const [existing] = await db.select().from(identityRevealRequests).where(
      and(eq(identityRevealRequests.submissionId, sub.id), eq(identityRevealRequests.status, "PENDING"))
    ).limit(1);

    if (existing) {
      return res.json({ success: true, message: "כבר קיימת בקשת חשיפת זהות ממתינה עבור פנייה זו" });
    }

    // Insert new request
    await db.insert(identityRevealRequests).values({
      submissionId: sub.id,
      requestedByUserId: sub.advisorId, // Associated with the advisor for review, but requested by lender invite token
      reason: reason || "מבקש גישה לצורך אימות זהות ומסמכי מקור",
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Update submission status to IDENTITY_REQUESTED
    await db.update(lenderSubmissions).set({
      status: "IDENTITY_REQUESTED",
      updatedAt: new Date()
    }).where(eq(lenderSubmissions.id, sub.id));

    await writeAuditLog(
      sub.advisorId,
      "IDENTITY_REVEAL_REQUESTED",
      "SUBMISSIONS",
      sub.id,
      `Lender requested identity reveal via public invite token for submission ID: ${sub.id}`
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error creating public token identity request:", err);
    res.status(500).json({ error: "שגיאה פנימית ביצירת בקשת חשיפת זהות" });
  }
});

// POST /api/lenders/invite/:token/reply (Secure endpoint to manually post decision / feedback)
app.post("/api/lenders/invite/:token/reply", async (req, res) => {
  const { token } = req.params;
  const { decision, message } = req.body;

  if (!token || !decision) {
    return res.status(400).json({ error: "נתונים חסרים לביצוע פעולה" });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [invite] = await db.select().from(lenderInviteTokens).where(eq(lenderInviteTokens.tokenHash, tokenHash)).limit(1);
    
    if (!invite || new Date() > invite.expiresAt) {
      return res.status(403).json({ error: "קישור הזמנה פג תוקף או לא קיים" });
    }

    const [sub] = await db.select().from(lenderSubmissions).where(eq(lenderSubmissions.id, invite.submissionId)).limit(1);
    if (!sub) {
      return res.status(404).json({ error: "הגשה לא נמצאה" });
    }

    const mappedStatus = decision === "interested" ? "IN_REVIEW" : decision === "declined" ? "DECLINED" : "IN_REVIEW";
    
    await db.update(lenderSubmissions).set({
      status: mappedStatus,
      updatedAt: new Date()
    }).where(eq(lenderSubmissions.id, sub.id));

    // Get a valid lender underwriter user or fallback
    let responderUserId = 1;
    const [lenderUserRecord] = await db.select().from(users).where(eq(users.role, "LENDER_UNDERWRITER")).limit(1);
    if (lenderUserRecord) {
      responderUserId = lenderUserRecord.id;
    } else {
      const [anyUser] = await db.select().from(users).limit(1);
      if (anyUser) {
        responderUserId = anyUser.id;
      }
    }

    // Log the response
    await db.insert(lenderResponses).values({
      submissionId: sub.id,
      lenderUserId: responderUserId,
      responseType: decision === "interested" ? "INTERESTED" : "NOT_INTERESTED",
      message: message || (decision === "interested" ? "מעוניינים בתיק" : "לא מתאים למדיניות האשראי"),
      createdAt: new Date()
    });

    res.json({ success: true });
  } catch (err) {
    console.error("POST /api/lenders/invite/:token/reply error:", err);
    res.status(500).json({ error: "שגיאה פנימית בשמירת תגובת המממן" });
  }
});

// POST /api/lenders/invite/:token/offer (Secure endpoint for manual official offer insertion)
app.post("/api/lenders/invite/:token/offer", async (req, res) => {
  const { token } = req.params;
  const { amount, rate, years, notes } = req.body;

  if (!token || !amount || !rate || !years) {
    return res.status(400).json({ error: "נתוני הצעה חסרים (סכום, ריבית ושנים הם שדות חובה)" });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [invite] = await db.select().from(lenderInviteTokens).where(eq(lenderInviteTokens.tokenHash, tokenHash)).limit(1);
    
    if (!invite || new Date() > invite.expiresAt) {
      return res.status(403).json({ error: "קישור הזמנה פג תוקף או לא קיים" });
    }

    const [sub] = await db.select().from(lenderSubmissions).where(eq(lenderSubmissions.id, invite.submissionId)).limit(1);
    if (!sub) {
      return res.status(404).json({ error: "הגשה לא נמצאה" });
    }

    // Get a valid lender underwriter user or fallback
    let responderUserId = 1;
    const [lenderUserRecord] = await db.select().from(users).where(eq(users.role, "LENDER_UNDERWRITER")).limit(1);
    if (lenderUserRecord) {
      responderUserId = lenderUserRecord.id;
    } else {
      const [anyUser] = await db.select().from(users).limit(1);
      if (anyUser) {
        responderUserId = anyUser.id;
      }
    }

    // Insert loan offer
    const [newOffer] = await db.insert(loanOffers).values({
      submissionId: sub.id,
      lenderId: sub.lenderId,
      amount: String(amount),
      interestRate: String(rate),
      interestType: "FIXED",
      termMonths: parseInt(years, 10) * 12,
      status: "SUBMITTED",
      conditions: notes || "",
      createdByUserId: responderUserId,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    // Update submission status to OFFER_RECEIVED
    await db.update(lenderSubmissions).set({
      status: "OFFER_RECEIVED",
      updatedAt: new Date()
    }).where(eq(lenderSubmissions.id, sub.id));

    res.json({ success: true, offerId: newOffer.id });
  } catch (err) {
    console.error("POST /api/lenders/invite/:token/offer error:", err);
    res.status(500).json({ error: "שגיאה פנימית בהגשת ההצעה" });
  }
});

// POST /api/clients/:id/ask-advisor (Secured Gemini Advisor assistant to help advisor refine client's profile/notes)
app.post("/api/clients/:id/ask-advisor", requireFirebaseAuth, loadDatabaseUser, requireActiveUser, requireAdvisorClientAccess, async (req: any, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: "אנא הזן שאלה." });
  }

  try {
    const [client] = await db.select().from(dbClients).where(eq(dbClients.id, parseInt(req.params.id, 10))).limit(1);
    if (!client) {
      return res.status(404).json({ error: "הלקוח לא נמצא" });
    }

    const advisor = req.dbUser;
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
  } catch (err) {
    console.error("ask-advisor error:", err);
    res.status(500).json({ error: "שגיאה פנימית ביועץ הבינה המלאכותית" });
  }
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
