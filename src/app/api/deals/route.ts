import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { clientDeals, files, organizations } from "@/db/schema";
import { ApiError, apiError, assertSameOrigin, requireText } from "@/lib/api";
import { assertOrganizationAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeAudit } from "@/lib/audit";

const MAX_BYTES = 10 * 1024 * 1024;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC = "application/msword";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const organizationId = user.role === "client" ? user.organizationId : request.nextUrl.searchParams.get("organizationId");
    if (organizationId) await assertOrganizationAccess(user, organizationId);
    const rows = organizationId
      ? await db.select().from(clientDeals).where(and(eq(clientDeals.organizationId, organizationId), user.role === "client" ? eq(clientDeals.clientVisible, true) : undefined)).orderBy(desc(clientDeals.agreementDate), desc(clientDeals.createdAt)).limit(300)
      : user.role === "admin" || user.role === "production_manager"
        ? await db.select().from(clientDeals).orderBy(desc(clientDeals.agreementDate), desc(clientDeals.createdAt)).limit(300)
        : [];
    const filesById = new Map((rows.length ? await db.select({ id: files.id, fileName: files.fileName, contentType: files.contentType, fileSize: files.fileSize, versionNumber: files.versionNumber }).from(files) : []).map((file) => [file.id, file]));
    return NextResponse.json({ deals: rows.map((deal) => ({ ...deal, contract: deal.contractFileId ? filesById.get(deal.contractFileId) || null : null })) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["admin", "account_manager"]);
    requireActiveAccount(user);
    const form = await request.formData();
    const organizationId = requireText(form.get("organizationId"), "Client", 80);
    await assertOrganizationAccess(user, organizationId);
    const [organization] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!organization) throw new ApiError(404, "Client not found.", "NOT_FOUND");
    const title = requireText(form.get("title"), "Deal title", 180);
    const summary = requireText(form.get("summary"), "Agreement details", 12000);
    const rawStatus = String(form.get("status") || "agreed");
    const statuses = ["negotiating", "agreed", "rejected", "ended"];
    if (!statuses.includes(rawStatus)) throw new ApiError(400, "Invalid deal status.", "VALIDATION_ERROR");
    const valueText = String(form.get("dealValue") || "").trim();
    const dealValue = valueText ? Number(valueText) : null;
    if (dealValue !== null && (!Number.isFinite(dealValue) || dealValue < 0)) throw new ApiError(400, "Enter a valid deal value.", "VALIDATION_ERROR");
    const contract = form.get("contract");
    let contractFileId: string | null = null;
    if (contract instanceof File && contract.size > 0) {
      if (contract.size > MAX_BYTES) throw new ApiError(400, "Contract must be smaller than 10 MB.", "FILE_TOO_LARGE");
      const ext = contract.name.split(".").pop()?.toLowerCase();
      const type = contract.type.toLowerCase();
      const bytes = Buffer.from(await contract.arrayBuffer());
      const validPdf = ext === "pdf" && type === "application/pdf" && bytes.toString("ascii", 0, 5) === "%PDF-";
      const validDocx = ext === "docx" && type === DOCX && bytes[0] === 0x50 && bytes[1] === 0x4b;
      const validDoc = ext === "doc" && type === DOC && bytes.length > 8 && bytes[0] === 0xd0 && bytes[1] === 0xcf;
      if (!validPdf && !validDocx && !validDoc) throw new ApiError(400, "Upload a valid PDF, DOC or DOCX contract.", "FILE_TYPE_REJECTED");
      const safeName = contract.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 240);
      const [saved] = await db.insert(files).values({
        organizationId, uploadedBy: user.id, fileName: safeName, contentType: type, fileSize: contract.size,
        category: "document", versionNumber: 1, clientVisible: form.get("clientVisible") === "true", content: bytes,
      }).returning({ id: files.id });
      contractFileId = saved.id;
    }
    const clientVisible = form.get("clientVisible") === "true";
    const [deal] = await db.insert(clientDeals).values({
      organizationId, title, summary,
      services: String(form.get("services") || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 30),
      dealValue, currency: String(form.get("currency") || "EGP").slice(0, 3).toUpperCase(),
      status: rawStatus, agreementDate: String(form.get("agreementDate") || "") || null,
      contractFileId, contractStatus: contractFileId ? String(form.get("contractStatus") || "draft") : "not_uploaded",
      contractStartDate: String(form.get("contractStartDate") || "") || null,
      contractEndDate: String(form.get("contractEndDate") || "") || null,
      clientVisible, createdBy: user.id,
    }).returning();
    await writeAudit({ actorId: user.id, organizationId, action: "deal.created", entityType: "client_deal", entityId: deal.id, newValue: { title, status: rawStatus, contractFileId, clientVisible } });
    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) { return apiError(error); }
}
