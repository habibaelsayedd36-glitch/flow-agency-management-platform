"use client";

import { FormEvent, useEffect, useState } from "react";
import { Icon } from "@/components/flow-icons";
import type { AuthUserView, OrganizationView } from "@/components/auth-screen";
import type { PortalRow } from "@/lib/portal-types";
import { requestJson } from "@/lib/portal-types";

export type ModalName = "product" | "project" | "service" | "upload" | "client" | "team" | "invoice" | "payment" | "plan" | "content";
export type ModalState = { type: ModalName; payload?: PortalRow } | null;

type Props = {
  modal: ModalState;
  user: AuthUserView;
  organization: OrganizationView | null;
  language: "en" | "ar";
  onClose: () => void;
  onDone: (message: string) => void;
};

const titles: Record<ModalName, { title: string; subtitle: string }> = {
  product: { title: "Add a product", subtitle: "Share the essentials. You can add references and details later." },
  project: { title: "Create a project", subtitle: "A simple starting point for the work you want FLOW to deliver." },
  service: { title: "Request a service", subtitle: "Tell us what you need. Your account manager will confirm scope and pricing." },
  upload: { title: "Upload a file", subtitle: "Files are stored privately and linked to your workspace." },
  client: { title: "Add a client workspace", subtitle: "New accounts are created in review until the client email is verified." },
  team: { title: "Add a team member", subtitle: "Set a scoped staff role. The role controls which records they can access." },
  invoice: { title: "Create an invoice", subtitle: "FLOW calculates line totals, discount, tax, and balance on the server." },
  payment: { title: "Record a verified payment", subtitle: "Only payments confirmed by FLOW may be added to an invoice balance." },
  plan: { title: "Configure a subscription plan", subtitle: "Commercial rules are editable by FLOW administrators." },
  content: { title: "Create a listing version", subtitle: "Save a new language version without overwriting approved content." },
};

function TextField({ label, name, required, type = "text", placeholder, defaultValue, min, max, step, rows }: {
  label: string; name: string; required?: boolean; type?: string; placeholder?: string; defaultValue?: string | number; min?: number; max?: number; step?: number; rows?: number;
}) {
  return <label className="field-label">{label}{rows ? <textarea name={name} rows={rows} required={required} placeholder={placeholder} defaultValue={defaultValue} maxLength={12000} /> : <input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} min={min} max={max} step={step} />}</label>;
}

export function PortalModal({ modal, user, organization, language, onClose, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [services, setServices] = useState<PortalRow[]>([]);
  const [projects, setProjects] = useState<PortalRow[]>([]);
  const [productOptions, setProductOptions] = useState<PortalRow[]>([]);
  const [requiredServices, setRequiredServices] = useState<string[]>([]);
  const [clientVisible, setClientVisible] = useState(true);
  const [sendForReview, setSendForReview] = useState(false);
  const [productQuantity, setProductQuantity] = useState(1);

  useEffect(() => {
    if (modal?.type === "service") requestJson<{ catalog: PortalRow[] }>("/api/services").then((result) => setServices(result.catalog)).catch((caught) => setError(caught.message));
    if (modal?.type === "product" || modal?.type === "upload") requestJson<{ projects: PortalRow[] }>("/api/projects").then((result) => setProjects(result.projects)).catch(() => setProjects([]));
    if (modal?.type === "upload") requestJson<{ products: PortalRow[] }>("/api/products").then((result) => setProductOptions(result.products)).catch(() => setProductOptions([]));
  }, [modal?.type]);

  if (!modal) return null;
  const title = titles[modal.type];
  const isStaff = user.role !== "client";
  const isAdmin = user.role === "admin";
  const currentOrganizationId = organization?.id || user.organizationId || "";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const get = (key: string) => String(data.get(key) || "").trim();
    try {
      if (modal.type === "product") {
        await requestJson("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          organizationId: currentOrganizationId,
          name: get("name"), sku: get("sku"), brand: get("brand"), category: get("category"), productType: get("productType"), description: get("description"),
          targetMarketplaces: data.getAll("targetMarketplaces").map(String), projectId: get("projectId") || null, requiredServices, clientInstructions: get("clientInstructions"),
        }) });
        onDone("Product submitted to your FLOW workspace.");
      } else if (modal.type === "project") {
        await requestJson("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId: currentOrganizationId, name: get("name"), description: get("description"), dueDate: get("dueDate"), priority: get("priority") }) });
        onDone(user.role === "client" ? "Project request sent to FLOW." : "Project created.");
      } else if (modal.type === "service") {
        await requestJson("/api/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          organizationId: currentOrganizationId, serviceId: get("serviceId"), projectName: get("projectName"), productQuantity, description: get("description"),
          targetMarketplace: get("targetMarketplace"), desiredDeadline: get("desiredDeadline"), priority: get("priority"),
        }) });
        onDone("Service request submitted. Your account manager can follow up with a confirmed quote.");
      } else if (modal.type === "upload") {
        const file = data.get("file");
        if (!(file instanceof File)) throw new Error("Choose a file to upload.");
        const form = new FormData();
        form.set("file", file);
        form.set("category", get("category") || "document");
        form.set("clientVisible", isStaff ? String(clientVisible) : "true");
        if (isStaff) form.set("organizationId", get("organizationId") || currentOrganizationId);
        if (get("productId")) form.set("productId", get("productId"));
        if (get("projectId")) form.set("projectId", get("projectId"));
        const response = await fetch("/api/files", { method: "POST", body: form, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Upload failed.");
        onDone(`${file.name} uploaded as version ${result.file.versionNumber}.`);
      } else if (modal.type === "client") {
        await requestJson("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyName: get("companyName"), fullName: get("fullName"), email: get("email"), phone: get("phone"), category: get("category"), password: get("password"), preferredLanguage: get("preferredLanguage"), website: get("website") }) });
        onDone("Client workspace created in review. Email delivery status is shown in the client record.");
      } else if (modal.type === "team") {
        await requestJson("/api/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: get("fullName"), email: get("email"), password: get("password"), role: get("role"), department: get("department"), title: get("title"), phone: get("phone") }) });
        onDone("Team member created with the selected role.");
      } else if (modal.type === "invoice") {
        await requestJson("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          organizationId: get("organizationId"), dueDate: get("dueDate"), notes: get("notes"), taxRate: Number(get("taxRate") || 0), discount: Number(get("discount") || 0),
          currency: get("currency") || "EGP", items: [{ description: get("itemDescription"), quantity: Number(get("quantity") || 1), unitPrice: Number(get("unitPrice") || 0) }],
        }) });
        onDone("Invoice created. The client can now view the server-calculated total.");
      } else if (modal.type === "payment") {
        await requestJson("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: modal.payload?.id, amount: Number(get("amount")), method: get("method"), reference: get("reference") }) });
        onDone("Payment reconciled and invoice balance updated.");
      } else if (modal.type === "plan") {
        await requestJson("/api/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: get("name"), description: get("description"), price: get("price") || null, productQuota: get("productQuota") || null, billingCycle: get("billingCycle"), currency: get("currency") || "EGP", isCustom: data.get("isCustom") === "on", includedServices: requiredServices }) });
        onDone("Subscription plan saved.");
      } else if (modal.type === "content" && modal.payload?.id) {
        const bulletPoints = get("bulletPoints").split("\n").map((item) => item.trim()).filter(Boolean);
        const keywords = get("keywords").split(",").map((item) => item.trim()).filter(Boolean);
        await requestJson(`/api/products/${modal.payload.id}/content`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: get("language"), title: get("title"), shortDescription: get("shortDescription"), fullDescription: get("fullDescription"), bulletPoints, keywords, status: sendForReview ? "ready_for_client" : "draft" }) });
        onDone(sendForReview ? "Listing version submitted for client review." : "Listing version saved as a draft.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const currentTitle = modal.type === "content" && modal.payload?.name ? `Create listing · ${modal.payload.name}` : title.title;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="portal-modal-title" dir={language === "ar" ? "rtl" : "ltr"}>
      <header className="modal-head"><div><span className="eyebrow">FLOW CLIENT PORTAL</span><h2 id="portal-modal-title">{currentTitle}</h2><p>{title.subtitle}</p></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button></header>
      <form className="modal-body" onSubmit={submit}>
        {modal.type === "product" && <>
          <TextField label="Product name" name="name" required placeholder="e.g. Ceramic storage jar" />
          <div className="form-grid-two"><TextField label="SKU" name="sku" placeholder="Optional internal code" /><TextField label="Brand" name="brand" placeholder="Brand name" /></div>
          <div className="form-grid-two"><TextField label="Category" name="category" placeholder="Home & kitchen" /><TextField label="Product type" name="productType" placeholder="e.g. Kitchen storage" /></div>
          <div className="form-grid-two"><fieldset className="choice-field"><legend>Marketplaces · select all that apply</legend><div className="choice-row">{["Amazon", "Noon", "Jumia", "Shopify", "InstaShop", "Other"].map((item) => <label key={item} className="choice-chip"><input type="checkbox" name="targetMarketplaces" value={item} />{item}</label>)}</div></fieldset><label className="field-label">Project (optional)<select name="projectId" defaultValue=""><option value="">No project linked</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label></div>
          <label className="field-label">Product description<textarea name="description" rows={3} placeholder="What should our team know about this product?" /></label>
          <fieldset className="choice-field"><legend>Services needed</legend><div className="choice-row">{[["product-photography", "Photography"], ["bilingual-listing", "Bilingual listing"], ["marketplace-account-management", "Account support"]].map(([key, label]) => <button key={key} type="button" className={`choice-chip ${requiredServices.includes(key) ? "selected" : ""}`} onClick={() => setRequiredServices((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])}>{requiredServices.includes(key) && <Icon name="check" size={12} />}{label}</button>)}</div></fieldset>
          <TextField label="Instructions for FLOW" name="clientInstructions" rows={2} placeholder="Handling, styling or compliance notes…" />
        </>}

        {modal.type === "project" && <>
          <TextField label="Project name" name="name" required placeholder="e.g. Summer product launch" />
          <TextField label="Project brief" name="description" rows={4} placeholder="What does success look like for this project?" />
          <div className="form-grid-two"><TextField label="Target delivery date" name="dueDate" type="date" /><label className="field-label">Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label></div>
        </>}

        {modal.type === "service" && <>
          <label className="field-label">Service type<select name="serviceId" required defaultValue=""><option value="">Choose a FLOW service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}{service.price !== null ? ` · ${new Intl.NumberFormat("en-EG", { style: "currency", currency: service.currency || "EGP", maximumFractionDigits: 0 }).format(Number(service.price))} ${service.unitType === "per_item" ? "per item" : service.unitType === "monthly" ? "monthly" : ""}` : ""}</option>)}</select></label>
          <TextField label="Request or project name" name="projectName" required placeholder="What should we call this request?" />
          <div className="form-grid-two"><label className="field-label">Product quantity<input name="productQuantity" type="number" min="1" max="100000" value={productQuantity} onChange={(event) => setProductQuantity(Number(event.target.value))} required /></label><label className="field-label">Target marketplace<select name="targetMarketplace" defaultValue=""><option value="">Not specified</option><option>Amazon</option><option>Noon</option><option>TikTok Shop</option><option>Shopify</option><option>InstaShop</option><option>Other</option></select></label></div>
          <TextField label="Desired deadline" name="desiredDeadline" type="date" />
          <TextField label="Brief and requirements" name="description" rows={4} placeholder="Include any details or references that will help us scope the request." />
          <div className="form-alert success-alert">Public price references are indicative only. FLOW will confirm your quote and delivery date before work begins.</div>
        </>}

        {modal.type === "upload" && <>
          <label className="field-label file-drop-field"><span>Choose file · JPG, PNG, WebP, PDF, CSV, XLSX, MP4 · up to 10 MB</span><input name="file" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.csv,.xls,.xlsx,.mp4" required /><small>Each upload is stored as a new version; approved files are never overwritten.</small></label>
          <div className="form-grid-two"><label className="field-label">File category<select name="category" defaultValue="document"><option value="reference">Reference</option><option value="original">Original product image</option><option value="edited">Edited image</option><option value="deliverable">Deliverable</option><option value="document">Document</option><option value="other">Other</option></select></label><label className="field-label">Link to product (optional)<select name="productId" defaultValue={String(modal.payload?.productId || "")}><option value="">No product linked</option>{productOptions.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label></div>
          <label className="field-label">Link to project (optional)<select name="projectId" defaultValue={String(modal.payload?.projectId || "")}><option value="">No project linked</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          {isStaff && <TextField label="Client workspace ID" name="organizationId" defaultValue={String(modal.payload?.organizationId || currentOrganizationId)} placeholder="Workspace ID" />}
          {isStaff && <label className="switch-row"><span><b>Visible to client</b><small>Turn off to keep the upload internal to FLOW.</small></span><input type="checkbox" checked={clientVisible} onChange={(event) => setClientVisible(event.target.checked)} /></label>}
          <p className="form-hint"><Icon name="shield" size={14} />Files are delivered through a private, permission-checked download route.</p>
        </>}

        {modal.type === "client" && <>
          <TextField label="Company name" name="companyName" required placeholder="Client company" />
          <div className="form-grid-two"><TextField label="Contact person" name="fullName" required placeholder="Full name" /><TextField label="Phone" name="phone" placeholder="+20 …" /></div>
          <div className="form-grid-two"><TextField label="Email" name="email" type="email" required placeholder="client@company.com" /><TextField label="Business category" name="category" placeholder="Category" /></div>
          <TextField label="Website (optional)" name="website" type="url" placeholder="https://www.company.com" /><div className="form-grid-two"><TextField label="Temporary password" name="password" type="password" required placeholder="At least 12 characters" /><label className="field-label">Preferred language<select name="preferredLanguage" defaultValue="en"><option value="en">English</option><option value="ar">Arabic</option></select></label></div>
        </>}

        {modal.type === "team" && <>
          <TextField label="Full name" name="fullName" required placeholder="Team member name" />
          <div className="form-grid-two"><TextField label="Work email" name="email" type="email" required placeholder="name@flow-agency-eg.com" /><TextField label="Temporary password" name="password" type="password" required placeholder="At least 12 characters" /></div>
          <div className="form-grid-two"><label className="field-label">Role<select name="role" required defaultValue="account_manager"><option value="account_manager">Account manager</option><option value="photographer">Photography team</option><option value="content_creator">Content team</option><option value="production_manager">Production manager</option></select></label><TextField label="Department" name="department" placeholder="Production" /></div>
          <div className="form-grid-two"><TextField label="Job title" name="title" placeholder="Role title" /><TextField label="Phone" name="phone" placeholder="Optional" /></div>
        </>}

        {modal.type === "invoice" && <>
          <TextField label="Client workspace ID" name="organizationId" required placeholder="Client organization ID" />
          <TextField label="Invoice line description" name="itemDescription" required placeholder="e.g. Product photography · 20 items" />
          <div className="form-grid-two"><TextField label="Quantity" name="quantity" required type="number" min={0.01} step={0.01} defaultValue={1} /><TextField label="Unit price (EGP)" name="unitPrice" required type="number" min={0} step={0.01} /></div>
          <div className="form-grid-two"><TextField label="Discount (EGP)" name="discount" type="number" min={0} step={0.01} defaultValue={0} /><TextField label="Tax rate (%)" name="taxRate" type="number" min={0} max={30} step={0.01} defaultValue={0} /></div>
          <div className="form-grid-two"><TextField label="Due date" name="dueDate" type="date" /><label className="field-label">Currency<select name="currency" defaultValue="EGP"><option>EGP</option><option>USD</option><option>EUR</option><option>SAR</option></select></label></div>
          <TextField label="Notes" name="notes" rows={2} placeholder="Optional billing note" />
        </>}

        {modal.type === "payment" && <>
          <div className="form-alert success-alert">Invoice {String(modal.payload?.invoiceNumber || "")} · Balance {new Intl.NumberFormat("en-EG", { style: "currency", currency: String(modal.payload?.currency || "EGP") }).format(Math.max(0, Number(modal.payload?.total || 0) - Number(modal.payload?.amountPaid || 0)))}</div>
          <TextField label="Verified payment amount" name="amount" required type="number" min={0.01} step={0.01} max={Math.max(0, Number(modal.payload?.total || 0) - Number(modal.payload?.amountPaid || 0))} />
          <label className="field-label">Payment method<select name="method" required defaultValue="bank_transfer"><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="other">Other confirmed method</option></select></label>
          <TextField label="Payment reference" name="reference" placeholder="Bank transfer or receipt reference" />
        </>}

        {modal.type === "plan" && <>
          <TextField label="Plan name" name="name" required placeholder="Custom plan name" />
          <TextField label="Description" name="description" rows={2} placeholder="Included services and terms" />
          <div className="form-grid-two"><TextField label="Price" name="price" type="number" min={0} step={0.01} placeholder="Set by FLOW" /><TextField label="Product quota" name="productQuota" type="number" min={0} step={1} placeholder="Leave blank for unlimited" /></div>
          <div className="form-grid-two"><label className="field-label">Billing cycle<select name="billingCycle" defaultValue="monthly"><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label><label className="field-label">Currency<select name="currency" defaultValue="EGP"><option>EGP</option><option>USD</option><option>SAR</option></select></label></div>
          <label className="switch-row"><span><b>Custom plan</b><small>Mark this as an individually priced plan.</small></span><input name="isCustom" type="checkbox" /></label>
        </>}

        {modal.type === "content" && <>
          <div className="form-grid-two"><label className="field-label">Language<select name="language" defaultValue="en"><option value="en">English</option><option value="ar">Arabic</option></select></label><TextField label="Product title" name="title" required placeholder="Marketplace listing title" /></div>
          <TextField label="Short description" name="shortDescription" rows={2} placeholder="A concise product summary" />
          <TextField label="Full description" name="fullDescription" rows={4} placeholder="Detailed listing copy" />
          <TextField label="Bullet points · one per line" name="bulletPoints" rows={4} placeholder="Key benefit one\nKey benefit two\nSpecifications" />
          <TextField label="SEO keywords · separated by commas" name="keywords" rows={2} placeholder="main keyword, secondary keyword" />
          {isStaff && ["admin", "account_manager", "production_manager"].includes(user.role) && <label className="switch-row"><span><b>Submit for client review</b><small>Visible to the client as a reviewable listing version.</small></span><input type="checkbox" checked={sendForReview} onChange={(event) => setSendForReview(event.target.checked)} /></label>}
        </>}

        {error && <div className="form-alert error-alert" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? "Saving…" : modal.type === "upload" ? "Upload file" : modal.type === "content" ? sendForReview ? "Submit for review" : "Save version" : modal.type === "service" ? "Submit request" : modal.type === "invoice" ? "Create invoice" : modal.type === "payment" ? "Record verified payment" : modal.type === "client" ? "Create workspace" : modal.type === "team" ? "Add team member" : modal.type === "plan" ? "Save plan" : "Save"}<Icon name="arrow" size={15} /></button></div>
      </form>
    </section>
  </div>;
}
