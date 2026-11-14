import { desc, eq, inArray } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoiceItems, invoices, projects } from "@/db/schema";
import { ApiError, apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function visibleOrganizationIds(user: Awaited<ReturnType<typeof requireAuth>>) {
  if (user.role === "client") return user.organizationId ? [user.organizationId] : [];
  if (user.role === "admin" || user.role === "production_manager") return null;
  if (user.role === "account_manager") {
    const rows = await db.select({ organizationId: projects.organizationId }).from(projects).where(eq(projects.accountManagerId, user.id));
    return [...new Set(rows.map((row) => row.organizationId))];
  }
  return [];
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const organizationIds = await visibleOrganizationIds(user);
    const rows = organizationIds === null
      ? await db.select().from(invoices).orderBy(desc(invoices.issueDate)).limit(250)
      : organizationIds.length
        ? await db.select().from(invoices).where(inArray(invoices.organizationId, organizationIds)).orderBy(desc(invoices.issueDate)).limit(250)
        : [];
    const ids = rows.map((invoice) => invoice.id);
    const items = ids.length ? await db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, ids)) : [];
    return NextResponse.json({ invoices: rows.map((invoice) => ({ ...invoice, items: items.filter((item) => item.invoiceId === invoice.id) })) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["admin"]);
    requireActiveAccount(user);
    const body = await request.json();
    const organizationId = requireText(body.organizationId, "Client workspace", 80);
    const description = optionalText(body.notes, 3000);
    const rows = body.items;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 50) throw new ApiError(400, "Add between 1 and 50 invoice lines.", "VALIDATION_ERROR");
    const normalizedItems = rows.map((item: unknown) => {
      if (!item || typeof item !== "object") throw new ApiError(400, "An invoice line is invalid.", "VALIDATION_ERROR");
      const row = item as Record<string, unknown>;
      const itemDescription = requireText(row.description, "Line description", 240);
      const quantity = Number(row.quantity);
      const unitPrice = Number(row.unitPrice);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000000) {
        throw new ApiError(400, "Enter a valid quantity and unit price for each invoice line.", "VALIDATION_ERROR");
      }
      return { description: itemDescription, quantity: money(quantity), unitPrice: money(unitPrice), lineTotal: money(quantity * unitPrice) };
    });
    const subtotal = money(normalizedItems.reduce((total, item) => total + item.lineTotal, 0));
    const discount = body.discount === undefined || body.discount === "" ? 0 : Number(body.discount);
    const taxRate = body.taxRate === undefined || body.taxRate === "" ? 0 : Number(body.taxRate);
    if (!Number.isFinite(discount) || discount < 0 || discount > subtotal || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 30) {
      throw new ApiError(400, "Discount or tax is outside the permitted range.", "VALIDATION_ERROR");
    }
    const tax = money((subtotal - discount) * taxRate / 100);
    const total = money(subtotal - discount + tax);
    const issueDate = new Date().toISOString().slice(0, 10);
    const dueDate = typeof body.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : null;
    const invoiceNumber = `FLOW-${issueDate.slice(2, 7).replace("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const currency = typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency) ? body.currency : "EGP";
    const [invoice] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(invoices).values({
        organizationId,
        invoiceNumber,
        issueDate,
        dueDate,
        subtotal,
        discount: money(discount),
        tax,
        total,
        amountPaid: 0,
        currency,
        status: "unpaid",
        notes: description,
        createdBy: user.id,
      }).returning();
      await tx.insert(invoiceItems).values(normalizedItems.map((item) => ({ invoiceId: created.id, ...item })));
      return [created];
    });
    await writeActivity({ actorId: user.id, organizationId, entityType: "invoice", entityId: invoice.id, action: "invoice.created", description: `Invoice ${invoiceNumber} was issued.`, visibility: "client" });
    await writeAudit({ actorId: user.id, organizationId, action: "invoice.created", entityType: "invoice", entityId: invoice.id, newValue: { invoiceNumber, subtotal, discount, tax, total, currency } });
    return NextResponse.json({ invoice: { ...invoice, items: normalizedItems } }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
