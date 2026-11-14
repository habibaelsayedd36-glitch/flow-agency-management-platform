import { and, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { deliverables, files, projectMembers, projects, workflowSteps } from "@/db/schema";
import { ApiError, apiError, assertSameOrigin, requireText } from "@/lib/api";
import { assertOrganizationAccess, assertProductAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";

const MAX_BYTES = 10 * 1024 * 1024;
const acceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "video/mp4",
]);
const acceptedExtensions = new Set(["jpg", "jpeg", "png", "webp", "pdf", "csv", "xls", "xlsx", "mp4"]);

function hasValidSignature(type: string, bytes: Buffer) {
  if (type === "image/jpeg") return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (type === "application/pdf") return bytes.toString("ascii", 0, 5) === "%PDF-";
  if (type.includes("spreadsheet") || type === "application/vnd.ms-excel") return bytes[0] === 0x50 && bytes[1] === 0x4b || type === "application/vnd.ms-excel";
  if (type === "video/mp4") return bytes.toString("ascii", 4, 8) === "ftyp";
  if (type.includes("csv") || type === "application/vnd.ms-excel") return !bytes.subarray(0, 1024).includes(0);
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const organizationId = request.nextUrl.searchParams.get("organizationId") || user.organizationId;
    if (user.role === "client" && organizationId !== user.organizationId) return NextResponse.json({ error: "Files not found." }, { status: 404 });
    if (organizationId) await assertOrganizationAccess(user, organizationId);
    if (!organizationId && user.role !== "admin" && user.role !== "production_manager") return NextResponse.json({ files: [] });

    const columns = { id: files.id, organizationId: files.organizationId, projectId: files.projectId, productId: files.productId, fileName: files.fileName, contentType: files.contentType, fileSize: files.fileSize, category: files.category, versionNumber: files.versionNumber, clientVisible: files.clientVisible, createdAt: files.createdAt };
    const rows = organizationId
      ? await db.select(columns).from(files).where(eq(files.organizationId, organizationId)).orderBy(desc(files.createdAt)).limit(250)
      : await db.select(columns).from(files).orderBy(desc(files.createdAt)).limit(250);
    if (user.role === "client") return NextResponse.json({ files: rows.filter((file) => file.clientVisible) });
    if (["photographer", "content_creator"].includes(user.role)) {
      const [taskRows, memberRows] = await Promise.all([
        db.select({ productId: workflowSteps.productId }).from(workflowSteps).where(eq(workflowSteps.assignedTo, user.id)),
        db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, user.id)),
      ]);
      const productIds = new Set(taskRows.map((row) => row.productId));
      const projectIds = new Set(memberRows.map((row) => row.projectId));
      return NextResponse.json({ files: rows.filter((file) => (file.productId && productIds.has(file.productId)) || (file.projectId && projectIds.has(file.projectId))) });
    }
    return NextResponse.json({ files: rows });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["client", "admin", "account_manager", "photographer", "content_creator", "production_manager"]);
    requireActiveAccount(user);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose a file to upload.", "VALIDATION_ERROR");
    if (file.size < 1 || file.size > MAX_BYTES) throw new ApiError(400, "Files must be smaller than 10 MB.", "FILE_TOO_LARGE");
    const type = file.type.toLowerCase();
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!acceptedTypes.has(type) || !acceptedExtensions.has(extension)) throw new ApiError(400, "This file type is not supported.", "FILE_TYPE_REJECTED");
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasValidSignature(type, buffer)) throw new ApiError(400, "The file content does not match its declared type.", "FILE_SIGNATURE_REJECTED");

    const organizationId = user.role === "client" ? user.organizationId : requireText(formData.get("organizationId"), "Workspace", 80);
    if (!organizationId) throw new ApiError(400, "A client workspace is required.", "VALIDATION_ERROR");
    await assertOrganizationAccess(user, organizationId);
    const productId = typeof formData.get("productId") === "string" ? String(formData.get("productId")) || null : null;
    const projectId = typeof formData.get("projectId") === "string" ? String(formData.get("projectId")) || null : null;
    if (productId) {
      const product = await assertProductAccess(user, productId);
      if (product.organizationId !== organizationId) throw new ApiError(404, "Product not found.", "NOT_FOUND");
    }
    if (projectId) {
      const [project] = await db.select({ organizationId: projects.organizationId }).from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project || project.organizationId !== organizationId) throw new ApiError(404, "Project not found.", "NOT_FOUND");
    }

    const categories = ["reference", "original", "edited", "deliverable", "document", "other"] as const;
    const rawCategory = String(formData.get("category") || "document");
    const category = categories.includes(rawCategory as (typeof categories)[number]) ? rawCategory as (typeof categories)[number] : "document";
    if (user.role === "client" && !["reference", "document", "original"].includes(category)) throw new ApiError(403, "Clients can only upload reference and source files.", "FORBIDDEN");
    const clientVisible = user.role === "client" ? true : formData.get("clientVisible") !== "false";
    const safeName = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 240);
    const previous = productId
      ? await db.select({ versionNumber: files.versionNumber }).from(files).where(and(eq(files.productId, productId), eq(files.fileName, safeName))).orderBy(desc(files.versionNumber)).limit(1)
      : [];
    const versionNumber = (previous[0]?.versionNumber ?? 0) + 1;
    const inserted = await db.transaction(async (tx) => {
      const [saved] = await tx.insert(files).values({
        organizationId,
        productId,
        projectId,
        uploadedBy: user.id,
        fileName: safeName,
        contentType: type,
        fileSize: file.size,
        category,
        versionNumber,
        clientVisible,
        content: buffer,
      }).returning({ id: files.id, fileName: files.fileName, versionNumber: files.versionNumber, category: files.category });
      if (category === "deliverable") {
        await tx.insert(deliverables).values({ organizationId, projectId, productId, fileId: saved.id, title: safeName, deliverableType: type, versionNumber, createdBy: user.id });
      }
      return saved;
    });
    await writeActivity({ actorId: user.id, organizationId, entityType: "file", entityId: inserted.id, action: "file.uploaded", description: `${safeName} was uploaded.`, visibility: clientVisible ? "client" : "internal" });
    await writeAudit({ actorId: user.id, organizationId, action: "file.uploaded", entityType: "file", entityId: inserted.id, newValue: { fileName: safeName, versionNumber, category, productId, projectId } });
    return NextResponse.json({ file: inserted, downloadUrl: `/api/files/${inserted.id}` }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
