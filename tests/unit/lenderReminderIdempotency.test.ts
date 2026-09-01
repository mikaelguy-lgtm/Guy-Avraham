import {describe, expect, it, vi} from "vitest";
import {EncryptionService} from "../../src/utils/crypto";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://unused";

interface FakeCompanySubmission {
  id: number;
  response_deadline_at: string;
  decision_status: string;
  advisor_id: number;
  public_id: string;
  reminder_sent_at: Date | null;
  company_name: string;
  client_id: number;
  public_case_number: string;
}

interface FakeInvitation {
  id: number;
  company_submission_id: number;
  contact_id: number;
  closed_at: Date | null;
  reminder_one_sent_at: Date | null;
}

function makeReminderTestPool() {
  const submissions = new Map<number, FakeCompanySubmission>();
  const invitations: FakeInvitation[] = [];
  const contacts = new Map<number, {email: string; is_primary: boolean}>();
  const outbox: Array<{idempotency_key: string; template: string; recipient: string; company_submission_id: number; invitation_id: number}> = [];

  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("cs.decision_status in('PENDING','PENDING_VERIFICATION')")) {
      return {rows: [...submissions.values()].filter((row) => ["PENDING", "PENDING_VERIFICATION"].includes(row.decision_status)).map((row) => ({
        submission_id: row.id, response_deadline_at: row.response_deadline_at, decision_status: row.decision_status,
        advisor_id: row.advisor_id, submission_public_id: row.public_id, reminder_sent_at: row.reminder_sent_at,
        company_name: row.company_name, client_id: row.client_id, public_case_number: row.public_case_number
      }))};
    }
    if (sql.includes("order by lc.is_primary desc,sci.id limit 1")) {
      const submissionId = Number(params[0]);
      const open = invitations
        .filter((invitation) => invitation.company_submission_id === submissionId && !invitation.closed_at)
        .sort((a, b) => Number(contacts.get(b.contact_id)!.is_primary) - Number(contacts.get(a.contact_id)!.is_primary) || a.id - b.id);
      return {rows: open.length ? [{id: open[0].id, email: contacts.get(open[0].contact_id)!.email}] : []};
    }
    if (sql.includes("reminder_sent_at=now(),updated_at=now() where id=$1 and reminder_sent_at is null")) {
      const submission = submissions.get(Number(params[0]))!;
      if (submission.reminder_sent_at) return {rows: []};
      submission.reminder_sent_at = new Date();
      return {rows: [{id: submission.id}]};
    }
    if (sql.includes("insert into email_outbox") && sql.includes("'LENDER_REMINDER'")) {
      const [idempotencyKey, recipient, , companySubmissionId, invitationId] = params as [string, string, unknown, number, number];
      if (outbox.some((row) => row.idempotency_key === idempotencyKey)) return {rows: []};
      outbox.push({idempotency_key: idempotencyKey, template: "LENDER_REMINDER", recipient, company_submission_id: companySubmissionId, invitation_id: invitationId});
      return {rows: [{id: outbox.length}]};
    }
    if (sql.includes("reminder_one_sent_at=now(),updated_at=now() where id=$1")) {
      const invitation = invitations.find((item) => item.id === Number(params[0]));
      if (invitation) invitation.reminder_one_sent_at = new Date();
      return {rows: []};
    }
    return {rows: []};
  });

  return {
    query,
    connect: vi.fn().mockResolvedValue({
      query: vi.fn(async (sql: string) => ({rows: sql.includes("pg_try_advisory_lock") ? [{locked: true}] : []})),
      release: vi.fn()
    }),
    submissions, invitations, contacts, outbox
  };
}

async function buildService(pool: ReturnType<typeof makeReminderTestPool>, now: Date) {
  const {PostgresLenderDeliveryService} = await import("../../src/services/lenderDelivery");
  return new PostgresLenderDeliveryService({
    pool: pool as never, storage: {} as never, email: {send: vi.fn()} as never,
    encryption: new EncryptionService(Buffer.alloc(32, 4)), tokens: {} as never,
    broker: {publish: vi.fn()} as never, appUrl: "https://app.syncash.co.il", nodeEnv: "test",
    processJobsOnDemand: false, now: () => now
  });
}

const NOW = new Date("2026-07-28T10:00:00+03:00");
const DEADLINE = "2026-07-28T18:00:00+03:00";

function seedSubmissionWithContacts(pool: ReturnType<typeof makeReminderTestPool>, contactCount: number) {
  pool.submissions.set(1, {
    id: 1, response_deadline_at: DEADLINE, decision_status: "PENDING", advisor_id: 9, public_id: "sub-1",
    reminder_sent_at: null, company_name: "חברת בדיקה", client_id: 5, public_case_number: "SC-1"
  });
  for (let index = 0; index < contactCount; index += 1) {
    pool.contacts.set(index + 1, {email: `contact${index + 1}@lender.test`, is_primary: index === 0});
    pool.invitations.push({id: index + 1, company_submission_id: 1, contact_id: index + 1, closed_at: null, reminder_one_sent_at: null});
  }
}

describe("lender reminder idempotency (root-cause fix)", () => {
  it("sends exactly one reminder on business day 2 at 09:00, even with three active contacts", async () => {
    const pool = makeReminderTestPool();
    seedSubmissionWithContacts(pool, 3);
    const service = await buildService(pool, NOW);

    await service.processJobs({processEmail: false});

    expect(pool.outbox).toHaveLength(1);
    expect(pool.outbox[0].recipient).toBe("contact1@lender.test");
    expect(pool.outbox[0].idempotency_key).toBe("LENDER_REMINDER:1");
  }, 15_000);

  it("prefers the primary contact as the single reminder recipient", async () => {
    const pool = makeReminderTestPool();
    pool.submissions.set(1, {
      id: 1, response_deadline_at: DEADLINE, decision_status: "PENDING", advisor_id: 9, public_id: "sub-1",
      reminder_sent_at: null, company_name: "חברת בדיקה", client_id: 5, public_case_number: "SC-1"
    });
    pool.contacts.set(1, {email: "secondary@lender.test", is_primary: false});
    pool.contacts.set(2, {email: "primary@lender.test", is_primary: true});
    pool.invitations.push(
      {id: 1, company_submission_id: 1, contact_id: 1, closed_at: null, reminder_one_sent_at: null},
      {id: 2, company_submission_id: 1, contact_id: 2, closed_at: null, reminder_one_sent_at: null}
    );
    const service = await buildService(pool, NOW);

    await service.processJobs({processEmail: false});

    expect(pool.outbox).toHaveLength(1);
    expect(pool.outbox[0].recipient).toBe("primary@lender.test");
  });

  it("does not duplicate the reminder when the worker tick runs again (idempotent re-run)", async () => {
    const pool = makeReminderTestPool();
    seedSubmissionWithContacts(pool, 2);
    const service = await buildService(pool, NOW);

    await service.processJobs({processEmail: false});
    await service.processJobs({processEmail: false});
    await service.processJobs({processEmail: false});

    expect(pool.outbox).toHaveLength(1);
  });

  it("stays exactly-once even if two worker instances race past the advisory lock (DB row is the source of truth)", async () => {
    const pool = makeReminderTestPool();
    seedSubmissionWithContacts(pool, 4);
    const serviceA = await buildService(pool, NOW);
    const serviceB = await buildService(pool, NOW);

    await Promise.all([serviceA.processJobs({processEmail: false}), serviceB.processJobs({processEmail: false})]);

    expect(pool.outbox).toHaveLength(1);
  });

  it("does not send a reminder before 09:00 on the deadline day", async () => {
    const pool = makeReminderTestPool();
    seedSubmissionWithContacts(pool, 1);
    const beforeReminder = new Date("2026-07-28T08:00:00+03:00");
    const service = await buildService(pool, beforeReminder);

    await service.processJobs({processEmail: false});

    expect(pool.outbox).toHaveLength(0);
  });

  it("does not send a reminder once a decision already exists", async () => {
    const pool = makeReminderTestPool();
    seedSubmissionWithContacts(pool, 2);
    pool.submissions.get(1)!.decision_status = "INTERESTED";
    const service = await buildService(pool, NOW);

    await service.processJobs({processEmail: false});

    expect(pool.outbox).toHaveLength(0);
  });
});
