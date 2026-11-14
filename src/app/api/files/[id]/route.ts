import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { files, projects } from "@/db/schema";
import { apiError } from "@/lib/api";
import { assertOrganizationAccess, assertProductAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    requireActiveAccount(user);
    const { id } = await context.params;
    const [file] = await db.select().from(files).where(eq(files.id, id)).limit(1);
    if (!file || (user.role === "client" && (!file.clientVisible || file.organizationId !== user.organizationId))) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
    if (file.productId) {
      const product = await assertProductAccess(user, file.productId);
      if (product.organizationId !== file.organizationId) return NextResponse.json({ error: "File not found." }, { status: 404 });
    } else if (file.projectId) {
      const [project] = await db.select({ organizationId: projects.organizationId }).from(projects).where(eq(projects.id, file.projectId)).limit(1);
      if (!project || project.organizationId !== file.organizationId) return NextResponse.json({ error: "File not found." }, { status: 404 });
      await assertOrganizationAccess(user, project.organizationId);
    } else {
      await assertOrganizationAccess(user, file.organizationId);
    }
    const safeName = encodeURIComponent(file.fileName).replace(/['()]/g, escape);
    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(file.contentType);
    return new Response(new Uint8Array(file.content), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.fileSize),
        "Content-Disposition": `${isImage ? "inline" : "attachment"}; filename*=UTF-8''${safeName}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
