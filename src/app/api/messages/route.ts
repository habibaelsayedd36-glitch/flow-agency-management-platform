import { and, desc, eq, inArray, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { conversations, files, messageAttachments, messages, notifications, projectMembers, projects, users } from "@/db/schema";
import { apiError, assertSameOrigin, requireText } from "@/lib/api";
import { assertOrganizationAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";

async function conversationScope(user: Awaited<ReturnType<typeof requireAuth>>) {
  if (user.role === "client") return user.organizationId ? eq(conversations.organizationId, user.organizationId) : undefined;
  if (user.role === "admin" || user.role === "production_manager") return undefined;
  if (user.role === "account_manager") {
    const rows = await db.select({ organizationId: projects.organizationId }).from(projects).where(eq(projects.accountManagerId, user.id));
    const orgIds = [...new Set(rows.map((row) => row.organizationId))];
    return orgIds.length ? inArray(conversations.organizationId, orgIds) : eq(conversations.assignedUserId, user.id);
  }
  return eq(conversations.assignedUserId, user.id);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const scope = await conversationScope(user);
    const rows = scope
      ? await db.select({ conversation: conversations, companyName: users.fullName }).from(conversations).leftJoin(users, eq(conversations.assignedUserId, users.id)).where(scope).orderBy(desc(conversations.updatedAt)).limit(100)
      : user.role === "admin" || user.role === "production_manager"
        ? await db.select({ conversation: conversations, companyName: users.fullName }).from(conversations).leftJoin(users, eq(conversations.assignedUserId, users.id)).orderBy(desc(conversations.updatedAt)).limit(100)
        : [];
    const conversationIds = rows.map((row) => row.conversation.id);
    const latest = conversationIds.length
      ? await db.select().from(messages).where(inArray(messages.conversationId, conversationIds)).orderBy(desc(messages.createdAt)).limit(300)
      : [];
    const previews = new Map<string, (typeof latest)[number]>();
    const unread = new Map<string, number>();
    for (const message of latest) {
      if (user.role === "client" && message.isInternal) continue;
      if (!previews.has(message.conversationId)) previews.set(message.conversationId, message);
      if (message.senderId !== user.id && !message.readAt && !message.isInternal) unread.set(message.conversationId, (unread.get(message.conversationId) ?? 0) + 1);
    }
    return NextResponse.json({ conversations: rows.map((row) => ({
      ...row.conversation,
      accountManagerName: row.companyName,
      lastMessage: previews.get(row.conversation.id) ?? null,
      unreadCount: unread.get(row.conversation.id) ?? 0,
    })) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const body = await request.json();
    const text = requireText(body.body, "Message", 5000);
    const isInternal = user.role !== "client" && body.isInternal === true;
    let conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
    let conversation = conversationId ? (await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1))[0] : undefined;

    if (conversationId && !conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    if (!conversation) {
      const organizationId = user.role === "client" ? user.organizationId : requireText(body.organizationId, "Workspace", 80);
      if (!organizationId) return NextResponse.json({ error: "A client workspace is required." }, { status: 400 });
      await assertOrganizationAccess(user, organizationId);
      const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : null;
      if (projectId) {
        const [project] = await db.select({ organizationId: projects.organizationId }).from(projects).where(eq(projects.id, projectId)).limit(1);
        if (!project || project.organizationId !== organizationId) return NextResponse.json({ error: "Project not found in this workspace." }, { status: 404 });
      }
      const [created] = await db.insert(conversations).values({
        organizationId,
        projectId,
        subject: requireText(body.subject || "Client support", "Subject", 180),
        assignedUserId: user.role === "account_manager" ? user.id : null,
        createdBy: user.id,
      }).returning();
      conversation = created;
      conversationId = created.id;
    } else {
      await assertOrganizationAccess(user, conversation.organizationId);
      if (!["client", "admin", "production_manager"].includes(user.role) && conversation.assignedUserId !== user.id) {
        return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      }
    }

    const rawFileIds: string[] = Array.isArray(body.fileIds) ? body.fileIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 5) : [];
    if (rawFileIds.length) {
      const attachedFiles = await db.select({ id: files.id, organizationId: files.organizationId, clientVisible: files.clientVisible }).from(files).where(inArray(files.id, rawFileIds));
      if (attachedFiles.length !== rawFileIds.length || attachedFiles.some((file) => file.organizationId !== conversation?.organizationId || (user.role === "client" && !file.clientVisible))) {
        return NextResponse.json({ error: "One or more attachments cannot be shared in this conversation." }, { status: 400 });
      }
    }

    const [message] = await db.insert(messages).values({ conversationId: conversationId!, senderId: user.id, body: text, isInternal }).returning();
    if (rawFileIds.length) await db.insert(messageAttachments).values(rawFileIds.map((fileId) => ({ messageId: message.id, fileId })));
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId!));
    if (!isInternal && user.role === "client" && conversation.assignedUserId) {
      await db.insert(notifications).values({ userId: conversation.assignedUserId, title: "New client message", body: `A new message is waiting in “${conversation.subject}”.`, type: "message", href: `/messages?conversation=${conversationId}` });
    }
    await writeActivity({ actorId: user.id, organizationId: conversation.organizationId, entityType: "message", entityId: message.id, action: "message.sent", description: isInternal ? "An internal note was added." : "A new message was sent.", visibility: isInternal ? "internal" : "client" });
    await writeAudit({ actorId: user.id, organizationId: conversation.organizationId, action: "message.sent", entityType: "message", entityId: message.id, newValue: { conversationId, internal: isInternal } });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
