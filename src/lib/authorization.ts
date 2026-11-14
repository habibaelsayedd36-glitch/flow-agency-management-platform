import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { products, projectMembers, projects, workflowSteps } from "@/db/schema";
import { ApiError } from "@/lib/api";
import { getAuthUser, type AuthUser } from "@/lib/auth";

export type UserRole = AuthUser["role"];

export async function requireAuth(request: NextRequest, allowedRoles?: UserRole[]) {
  const user = await getAuthUser(request);
  if (!user) throw new ApiError(401, "Please sign in to continue.", "UNAUTHENTICATED");
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new ApiError(403, "You do not have permission to do that.", "FORBIDDEN");
  }
  return user;
}

export function requireActiveAccount(user: AuthUser) {
  if (user.status !== "active" || (user.role === "client" && user.organizationStatus !== "active")) {
    throw new ApiError(403, "This workspace is awaiting FLOW team activation.", "ACCOUNT_PENDING");
  }
}

export async function canAccessOrganization(user: AuthUser, organizationId: string) {
  if (!user.organizationId && user.role === "client") return false;
  if (user.role === "admin" || user.role === "production_manager") return true;
  if (user.role === "client") return user.organizationId === organizationId;

  const assignedProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .leftJoin(projectMembers, eq(projectMembers.projectId, projects.id))
    .where(
      and(
        eq(projects.organizationId, organizationId),
        user.role === "account_manager"
          ? eq(projects.accountManagerId, user.id)
          : eq(projectMembers.userId, user.id),
      ),
    )
    .limit(1);
  return assignedProjects.length > 0;
}

export async function assertOrganizationAccess(user: AuthUser, organizationId: string) {
  if (!(await canAccessOrganization(user, organizationId))) {
    throw new ApiError(404, "The requested workspace was not found.", "NOT_FOUND");
  }
}

export async function assertProductAccess(user: AuthUser, productId: string) {
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) throw new ApiError(404, "Product not found.", "NOT_FOUND");
  if (user.role === "admin" || user.role === "production_manager") return product;
  if (user.role === "client") {
    if (product.organizationId !== user.organizationId) throw new ApiError(404, "Product not found.", "NOT_FOUND");
    return product;
  }
  if (user.role === "account_manager") {
    await assertOrganizationAccess(user, product.organizationId);
    return product;
  }

  const assignment = await db
    .select({ id: workflowSteps.id })
    .from(workflowSteps)
    .where(and(eq(workflowSteps.productId, product.id), eq(workflowSteps.assignedTo, user.id)))
    .limit(1);
  const projectAssignment = product.projectId
    ? await db
        .select({ id: projectMembers.projectId })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, product.projectId), eq(projectMembers.userId, user.id)))
        .limit(1)
    : [];
  if (!assignment.length && !projectAssignment.length) throw new ApiError(404, "Product not found.", "NOT_FOUND");
  return product;
}

export function canManageWork(user: AuthUser) {
  return ["admin", "account_manager", "production_manager"].includes(user.role);
}

export function isAdmin(user: AuthUser) {
  return user.role === "admin";
}
