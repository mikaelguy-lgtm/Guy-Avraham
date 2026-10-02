import "dotenv/config";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { closeDatabase, db } from "./index.js";
import { advisorProfiles, lenderUsers, lenders, users } from "./schema.js";

const developmentUsers = [
  {
    uid: "dev-super-admin",
    email: process.env.E2E_SUPER_ADMIN_EMAIL ?? "superadmin@syncash.local",
    password: process.env.E2E_SUPER_ADMIN_PASSWORD,
    firstName: "מנהל",
    lastName: "פיתוח",
    role: "SUPER_ADMIN" as const,
    roleLabel: "סופר אדמין"
  },
  {
    uid: "dev-advisor",
    email: process.env.E2E_ADVISOR_EMAIL ?? "advisor@syncash.local",
    password: process.env.E2E_ADVISOR_PASSWORD,
    firstName: "יועץ",
    lastName: "פיתוח",
    role: "ADVISOR" as const,
    roleLabel: "יועץ משכנתאות"
  },
  {
    uid: "dev-lender",
    email: process.env.E2E_LENDER_EMAIL ?? "underwriter@syncash.local",
    password: process.env.E2E_LENDER_PASSWORD,
    firstName: "חתם",
    lastName: "פיתוח",
    role: "LENDER_UNDERWRITER" as const,
    roleLabel: "חתם"
  },
  {
    uid: "dev-other-lender",
    email: process.env.E2E_OTHER_LENDER_EMAIL ?? "other-underwriter@syncash.local",
    password: process.env.E2E_OTHER_LENDER_PASSWORD,
    firstName: "חתם",
    lastName: "נוסף",
    role: "LENDER_UNDERWRITER" as const,
    roleLabel: "חתם"
  }
];

if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  if (getApps().length === 0) initializeApp({projectId: process.env.FIREBASE_PROJECT_ID ?? "syncash-local"});
  const auth = getAuth();
  for (const user of developmentUsers) {
    if (!user.password) throw new Error(`Missing local password for ${user.email}`);
    try {
      await auth.updateUser(user.uid, {email: user.email, password: user.password, emailVerified: true});
    } catch (error: unknown) {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
      if (code !== "auth/user-not-found") throw error;
      await auth.createUser({uid: user.uid, email: user.email, password: user.password, emailVerified: true});
    }
  }
}

const insertedUsers = new Map<string, number>();
for (const user of developmentUsers) {
  const [row] = await db.insert(users).values({
    firebaseUid: user.uid,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    roleLabel: user.roleLabel,
    status: "ACTIVE",
    emailVerified: true
  }).onConflictDoUpdate({
    target: users.firebaseUid,
    set: {email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, roleLabel: user.roleLabel, status: "ACTIVE", emailVerified: true, deletedAt: null, updatedAt: new Date()}
  }).returning({id: users.id});
  insertedUsers.set(user.uid, row.id);
}

const advisorUserId = insertedUsers.get("dev-advisor")!;
await db.insert(advisorProfiles).values({userId: advisorUserId, businessName: "SynCash פיתוח", businessEmail: developmentUsers.find((user) => user.uid === "dev-advisor")!.email})
  .onConflictDoUpdate({target: advisorProfiles.userId, set: {businessName: "SynCash פיתוח", businessEmail: developmentUsers.find((user) => user.uid === "dev-advisor")!.email, updatedAt: new Date()}});

const [primaryLender] = await db.insert(lenders).values({
  name: "קרן SynCash מקומית",
  slug: "syncash-local-funding",
  contactEmail: "lender@syncash.local"
}).onConflictDoUpdate({target: lenders.slug, set: {name: "קרן SynCash מקומית", contactEmail: "lender@syncash.local", active: true, updatedAt: new Date()}})
  .returning({id: lenders.id});

const [otherLender] = await db.insert(lenders).values({
  name: "קרן SynCash נוספת",
  slug: "syncash-other-funding",
  contactEmail: "other-lender@syncash.local"
}).onConflictDoUpdate({target: lenders.slug, set: {name: "קרן SynCash נוספת", contactEmail: "other-lender@syncash.local", active: true, updatedAt: new Date()}})
  .returning({id: lenders.id});

await db.insert(lenderUsers).values([
  {lenderId: primaryLender.id, userId: insertedUsers.get("dev-lender")!},
  {lenderId: otherLender.id, userId: insertedUsers.get("dev-other-lender")!}
]).onConflictDoNothing();

console.log({users: developmentUsers.map((user) => user.email), lenders: [primaryLender.id, otherLender.id]});
await closeDatabase();
