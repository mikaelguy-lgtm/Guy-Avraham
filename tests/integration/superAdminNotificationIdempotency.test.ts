// Real-Postgres proof (spec tests E & F) that the SUPER_ADMIN in-app
// notification and the SUPER_ADMIN alert email are each DB-level
// idempotent: a duplicate business event (worker retry, a second request
// for the same event) can never create a second row, for either table.
// This exercises the actual unique-index + ON CONFLICT DO NOTHING paths in
// PostgresStore, not the fake pool used by the rest of this repo's tests.
import {randomBytes} from "node:crypto";
import {Pool} from "pg";
import {afterAll, beforeAll, describe, expect, it} from "vitest";
import {PostgresStore} from "../../src/services/store";

const pool = new Pool({connectionString: process.env.DATABASE_URL});
const store = new PostgresStore();
let superAdminId: number;
const notificationIds: number[] = [];

beforeAll(async () => {
  const admin = await pool.query("select id from users where role='SUPER_ADMIN' and status='ACTIVE' limit 1");
  if (!admin.rows[0]) throw new Error("No seeded SUPER_ADMIN found — run npm run db:seed first");
  superAdminId = admin.rows[0].id;
});

afterAll(async () => {
  if (notificationIds.length) await pool.query("delete from notifications where id = any($1)", [notificationIds]);
  await pool.query("delete from email_outbox where idempotency_key like 'SUPER_ADMIN_EMAIL:TEST_IDEMPOTENCY:%'");
  await pool.end();
});

describe("SUPER_ADMIN notification/email idempotency (real DB unique constraints)", () => {
  it("(E) calling notifySuperAdmins twice for the same business event creates exactly one notification row per admin", async () => {
    const eventId = randomBytes(6).toString("hex");
    const idempotencyKeyPrefix = `SUPER_ADMIN_NOTIFICATION:TEST_IDEMPOTENCY:${eventId}`;

    const firstRun = await store.notifySuperAdmins("SUPER_ADMIN_CASE_CREATED", "t", "b", "client", 1, idempotencyKeyPrefix);
    const secondRun = await store.notifySuperAdmins("SUPER_ADMIN_CASE_CREATED", "t", "b", "client", 1, idempotencyKeyPrefix);

    expect(firstRun).toBeGreaterThan(0);
    expect(secondRun).toBe(0); // every admin already had this event — nothing new created

    const rows = await pool.query("select id from notifications where idempotency_key=$1", [`${idempotencyKeyPrefix}:${superAdminId}`]);
    notificationIds.push(...rows.rows.map((row) => row.id));
    expect(rows.rows.length).toBe(1);
  });

  it("(E) concurrent duplicate calls (simulating a race, not just a sequential retry) still create exactly one row", async () => {
    const eventId = randomBytes(6).toString("hex");
    const idempotencyKeyPrefix = `SUPER_ADMIN_NOTIFICATION:TEST_IDEMPOTENCY:${eventId}`;

    await Promise.all([
      store.notifySuperAdmins("SUPER_ADMIN_CASE_CREATED", "t", "b", "client", 1, idempotencyKeyPrefix),
      store.notifySuperAdmins("SUPER_ADMIN_CASE_CREATED", "t", "b", "client", 1, idempotencyKeyPrefix),
      store.notifySuperAdmins("SUPER_ADMIN_CASE_CREATED", "t", "b", "client", 1, idempotencyKeyPrefix)
    ]);

    const rows = await pool.query("select id from notifications where idempotency_key=$1", [`${idempotencyKeyPrefix}:${superAdminId}`]);
    notificationIds.push(...rows.rows.map((row) => row.id));
    expect(rows.rows.length).toBe(1);
  });

  it("(F) enqueueSuperAdminEmail called twice for the same business event creates exactly one email_outbox row", async () => {
    const eventId = randomBytes(6).toString("hex");
    const idempotencyKey = `SUPER_ADMIN_EMAIL:TEST_IDEMPOTENCY:${eventId}`;

    const firstInsert = await store.enqueueSuperAdminEmail("SUPER_ADMIN_CASE_CREATED", idempotencyKey, "admin-test@example.com", {clientId: 1});
    const secondInsert = await store.enqueueSuperAdminEmail("SUPER_ADMIN_CASE_CREATED", idempotencyKey, "admin-test@example.com", {clientId: 1});

    expect(firstInsert).toBe(true);
    expect(secondInsert).toBe(false); // already enqueued — worker retry must never duplicate

    const rows = await pool.query("select id from email_outbox where idempotency_key=$1", [idempotencyKey]);
    expect(rows.rows.length).toBe(1);
  });

  it("(F) concurrent duplicate email-enqueue calls still create exactly one email_outbox row", async () => {
    const eventId = randomBytes(6).toString("hex");
    const idempotencyKey = `SUPER_ADMIN_EMAIL:TEST_IDEMPOTENCY:${eventId}`;

    await Promise.all([
      store.enqueueSuperAdminEmail("SUPER_ADMIN_CASE_CREATED", idempotencyKey, "admin-test@example.com", {clientId: 1}),
      store.enqueueSuperAdminEmail("SUPER_ADMIN_CASE_CREATED", idempotencyKey, "admin-test@example.com", {clientId: 1}),
      store.enqueueSuperAdminEmail("SUPER_ADMIN_CASE_CREATED", idempotencyKey, "admin-test@example.com", {clientId: 1})
    ]);

    const rows = await pool.query("select id from email_outbox where idempotency_key=$1", [idempotencyKey]);
    expect(rows.rows.length).toBe(1);
  });
});
