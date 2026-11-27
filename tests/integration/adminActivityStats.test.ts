// Real Postgres: the SUPER_ADMIN activity trends must bucket by the Israeli
// calendar day and include today. Regression for the 2026-11 bug where the
// series started at Israeli midnight (22:00/21:00 UTC the previous day) and was
// truncated in UTC, so today's bucket was never generated and every bucket
// was labelled a day early.
import {Pool} from "pg";
import {afterAll, describe, expect, it} from "vitest";
import {EncryptionService} from "../../src/utils/crypto";
import {PostgresLenderDeliveryService} from "../../src/services/lenderDelivery";

const pool = new Pool({connectionString: process.env.DATABASE_URL});
afterAll(async () => { await pool.end(); });

function israelDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit"}).format(date);
}

describe("admin activity trends (real Postgres)", () => {
  const service = new PostgresLenderDeliveryService({
    pool, storage: {} as never, email: {send: async () => ({messageId: "x"})} as never,
    encryption: new EncryptionService(Buffer.alloc(32, 4)), tokens: {} as never, broker: {publish: () => undefined} as never,
    appUrl: "http://localhost", nodeEnv: "test", processJobsOnDemand: false, now: () => new Date()
  });

  it.each(["today", "7d", "30d", "month"] as const)("ends on today's Israeli date and has one bucket per Israeli day (%s)", async (period) => {
    const points = await service.getAdminActivityStats(period) as Array<{bucket: string}>;
    expect(points.length).toBeGreaterThan(0);
    expect(points[points.length - 1].bucket).toBe(israelDateKey(new Date()));
    const keys = points.map((point) => point.bucket);
    expect(new Set(keys).size).toBe(keys.length);
    if (period === "today") expect(points).toHaveLength(1);
    if (period === "7d") expect(points).toHaveLength(7);
    if (period === "30d") expect(points).toHaveLength(30);
  });

  it("totals match a direct count of new cases in the same Israeli-day window", async () => {
    const points = await service.getAdminActivityStats("7d") as Array<{new_cases: number}>;
    const total = points.reduce((sum, point) => sum + point.new_cases, 0);
    const direct = await pool.query(`select count(*)::int c from clients where deleted_at is null and (created_at at time zone 'Asia/Jerusalem')::date >= (now() at time zone 'Asia/Jerusalem')::date - 6`);
    expect(total).toBe(direct.rows[0].c);
  });
});
