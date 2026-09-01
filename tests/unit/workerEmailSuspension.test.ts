import {describe, expect, it, vi} from "vitest";
import {EncryptionService} from "../../src/utils/crypto";

describe("worker email suspension", () => {
  it("runs schedules without reading or retrying the email outbox", async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://unused";
    const {PostgresLenderDeliveryService} = await import("../../src/services/lenderDelivery");
    const queries: string[] = [];
    const query = vi.fn(async (sql: string) => {
      queries.push(sql);
      return {rows: []};
    });
    const connection = {
      query: vi.fn(async (sql: string) => ({rows: sql.includes("pg_try_advisory_lock") ? [{locked: true}] : []})),
      release: vi.fn()
    };
    const send = vi.fn();
    const service = new PostgresLenderDeliveryService({
      pool: {query, connect: vi.fn().mockResolvedValue(connection)} as never,
      storage: {} as never,
      email: {send} as never,
      encryption: new EncryptionService(Buffer.alloc(32, 4)),
      tokens: {} as never,
      broker: {publish: vi.fn()} as never,
      appUrl: "https://app.syncash.co.il",
      nodeEnv: "test",
      processJobsOnDemand: false,
      now: () => new Date("2026-07-28T12:00:00.000Z")
    });

    await service.processJobs({processEmail: false});

    expect(queries.some((sql) => sql.includes("business_calendar_exceptions"))).toBe(true);
    expect(queries.some((sql) => sql.includes("email_outbox where status='PENDING'"))).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledOnce();
  }, 15_000);
});
