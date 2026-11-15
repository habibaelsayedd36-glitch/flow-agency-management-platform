"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/flow-icons";
import { DealsView } from "@/components/deals-view";
import { type AuthUserView, type OrganizationView } from "@/components/auth-screen";
import type { ModalName, PortalModal, ModalState } from "@/components/portal-modal";
import { formatDate, formatMoney, requestJson, statusLabel, titleCase, type PortalRow } from "@/lib/portal-types";

type Props = {
  view: string;
  user: AuthUserView;
  organization: OrganizationView | null;
  language: "en" | "ar";
  refreshToken: number;
  onOpenModal: (name: ModalName, payload?: PortalRow) => void;
  onToast: (message: string, error?: boolean) => void;
  onRefresh: () => void;
  onNavigate: (view: string) => void;
};

const workflowStatuses = [
  "submitted", "initial_review", "waiting_information", "photography_scheduled", "photography_in_progress", "image_editing", "content_creation", "internal_quality_review", "awaiting_client_approval", "revision_requested", "approved", "ready_for_publishing", "published", "completed",
];
const projectStatuses = ["new", "pending_review", "waiting_client", "in_progress", "on_hold", "awaiting_approval", "revision_required", "completed", "cancelled"];

function Badge({ status }: { status: unknown }) {
  const value = typeof status === "string" ? status : "pending";
  return <span className={`status-badge ${value}`}>{statusLabel(value)}</span>;
}

function LoadingPanel({ label = "Loading workspace records…" }: { label?: string }) {
  return <div className="panel panel-pad module-loading"><span className="loading-small" /><span>{label}</span></div>;
}

function Empty({ icon = "folder", title, description, action, actionLabel }: { icon?: IconName; title: string; description: string; action?: () => void; actionLabel?: string }) {
  return <div className="empty-state"><span className="empty-state-icon"><Icon name={icon} size={18} /></span><h3>{title}</h3><p>{description}</p>{action && actionLabel && <button type="button" className="button button-secondary button-small" onClick={action}>{actionLabel}<Icon name="arrow" size={14} /></button>}</div>;
}

function SectionMessage({ error, retry }: { error: string; retry: () => void }) {
  return <div className="panel panel-pad"><div className="error-state"><span className="error-state-icon"><Icon name="shield" size={18} /></span><div><b>We couldn’t load this workspace.</b><p>{error}</p><button type="button" className="subtle-link" onClick={retry}><Icon name="refresh" size={14} /> Try again</button></div></div></div>;
}

export function PortalSections(props: Props) {
  const { view, user, organization, language, refreshToken, onOpenModal, onToast, onRefresh, onNavigate } = props;
  const [data, setData] = useState<PortalRow>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const reload = () => setLoadVersion((current) => current + 1);

  useEffect(() => {
    let current = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        let result: PortalRow = {};
        if (view === "products") result = await requestJson("/api/products");
        else if (view === "projects") {
          const [projectResult, productResult] = await Promise.all([requestJson("/api/projects"), requestJson("/api/products")]);
          result = { ...projectResult, ...productResult };
        } else if (["production", "photography", "content"].includes(view)) result = await requestJson("/api/products");
        else if (view === "approvals") result = await requestJson("/api/approvals");
        else if (view === "services") result = await requestJson("/api/services");
        else if (view === "marketplace") result = await requestJson("/api/marketplaces");
        else if (view === "billing") {
          const [invoiceResult, paymentResult] = await Promise.all([requestJson("/api/invoices"), requestJson("/api/payments")]);
          result = { ...invoiceResult, ...paymentResult };
        } else if (view === "payments") result = await requestJson("/api/payments");
        else if (view === "messages") result = await requestJson("/api/messages");
        else if (view === "reports") result = await requestJson("/api/reports");
        else if (view === "clients") result = await requestJson("/api/clients");
        else if (view === "deals") result = await requestJson("/api/deals");
        else if (view === "team") result = await requestJson("/api/team");
        else if (view === "subscriptions") {
          const [planResult, subscriptionResult] = await Promise.all([requestJson("/api/plans"), requestJson(`/api/subscriptions${user.role === "client" && user.organizationId ? `?organizationId=${user.organizationId}` : ""}`)]);
          result = { ...planResult, ...subscriptionResult };
        } else if (view === "audit") result = await requestJson("/api/admin/audit");
        else if (view === "notifications") result = await requestJson("/api/notifications");
        if (current) setData(result);
      } catch (caught) {
        if (current) setError(caught instanceof Error ? caught.message : "Please try again.");
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    return () => { current = false; };
  }, [view, refreshToken, loadVersion, user.role, user.organizationId]);

  if (view === "settings") return <SettingsView user={user} organization={organization} language={language} onToast={onToast} onRefresh={onRefresh} />;
  if (loading) return <LoadingPanel />;
  if (error) return <SectionMessage error={error} retry={reload} />;

  if (view === "products") return <ProductsView products={data.products || []} user={user} language={language} onOpenModal={onOpenModal} onToast={onToast} onRefresh={onRefresh} />;
  if (view === "projects") return <ProjectsView projects={data.projects || []} products={data.products || []} user={user} language={language} onOpenModal={onOpenModal} onToast={onToast} onRefresh={onRefresh} />;
  if (view === "production") return <ProductionView products={data.products || []} user={user} language={language} onOpenModal={onOpenModal} onToast={onToast} onRefresh={onRefresh} onNavigate={onNavigate} />;
  if (view === "photography") return <PhotographyView products={data.products || []} user={user} language={language} onOpenModal={onOpenModal} onNavigate={onNavigate} />;
  if (view === "content") return <ContentView products={data.products || []} user={user} language={language} onOpenModal={onOpenModal} onToast={onToast} onRefresh={onRefresh} />;
  if (view === "approvals") return <ApprovalsView approvals={data.approvals || []} user={user} language={language} onToast={onToast} onRefresh={onRefresh} />;
  if (view === "services") return <ServicesView catalog={data.catalog || []} requests={data.requests || []} user={user} language={language} onOpenModal={onOpenModal} onToast={onToast} onRefresh={onRefresh} />;
  if (view === "marketplace") return <MarketplaceView data={data} user={user} language={language} onOpenModal={onOpenModal} onToast={onToast} onRefresh={onRefresh} />;
  if (view === "billing") return <BillingView invoices={data.invoices || []} payments={data.payments || []} user={user} language={language} onOpenModal={onOpenModal} onToast={onToast} onRefresh={onRefresh} />;
  if (view === "payments") return <PaymentsView payments={data.payments || []} language={language} />;
  if (view === "messages") return <MessagesView conversations={data.conversations || []} user={user} language={language} onToast={onToast} onRefresh={onRefresh} />;
  if (view === "reports") return <ReportsView data={data} language={language} />;
  if (view === "clients") return <ClientsView clients={data.clients || []} language={language} onToast={onToast} onRefresh={onRefresh} />;
  if (view === "deals") return <DealsView user={user} language={language} onToast={onToast} onRefresh={onRefresh} />;
  if (view === "team") return <TeamView team={data.team || []} onToast={onToast} onRefresh={onRefresh} />;
  if (view === "subscriptions") return <SubscriptionsView data={data} user={user} language={language} onOpenModal={onOpenModal} onToast={onToast} onRefresh={onRefresh} />;
  if (view === "audit") return <AuditView rows={data.auditLogs || []} language={language} />;
  if (view === "notifications") return <NotificationsView rows={data.notifications || []} language={language} onRefresh={onRefresh} onToast={onToast} />;
  return <Empty title="Choose a workspace" description="Use the FLOW navigation to open a workspace module." />;
}

function ProductsView({ products, user, language, onOpenModal, onToast, onRefresh }: { products: PortalRow[]; user: AuthUserView; language: "en" | "ar"; onOpenModal: Props["onOpenModal"]; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [importing, setImporting] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(user.organizationId || "");
  const [workspaces, setWorkspaces] = useState<PortalRow[]>([]);
  useEffect(() => {
    if (user.role !== "admin") return;
    let active = true;
    requestJson<{ clients: PortalRow[] }>("/api/clients")
      .then((result) => { if (active) setWorkspaces(result.clients || []); })
      .catch((error) => { if (active) onToast(error instanceof Error ? error.message : "Could not load workspaces.", true); });
    return () => { active = false; };
  }, [user.role, onToast]);
  const [healthFilter, setHealthFilter] = useState("all");
  const skuCounts: Record<string, number> = {};
  products.forEach((product) => { const sku = String(product.sku || "").trim().toLowerCase(); if (sku) skuCounts[sku] = (skuCounts[sku] || 0) + 1; });
  const getProductIssues = (product: PortalRow) => {
    const issues: string[] = [];
    const sku = String(product.sku || "").trim().toLowerCase();
    if (!sku) issues.push("missing_sku"); else if (skuCounts[sku] > 1) issues.push("duplicate_sku");
    if (!String(product.description || "").trim()) issues.push("missing_description");
    if (!String(product.targetMarketplace || "").trim()) issues.push("no_marketplace");
    return issues;
  };
  const healthCounts = { missingSku: products.filter((product) => getProductIssues(product).includes("missing_sku")).length, duplicateSku: products.filter((product) => getProductIssues(product).includes("duplicate_sku")).length, missingDescription: products.filter((product) => getProductIssues(product).includes("missing_description")).length, noMarketplace: products.filter((product) => getProductIssues(product).includes("no_marketplace")).length };
  const needsReview = products.filter((product) => getProductIssues(product).length > 0).length;
  const filtered = products.filter((product) => {
    const matchesSearch = `${product.name} ${product.sku || ""} ${product.category || ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "all" || product.status === status;
    const issues = getProductIssues(product);
    const matchesHealth = healthFilter === "all" || (healthFilter === "needs_review" ? issues.length > 0 : issues.includes(healthFilter));
    return matchesSearch && matchesStatus && matchesHealth;
  });

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const form = new FormData(); form.set("file", file);
    const workspaceId = user.role === "client" ? user.organizationId : (user.organizationId || selectedWorkspace);
    if (workspaceId) form.set("organizationId", workspaceId);
    if (!workspaceId) {
      onToast("Select the client workspace before importing the spreadsheet.", true);
      setImporting(false);
      event.target.value = "";
      return;
    }
    try {
      const response = await fetch("/api/products/import", { method: "POST", body: form, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Import failed.");
      onToast(`${result.imported} products imported${result.skipped ? ` · ${result.skipped} rows skipped` : ""}.`);
      onRefresh();
    } catch (error) { onToast(error instanceof Error ? error.message : "Import failed.", true); }
    finally { setImporting(false); event.target.value = ""; }
  };

  if (selectedId) return <ProductDetail productId={selectedId} user={user} language={language} onBack={() => setSelectedId("")} onOpenModal={onOpenModal} onToast={onToast} onRefresh={onRefresh} />;
  return <>
    <section className="listing-ops-grid catalog-health-summary" aria-label={t("Smart catalog health", "فحص جودة الكتالوج")}>
      <article className="listing-ops-card"><span className="listing-ops-icon"><Icon name="products" size={17} /></span><span className="section-label">{t("CATALOG SIZE", "حجم الكتالوج")}</span><b>{products.length}</b><small>{t("Products loaded from this workspace", "منتج محمّل من مساحة العمل")}</small></article>
      <article className={`listing-ops-card ${needsReview ? "needs-attention" : ""}`}><span className="listing-ops-icon"><Icon name="shield" size={17} /></span><span className="section-label">{t("NEEDS REVIEW", "يحتاج مراجعة")}</span><b>{needsReview}</b><small>{t("Products with one or more data issues", "منتج به مشكلة أو أكثر في البيانات")}</small></article>
      <article className="listing-ops-card"><span className="listing-ops-icon"><Icon name="file" size={17} /></span><span className="section-label">{t("MISSING SKU", "SKU ناقص")}</span><b>{healthCounts.missingSku}</b><small>{t("Product identifiers to complete", "معرّفات منتجات تحتاج استكمال")}</small></article>
      <article className="listing-ops-card"><span className="listing-ops-icon"><Icon name="shield" size={17} /></span><span className="section-label">{t("DUPLICATE SKU", "SKU مكرر")}</span><b>{healthCounts.duplicateSku}</b><small>{t("Products sharing an SKU", "منتجات تشترك في نفس SKU")}</small></article>
    </section>
    <div className="toolbar"><div className="toolbar-left">{user.role === "admin" && <select className="toolbar-select" value={selectedWorkspace} onChange={(event) => setSelectedWorkspace(event.target.value)} aria-label={t("Select client workspace", "اختر مساحة عمل العميل")}><option value="">Select client workspace</option>{workspaces.map((entry) => <option key={entry.organization.id} value={entry.organization.id}>{entry.organization.companyName}</option>)}</select>}<label className="search-box"><Icon name="search" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search name, SKU or category", "ابحث بالاسم أو SKU أو الفئة")} aria-label={t("Search products", "البحث عن المنتجات")} /></label><select className="toolbar-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter products"><option value="all">All statuses</option>{workflowStatuses.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select><select className="toolbar-select" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value)} aria-label={t("Catalog health filter", "فلتر جودة الكتالوج")}><option value="all">{t("All catalog health", "كل حالات الجودة")}</option><option value="needs_review">{t("Needs review", "يحتاج مراجعة")}</option><option value="missing_sku">{t("Missing SKU", "SKU ناقص")}</option><option value="duplicate_sku">{t("Duplicate SKU", "SKU مكرر")}</option><option value="missing_description">{t("Missing description", "وصف ناقص")}</option><option value="no_marketplace">{t("No marketplace", "بدون منصة")}</option></select></div><div className="toolbar-right"><label className="button button-secondary button-small import-label">{importing ? t("Importing…", "جارٍ الاستيراد…") : t("Import CSV / Excel", "استيراد CSV / Excel")}<Icon name="upload" size={14} /><input type="file" accept=".csv,.xlsx,.xls" onChange={importFile} disabled={importing} /></label><button type="button" className="icon-button" aria-label={t("Table view", "عرض الجدول")} onClick={() => setViewMode("table")}><Icon name="projects" size={15} /></button><button type="button" className="icon-button" aria-label={t("Card view", "عرض البطاقات")} onClick={() => setViewMode("cards")}><Icon name="grid" size={15} /></button></div></div>
    {filtered.length === 0 ? <div className="panel"><Empty icon="products" title={products.length ? t("No matching products", "لا توجد منتجات مطابقة") : t("Your product catalog is ready", "كتالوج منتجاتك جاهز")} description={products.length ? t("Try a different search or status filter.", "جرّب البحث بكلمة أخرى أو غيّر فلتر الحالة.") : t("Import a spreadsheet with up to 499 products to start your production workflow.", "استورد ملفًا يحتوي على 499 منتجًا كحد أقصى لبدء دورة الإنتاج.")}  /></div> : viewMode === "cards" ? <div className="product-card-grid">{filtered.map((product) => <button className="product-card product-card-button" type="button" key={product.id} onClick={() => setSelectedId(product.id)}><div className="product-card-top"><span className="product-placeholder-icon"><Icon name="products" size={19} /></span><span className="product-card-status"><Badge status={product.status} /></span></div><div className="product-card-content"><h3>{product.name}</h3><p>{[product.brand, product.category].filter(Boolean).join(" · ") || product.sku || t("Product details", "تفاصيل المنتج")}</p><div className="product-card-footer"><span>{product.sku || t("SKU not set", "لم يتم تحديد SKU")}</span><span>{formatDate(product.createdAt, language, { day: "numeric", month: "short" })}</span></div></div></button>)}</div> : <div className="panel data-table-wrap"><table className="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Marketplace</th><th>Status</th><th>Submitted</th><th /></tr></thead><tbody>{filtered.map((product) => <tr key={product.id}><td><button type="button" className="table-primary table-button" onClick={() => setSelectedId(product.id)}>{product.name}</button><span className="table-secondary">{product.brand || product.category || ""}</span></td><td>{product.sku || "—"}</td><td>{product.targetMarketplace || "—"}</td><td><Badge status={product.status} /></td><td>{formatDate(product.createdAt, language)}</td><td><button type="button" className="icon-button" aria-label={`Open ${product.name}`} onClick={() => setSelectedId(product.id)}><Icon name="arrow" size={15} /></button></td></tr>)}</tbody></table></div>}
    <p className="record-count">Showing {filtered.length} of {products.length} products · data from your workspace</p>
  </>;
}

function ProductDetail({ productId, user, language, onBack, onOpenModal, onToast, onRefresh }: { productId: string; user: AuthUserView; language: "en" | "ar"; onBack: () => void; onOpenModal: Props["onOpenModal"]; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const [detail, setDetail] = useState<PortalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isStaff = user.role !== "client";
  useEffect(() => {
    let active = true;
    requestJson(`/api/products/${productId}`).then((result) => { if (active) setDetail(result); }).catch((caught) => { if (active) setError(caught.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId]);
  const changeStatus = async (status: string) => {
    try { await requestJson(`/api/products/${productId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); onToast("Product workflow updated."); onRefresh(); const next = await requestJson(`/api/products/${productId}`); setDetail(next); }
    catch (caught) { onToast(caught instanceof Error ? caught.message : "Could not update product.", true); }
  };
  if (loading) return <LoadingPanel label="Loading product history…" />;
  if (error || !detail) return <SectionMessage error={error || "Product not found."} retry={onBack} />;
  const product = detail.product;
  const workflow = detail.workflow || [];
  const files = detail.files || [];
  const versions = detail.contentVersions || [];
  const canChange = ["admin", "account_manager", "production_manager", "photographer", "content_creator"].includes(user.role);
  return <div className="product-detail-view"><div className="detail-back-row"><button type="button" className="subtle-link" onClick={onBack}><Icon name="arrow" size={14} className="back-arrow" />Back to products</button><div className="detail-actions">{isStaff && <button type="button" className="button button-secondary button-small" onClick={() => onOpenModal("upload", { productId, organizationId: product.organizationId })}><Icon name="upload" size={14} />Upload version</button>}{isStaff && <button type="button" className="button button-primary button-small" onClick={() => onOpenModal("content", { id: productId, name: product.name })}><Icon name="file" size={14} />New listing version</button>}</div></div>
    <div className="detail-grid"><div className="detail-column"><section className="detail-card"><div className="detail-title-row"><div><span className="section-label">PRODUCT PROFILE · {product.sku || "SKU NOT SET"}</span><h2>{product.name}</h2><p>{[product.brand, product.category].filter(Boolean).join(" · ") || t("Category not set", "لم يتم تحديد الفئة")}</p></div><Badge status={product.status} /></div><div className="detail-list"><div><span>Marketplace</span><b>{product.targetMarketplace || t("Not selected", "غير محدد")}</b></div><div><span>Product type</span><b>{product.productType || t("Not set", "غير محدد")}</b></div><div><span>Submitted</span><b>{formatDate(product.createdAt, language)}</b></div><div><span>Project</span><b>{product.projectId ? t("Linked project", "مشروع مرتبط") : t("Not linked", "غير مرتبط")}</b></div><div><span>Weight</span><b>{product.weight || t("Not specified", "غير محدد")}</b></div><div><span>Materials</span><b>{product.materials || t("Not specified", "غير محدد")}</b></div></div>{product.description && <div className="product-description"><span className="section-label">DESCRIPTION</span><p>{product.description}</p></div>}{product.clientInstructions && <div className="product-description"><span className="section-label">CLIENT INSTRUCTIONS</span><p>{product.clientInstructions}</p></div>}{isStaff && product.internalNotes && <div className="internal-note"><span className="section-label">INTERNAL NOTE · FLOW ONLY</span><p>{product.internalNotes}</p></div>}</section>
      <section className="detail-card"><div className="section-header"><div><span className="section-label">FILES & VERSIONS</span><h3>Product gallery</h3></div><span className="status-badge">{files.length} version{files.length === 1 ? "" : "s"}</span></div>{files.length ? <div className="file-version-list">{files.map((file: PortalRow) => <div className="file-version-row" key={file.id}><span className="file-tile"><Icon name={file.contentType?.startsWith("image/") ? "camera" : "file"} size={17} /></span><span className="file-version-copy"><b>{file.fileName}</b><small>Version {file.versionNumber} · {formatDate(file.createdAt, language)} · {Math.max(1, Math.round(file.fileSize / 1024))} KB</small></span><Badge status={file.category} /><a className="icon-button" href={`/api/files/${file.id}`} aria-label={`Download ${file.fileName}`}><Icon name="download" size={15} /></a></div>)}</div> : <Empty icon="camera" title={t("No files yet", "لا توجد ملفات حتى الآن")} description={t("Source images and deliverables will appear here as new versions are uploaded.", "ستظهر الصور الأصلية وملفات التسليم هنا عند رفع نسخ جديدة.")} action={isStaff ? () => onOpenModal("upload", { productId, organizationId: product.organizationId }) : undefined} actionLabel={isStaff ? t("Upload a file", "رفع ملف") : undefined} />}</section>
      <section className="detail-card"><div className="section-header"><div><span className="section-label">BILINGUAL LISTING</span><h3>Content versions</h3></div>{isStaff && <button className="subtle-link" type="button" onClick={() => onOpenModal("content", { id: productId, name: product.name })}>Add version <Icon name="plus" size={14} /></button>}</div>{versions.length ? <div className="content-version-list">{versions.map((version: PortalRow) => <article className="content-version" key={version.id}><div className="content-version-head"><b>{version.title}</b><span className="version-language">{version.language === "ar" ? "العربية" : "English"} · v{version.version}</span><Badge status={version.status} /></div>{version.shortDescription && <p>{version.shortDescription}</p>}{version.keywords?.length > 0 && <small>Keywords: {version.keywords.join(" · ")}</small>}</article>)}</div> : <Empty icon="file" title="No listing versions" description="English and Arabic marketplace copy will be versioned here." action={isStaff ? () => onOpenModal("content", { id: productId, name: product.name }) : undefined} actionLabel={isStaff ? "Create listing" : undefined} />}</section>
      </div><aside className="detail-column"><section className="detail-card"><span className="section-label">PRODUCTION FLOW</span><h3>Current workflow</h3><div className="workflow-track">{workflow.map((step: PortalRow) => <div className={`workflow-step ${step.status === "complete" || step.status === "completed" ? "complete" : step.status === "in_progress" ? "current" : ""}`} key={step.id}><span className="workflow-dot"><Icon name={step.status === "complete" || step.status === "completed" ? "check" : "circle"} size={12} /></span><span className="workflow-copy"><b>{step.stageLabel}</b>{step.comment && <span>{step.comment}</span>}</span>{step.completedAt && <time>{formatDate(step.completedAt, language, { day: "numeric", month: "short" })}</time>}</div>)}</div>{canChange && <label className="field-label status-control">Update workflow status<select value={product.status} onChange={(event) => void changeStatus(event.target.value)}>{workflowStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></label>}</section>
      <section className="detail-card"><span className="section-label">WORKSPACE</span><h3>Next steps</h3><p className="detail-help">{user.role === "client" ? "Your product history stays connected to the FLOW team. Approvals and new deliverables appear in your workspace." : "Keep internal notes private and make client-facing stage updates through the recorded workflow."}</p>{isStaff && <button type="button" className="button button-secondary button-small button-block" onClick={() => onOpenModal("upload", { productId, organizationId: product.organizationId })}><Icon name="upload" size={14} />Add a version</button>}</section></aside></div>
  </div>;
}

function ProjectsView({ projects, products, user, language, onOpenModal, onToast, onRefresh }: { projects: PortalRow[]; products: PortalRow[]; user: AuthUserView; language: "en" | "ar"; onOpenModal: Props["onOpenModal"]; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const [layout, setLayout] = useState("list");
  const [selected, setSelected] = useState<PortalRow | null>(null);
  if (selected) return <ProjectDetail project={selected} products={products.filter((product) => product.projectId === selected.id)} user={user} language={language} onBack={() => setSelected(null)} onToast={onToast} onRefresh={onRefresh} onOpenModal={onOpenModal} />;
  const layoutOptions = [["list", "List"], ["board", "Board"], ["timeline", "Timeline"], ["calendar", "Calendar"]];
  return <><div className="toolbar"><div className="toolbar-left"><span className="section-label">{projects.length} PROJECT{projects.length === 1 ? "" : "S"}</span></div><div className="toolbar-right view-switch">{layoutOptions.map(([key, label]) => <button type="button" key={key} className={`view-switch-button ${layout === key ? "active" : ""}`} onClick={() => setLayout(key)}>{label}</button>)}</div></div>{projects.length ? layout === "list" ? <div className="project-card-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} productCount={products.filter((item) => item.projectId === project.id).length} language={language} onClick={() => setSelected(project)} />)}</div> : layout === "board" ? <div className="kanban-board">{["new", "in_progress", "awaiting_approval", "completed"].map((status) => <section key={status} className="kanban-column"><div className="kanban-column-head"><b>{titleCase(status)}</b><span>{projects.filter((project) => project.status === status).length}</span></div>{projects.filter((project) => project.status === status).map((project) => <button type="button" className="kanban-card" key={project.id} onClick={() => setSelected(project)}><b>{project.name}</b><small>{project.projectCode}</small><div className="progress-line"><span style={{ width: `${project.progress || 0}%` }} /></div><span>{products.filter((item) => item.projectId === project.id).length} products · {project.dueDate ? formatDate(project.dueDate, language) : "No deadline"}</span></button>)}</section>)}</div> : layout === "timeline" ? <div className="timeline-board">{projects.map((project) => <button type="button" className="timeline-row" key={project.id} onClick={() => setSelected(project)}><span className="timeline-name"><b>{project.name}</b><small>{project.projectCode}</small></span><span className="timeline-line"><span style={{ width: `${Math.max(5, Number(project.progress || 0))}%` }} /></span><span className="timeline-date">{project.dueDate ? formatDate(project.dueDate, language) : "Date not set"}</span></button>)}</div> : <div className="calendar-grid">{projects.map((project) => <button type="button" className="calendar-project" key={project.id} onClick={() => setSelected(project)}><span className="calendar-date">{project.dueDate ? formatDate(project.dueDate, language, { day: "numeric", month: "short" }) : "No date"}</span><b>{project.name}</b><Badge status={project.status} /></button>)}</div> : <div className="panel"><Empty icon="projects" title="No projects yet" description={user.role === "client" ? "Create a project request and your FLOW account manager will review the scope." : "Create a project for an assigned client to begin tracking production."} action={() => onOpenModal("project")} actionLabel="Create a project" /></div>}</>;
}

function ProjectCard({ project, productCount, language, onClick }: { project: PortalRow; productCount: number; language: "en" | "ar"; onClick: () => void }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  return <button type="button" className="project-card project-card-button" onClick={onClick}><div className="project-card-head"><span><span className="section-label">{project.projectCode}</span><h3>{project.name}</h3></span><Badge status={project.status} /></div><p>{project.description || "A FLOW project workspace."}</p><div className="project-card-meta"><span>Products<b>{productCount}</b></span><span>Deadline<b>{project.dueDate ? formatDate(project.dueDate, language) : t("Not set", "غير محدد")}</b></span><span>Priority<b>{titleCase(project.priority)}</b></span></div><span className="progress-line"><span style={{ width: `${Math.max(0, Math.min(100, Number(project.progress || 0)))}%` }} /></span><div className="project-card-footer"><span>{Number(project.progress || 0)}% complete</span><Icon name="arrow" size={15} /></div></button>;
}

function ProjectDetail({ project, products, user, language, onBack, onToast, onRefresh, onOpenModal }: { project: PortalRow; products: PortalRow[]; user: AuthUserView; language: "en" | "ar"; onBack: () => void; onToast: Props["onToast"]; onRefresh: Props["onRefresh"]; onOpenModal: Props["onOpenModal"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const [status, setStatus] = useState(project.status);
  const [progress, setProgress] = useState(Number(project.progress || 0));
  const canManage = ["admin", "account_manager", "production_manager"].includes(user.role);
  const update = async (body: PortalRow) => {
    try { const result = await requestJson(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); setStatus(result.project.status); setProgress(result.project.progress); onToast("Project updated."); onRefresh(); }
    catch (error) { onToast(error instanceof Error ? error.message : "Could not update project.", true); }
  };
  return <div><div className="detail-back-row"><button type="button" className="subtle-link" onClick={onBack}><Icon name="arrow" size={14} className="back-arrow" />Back to projects</button>{canManage && <button type="button" className="button button-secondary button-small" onClick={() => onOpenModal("upload", { organizationId: project.organizationId, projectId: project.id })}><Icon name="upload" size={14} />Upload files</button>}</div><div className="detail-grid"><div className="detail-column"><section className="detail-card"><span className="section-label">{project.projectCode} · PROJECT OVERVIEW</span><h2 className="detail-main-title">{project.name}</h2><p>{project.description || "No description provided."}</p><div className="detail-list"><div><span>Current status</span><Badge status={status} /></div><div><span>Priority</span><b>{titleCase(project.priority)}</b></div><div><span>Start date</span><b>{formatDate(project.startDate, language)}</b></div><div><span>Expected delivery</span><b>{formatDate(project.dueDate, language)}</b></div><div><span>Products</span><b>{products.length}</b></div><div><span>Created</span><b>{formatDate(project.createdAt, language)}</b></div></div></section><section className="detail-card"><div className="section-header"><div><span className="section-label">PROJECT CATALOG</span><h3>Products in this project</h3></div>{canManage && <button type="button" className="subtle-link" onClick={() => onOpenModal("product", { projectId: project.id, organizationId: project.organizationId })}>Add product <Icon name="plus" size={14} /></button>}</div>{products.length ? products.map((product) => <div className="pending-row" key={product.id}><div className="pending-row-copy"><b>{product.name}</b><span>{product.sku || t("SKU not set", "لم يتم تحديد SKU")} · {titleCase(product.status)}</span></div><Badge status={product.status} /></div>) : <Empty icon="products" title="No products linked" description="Products assigned to this project will appear here." />}</section></div><aside className="detail-column"><section className="detail-card"><span className="section-label">PROJECT HEALTH</span><h3>Progress</h3><div className="large-progress"><span>{progress}%</span><div className="progress-line"><span style={{ width: `${progress}%` }} /></div><small>Set by the FLOW team as work moves through production.</small></div>{canManage && <label className="field-label status-control">Update progress<input type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} onMouseUp={() => void update({ progress })} onTouchEnd={() => void update({ progress })} /></label>}{canManage && <label className="field-label status-control">Project status<select value={status} onChange={(event) => { setStatus(event.target.value); void update({ status: event.target.value }); }}>{projectStatuses.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select></label>}</section></aside></div></div>;
}

function ProductionView({ products, user, language, onOpenModal, onToast, onRefresh, onNavigate }: { products: PortalRow[]; user: AuthUserView; language: "en" | "ar"; onOpenModal: Props["onOpenModal"]; onToast: Props["onToast"]; onRefresh: Props["onRefresh"]; onNavigate: Props["onNavigate"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const staff = user.role !== "client";
  const buckets = ["submitted", "photography_scheduled", "photography_in_progress", "image_editing", "content_creation", "internal_quality_review", "awaiting_client_approval", "revision_requested", "ready_for_publishing", "completed"];
  const filtered = products.filter((product) => buckets.includes(product.status));
  const update = async (product: PortalRow, status: string) => {
    try { await requestJson(`/api/products/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); onToast(`Workflow updated for ${product.name}.`); onRefresh(); }
    catch (error) { onToast(error instanceof Error ? error.message : "Could not update workflow.", true); }
  };
  return <><div className="production-summary-strip">{["Photography", "Content", "Review", "Complete"].map((label, index) => { const group = ["photography_scheduled", "photography_in_progress", "image_editing"].includes(label.toLowerCase()) ? [] : []; const count = index === 0 ? products.filter((item) => ["photography_scheduled", "photography_in_progress", "image_editing"].includes(item.status)).length : index === 1 ? products.filter((item) => item.status === "content_creation").length : index === 2 ? products.filter((item) => item.status === "awaiting_client_approval").length : products.filter((item) => item.status === "completed").length; return <div className="production-summary-card" key={label}><span>{label}</span><b>{count}</b></div>; })}</div><div className="toolbar"><div className="toolbar-left"><span className="section-label">{filtered.length} PRODUCTS IN THE WORKFLOW</span></div><div className="toolbar-right"><button type="button" className="button button-secondary button-small" onClick={() => onNavigate("photography")}><Icon name="camera" size={14} />Photography</button><button type="button" className="button button-secondary button-small" onClick={() => onNavigate("content")}><Icon name="file" size={14} />Content studio</button></div></div>{filtered.length ? <div className="panel data-table-wrap"><table className="data-table"><thead><tr><th>Product</th><th>Stage</th><th>Marketplace</th><th>Updated</th><th>Progress</th><th>Update</th></tr></thead><tbody>{filtered.map((product) => { const index = workflowStatuses.indexOf(product.status); const progress = index < 0 ? 0 : Math.round(((index + 1) / workflowStatuses.length) * 100); return <tr key={product.id}><td><span className="table-primary">{product.name}</span><span className="table-secondary">{product.sku || t("SKU not set", "لم يتم تحديد SKU")}</span></td><td><Badge status={product.status} /></td><td>{product.targetMarketplace || "—"}</td><td>{formatDate(product.updatedAt || product.createdAt, language)}</td><td><div className="progress-cell"><span className="progress-line"><span style={{ width: `${progress}%` }} /></span><small>{progress}%</small></div></td><td>{staff ? <select className="table-status-select" value={product.status} onChange={(event) => void update(product, event.target.value)} aria-label={`Set status for ${product.name}`}>{workflowStatuses.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select> : <span className="table-secondary">FLOW update</span>}</td></tr>; })}</tbody></table></div> : <div className="panel"><Empty icon="production" title="No products in production" description="As products are submitted, their real workflow stage will appear in this board." action={() => onOpenModal("product")} actionLabel="Add a product" /></div>}</>;
}

function PhotographyView({ products, user, language, onOpenModal, onNavigate }: { products: PortalRow[]; user: AuthUserView; language: "en" | "ar"; onOpenModal: Props["onOpenModal"]; onNavigate: Props["onNavigate"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const photo = products.filter((product) => ["photography_scheduled", "photography_in_progress", "image_editing", "awaiting_client_approval", "revision_requested", "completed"].includes(product.status));
  return <><div className="photography-note"><span className="photography-note-mark"><Icon name="camera" size={18} /></span><span><b>Originals and approved edits remain versioned separately.</b><small>Use product details to compare file versions, download approved images or upload a new revision. FLOW does not overwrite a version a client has approved.</small></span></div><div className="toolbar"><span className="section-label">{photo.length} PHOTOGRAPHY ITEMS</span><button type="button" className="button button-secondary button-small" onClick={() => onNavigate("products")}><Icon name="products" size={14} />Browse product catalog</button></div>{photo.length ? <div className="product-card-grid">{photo.map((product) => <article className="product-card" key={product.id}><div className="photo-product-visual"><span className="product-placeholder-icon"><Icon name="camera" size={19} /></span><Badge status={product.status} /></div><div className="product-card-content"><h3>{product.name}</h3><p>{product.sku || t("SKU not set", "لم يتم تحديد SKU")} · {product.targetMarketplace || "Marketplace not selected"}</p><div className="product-card-footer"><span>{formatDate(product.updatedAt || product.createdAt, language)}</span><button type="button" className="subtle-link" onClick={() => onNavigate("products")}>Open product <Icon name="arrow" size={13} /></button></div></div></article>)}</div> : <div className="panel"><Empty icon="camera" title="No photography tasks yet" description="Products scheduled for photography and their image versions will appear here." action={() => onNavigate("products")} actionLabel="View products" /></div>}</>;
}

function ContentView({ products, user, language, onOpenModal, onToast, onRefresh }: { products: PortalRow[]; user: AuthUserView; language: "en" | "ar"; onOpenModal: Props["onOpenModal"]; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const contentProducts = products;
  return <><div className="content-language-banner" dir={language === "ar" ? "rtl" : "ltr"}><span className="language-pair"><b>EN</b><i>+</i><b>ع</b></span><span><b>{t("Arabic and English, managed separately.", "العربية والإنجليزية، كل لغة تُدار بشكل مستقل.")}</b><small>{t("Each language has its own listing version, keywords, history and approval status.", "لكل لغة نسخة مستقلة من المحتوى والكلمات المفتاحية وسجل التعديلات وحالة الموافقة.")}</small></span><Badge status={t("Bilingual", "ثنائي اللغة")} /></div><div className="section-header"><div><span className="section-label">{t("PRODUCT CONTENT", "محتوى المنتجات")}</span><h2 className="section-title">{t("Listing content workspace", "مساحة محتوى قوائم المنتجات")}</h2></div><span className="status-badge">{contentProducts.length} {t("products", "منتج")}</span></div>{contentProducts.length ? <div className="content-workspace-list">{contentProducts.map((product) => <ContentProduct key={product.id} product={product} user={user} language={language} onOpenModal={onOpenModal} onToast={onToast} onRefresh={onRefresh} />)}</div> : <div className="panel"><Empty icon="file" title={t("No products in your catalog yet", "لا توجد منتجات في الكتالوج حتى الآن")} description={t("Add or import products first. They will appear here so you can create Arabic and English listing content.", "أضيفي المنتجات أو استورديها أولًا، وستظهر هنا لإنشاء محتوى القوائم بالعربية والإنجليزية.")} /></div>}</>;
}

function ContentProduct({ product, user, language, onOpenModal, onToast, onRefresh }: { product: PortalRow; user: AuthUserView; language: "en" | "ar"; onOpenModal: Props["onOpenModal"]; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const [versions, setVersions] = useState<PortalRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const canEdit = ["admin", "account_manager", "content_creator", "production_manager"].includes(user.role);
  const [generating, setGenerating] = useState(false);
  const [autoGenerationAttempted, setAutoGenerationAttempted] = useState(false);
  const generateBilingual = async () => {
    setGenerating(true);
    try {
      const result = await requestJson<{ generated: Record<"en" | "ar", PortalRow> }>(`/api/products/${product.id}/content/generate`, { method: "POST" });
      for (const locale of ["en", "ar"] as const) {
        const version = result.generated[locale];
        await requestJson(`/api/products/${product.id}/content`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: locale, title: version.title, shortDescription: version.shortDescription, fullDescription: version.fullDescription, bulletPoints: version.bulletPoints, keywords: version.keywords, status: "draft" }) });
      }
      onToast(t("Arabic and English drafts generated and saved. Review before approval.", "تم إنشاء وحفظ مسودتي العربية والإنجليزية. راجعيهما قبل الاعتماد."));
      const refreshed = await requestJson<{ versions: PortalRow[] }>(`/api/products/${product.id}/content`);
      setVersions(refreshed.versions);
      setExpanded(true);
      onRefresh();
    } catch (error) { onToast(error instanceof Error ? error.message : t("Could not generate listing content.", "تعذر إنشاء محتوى المنتج."), true); }
    finally { setGenerating(false); }
  };
  useEffect(() => {
    let active = true;
    if (!canEdit || autoGenerationAttempted) return () => { active = false; };
    setAutoGenerationAttempted(true);
    requestJson<{ versions: PortalRow[] }>(`/api/products/${product.id}/content`)
      .then(async (result) => {
        if (!active) return;
        setVersions(result.versions);
        if (!result.versions.length) await generateBilingual();
      })
      .catch((error) => { if (active) onToast(error instanceof Error ? error.message : "Could not load listing versions.", true); });
    return () => { active = false; };
  }, [product.id]);
  const marketplaceNames = Array.isArray(product.targetMarketplaces) ? product.targetMarketplaces.join(" · ") : product.targetMarketplace || t("Marketplace not selected", "لم يتم اختيار منصة");
  return <article className="content-product-card" dir={language === "ar" ? "rtl" : "ltr"}><div className="content-product-head"><span className="content-product-icon"><Icon name="file" size={18} /></span><span className="content-product-name"><b>{product.name}</b><small>{product.sku || t("SKU not set", "لم يتم تحديد SKU")} · {marketplaceNames}</small></span><Badge status={product.status} /><button type="button" className="icon-button" aria-label={t("Open content versions", "فتح نسخ المحتوى")} title={t("Open content versions", "فتح نسخ المحتوى")} onClick={() => setExpanded((current) => !current)}><Icon name="chevron" size={16} /></button></div>{expanded && <div className="content-product-expanded">{canEdit && <button type="button" className="button button-primary button-small" disabled={generating} onClick={() => void generateBilingual()}><Icon name="check" size={14} />{generating ? t("Generating Arabic + English…", "جارٍ إنشاء العربية والإنجليزية…") : t("Generate both languages with AI", "إنشاء النسختين بالذكاء الاصطناعي")}</button>}{versions.length ? versions.map((version) => <div className="content-preview" key={version.id} dir={version.language === "ar" ? "rtl" : "ltr"}><div className="content-version-head"><b>{version.title}</b><span className="version-language">{version.language === "ar" ? t("Arabic", "العربية") : t("English", "الإنجليزية")} · v{version.version}</span><Badge status={version.status} /></div>{version.shortDescription && <p>{version.shortDescription}</p>}{version.fullDescription && <details><summary>{t("Full description", "الوصف الكامل")}</summary><p>{version.fullDescription}</p></details>}{version.bulletPoints?.length > 0 && <ul>{version.bulletPoints.map((item: string, index: number) => <li key={index}>{item}</li>)}</ul>}{version.keywords?.length > 0 && <small>{t("Keywords", "الكلمات المفتاحية")}: {version.keywords.join(" · ")}</small>}</div>) : <p className="empty-inline">{t("No saved versions yet. Generate both languages automatically.", "لا توجد نسخ محفوظة حتى الآن. أنشئي النسختين تلقائيًا.")}</p>}{canEdit && <button type="button" className="button button-secondary button-small" onClick={() => onOpenModal("content", { id: product.id, name: product.name })}><Icon name="plus" size={14} />{t("Create language version", "إنشاء نسخة لغوية")}</button>}</div>}</article>;
}

function ApprovalsView({ approvals, user, language, onToast, onRefresh }: { approvals: PortalRow[]; user: AuthUserView; language: "en" | "ar"; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const [revisionId, setRevisionId] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [busyId, setBusyId] = useState("");
  const answer = async (id: string, status: string, note?: string) => {
    setBusyId(id);
    try {
      await requestJson(`/api/approvals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, note }) });
      onToast(status === "approved" ? "Approval recorded. Thank you." : "Revision request sent to FLOW.");
      setRevisionId(""); setRevisionNote(""); onRefresh();
    } catch (error) { onToast(error instanceof Error ? error.message : "Could not update approval.", true); }
    finally { setBusyId(""); }
  };
  const pending = approvals.filter((item) => item.approval.status === "pending");
  const history = approvals.filter((item) => item.approval.status !== "pending");
  return <><section className="approval-intro"><span className="approval-intro-icon"><Icon name="approvals" size={19} /></span><span><b>Client approvals are recorded, not overwritten.</b><small>Approving moves the product workflow forward. A revision request remains attached to this approval’s history.</small></span><span className="approval-count">{pending.length}<small>waiting</small></span></section><div className="section-header"><div><span className="section-label">CLIENT REVIEW</span><h2 className="section-title">Waiting for your response</h2></div></div>{pending.length ? <div className="approval-grid">{pending.map((item) => { const approval = item.approval; return <article className="approval-card" key={approval.id}><div className="approval-card-top"><span className="approval-type-icon"><Icon name={approval.approvalType === "photography" ? "camera" : approval.approvalType === "content" ? "file" : "folder"} size={17} /></span><Badge status={approval.approvalType} /></div><h3>{approval.title}</h3><p>{item.productName ? `Product · ${item.productName}` : "FLOW deliverable"}</p><div className="approval-meta"><span>Requested {formatDate(approval.requestedAt, language)}</span><span>By FLOW team</span></div>{revisionId === approval.id && <div className="revision-form"><label className="field-label">What would you like changed?<textarea rows={3} value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} placeholder="Add clear, specific feedback…" /></label><div className="inline-actions"><button type="button" className="button button-secondary button-small" onClick={() => { setRevisionId(""); setRevisionNote(""); }}>Cancel</button><button type="button" className="button button-primary button-small" disabled={!revisionNote.trim() || busyId === approval.id} onClick={() => void answer(approval.id, "revision_requested", revisionNote)}>Send revision</button></div></div>}{user.role === "client" ? <div className="approval-actions"><button type="button" className="button button-secondary button-small" onClick={() => { setRevisionId(approval.id); setRevisionNote(""); }}>Request revision</button><button type="button" className="button button-primary button-small" disabled={busyId === approval.id} onClick={() => void answer(approval.id, "approved")}>Approve <Icon name="check" size={14} /></button></div> : <p className="approval-staff-note">Awaiting the client’s response</p>}</article>; })}</div> : <div className="panel"><Empty icon="check" title="No approvals waiting" description="When the FLOW team submits photography or listing work for review, it will appear here." /></div>}{history.length > 0 && <section className="panel panel-pad approval-history"><div className="section-header"><div><span className="section-label">REVIEW HISTORY</span><h2 className="section-title">Previous decisions</h2></div></div>{history.map((item) => <div className="pending-row" key={item.approval.id}><div className="pending-row-copy"><b>{item.approval.title}</b><span>{item.productName || "Deliverable"} · {formatDate(item.approval.respondedAt, language)}{item.approval.clientNote ? ` · “${item.approval.clientNote}”` : ""}</span></div><Badge status={item.approval.status} /></div>)}</section>}</>;
}

function ServicesView({ catalog, requests, user, language, onOpenModal, onToast, onRefresh }: { catalog: PortalRow[]; requests: PortalRow[]; user: AuthUserView; language: "en" | "ar"; onOpenModal: Props["onOpenModal"]; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const serviceIcon = (slug: string): IconName => slug.includes("photo") ? "camera" : slug.includes("listing") ? "file" : "marketplace";
  return <><div className="service-catalog-banner"><span className="service-catalog-banner-icon"><Icon name="spark" size={18} /></span><span><b>FLOW’s verified service catalog</b><small>Pricing shown is a public reference only. Your account manager confirms the final scope, terms and quote before work begins.</small></span></div><div className="section-header"><div><span className="section-label">WHAT WE DO</span><h2 className="section-title">Services for your marketplace flow</h2></div></div>{catalog.length ? <div className="service-catalog-grid">{catalog.map((service) => <article className="service-card" key={service.id}><div className="service-card-top"><span className="service-card-icon"><Icon name={serviceIcon(service.slug)} size={18} /></span><Badge status="Available" /></div><h3>{service.name}</h3><p>{service.description}</p>{service.price !== null && <div className="service-price">{formatMoney(service.price, service.currency || "EGP", language)}<small>{service.unitType === "per_item" ? "per item" : service.unitType === "monthly" ? "per month · starting reference" : service.unitType}</small></div>}<small className="reference-note">{service.priceLabel || "Quote confirmed by FLOW"}</small><button type="button" className="button button-secondary button-small" onClick={() => onOpenModal("service", { serviceId: service.id })}>Request this service <Icon name="arrow" size={14} /></button></article>)}</div> : <div className="panel"><Empty icon="services" title="Service catalog is not configured" description="Ask a FLOW administrator to enable the verified services offered by the agency." /></div>}<section className="panel panel-pad service-request-history"><div className="section-header"><div><span className="section-label">YOUR WORKSPACE</span><h2 className="section-title">Service requests</h2></div><span className="status-badge">{requests.length} total</span></div>{requests.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Request</th><th>Products</th><th>Status</th><th>Deadline</th><th>Estimate</th></tr></thead><tbody>{requests.map((request) => <tr key={request.id}><td><span className="table-primary">{request.projectName}</span><span className="table-secondary">{request.targetMarketplace || "Marketplace not set"}</span></td><td>{request.productQuantity}</td><td><Badge status={request.status} /></td><td>{request.desiredDeadline ? formatDate(request.desiredDeadline, language) : t("Not set", "غير محدد")}</td><td>{request.estimatedCost === null ? "Awaiting FLOW quote" : formatMoney(request.estimatedCost, "EGP", language)}</td></tr>)}</tbody></table></div> : <Empty icon="services" title="No service requests yet" description="Your request history and FLOW’s confirmed estimates will be listed here." />}</section></>;
}

function MarketplaceView({ data, user, language }: { data: PortalRow; user: AuthUserView; language: "en" | "ar"; onOpenModal: Props["onOpenModal"]; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const marketplaces = data.marketplaces || [];
  const listings = data.listings || [];
  const statuses = ["not_published", "draft", "ready_for_publishing", "pending", "published", "rejected", "needs_attention"];
  const counts = statuses.map((status) => ({ status, count: listings.filter((entry: PortalRow) => entry.listing.status === status).length })).filter((item) => item.count > 0);
  const attentionCount = listings.filter((entry: PortalRow) => ["rejected", "needs_attention"].includes(entry.listing.status) || Boolean(entry.listing.errorMessage)).length;
  const publishedCount = listings.filter((entry: PortalRow) => entry.listing.status === "published").length;
  const draftCount = listings.filter((entry: PortalRow) => ["draft", "not_published", "ready_for_publishing"].includes(entry.listing.status)).length;
  return <><div className="marketplace-disclaimer"><Icon name="shield" size={15} /><span><b>Automated listing records.</b> FLOW tracks a separate record for every selected marketplace. Manual listing creation and status edits are disabled. Live publishing and status synchronization require each marketplace API to be authorized and tested.</span></div><div className="marketplace-grid">{marketplaces.map((marketplace: PortalRow) => <article className="marketplace-card" key={marketplace.id}><div className="marketplace-card-head"><b className={"marketplace-logo-text marketplace-" + marketplace.slug}>{marketplace.name}</b><Badge status={marketplace.connectionStatus || "not_connected"} /></div><p>{marketplace.connectionStatus === "connected" ? "Verified account connection." : "API connection is not configured yet."}</p><span className="marketplace-connection-note"><Icon name="link" size={13} />{marketplace.account?.displayName || "Awaiting secure account authorization"}</span></article>)}</div><section className="listing-ops-grid">
    <article className="listing-ops-card"><span className="listing-ops-icon"><Icon name="file" size={17} /></span><span className="section-label">LISTING QUEUE</span><b>{draftCount}</b><small>Draft or waiting for publication</small></article>
    <article className="listing-ops-card"><span className="listing-ops-icon"><Icon name="check" size={17} /></span><span className="section-label">PUBLISHED</span><b>{publishedCount}</b><small>Confirmed published records</small></article>
    <article className={`listing-ops-card ${attentionCount ? "needs-attention" : ""}`}><span className="listing-ops-icon"><Icon name="shield" size={17} /></span><span className="section-label">LISTING HEALTH</span><b>{attentionCount}</b><small>Rejected or error records to review</small></article>
  </section><section className="panel panel-pad marketplace-listings-panel"><div className="section-header"><div><span className="section-label">LISTING PIPELINE</span><h2 className="section-title">Marketplace tracking & error center</h2></div><span className="status-badge">{listings.length} records</span></div>{counts.length > 0 && <div className="billing-summary">{counts.map((item) => <div className="billing-metric" key={item.status}><span>{titleCase(item.status)}</span><b>{item.count}</b></div>)}</div>}{listings.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Product</th><th>Marketplace</th><th>Pipeline status</th><th>Listing ID</th><th>Last update</th><th>Product link</th></tr></thead><tbody>{listings.map((entry: PortalRow) => <tr key={entry.listing.id}><td>{entry.productName}</td><td>{entry.marketplaceName}</td><td><Badge status={entry.listing.status} />{entry.listing.errorMessage && <span className="table-secondary">{entry.listing.errorMessage}</span>}</td><td>{entry.listing.listingId || "—"}</td><td>{formatDate(entry.listing.updatedAt, language)}</td><td>{entry.listing.listingUrl ? <a href={entry.listing.listingUrl} target="_blank" rel="noreferrer" className="subtle-link">Open <Icon name="external" size={13} /></a> : "Awaiting API sync"}</td></tr>)}</tbody></table></div> : <Empty icon="marketplace" title="No marketplace tasks yet" description="Product tracking will appear here for each selected marketplace." />}<p className="module-footnote">Manual listing creation and status changes are disabled. Automatic publishing and live status updates require official API access for the client seller account; no account is shown as connected until verification succeeds.</p></section></>;
}
function BillingView({ invoices, payments, user, language, onOpenModal, onToast, onRefresh }: { invoices: PortalRow[]; payments: PortalRow[]; user: AuthUserView; language: "en" | "ar"; onOpenModal: Props["onOpenModal"]; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const [selected, setSelected] = useState<PortalRow | null>(null);
  const outstanding = invoices.filter((invoice) => ["unpaid", "partially_paid", "pending"].includes(invoice.status)).reduce((sum, invoice) => sum + Math.max(0, Number(invoice.total) - Number(invoice.amountPaid)), 0);
  const paid = invoices.reduce((sum, invoice) => sum + Number(invoice.amountPaid || 0), 0);
  const admin = user.role === "admin";
  if (selected) return <div className="invoice-detail-page"><div className="detail-back-row print-hide"><button type="button" className="subtle-link" onClick={() => setSelected(null)}><Icon name="arrow" size={14} className="back-arrow" />Back to invoices</button><button type="button" className="button button-secondary button-small" onClick={() => window.print()}><Icon name="download" size={14} />Print / save PDF</button><button type="button" className="button button-secondary button-small" onClick={() => { const phone = String(selected.organization?.phone || "").replace(/[^0-9]/g, "").replace(/^0/, "20"); const balance = Math.max(0, Number(selected.total) - Number(selected.amountPaid)); const message = `Hello ${selected.organization?.contactPerson || ""}, your FLOW invoice ${selected.invoiceNumber} is ready. Total: ${formatMoney(selected.total, selected.currency, "en")}. Balance due: ${formatMoney(balance, selected.currency, "en")}.`; const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`; window.open(url, "_blank", "noopener,noreferrer"); }}><Icon name="messages" size={14} />WhatsApp invoice</button>{admin && selected.status !== "paid" && <button type="button" className="button button-primary button-small" onClick={() => onOpenModal("payment", selected)}>Record verified payment</button>}</div><div className="invoice-print"><div className="invoice-print-head"><img className="flow-lockup" src="https://www.flow-agency-eg.com/assets/logo/flow-lockup-green.png" alt="FLOW Agency" /><span><b>INVOICE</b><small>{selected.invoiceNumber}</small></span></div><div className="invoice-print-meta"><div><span>BILL TO</span><b>{selected.organization?.companyName || selected.companyName || "Client workspace"}</b><small>{selected.organization?.contactPerson || "FLOW client"}</small></div><div><span>ISSUED</span><b>{formatDate(selected.issueDate, language)}</b><span>DUE</span><b>{selected.dueDate ? formatDate(selected.dueDate, language) : "Upon receipt"}</b></div></div><table className="data-table invoice-line-table"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{(selected.items || []).map((item: PortalRow) => <tr key={item.id}><td>{item.description}</td><td>{item.quantity}</td><td>{formatMoney(item.unitPrice, selected.currency, language)}</td><td>{formatMoney(item.lineTotal, selected.currency, language)}</td></tr>)}</tbody></table><div className="invoice-totals"><div><span>Subtotal</span><b>{formatMoney(selected.subtotal, selected.currency, language)}</b></div><div><span>Discount</span><b>− {formatMoney(selected.discount, selected.currency, language)}</b></div><div><span>Tax</span><b>{formatMoney(selected.tax, selected.currency, language)}</b></div><div className="invoice-grand-total"><span>Total</span><b>{formatMoney(selected.total, selected.currency, language)}</b></div><div><span>Amount paid</span><b>{formatMoney(selected.amountPaid, selected.currency, language)}</b></div><div className="invoice-balance"><span>Balance due</span><b>{formatMoney(Math.max(0, Number(selected.total) - Number(selected.amountPaid)), selected.currency, language)}</b></div></div>{selected.notes && <p className="invoice-note">{selected.notes}</p>}<div className="invoice-print-footer">FLOW Agency · E-commerce content & marketplace operations · Egypt<br />Payment status is updated only after FLOW verifies the payment.</div></div><div className="panel panel-pad payment-history"><div className="section-header"><div><span className="section-label">RECONCILIATION</span><h2 className="section-title">Payment history</h2></div></div>{payments.filter((payment) => payment.invoiceId === selected.id).length ? payments.filter((payment) => payment.invoiceId === selected.id).map((payment) => <div className="pending-row" key={payment.id}><div className="pending-row-copy"><b>{formatMoney(payment.amount, payment.currency, language)} · {titleCase(payment.method)}</b><span>{formatDate(payment.paidAt || payment.createdAt, language)} · {payment.reference || "Reference not entered"}</span></div><Badge status={payment.status} /></div>) : <p className="empty-inline">No verified payments have been recorded for this invoice.</p>}</div></div>;
  return <><div className="billing-summary"><div className="billing-metric"><span>Open invoices</span><b>{invoices.filter((invoice) => ["unpaid", "partially_paid", "pending"].includes(invoice.status)).length}</b></div><div className="billing-metric"><span>Outstanding balance</span><b>{formatMoney(outstanding, "EGP", language)}</b></div><div className="billing-metric"><span>Payments recorded</span><b>{formatMoney(paid, "EGP", language)}</b></div></div><div className="panel data-table-wrap">{invoices.length ? <table className="data-table"><thead><tr><th>Invoice</th><th>Issue date</th><th>Due date</th><th>Total</th><th>Balance</th><th>Status</th><th /></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><button type="button" className="table-primary table-button" onClick={() => setSelected(invoice)}>{invoice.invoiceNumber}</button><span className="table-secondary">{invoice.items?.length || 0} line item{invoice.items?.length === 1 ? "" : "s"}</span></td><td>{formatDate(invoice.issueDate, language)}</td><td>{invoice.dueDate ? formatDate(invoice.dueDate, language) : "—"}</td><td><b>{formatMoney(invoice.total, invoice.currency, language)}</b></td><td>{formatMoney(Math.max(0, Number(invoice.total) - Number(invoice.amountPaid)), invoice.currency, language)}</td><td><Badge status={invoice.status} /></td><td><button type="button" className="icon-button" onClick={() => setSelected(invoice)} aria-label="Open invoice"><Icon name="arrow" size={15} /></button></td></tr>)}</tbody></table> : <Empty icon="billing" title="No invoices have been issued" description={admin ? "Create an invoice for a client. Amounts are calculated and validated on the server." : "FLOW invoices will appear here once issued to your workspace."} action={admin ? () => onOpenModal("invoice") : undefined} actionLabel={admin ? "Create invoice" : undefined} />}</div><p className="module-footnote">No payment gateway is connected. Payments shown here are recorded by FLOW only after trusted, manual reconciliation.</p></>;
}

function PaymentsView({ payments, language }: { payments: PortalRow[]; language: "en" | "ar" }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  return <div className="panel data-table-wrap">{payments.length ? <table className="data-table"><thead><tr><th>Invoice</th><th>Amount</th><th>Method</th><th>Reference</th><th>Verified</th><th>Status</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.invoiceId}</td><td><b>{formatMoney(payment.amount, payment.currency, language)}</b></td><td>{titleCase(payment.method)}</td><td>{payment.reference || "—"}</td><td>{formatDate(payment.paidAt || payment.createdAt, language)}</td><td><Badge status={payment.status} /></td></tr>)}</tbody></table> : <Empty icon="billing" title="No payment records" description="Only payments verified by the FLOW team are recorded here." />}</div>;
}

function MessagesView({ conversations, user, language, onToast, onRefresh }: { conversations: PortalRow[]; user: AuthUserView; language: "en" | "ar"; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const [conversationId, setConversationId] = useState("");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [thread, setThread] = useState<PortalRow | null>(null);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newConversation, setNewConversation] = useState(false);
  const [subject, setSubject] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const active = conversations.find((item) => item.id === conversationId) || conversations[0];

  useEffect(() => {
    if (active && active.id !== conversationId) setConversationId(active.id);
  }, [active, conversationId]);
  useEffect(() => {
    if (!conversationId) { setThread(null); return; }
    let current = true;
    requestJson(`/api/messages/${conversationId}`).then((result) => { if (current) setThread(result); }).catch((error) => onToast(error.message, true));
    return () => { current = false; };
  }, [conversationId, onToast, conversations.length]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const payload: PortalRow = { body: body.trim(), fileIds: attachmentIds, isInternal: internal };
      let nextConversationId = conversationId;
      if (newConversation || !conversationId) {
        payload.subject = subject.trim() || "Client support";
        if (user.role !== "client") payload.organizationId = workspaceId;
        if (projectId) payload.projectId = projectId;
        const result = await requestJson<{ message: PortalRow }>("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        nextConversationId = result.message.conversationId;
        setConversationId(nextConversationId);
        setNewConversation(false);
      } else {
        await requestJson(`/api/messages/${conversationId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setBody(""); setAttachmentIds([]); setInternal(false); onToast(internal ? "Internal note saved for FLOW staff." : "Message sent."); onRefresh();
      if (nextConversationId) {
        const result = await requestJson(`/api/messages/${nextConversationId}`);
        setThread(result);
      }
    } catch (error) { onToast(error instanceof Error ? error.message : "Message could not be sent.", true); }
    finally { setBusy(false); }
  };

  const attachFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const form = new FormData(); form.set("file", file); form.set("category", "document"); form.set("clientVisible", "true");
      const orgId = user.organizationId || active?.organizationId || workspaceId;
      if (user.role !== "client" && orgId) form.set("organizationId", orgId);
      const response = await fetch("/api/files", { method: "POST", body: form, cache: "no-store" });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "File upload failed.");
      setAttachmentIds((current) => [...current, result.file.id]); onToast(`${file.name} uploaded and attached.`);
    } catch (error) { onToast(error instanceof Error ? error.message : "File upload failed.", true); }
    finally { setUploading(false); event.target.value = ""; }
  };

  const messages = thread?.messages || [];
  const rtl = language === "ar";
  return <div className={`conversation-layout ${mobileThreadOpen ? "mobile-thread-open" : ""}`} dir={rtl ? "rtl" : "ltr"}>
    <aside className="conversation-list" aria-label={t("Conversation list", "قائمة المحادثات")}>
      <div className="conversation-list-head">
        <b>{t("Conversations", "المحادثات")}</b>
        <button type="button" className="icon-button" aria-label={t("New conversation", "محادثة جديدة")} title={t("New conversation", "محادثة جديدة")} onClick={() => { setNewConversation(true); setMobileThreadOpen(true); setConversationId(""); setThread(null); setBody(""); setSubject(""); setWorkspaceId(""); setProjectId(""); setAttachmentIds([]); }}>
          <Icon name="plus" size={16} />
        </button>
      </div>
      {conversations.map((conversation) => <button type="button" key={conversation.id} className={`conversation-item ${conversation.id === conversationId && !newConversation ? "active" : ""}`} onClick={() => { setConversationId(conversation.id); setNewConversation(false); setMobileThreadOpen(true); setAttachmentIds([]); }}>
        <b>{conversation.subject}</b>
        <span>{conversation.lastMessage?.body || t("No messages yet", "لا توجد رسائل بعد")}</span>
        {conversation.unreadCount > 0 && <small className="conversation-unread">{conversation.unreadCount} {t("unread", "غير مقروءة")}</small>}
      </button>)}
      {!conversations.length && !newConversation && <div className="empty-inline conversation-empty">{t("No conversations yet.", "لا توجد محادثات حتى الآن.")}</div>}
    </aside>
    <section className={`conversation-thread ${newConversation ? "new-conversation-active" : ""}`}>
      <header className="thread-head">
        <button type="button" className="conversation-back-button" onClick={() => setMobileThreadOpen(false)}><Icon name="arrow" size={14} />{t("Conversations", "المحادثات")}</button>
        <div className="thread-head-copy"><b>{newConversation ? t("New conversation", "محادثة جديدة") : active?.subject || t("Select a conversation", "اختاري محادثة")}</b>
        <span>{newConversation ? t("Send a message to start a FLOW conversation.", "ابعتي رسالة لبدء محادثة مع FLOW.") : active?.projectId ? t("Linked to a project", "مرتبطة بمشروع") : t("FLOW account support", "دعم حساب FLOW")}</span></div>
      </header>
      {newConversation && user.role !== "client" && <div className="conversation-new-fields">
        <label className="field-label">{t("Workspace ID", "رقم مساحة العمل")}<input value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} placeholder={t("Client workspace ID", "رقم مساحة عمل العميل")} /></label>
        <label className="field-label">{t("Subject", "الموضوع")}<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={t("Conversation subject", "موضوع المحادثة")} /></label>
      </div>}
      {newConversation && user.role === "client" && <div className="conversation-new-fields">
        <label className="field-label">{t("Subject", "الموضوع")}<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={t("How can FLOW help?", "إزاي نقدر نساعدك؟")} /></label>
      </div>}
      <div className="thread-messages" aria-live="polite">
        {messages.length ? messages.map((message: PortalRow) => <article className={`message-bubble ${message.senderId === user.id ? "mine" : ""} ${message.isInternal ? "internal-message" : ""}`} key={message.id}>
          {message.isInternal && <span className="internal-message-label">{t("FLOW ONLY · INTERNAL NOTE", "لفريق FLOW فقط · ملاحظة داخلية")}</span>}
          {message.body}
          <small>{message.senderName || (message.senderId === user.id ? t("You", "أنتِ") : t("FLOW team", "فريق FLOW"))} · {formatDate(message.createdAt, language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
          {message.attachments?.map((file: PortalRow) => <a className="message-attachment" href={`/api/files/${file.fileId}`} key={file.fileId}><Icon name="file" size={13} />{file.fileName}<Icon name="download" size={12} /></a>)}
        </article>) : !newConversation ? <div className="thread-empty">
          <p>{t("Your conversation history will appear here.", "سجل المحادثة هيظهر هنا.")}</p>
        </div> : null}
      </div>
      {attachmentIds.length > 0 && <div className="attached-pills">{attachmentIds.map((id, index) => <span key={id}><Icon name="file" size={12} />{t("Attachment", "مرفق")} {index + 1}<button type="button" onClick={() => setAttachmentIds((current) => current.filter((item) => item !== id))} aria-label={t("Remove attachment", "إزالة المرفق")}><Icon name="close" size={12} /></button></span>)}</div>}
      <form className="message-compose" onSubmit={sendMessage}>
        <label className="message-attach-button" aria-label={t("Attach file", "إرفاق ملف")} title={t("Attach file", "إرفاق ملف")}><Icon name="file" size={17} /><input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.csv,.xlsx" onChange={attachFile} disabled={uploading} /></label>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={uploading ? t("Uploading attachment…", "جارٍ رفع المرفق…") : t("Write a message…", "اكتبي رسالة…")} rows={1} maxLength={5000} required />
        {user.role !== "client" && <label className="internal-toggle" title={t("Internal note only", "ملاحظة داخلية فقط")}><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /><span>{t("Internal", "داخلي")}</span></label>}
        <button type="submit" className="send-message-button" disabled={!body.trim() || busy || uploading} aria-label={t("Send message", "إرسال الرسالة")} title={t("Send message", "إرسال الرسالة")}><Icon name="send" size={16} /><span>{t("Send", "إرسال")}</span></button>
      </form>
    </section>
  </div>;
}

function ReportsView({ data, language }: { data: PortalRow; language: "en" | "ar" }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const productBreakdown = data.products?.byStatus || [];
  const projectBreakdown = data.projects?.byStatus || [];
  const maxProduct = Math.max(1, ...productBreakdown.map((item: PortalRow) => item.total));
  const maxProject = Math.max(1, ...projectBreakdown.map((item: PortalRow) => item.total));
  return <><div className="toolbar"><div className="toolbar-left"><label className="date-filter">From<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label className="date-filter">To<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label><button type="button" className="button button-secondary button-small" onClick={() => window.location.reload()}>Apply dates <Icon name="filter" size={14} /></button></div><div className="toolbar-right"><a className="button button-secondary button-small" href={`/api/reports/export${start || end ? `?${new URLSearchParams({ ...(start ? { start } : {}), ...(end ? { end } : {}) })}` : ""}`}><Icon name="download" size={14} />Export products CSV</a></div></div><div className="billing-summary"><div className="billing-metric"><span>Products submitted</span><b>{data.products?.total ?? 0}</b></div><div className="billing-metric"><span>Projects recorded</span><b>{data.projects?.total ?? 0}</b></div><div className="billing-metric"><span>Service requests</span><b>{data.serviceRequests ?? 0}</b></div></div><div className="analytics-grid"><div className="chart-panel"><div className="section-header"><div><span className="section-label">PRODUCTION</span><h2 className="section-title">Products by workflow stage</h2></div></div>{productBreakdown.length ? <div className="bar-chart">{productBreakdown.map((row: PortalRow) => <div className="bar-column" key={row.status}><span className="bar-value" style={{ height: `${Math.max(6, Number(row.total) / maxProduct * 100)}%` }} title={`${row.total} ${statusLabel(row.status)}`} /><small>{shortStatus(row.status)}</small></div>)}</div> : <Empty icon="reports" title="No product activity" description="As real product records arrive, this report will populate." />}</div><div className="chart-panel"><div className="section-header"><div><span className="section-label">PROJECT DELIVERY</span><h2 className="section-title">Projects by status</h2></div></div>{projectBreakdown.length ? <div className="bar-chart">{projectBreakdown.map((row: PortalRow) => <div className="bar-column" key={row.status}><span className="bar-value" style={{ height: `${Math.max(6, Number(row.total) / maxProject * 100)}%` }} title={`${row.total} ${statusLabel(row.status)}`} /><small>{shortStatus(row.status)}</small></div>)}</div> : <Empty icon="projects" title="No project records" description="Project status reporting will be based on your FLOW workspace." />}</div></div><div className="analytics-grid report-stat-panels"><div className="chart-panel"><span className="section-label">BILLING RECORDS</span><div className="report-large-number">{formatMoney(data.billing?.billed, "EGP", language)}</div><p>Invoice total recorded in the selected date range.</p><div className="report-secondary-stat">Payments recorded: <b>{formatMoney(data.billing?.paid, "EGP", language)}</b></div></div><div className="chart-panel"><span className="section-label">CLIENT APPROVAL</span><div className="report-large-number">{data.pendingApprovals || 0}</div><p>Approvals currently waiting for a response.</p><div className="report-secondary-stat">Service requests: <b>{data.serviceRequests || 0}</b></div></div></div><p className="module-footnote">All report values come from saved FLOW portal records. No sales data is inferred from marketplace integrations.</p></>;
}
function shortStatus(value: string) { return value.replaceAll("_", " ").split(" ").map((word) => word.slice(0, 4)).join(" "); }

function ClientsView({ clients, language, onToast, onRefresh }: { clients: PortalRow[]; language: "en" | "ar"; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const [filter, setFilter] = useState("all");
  const updateStatus = async (client: PortalRow, status: string) => {
    if (status === "active" && !window.confirm("Activate this client workspace and confirm email identity through FLOW’s manual review? This will be audit logged.")) return;
    try { await requestJson(`/api/clients/${client.organization.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, verifyManually: status === "active" }) }); onToast(`Client workspace ${status === "active" ? "activated" : status}.`); onRefresh(); }
    catch (error) { onToast(error instanceof Error ? error.message : "Could not update client.", true); }
  };
  const shown = clients.filter((client) => filter === "all" || client.organization.status === filter);
  return <><div className="toolbar"><div className="toolbar-left"><span className="section-label">{clients.length} WORKSPACES</span><select className="toolbar-select" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All accounts</option><option value="pending">Pending review</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div></div><div className="panel data-table-wrap">{shown.length ? <table className="data-table"><thead><tr><th>Company</th><th>Primary contact</th><th>Category</th><th>Marketplaces</th><th>Joined</th><th>Status</th><th>Manage</th></tr></thead><tbody>{shown.map((client) => { const organization = client.organization; const contact = client.contacts?.[0]; return <tr key={organization.id}><td><span className="table-primary">{organization.companyName}</span><span className="table-secondary">{organization.id}</span></td><td><span className="table-primary">{contact?.fullName || organization.contactPerson}</span><span className="table-secondary">{contact?.email || "No contact email"}</span></td><td>{organization.category || "—"}</td><td>{organization.targetMarketplaces?.join(", ") || t("Not specified", "غير محدد")}</td><td>{formatDate(organization.createdAt)}</td><td><Badge status={organization.status} />{contact && !contact.emailVerifiedAt && <small className="table-secondary">Email unverified</small>}</td><td><div className="inline-actions">{organization.status !== "active" && <button type="button" className="button button-primary button-small" onClick={() => void updateStatus(client, "active")}>Activate</button>}{organization.status === "active" && <button type="button" className="button button-secondary button-small" onClick={() => void updateStatus(client, "suspended")}>Suspend</button>}</div></td></tr>; })}</tbody></table> : <Empty icon="clients" title="No client workspaces match" description="Change the account filter or create a new client workspace." />}</div></>;
}

function TeamView({ team, onToast, onRefresh }: { team: PortalRow[]; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const toggle = async (member: PortalRow) => {
    const status = member.user.status === "active" ? "disabled" : "active";
    try { await requestJson(`/api/team/${member.user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); onToast(`Team access ${status === "active" ? "restored" : "disabled"}.`); onRefresh(); }
    catch (error) { onToast(error instanceof Error ? error.message : "Could not update team member.", true); }
  };
  const totalOpen = team.reduce((sum, member) => sum + Number(member.workload?.open || 0), 0);
  const totalOverdue = team.reduce((sum, member) => sum + Number(member.workload?.overdue || 0), 0);
  return <><div className="team-summary-row"><div className="team-summary-item"><b>{team.length}</b><span>Team accounts</span></div><div className="team-summary-item"><b>{team.filter((member) => member.user.role === "account_manager").length}</b><span>Account managers</span></div><div className="team-summary-item"><b>{team.filter((member) => member.user.status === "active").length}</b><span>Active access</span></div><div className="team-summary-item"><b>{totalOpen}</b><span>Open workflow tasks</span></div><div className="team-summary-item"><b>{totalOverdue}</b><span>Overdue tasks</span></div></div><div className="panel data-table-wrap">{team.length ? <table className="data-table"><thead><tr><th>Team member</th><th>Department</th><th>Role</th><th>Open tasks</th><th>In progress</th><th>Overdue</th><th>Created</th><th>Status</th><th>Access</th></tr></thead><tbody>{team.map((member) => <tr key={member.user.id}><td><span className="table-primary">{member.user.fullName}</span><span className="table-secondary">{member.user.email}</span></td><td>{member.employee?.department || "—"}</td><td><Badge status={member.user.role} /></td><td>{member.workload?.open ?? 0}</td><td>{member.workload?.inProgress ?? 0}</td><td>{member.workload?.overdue ? <Badge status="needs_attention" /> : "0"}{member.workload?.overdue ? ` ${member.workload.overdue}` : ""}</td><td>{formatDate(member.user.createdAt)}</td><td><Badge status={member.user.status} /></td><td><button type="button" className="button button-secondary button-small" onClick={() => void toggle(member)}>{member.user.status === "active" ? "Disable" : "Activate"}</button></td></tr>)}</tbody></table> : <Empty icon="team" title="No staff accounts yet" description="Create FLOW team members with the role and permissions appropriate to their department." />}</div><p className="module-footnote">Workload is calculated from saved workflow assignments and deadlines. Hour-based time tracking is not enabled yet.</p></>;
}

function SubscriptionsView({ data, user, language, onOpenModal, onToast, onRefresh }: { data: PortalRow; user: AuthUserView; language: "en" | "ar"; onOpenModal: Props["onOpenModal"]; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const isAdmin = user.role === "admin";
  const [message, setMessage] = useState("");
  const subscription = data.subscription || null;
  const plan = data.plan || null;
  const usage = data.usage || null;
  const assign = async (organizationId: string, planId: string) => {
    try { await requestJson("/api/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, planId }) }); onToast("Subscription assigned."); onRefresh(); }
    catch (error) { onToast(error instanceof Error ? error.message : "Could not assign subscription.", true); }
  };
  const requestChange = async () => {
    try { await requestJson("/api/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request_change", message }) }); setMessage(""); onToast("Subscription review request sent to FLOW."); onRefresh(); }
    catch (error) { onToast(error instanceof Error ? error.message : "Could not send request.", true); }
  };
  if (!isAdmin) return <div className="subscription-client-view">{subscription && plan ? <section className="subscription-card-current"><div className="subscription-current-top"><span className="section-label">CURRENT SUBSCRIPTION</span><Badge status={subscription.status} /></div><h2>{plan.name}</h2><p>{plan.description || "FLOW subscription plan"}</p><div className="subscription-usage"><div><span>Products used this period</span><b>{usage?.productsUsed ?? 0}{usage?.productQuota !== null && usage?.productQuota !== undefined ? ` / ${usage.productQuota}` : ""}</b></div><div><span>Remaining product quota</span><b>{usage?.remaining === null || usage?.remaining === undefined ? "No configured limit" : usage.remaining}</b></div><div><span>Renewal date</span><b>{subscription.renewsAt ? formatDate(subscription.renewsAt, language) : t("Not set", "غير محدد")}</b></div><div><span>Billing cycle</span><b>{titleCase(subscription.billingCycle)}</b></div></div><div className="subscription-quota-line"><span style={{ width: `${usage?.productQuota ? Math.min(100, (usage.productsUsed / usage.productQuota) * 100) : 0}%` }} /></div></section> : <div className="panel"><Empty icon="billing" title="No subscription assigned" description="Your FLOW workspace does not have an active portal subscription record. Contact your account manager for a tailored quote." /></div>}<section className="panel panel-pad subscription-change"><div className="section-header"><div><span className="section-label">PLAN REVIEW</span><h2 className="section-title">Need a change?</h2></div></div><label className="field-label">Tell FLOW what you need<textarea rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="More products, a different service mix, or a billing-cycle discussion…" /></label><button type="button" className="button button-primary button-small" disabled={!message.trim()} onClick={() => void requestChange()}>Request subscription review <Icon name="arrow" size={14} /></button></section></div>;
  return <><div className="toolbar"><div className="toolbar-left"><span className="section-label">CONFIGURABLE COMMERCIAL RULES</span></div><div className="toolbar-right"><button type="button" className="button button-secondary button-small" onClick={() => onOpenModal("plan")}>New plan <Icon name="plus" size={14} /></button></div></div><div className="subscription-admin-grid">{(data.plans || []).map((planRow: PortalRow) => <article className="subscription-plan-card" key={planRow.id}><div className="subscription-plan-head"><span className="service-card-icon"><Icon name="billing" size={17} /></span><Badge status={planRow.isEnabled ? "active" : "disabled"} /></div><h3>{planRow.name}</h3><p>{planRow.description || "No plan description"}</p><div className="subscription-plan-price">{planRow.price === null ? "Custom" : formatMoney(planRow.price, planRow.currency || "EGP", language)}<small> / {planRow.billingCycle}</small></div><div className="plan-rule"><span>Product quota</span><b>{planRow.productQuota ?? "Not limited"}</b></div><div className="plan-rule"><span>Included services</span><b>{planRow.includedServices?.length || 0}</b></div><p className="module-footnote">Commercial values are FLOW-admin configurable and are not assigned to clients automatically.</p></article>)}</div>{!(data.plans || []).length && <div className="panel"><Empty icon="billing" title="No subscription plans configured" description="Create a plan only after FLOW confirms its actual commercial rules and quotas." action={() => onOpenModal("plan")} actionLabel="Configure a plan" /></div>}<div className="panel data-table-wrap subscription-table"><div className="section-header"><div><span className="section-label">SUBSCRIPTION RECORDS</span><h2 className="section-title">Client assignments</h2></div></div>{data.subscriptions?.length ? <table className="data-table"><thead><tr><th>Workspace</th><th>Plan ID</th><th>Cycle</th><th>Status</th><th>Starts</th><th>Renewal</th></tr></thead><tbody>{data.subscriptions.map((item: PortalRow) => <tr key={item.id}><td>{item.organizationId}</td><td>{item.planId || "Custom"}</td><td>{item.billingCycle}</td><td><Badge status={item.status} /></td><td>{item.startsAt || "—"}</td><td>{item.renewsAt || "—"}</td></tr>)}</tbody></table> : <Empty icon="billing" title="No assignments yet" description="Client subscriptions are listed here after an administrator assigns a plan." />}</div></>;
}

function AuditView({ rows, language }: { rows: PortalRow[]; language: "en" | "ar" }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  return <div className="panel data-table-wrap">{rows.length ? <table className="data-table"><thead><tr><th>Action</th><th>Actor</th><th>Record</th><th>Timestamp</th><th>Value change</th></tr></thead><tbody>{rows.map((entry) => <tr key={entry.audit.id}><td><span className="table-primary">{entry.audit.action}</span></td><td>{entry.actorName || "System"}<span className="table-secondary">{entry.actorEmail || ""}</span></td><td>{entry.audit.entityType}{entry.audit.entityId ? <span className="table-secondary">{entry.audit.entityId}</span> : ""}</td><td>{formatDate(entry.audit.createdAt, language, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td><td><span className="audit-value">{entry.audit.newValue ? JSON.stringify(entry.audit.newValue) : "—"}</span></td></tr>)}</tbody></table> : <Empty icon="shield" title="No audit entries" description="Important administrative actions will appear here. Audit entries cannot be edited from the portal." />}</div>;
}

function NotificationsView({ rows, language, onRefresh, onToast }: { rows: PortalRow[]; language: "en" | "ar"; onRefresh: Props["onRefresh"]; onToast: Props["onToast"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const markAll = async () => { try { await requestJson("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }); onToast("Notifications marked as read."); onRefresh(); } catch (error) { onToast(error instanceof Error ? error.message : "Could not update notifications.", true); } };
  return <><div className="toolbar"><span className="section-label">{rows.filter((row) => !row.readAt).length} UNREAD</span><button type="button" className="button button-secondary button-small" onClick={() => void markAll()}>Mark all read <Icon name="check" size={14} /></button></div><div className="panel notification-list-panel">{rows.length ? rows.map((row) => <article className={`notification-row ${row.readAt ? "is-read" : ""}`} key={row.id}><span className="notification-row-icon"><Icon name={row.type === "message" ? "messages" : row.type === "invoice" ? "billing" : "spark"} size={15} /></span><span><b>{row.title}</b><small>{row.body}</small><time>{formatDate(row.createdAt, language, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time></span><Badge status={row.readAt ? "read" : "unread"} /></article>) : <Empty icon="bell" title="No notifications yet" description="Important activity for this workspace will appear here." />}</div></>;
}

function SettingsView({ user, organization, language, onToast, onRefresh }: { user: AuthUserView; organization: OrganizationView | null; language: "en" | "ar"; onToast: Props["onToast"]; onRefresh: Props["onRefresh"] }) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const [busy, setBusy] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true);
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());
    try { await requestJson("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); onToast("Workspace profile updated."); onRefresh(); }
    catch (error) { onToast(error instanceof Error ? error.message : "Could not save profile.", true); }
    finally { setBusy(false); }
  };
  if (!organization || user.role !== "client") return <div className="settings-layout"><section className="detail-card"><span className="section-label">YOUR FLOW PROFILE</span><h3>Account</h3><div className="detail-list"><div><span>Name</span><b>{user.fullName}</b></div><div><span>Email</span><b>{user.email}</b></div><div><span>Role</span><b>{titleCase(user.role)}</b></div><div><span>Language</span><b>{language === "ar" ? "Arabic" : "English"}</b></div></div></section><section className="detail-card"><span className="section-label">SECURITY</span><h3>Secure access</h3><p className="detail-help">FLOW stores password hashes and short-lived server-validated session records. Sign out from the sidebar to revoke this browser session.</p><p className="detail-help">Password reset uses a one-time link when email delivery is configured for the workspace.</p></section></div>;
  return <div className="settings-layout"><form className="detail-card settings-form" onSubmit={save}><span className="section-label">CLIENT PROFILE</span><h3>Company details</h3><div className="form-grid-two"><label className="field-label">Company name<input name="companyName" required defaultValue={organization.companyName} /></label><label className="field-label">Contact person<input name="contactPerson" required defaultValue={organization.contactPerson} /></label></div><div className="form-grid-two"><label className="field-label">Phone<input name="phone" defaultValue={organization.phone || ""} /></label><label className="field-label">Business category<input name="category" defaultValue={organization.category || ""} /></label></div><div className="form-grid-two"><label className="field-label">Website<input name="website" defaultValue={organization.website || ""} /></label><label className="field-label">Preferred language<select name="preferredLanguage" defaultValue={organization.preferredLanguage}><option value="en">English</option><option value="ar">Arabic</option></select></label></div><div className="form-grid-two"><label className="field-label">Products per month<input name="monthlyProductEstimate" type="number" min={0} defaultValue={organization.monthlyProductEstimate ?? ""} /></label><label className="field-label">Client email<input value={user.email} readOnly /></label></div><label className="field-label">Business description<textarea name="description" rows={3} defaultValue={organization.description || ""} /></label><label className="field-label">Additional requirements<textarea name="additionalRequirements" rows={3} defaultValue={organization.additionalRequirements || ""} /></label><button type="submit" className="button button-primary button-small" disabled={busy}>{busy ? "Saving…" : "Save profile"}<Icon name="check" size={14} /></button></form><div className="settings-side-stack"><section className="detail-card"><span className="section-label">WORKSPACE DETAILS</span><h3>Account status</h3><div className="settings-status"><Badge status={organization.status} /><span>{organization.status === "active" ? "Your client workspace is active." : "Your account is being reviewed by FLOW."}</span></div><div className="card-rule" /><div className="detail-list"><div><span>Created</span><b>{formatDate(organization.createdAt, language)}</b></div><div><span>Company ID</span><b className="settings-id">{organization.id}</b></div></div></section><section className="detail-card"><span className="section-label">ACCESS & PRIVACY</span><h3>Your information</h3><p className="detail-help">Your products, projects, invoices and conversations are scoped to this company workspace. Internal FLOW notes and private files are not included in client-facing views.</p><p className="detail-help">To change your sign-in email or request data export, contact your assigned FLOW account manager.</p></section></div></div>;
}
