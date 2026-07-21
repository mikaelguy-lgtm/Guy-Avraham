import { encryptField, decryptField } from "./src/utils/crypto";
import { getSecret, setSecret, setSecretProvider, InMemorySecretProvider, getSecretProvider } from "./src/utils/secretManager";
import { requireActiveUser, requireRole, AuthenticatedRequest } from "./src/middleware/auth";
import { Response } from "express";

// Mock Response Builder
function mockResponse() {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.jsonData = data;
    return res;
  };
  res.send = (text: any) => {
    res.sendData = text;
    return res;
  };
  return res as Response;
}

async function runTests() {
  console.log("=====================================================================");
  console.log("               SYNCASH SECURITY & COMPLIANCE TEST SUITE               ");
  console.log("=====================================================================");
  
  // Inject the InMemorySecretProvider to completely isolate the test suite from real secrets
  setSecretProvider(new InMemorySecretProvider());

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.log(`[FAIL] ${message}`);
      failed++;
    }
  }

  // --- TEST 1: FIELD ENCRYPTION / DECRYPTION LOOP ---
  console.log("\n--- TEST 1: AES-256-GCM Field Encryption & Decryption ---");
  try {
    // Generate valid 256-bit (32 bytes) hex key for encryption tests
    process.env.FIELD_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const secretMessage = "Sensitive Identity Info 12345";
    
    const cipherText = encryptField(secretMessage);
    assert(cipherText.startsWith("v1:"), "Ciphertext should use v1 envelope version prefix");
    assert(!cipherText.includes(secretMessage), "Ciphertext should never leak raw plain-text content");
    
    const plainText = decryptField(cipherText);
    assert(plainText === secretMessage, "Decrypted message should exactly match original plaintext value");
  } catch (err: any) {
    console.error("Test 1 failed with error:", err);
    failed++;
  }

  // --- TEST 2: SECRET MANAGER SECURITY AND VAULT ---
  console.log("\n--- TEST 2: Secret Manager Vault Storage & Isolation ---");
  try {
    const testSecretValue = "SuperSecureSMTPPassword101!!";
    await setSecret("syncash-smtp-password", testSecretValue);
    
    const retrievedSecret = await getSecret("syncash-smtp-password");
    assert(retrievedSecret === testSecretValue, "Retrieved secret from Secret Manager must match saved value");
    assert(getSecretProvider() instanceof InMemorySecretProvider, "Secret provider must be the isolated InMemorySecretProvider");
  } catch (err: any) {
    console.error("Test 2 failed with error:", err);
    failed++;
  }

  // --- TEST 3: BACKEND MIDDLEWARE SECURITY FOR USERS ---
  console.log("\n--- TEST 3: requireActiveUser User Status Control ---");
  try {
    // Case 3a: ACTIVE User
    const reqActive = { dbUser: { id: 1, email: "test@syncash.com", status: "ACTIVE", role: "ADVISOR" } } as AuthenticatedRequest;
    const resActive = mockResponse();
    let activeNextCalled = false;
    requireActiveUser(reqActive, resActive, () => { activeNextCalled = true; });
    assert(activeNextCalled && !resActive.statusCode, "ACTIVE status advisor must pass active middleware checks smoothly");

    // Case 3b: SUSPENDED User
    const reqSuspended = { dbUser: { id: 2, email: "test@syncash.com", status: "SUSPENDED", role: "ADVISOR" } } as AuthenticatedRequest;
    const resSuspended = mockResponse();
    let suspendedNextCalled = false;
    requireActiveUser(reqSuspended, resSuspended, () => { suspendedNextCalled = true; });
    assert(!suspendedNextCalled && resSuspended.statusCode === 403, "SUSPENDED user must be blocked with 403 Forbidden status");
    assert((resSuspended as any).jsonData?.error?.includes("מושעה"), "Suspended block response should output descriptive Hebrew message");

    // Case 3c: DELETED User
    const reqDeleted = { dbUser: { id: 3, email: "test@syncash.com", status: "DELETED", role: "ADVISOR" } } as AuthenticatedRequest;
    const resDeleted = mockResponse();
    let deletedNextCalled = false;
    requireActiveUser(reqDeleted, resDeleted, () => { deletedNextCalled = true; });
    assert(!deletedNextCalled && resDeleted.statusCode === 403, "DELETED user must be blocked with 403 Forbidden status");

    // Case 3d: PENDING User
    const reqPending = { dbUser: { id: 4, email: "test@syncash.com", status: "PENDING", role: "ADVISOR" } } as AuthenticatedRequest;
    const resPending = mockResponse();
    let pendingNextCalled = false;
    requireActiveUser(reqPending, resPending, () => { pendingNextCalled = true; });
    assert(!pendingNextCalled && resPending.statusCode === 403, "PENDING user must be blocked with 403 Forbidden status");
  } catch (err: any) {
    console.error("Test 3 failed with error:", err);
    failed++;
  }

  // --- TEST 4: ROLE AUTHORIZATION AND ACCESS ---
  console.log("\n--- TEST 4: requireRole Access Control & RBAC Verification ---");
  try {
    const adminMiddleware = requireRole(["SUPER_ADMIN", "ADMIN"]);
    
    // Case 4a: SUPER_ADMIN accessing Admin Setting
    const reqSuper = { dbUser: { id: 1, role: "SUPER_ADMIN" } } as AuthenticatedRequest;
    const resSuper = mockResponse();
    let superNextCalled = false;
    adminMiddleware(reqSuper, resSuper, () => { superNextCalled = true; });
    assert(superNextCalled && !resSuper.statusCode, "SUPER_ADMIN role must be allowed to access system configurations");

    // Case 4b: Normal ADVISOR attempting access
    const reqAdvisor = { dbUser: { id: 2, role: "ADVISOR" } } as AuthenticatedRequest;
    const resAdvisor = mockResponse();
    let advisorNextCalled = false;
    adminMiddleware(reqAdvisor, resAdvisor, () => { advisorNextCalled = true; });
    assert(!advisorNextCalled && resAdvisor.statusCode === 403, "ADVISOR role must be restricted from accessing administrator panels");
    assert((resAdvisor as any).jsonData?.error?.includes("הרשאה"), "Restriction response should output descriptive Hebrew message");
  } catch (err: any) {
    console.error("Test 4 failed with error:", err);
    failed++;
  }

  console.log("\n=====================================================================");
  console.log(`TEST SUMMARY: Passed ${passed} / Failed ${failed}`);
  console.log("=====================================================================");
  
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Unhandled test suite exception:", err);
  process.exit(1);
});
