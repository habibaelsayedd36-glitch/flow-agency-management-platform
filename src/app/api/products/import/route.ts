import * as XLSX from "xlsx";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { marketplaceListings, marketplaces, products, workflowSteps } from "@/db/schema";
import { ApiError, apiError, assertSameOrigin, requireText } from "@/lib/api";
import { assertOrganizationAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";
import { FLOW_WORKFLOW } from "@/lib/workflow";
import { ensureFlowCatalog } from "@/lib/catalog";

const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

function column(row: Record<string, unknown>, ...names: string[]) {
  const entries = Object.entries(row);
  const match = entries.find(([key]) => names.includes(key.toLowerCase().replace(/[ _-]+/g, "").trim()));
  return typeof match?.[1] === "string" || typeof match?.[1] === "number" ? String(match[1]).trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireAuth(request, ["client", "admin", "account_manager", "production_manager"]);
    requireActiveAccount(user);
    const formData = await request.formData();
    await ensureFlowCatalog();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Choose a CSV or Excel file.", "VALIDATION_ERROR");
    if (file.size > MAX_IMPORT_BYTES) throw new ApiError(400, "Import files must be smaller than 8 MB.", "FILE_TOO_LARGE");
    const organizationId = user.role === "client" ? user.organizationId : requireText(formData.get("organizationId"), "Workspace", 80);
    if (!organizationId) throw new ApiError(400, "A client workspace is required.", "VALIDATION_ERROR");
    await assertOrganizationAccess(user, organizationId);
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["csv", "xlsx", "xls"].includes(extension)) throw new ApiError(400, "Upload a CSV, XLS, or XLSX file.", "FILE_TYPE_REJECTED");
    const bytes = Buffer.from(await file.arrayBuffer());
    if (extension === "csv" && bytes.includes(0)) throw new ApiError(400, "The CSV file is not valid text.", "FILE_TYPE_REJECTED");
    const workbook = XLSX.read(bytes, { type: "buffer", raw: false });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) throw new ApiError(400, "The spreadsheet does not contain a worksheet.", "VALIDATION_ERROR");
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "", raw: false });
    if (!rows.length) throw new ApiError(400, "The spreadsheet has no product rows.", "VALIDATION_ERROR");
    if (rows.length >= 500) throw new ApiError(400, "Import fewer than 500 products per spreadsheet (maximum 499).", "VALIDATION_ERROR");
    const productValues = rows.map((row) => ({
      organizationId,
      name: column(row, "name", "productname", "title"),
      sku: column(row, "sku", "productsku") || null,
      brand: column(row, "brand") || null,
      category: column(row, "category") || null,
      description: column(row, "description", "productdescription") || null,
      targetMarketplace: column(row, "marketplace", "marketplaces", "targetmarketplace", "targetmarketplaces").split(/[,;|]/).map((value) => value.trim()).filter(Boolean).join(", ") || null,
      createdBy: user.id,
    })).filter((row) => row.name);
    if (!productValues.length) throw new ApiError(400, "A product name column is required. Use a header named name or product name.", "VALIDATION_ERROR");
    const inserted = await db.transaction(async (tx) => {
      const created = await tx.insert(products).values(productValues).returning({ id: products.id, name: products.name, organizationId: products.organizationId });
      const stageRows = created.flatMap((product) => FLOW_WORKFLOW.map((stage, index) => ({
        productId: product.id,
        stageKey: stage.key,
        stageLabel: stage.label,
        stageOrder: index + 1,
        status: index === 0 ? "in_progress" : "pending",
        startedAt: index === 0 ? new Date() : null,
        clientVisible: stage.clientVisible,
      })));
      await tx.insert(workflowSteps).values(stageRows);
      const channelRows = await tx.select({ id: marketplaces.id, slug: marketplaces.slug }).from(marketplaces);
      const listingRows = created.flatMap((product, index) => {
        const requested = productValues[index]?.targetMarketplace?.split(",").map((name) => name.trim().toLowerCase().replace(" ", "")) || [];
        return channelRows.filter((channel) => requested.includes(channel.slug)).map((channel) => ({
          productId: product.id, marketplaceId: channel.id, status: "not_published" as const,
        }));
      });
      if (listingRows.length) await tx.insert(marketplaceListings).values(listingRows).onConflictDoNothing();
      return created;
    });
    await writeActivity({ actorId: user.id, organizationId, entityType: "product", action: "products.imported", description: `${inserted.length} products were imported for production.`, visibility: "client", metadata: { count: inserted.length } });
    await writeAudit({ actorId: user.id, organizationId, action: "products.imported", entityType: "product", newValue: { count: inserted.length } });
    return NextResponse.json({ imported: inserted.length, skipped: rows.length - inserted.length }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
