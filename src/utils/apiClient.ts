import { Client, AdvisorProfile } from "../types";
import { auth } from "../lib/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";

let isFirebaseInitialized = false;
let resolveInit: (() => void) | null = null;
const initPromise = new Promise<void>((resolve) => {
  resolveInit = resolve;
});

// Initial listener to mark initialization
const authUnsubscribe = auth.onAuthStateChanged(() => {
  isFirebaseInitialized = true;
  if (resolveInit) {
    resolveInit();
  }
  authUnsubscribe(); // Unsubscribe immediately after the first event
});

// Helper to get Firebase ID token, waiting for auth initialization if necessary with a 5-second timeout
async function getFirebaseToken(forceRefresh = false): Promise<string | null> {
  if (!isFirebaseInitialized) {
    try {
      await Promise.race([
        initPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("AUTH_INIT_TIMEOUT")), 5000))
      ]);
    } catch (e) {
      console.warn("Auth initialization timed out or failed:", e);
    }
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  try {
    const token = await currentUser.getIdToken(forceRefresh);
    return token;
  } catch (e) {
    console.error("Error retrieving Firebase ID token from currentUser:", e);
    return null;
  }
}

// Custom session expiration trigger
function triggerSessionExpired() {
  window.dispatchEvent(new CustomEvent("syncash-session-expired"));
}

// Secure fetch wrapper that automatically appends Firebase JWT token
async function authFetch(url: string, options: any = {}, retryCount = 0): Promise<any> {
  const token = await getFirebaseToken(false);
  if (!token) {
    // Return explicit local error if token is not available
    throw new Error("AUTH_REQUIRED");
  }

  let headers: any = {
    ...(options.headers || {}),
    "Authorization": `Bearer ${token}`
  };
  
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  
  const finalOptions = {
    ...options,
    headers
  };

  const res = await fetch(url, finalOptions);

  if (res.status === 401) {
    if (retryCount === 0) {
      console.warn("Unauthorized (401) received. Attempting to refresh token and retrying request...");
      try {
        const refreshedToken = await getFirebaseToken(true);
        if (refreshedToken) {
          let retryHeaders: any = {
            ...(options.headers || {}),
            "Authorization": `Bearer ${refreshedToken}`
          };
          if (!(options.body instanceof FormData)) {
            retryHeaders["Content-Type"] = "application/json";
          }
          const retryOptions = {
            ...options,
            headers: retryHeaders
          };
          const retryRes = await fetch(url, retryOptions);
          if (retryRes.ok) {
            return retryRes.json();
          }
          if (retryRes.status === 401) {
            triggerSessionExpired();
            throw new Error("AUTH_REQUIRED");
          }
          const err = await retryRes.json().catch(() => ({}));
          throw new Error(err.error || `שגיאה בשרת (${retryRes.status})`);
        }
      } catch (err: any) {
        console.error("Token refresh retry failed:", err);
      }
    }
    
    triggerSessionExpired();
    throw new Error("AUTH_REQUIRED");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `שגיאה בשרת (${res.status})`);
  }
  return res.json();
}

// Unified API Client
export const api = {
  // AUTH & SESSIONS
  async registerAdvisor(data: any) {
    // 1. Create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const firebaseUser = userCredential.user;
    
    // 2. Synchronize user profile with Postgres backend
    const syncData = {
      firstName: data.name.split(" ")[0] || data.name,
      lastName: data.name.split(" ").slice(1).join(" ") || "",
      phone: data.phone || "",
      businessName: data.company || "",
      licenseNumber: data.licenseNumber || ""
    };
    
    const dbUser = await authFetch("/api/auth/sync", {
      method: "POST",
      body: JSON.stringify(syncData)
    });
    
    return {
      id: String(dbUser.id),
      name: `${dbUser.firstName} ${dbUser.lastName}`,
      role: dbUser.role === 'SUPER_ADMIN' ? 'סופר אדמין' : 'יועץ משכנתאות',
      email: dbUser.email,
      phone: dbUser.phone,
      company: data.company || "",
      licenseNumber: data.licenseNumber || "",
      isAdmin: dbUser.role === 'SUPER_ADMIN' || dbUser.role === 'ADMIN',
      status: dbUser.status
    };
  },

  async loginAdvisor(data: any) {
    // 1. Sign in with Firebase Auth
    await signInWithEmailAndPassword(auth, data.email, data.password);
    
    // 2. Load the authenticated user profile from our server
    const dbUser = await authFetch("/api/auth/me");
    
    return {
      id: String(dbUser.id),
      name: `${dbUser.firstName} ${dbUser.lastName}`,
      role: dbUser.role === 'SUPER_ADMIN' ? 'סופר אדמין' : (dbUser.role === 'LENDER_UNDERWRITER' ? 'חתם' : 'יועץ משכנתאות'),
      email: dbUser.email,
      phone: dbUser.phone,
      company: "",
      licenseNumber: "",
      isAdmin: dbUser.role === 'SUPER_ADMIN' || dbUser.role === 'ADMIN',
      status: dbUser.status
    };
  },

  async getMe() {
    return authFetch("/api/auth/me");
  },

  async logout() {
    await signOut(auth);
  },

  // ADVISORS
  async getAdvisors() {
    return authFetch("/api/advisors");
  },

  async deleteAdvisor(id: string) {
    return authFetch(`/api/advisors/${id}`, { method: "DELETE" });
  },

  async updateAdvisor(id: string, data: any) {
    return authFetch(`/api/advisors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },

  // CLIENTS
  async getClients() {
    return authFetch("/api/clients");
  },

  async getClient(id: string) {
    return authFetch(`/api/clients/${id}`);
  },

  async createClient(data: any) {
    return authFetch("/api/clients", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  async updateClient(id: string, data: Partial<Client>) {
    return authFetch(`/api/clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },

  async deleteClient(id: string) {
    return authFetch(`/api/clients/${id}`, { method: "DELETE" });
  },

  // DOCUMENTS
  async uploadDoc(clientId: string, docId: string, name: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("docId", docId);
    formData.append("name", name);

    return authFetch(`/api/clients/${clientId}/upload-doc`, {
      method: "POST",
      body: formData
    });
  },

  async deleteDoc(clientId: string, docId: string, permanent = false) {
    return authFetch(`/api/clients/${clientId}/delete-doc`, {
      method: "POST",
      body: JSON.stringify({ docId, permanent })
    });
  },

  async downloadDocBlob(clientId: string, docId: string): Promise<Blob> {
    const token = await getFirebaseToken(false);
    if (!token) {
      throw new Error("AUTH_REQUIRED");
    }
    const res = await fetch(`/api/documents/download?clientId=${clientId}&docId=${docId}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    if (!res.ok) {
      throw new Error("Failed to download document");
    }
    return res.blob();
  },

  async getFirebaseToken() {
    return getFirebaseToken();
  },

  // SEND TO LENDERS (SUBMISSION ROUND)
  async sendToLenders(clientId: string, selectedLenders: string[], advisorId?: string) {
    return authFetch(`/api/clients/${clientId}/send-to-lenders`, {
      method: "POST",
      body: JSON.stringify({ selectedLenders, origin: window.location.origin, advisorId })
    });
  },

  // ASK ADVISOR (GEMINI AI CHAT)
  async askAdvisor(clientId: string, question: string) {
    return authFetch(`/api/clients/${clientId}/ask-advisor`, {
      method: "POST",
      body: JSON.stringify({ question })
    });
  },

  // EMAIL & SENDER CONFIGURATION SETTINGS
  async getAdminSettings() {
    return authFetch("/api/admin/settings");
  },

  async saveAdminSettings(settings: { systemSenderEmail?: string; lenderEmails?: Record<string, string> }) {
    return authFetch("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify(settings)
    });
  },

  // REVEAL LENDER IDENTITY (Transition from interested to offer)
  async revealLenderIdentity(clientId: string, lenderId: string) {
    return authFetch(`/api/clients/${clientId}/reveal-lender/${lenderId}`, {
      method: "POST"
    });
  },

  // SIMULATE LENDER REPLY (INBOUND EMAIL SIMULATOR Webhook)
  async simulateLenderReply(clientRefId: string, decision: "interested" | "not_interested", replyText?: string) {
    return authFetch("/api/lenders/simulated-reply", {
      method: "POST",
      body: JSON.stringify({ clientRefId, decision, replyText })
    });
  },

  // Lenders Admin CRUD
  async getAdminLenders() {
    return authFetch("/api/admin/lenders");
  },

  async addAdminLender(data: any) {
    return authFetch("/api/admin/lenders", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  async updateAdminLender(id: string, data: any) {
    return authFetch(`/api/admin/lenders/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },

  async deleteAdminLender(id: string) {
    return authFetch(`/api/admin/lenders/${id}`, { method: "DELETE" });
  },

  // --- NEW SECURE SYSTEM SETTINGS API WRAPPERS ---
  async getSecureGeneralSettings() {
    return authFetch("/api/admin/settings/general");
  },

  async updateSecureGeneralSettings(settings: Record<string, string>) {
    return authFetch("/api/admin/settings/general", {
      method: "PATCH",
      body: JSON.stringify({ settings })
    });
  },

  async getSecureEmailSettings() {
    return authFetch("/api/admin/settings/email");
  },

  async updateSecureEmailSettings(data: any) {
    return authFetch("/api/admin/settings/email", {
      method: "PATCH",
      body: JSON.stringify(data)
    });
  },

  async updateSmtpPassword(password: string) {
    return authFetch("/api/admin/settings/email/smtp-password", {
      method: "POST",
      body: JSON.stringify({ password })
    });
  },

  async testSmtpConnection(recipientEmail?: string) {
    return authFetch("/api/admin/settings/email/test", {
      method: "POST",
      body: JSON.stringify({ recipientEmail })
    });
  },

  async getDatabaseStatus() {
    return authFetch("/api/admin/settings/database/status");
  },

  async testDatabaseConnection() {
    return authFetch("/api/admin/settings/database/test", {
      method: "POST"
    });
  },

  async getDatabaseSchemaStatus() {
    return authFetch("/api/admin/settings/database/schema-status");
  },

  async getSecurityStatus() {
    return authFetch("/api/admin/settings/security/status");
  },

  async testFieldEncryption() {
    return authFetch("/api/admin/settings/security/encryption-test", {
      method: "POST"
    });
  },

  async getAuditLogs() {
    return authFetch("/api/admin/settings/audit");
  }
};
