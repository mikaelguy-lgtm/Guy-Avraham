import {readFileSync} from "node:fs";
import {renderToStaticMarkup} from "react-dom/server";
import {describe, expect, it} from "vitest";
import {StartupErrorBoundary, StartupErrorScreen} from "../../src/components/StartupErrorBoundary";
import {validateFrontendEnvironment} from "../../src/config/frontend";

const validEnvironment = {
  VITE_API_BASE_URL: "https://api.staging.example",
  VITE_FIREBASE_API_KEY: "AIza-staging-public-web-key",
  VITE_FIREBASE_AUTH_DOMAIN: "staging.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "syncash-staging",
  VITE_FIREBASE_STORAGE_BUCKET: "syncash-staging.firebasestorage.app",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "123456789012",
  VITE_FIREBASE_APP_ID: "1:123456789012:web:abcdef",
  VITE_USE_FIREBASE_EMULATOR: "false"
};

describe("frontend startup configuration", () => {
  it("accepts a production build with complete public configuration", () => {
    const result = validateFrontendEnvironment(validEnvironment, "production");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.apiBaseUrl).toBe("https://api.staging.example");
      expect(result.config.useFirebaseEmulator).toBe(false);
    }
  });

  it("rejects a missing API base URL", () => {
    const result = validateFrontendEnvironment({...validEnvironment, VITE_API_BASE_URL: ""}, "production");
    expect(result).toEqual(expect.objectContaining({ok: false, issue: expect.objectContaining({code: "SC-CONFIG-001"})}));
  });

  it("rejects missing Firebase public configuration", () => {
    const result = validateFrontendEnvironment({...validEnvironment, VITE_FIREBASE_PROJECT_ID: ""}, "production");
    expect(result).toEqual(expect.objectContaining({ok: false, issue: expect.objectContaining({code: "SC-CONFIG-001"})}));
  });

  it("rejects emulator mode and local API URLs in preview", () => {
    const emulatorResult = validateFrontendEnvironment({...validEnvironment, VITE_USE_FIREBASE_EMULATOR: "true", VITE_FIREBASE_AUTH_EMULATOR_URL: "http://127.0.0.1:9099"}, "preview");
    const localApiResult = validateFrontendEnvironment({...validEnvironment, VITE_API_BASE_URL: "http://127.0.0.1:3000"}, "preview");
    expect(emulatorResult).toEqual(expect.objectContaining({ok: false, issue: expect.objectContaining({code: "SC-CONFIG-004"})}));
    expect(localApiResult).toEqual(expect.objectContaining({ok: false, issue: expect.objectContaining({code: "SC-CONFIG-003"})}));
  });

  it("renders a sanitized Hebrew startup failure", () => {
    const markup = renderToStaticMarkup(<StartupErrorScreen code="SC-CONFIG-001" requestId="sc-test-request" />);
    const boundaryState = StartupErrorBoundary.getDerivedStateFromError();
    expect(markup).toContain("המערכת אינה מוגדרת לסביבת הבדיקה. חסרה כתובת שרת או הגדרת אימות.");
    expect(markup).toContain("SC-CONFIG-001");
    expect(markup).toContain("sc-test-request");
    expect(markup).not.toContain("stack");
    expect(boundaryState.failed).toBe(true);
  });

  it("defines frontend-only Netlify build and ordered SPA redirects", () => {
    const configuration = readFileSync("netlify.toml", "utf8");
    expect(configuration).toContain('command = "npm run build:web"');
    expect(configuration).toContain('publish = "dist"');
    expect(configuration.indexOf('from = "/api/*"')).toBeLessThan(configuration.indexOf('from = "/*"'));
    expect(configuration).toContain('to = "/index.html"');
    expect(configuration).toContain("status = 200");
  });
});
