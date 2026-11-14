import { db } from "@/db";
import { activityLogs, auditLogs } from "@/db/schema";

export async function writeAudit(input: {
  actorId?: string | null;
  organizationId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
}) {
  await db.insert(auditLogs).values({
    actorId: input.actorId ?? null,
    organizationId: input.organizationId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    ipAddress: input.ipAddress?.slice(0, 80) ?? null,
  });
}

export async function writeActivity(input: {
  actorId?: string | null;
  organizationId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  description: string;
  visibility?: "client" | "internal";
  metadata?: Record<string, unknown>;
}) {
  await db.insert(activityLogs).values({
    actorId: input.actorId ?? null,
    organizationId: input.organizationId ?? null,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    action: input.action,
    description: input.description,
    visibility: input.visibility ?? "client",
    metadata: input.metadata ?? {},
  });
}
