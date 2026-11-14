export type PortalRow = Record<string, any>;

export type PortalStats = {
  products: number;
  inProduction: number;
  completed: number;
  awaitingApproval: number;
  activeProjects: number;
  serviceRequests: number;
  outstandingInvoices: number;
  outstandingAmount: number;
};

export type PortalDashboardData = {
  pendingApproval?: boolean;
  user?: PortalRow;
  stats: PortalStats | null;
  projects: PortalRow[];
  activity: PortalRow[];
  subscription?: PortalRow | null;
};

export async function requestJson<T = PortalRow>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Something went wrong. Please try again.");
  return payload as T;
}

export function statusLabel(status: unknown) {
  if (typeof status !== "string" || !status) return "Not set";
  return status.replaceAll("_", " ");
}

export function formatDate(value: unknown, language: "en" | "ar" = "en", options?: Intl.DateTimeFormatOptions) {
  if (!value) return "Not set";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", options || { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function formatMoney(value: unknown, currency = "EGP", language: "en" | "ar" = "en") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-EG", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
}

export function initials(name: unknown) {
  return String(name || "F").trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "F";
}

export function titleCase(value: unknown) {
  return statusLabel(value).replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
