import { db } from '../db';
import { auditLogs } from '../db/schema';

export async function logAudit(
  actorUserId: number | null,
  action: string,
  entityType: string | null = null,
  entityId: number | null = null,
  metadata: any = null,
  ipAddress: string | null = null,
  userAgent: string | null = null
) {
  try {
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    await db.insert(auditLogs).values({
      actorUserId,
      action,
      entityType,
      entityId,
      metadata: metadataStr,
      ipAddress,
      userAgent
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

export const writeAuditLog = logAudit;
