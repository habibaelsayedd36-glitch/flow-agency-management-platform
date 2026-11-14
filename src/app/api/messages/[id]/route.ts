import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { conversations, files, messageAttachments, messages, users } from "@/db/schema";
import { apiError, assertSameOrigin, requireText } from "@/lib/api";
import { assertOrganizationAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const { id } = await context.params;
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    await assertOrganizationAccess(user, conversation.organizationId);
    if (!["client", "admin", "production_manager"].includes(user.role) && conversation.assignedUserId !== user.id) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const thread = user.role === "client"
      ? await db.select({ message: messages, senderName: users.fullName }).from(messages).leftJoin(users, eq(messages.senderId, users.id)).where(and(eq(messages.conversationId, id), eq(messages.isInternal, false))).orderBy(asc(messages.createdAt))
      : await db.select({ message: messages, senderName: users.fullName }).from(messages).leftJoin(users, eq(messages.senderId, users.id)).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
    const visibleIds = thread.map((item) => item.message.id);
    if (visibleIds.length) await db.update(messages).set({ readAt: new Date() }).where(and(inMessageIds(visibleIds), ne(messages.senderId, user.id), isNull(messages.readAt)));
    const attachments = visibleIds.length
      ? await db.select({ messageId: messageAttachments.messageId, fileId: files.id, fileName: files.fileName, contentType: files.contentType, clientVisible: files.clientVisible }).from(messageAttachments).innerJoin(files, eq(messageAttachments.fileId, files.id)).where(inMessageIds(visibleIds))
      : [];
    return NextResponse.json({
      conversation,
      messages: thread.map((item) => ({ ...item.message, senderName: item.senderName, attachments: attachments.filter((file) => file.messageId === item.message.id && (user.role !== "client" || file.clientVisible)) })),
    });
  } catch (error) {
    return apiError(error);
  }
}

function inMessageIds(ids: string[]) {
  return ids.length ? require("drizzle-orm").inArray(messages.id, ids) : eq(messages.id, "");
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const { id } = await context.params;
    const body = await request.json();
    const response = await fetch(new URL("/api/messages", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") || "", origin: request.headers.get("origin") || new URL(request.url).origin },
      body: JSON.stringify({ ...body, conversationId: id, body: requireText(body.body, "Message", 5000) }),
      cache: "no-store",
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return apiError(error);
  }
}
