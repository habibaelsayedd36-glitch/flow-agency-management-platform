import { NextResponse } from "next/server";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "REQUEST_ERROR") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function apiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("FLOW portal request failed", error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export function requireText(value: unknown, label: string, maxLength = 240) {
  if (typeof value !== "string" || !value.trim()) throw new ApiError(400, `${label} is required.`, "VALIDATION_ERROR");
  const result = value.trim();
  if (result.length > maxLength) throw new ApiError(400, `${label} is too long.`, "VALIDATION_ERROR");
  return result;
}

export function optionalText(value: unknown, maxLength = 2000) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new ApiError(400, "A text field has an invalid value.", "VALIDATION_ERROR");
  const result = value.trim();
  if (result.length > maxLength) throw new ApiError(400, "A text field is too long.", "VALIDATION_ERROR");
  return result || null;
}

export function parsePositiveInteger(value: unknown, label: string, max = 100000) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new ApiError(400, `${label} must be a whole number between 1 and ${max}.`, "VALIDATION_ERROR");
  }
  return parsed;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  try {
    const parsed = new URL(origin);
    const requestUrl = new URL(request.url);
    if (parsed.host !== requestUrl.host || parsed.protocol !== requestUrl.protocol) {
      throw new ApiError(403, "Cross-origin requests are not allowed.", "ORIGIN_REJECTED");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, "The request origin is invalid.", "ORIGIN_REJECTED");
  }
}
