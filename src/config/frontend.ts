export type FrontendConfig = {
  apiBaseUrl: string;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  useFirebaseEmulator: boolean;
  firebaseAuthEmulatorUrl: string | null;
};

export type FrontendConfigurationIssue = {
  code: "SC-CONFIG-001" | "SC-CONFIG-002" | "SC-CONFIG-003" | "SC-CONFIG-004";
  requestId: string;
};

export type FrontendConfigurationResult =
  | {ok: true; config: FrontendConfig}
  | {ok: false; issue: FrontendConfigurationIssue};

type PublicEnvironment = Record<string, string | boolean | undefined>;

const requiredKeys = [
  "VITE_API_BASE_URL",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
] as const;

export function createStartupRequestId(): string {
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replaceAll("-", "").slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `sc-${randomPart}`;
}

function failure(code: FrontendConfigurationIssue["code"]): FrontendConfigurationResult {
  return {ok: false, issue: {code, requestId: createStartupRequestId()}};
}

function isLocalAddress(url: URL): boolean {
  return ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(url.hostname);
}

export function validateFrontendEnvironment(source: PublicEnvironment, mode: string): FrontendConfigurationResult {
  if (requiredKeys.some((key) => typeof source[key] !== "string" || !String(source[key]).trim())) {
    return failure("SC-CONFIG-001");
  }

  let apiUrl: URL;
  try {
    apiUrl = new URL(String(source.VITE_API_BASE_URL));
  } catch {
    return failure("SC-CONFIG-002");
  }
  if (!new Set(["http:", "https:"]).has(apiUrl.protocol)) return failure("SC-CONFIG-002");

  const previewLike = mode === "production" || mode === "preview";
  if (previewLike && isLocalAddress(apiUrl)) return failure("SC-CONFIG-003");
  if (previewLike && !String(source.VITE_FIREBASE_API_KEY).startsWith("AIza")) return failure("SC-CONFIG-001");

  const useFirebaseEmulator = source.VITE_USE_FIREBASE_EMULATOR === "true";
  if (previewLike && useFirebaseEmulator) return failure("SC-CONFIG-004");

  let firebaseAuthEmulatorUrl: string | null = null;
  if (useFirebaseEmulator) {
    try {
      const emulatorUrl = new URL(String(source.VITE_FIREBASE_AUTH_EMULATOR_URL ?? ""));
      if (!isLocalAddress(emulatorUrl)) return failure("SC-CONFIG-004");
      firebaseAuthEmulatorUrl = emulatorUrl.origin;
    } catch {
      return failure("SC-CONFIG-004");
    }
  }

  return {
    ok: true,
    config: {
      apiBaseUrl: apiUrl.origin + apiUrl.pathname.replace(/\/$/, ""),
      firebase: {
        apiKey: String(source.VITE_FIREBASE_API_KEY),
        authDomain: String(source.VITE_FIREBASE_AUTH_DOMAIN),
        projectId: String(source.VITE_FIREBASE_PROJECT_ID),
        storageBucket: String(source.VITE_FIREBASE_STORAGE_BUCKET),
        messagingSenderId: String(source.VITE_FIREBASE_MESSAGING_SENDER_ID),
        appId: String(source.VITE_FIREBASE_APP_ID)
      },
      useFirebaseEmulator,
      firebaseAuthEmulatorUrl
    }
  };
}

export const frontendEnvironment = validateFrontendEnvironment(import.meta.env, import.meta.env.MODE);

export function requireFrontendConfig(): FrontendConfig {
  if (!frontendEnvironment.ok) throw new Error(frontendEnvironment.issue.code);
  return frontendEnvironment.config;
}
