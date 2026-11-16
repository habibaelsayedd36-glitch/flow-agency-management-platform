import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { automationRules, notifications, products, users, workflowSteps } from "@/db/schema";
import { apiError, assertSameOrigin } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";

const defaults = [
  { key: "overdue_tasks", title: "Overdue task alerts", description: "Notify task owners and managers when a deadline has passed." },
  { key: "due_soon", title: "Upcoming deadline reminders", description: "Notify owners about tasks due within the next 24 hours." },
  { key: "unassigned_tasks", title: "Unassigned task alerts", description: "Notify managers when active work has no assigned owner." },
];
async function getRules() {
  await db.insert(automationRules).values(defaults.map((item) => ({ key: item.key, enabled: true }))).onConflictDoNothing();
  const saved = await db.select().from(automationRules);
  return defaults.map((item) => ({ ...item, enabled: saved.find((rule) => rule.key === item.key)?.enabled ?? true }));
}
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request, ["admin", "production_manager"]);
    requireActiveAccount(user);
    const [rules, rows] = await Promise.all([
      getRules(),
      db.select({ id: workflowSteps.id, status: workflowSteps.status, deadline: workflowSteps.deadline, assignedTo: workflowSteps.assignedTo }).from(workflowSteps).where(inArray(workflowSteps.status, ["pending", "in_progress"])),
    ]);
    const now = Date.now();
    return NextResponse.json({ rules, counts: { overdue: rows.filter((row) => row.deadline && row.deadline.getTime() < now).length, dueSoon: rows.filter((row) => row.deadline && row.deadline.getTime() >= now && row.deadline.getTime() < now + 86400000).length, unassigned: rows.filter((row) => !row.assignedTo).length } });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["admin", "production_manager"]);
    requireActiveAccount(user);
    const body = await request.json();
    if (!defaults.some((item) => item.key === body.key) || typeof body.enabled !== "boolean") return NextResponse.json({ error: "Invalid automation rule." }, { status: 400 });
    await db.insert(automationRules).values({ key: body.key, enabled: body.enabled, updatedBy: user.id }).onConflictDoUpdate({ target: automationRules.key, set: { enabled: body.enabled, updatedBy: user.id, updatedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["admin", "production_manager"]);
    requireActiveAccount(user);
    const rules = await getRules();
    const enabled = new Set(rules.filter((rule) => rule.enabled).map((rule) => rule.key));
    const now = new Date();
    const dueSoon = new Date(now.getTime() + 86400000);
    const rows = await db.select({ id: workflowSteps.id, stageLabel: workflowSteps.stageLabel, status: workflowSteps.status, deadline: workflowSteps.deadline, assignedTo: workflowSteps.assignedTo, productName: products.name }).from(workflowSteps).innerJoin(products, eq(workflowSteps.productId, products.id)).where(inArray(workflowSteps.status, ["pending", "in_progress"])).limit(1000);
    const recipients = await db.select({ id: users.id, role: users.role }).from(users).where(and(eq(users.status, "active"), inArray(users.role, ["admin", "production_manager"])));
    let created = 0;
    for (const task of rows) {
      const overdue = task.deadline && task.deadline < now;
      const soon = task.deadline && task.deadline >= now && task.deadline <= dueSoon;
      const candidates: { key: string; recipients: string[]; title: string; body: string }[] = [];
      if (overdue && enabled.has("overdue_tasks")) candidates.push({ key: "overdue_tasks", recipients: [...new Set([task.assignedTo, ...recipients.map((r) => r.id)].filter(Boolean) as string[])], title: "Overdue task", body: `${task.productName}: ${task.stageLabel} is past its deadline.` });
      if (soon && enabled.has("due_soon") && task.assignedTo) candidates.push({ key: "due_soon", recipients: [task.assignedTo], title: "Deadline approaching", body: `${task.productName}: ${task.stageLabel} is due within 24 hours.` });
      if (!task.assignedTo && enabled.has("unassigned_tasks")) candidates.push({ key: "unassigned_tasks", recipients: recipients.map((r) => r.id), title: "Unassigned task", body: `${task.productName}: ${task.stageLabel} needs an owner.` });
      for (const candidate of candidates) for (const recipient of candidate.recipients) {
        const href = `/tasks?automation=${candidate.key}&id=${task.id}`;
        const [existing] = await db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, recipient), eq(notifications.href, href), gte(notifications.createdAt, new Date(now.getTime() - 86400000)))).limit(1);
        if (existing) continue;
        await db.insert(notifications).values({ userId: recipient, title: candidate.title, body: candidate.body, type: "workflow_automation", href });
        created++;
      }
    }
    return NextResponse.json({ created, checked: rows.length });
  } catch (error) { return apiError(error); }
}
