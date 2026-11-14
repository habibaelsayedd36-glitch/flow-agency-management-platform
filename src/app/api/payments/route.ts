import { and, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, payments, projects } from "@/db/schema";
import { ApiError, apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    let organizationIds: string[] | null = user.role === "admin" || user.role === "production_manager" ? null : user.organizationId ? [user.organizationId] : [];
    if (user.role === "account_manager") {
      const rows = await db.select({ organizationId: projects.organizationId }).from(projects).where(eq(projects.accountManagerId, user.id));
      organizationIds = [...new Set(rows.map((row) => row.organizationId))];
    }
    const invoiceRows = organizationIds === null
      ? await db.select({ id: invoices.id }).from(invoices)
      : organizationIds.length ? await db.select({ id: invoices.id }).from(invoices).where(inArray(invoices.organizationId, organizationIds)) : [];
    const invoiceIds = invoiceRows.map((invoice) => invoice.id);
    const rows = invoiceIds.length ? await db.select().from(payments).where(inArray(payments.invoiceId, invoiceIds)).orderBy(desc(payments.createdAt)) : [];
    return NextResponse.json({ payments: rows });
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
    const invoiceId = requireText(body.invoiceId, "Invoice", 80);
    const method = requireText(body.method, "Payment method", 60);
    if (!["cash", "bank_transfer", "cheque", "other"].includes(method)) throw new ApiError(400, "Payment method is not supported for manual reconciliation.", "VALIDATION_ERROR");
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) throw new ApiError(400, "Enter a valid payment amount.", "VALIDATION_ERROR");
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    if (!invoice || ["cancelled", "refunded"].includes(invoice.status)) return NextResponse.json({ error: "This invoice cannot accept a payment." }, { status: 404 });
    const balance = Math.round((invoice.total - invoice.amountPaid) * 100) / 100;
    if (amount > balance) throw new ApiError(400, "Payment exceeds the remaining invoice balance.", "PAYMENT_EXCEEDS_BALANCE");
    const newAmountPaid = Math.round((invoice.amountPaid + amount) * 100) / 100;
    const newStatus = newAmountPaid >= invoice.total ? "paid" : "partially_paid";
    const [payment] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(payments).values({
        invoiceId,
        amount,
        currency: invoice.currency,
        method,
        reference: optionalText(body.reference, 180),
        status: "verified",
        verifiedBy: user.id,
        paidAt: new Date(),
      }).returning();
      await tx.update(invoices).set({ amountPaid: newAmountPaid, status: newStatus, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
      return [created];
    });
    await writeActivity({ actorId: user.id, organizationId: invoice.organizationId, entityType: "payment", entityId: payment.id, action: "payment.verified", description: `A payment was reconciled against invoice ${invoice.invoiceNumber}.`, visibility: "client" });
    await writeAudit({ actorId: user.id, organizationId: invoice.organizationId, action: "payment.manually_verified", entityType: "payment", entityId: payment.id, newValue: { invoiceId, amount, method, status: "verified" } });
    return NextResponse.json({ payment, amountPaid: newAmountPaid, status: newStatus }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
