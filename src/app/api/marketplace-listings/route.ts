import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { marketplaceListings, marketplaces, products } from "@/db/schema";
import { ApiError, apiError, assertSameOrigin, optionalText, requireText } from "@/lib/api";
import { assertProductAccess, requireActiveAccount, requireAuth } from "@/lib/authorization";
import { writeActivity, writeAudit } from "@/lib/audit";

const statuses = ["not_published", "draft", "ready_for_publishing", "pending", "published", "rejected", "needs_attention"] as const;

export async function POST() {
  return NextResponse.json(
    { error: "Manual listing creation and status updates are disabled. FLOW will manage listing records automatically from each product's selected marketplaces." },
    { status: 410 },
  );
}
