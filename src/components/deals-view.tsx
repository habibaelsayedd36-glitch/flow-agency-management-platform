"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/flow-icons";
import type { AuthUserView } from "@/components/auth-screen";
import { formatDate, formatMoney, requestJson, titleCase, type PortalRow } from "@/lib/portal-types";

export function DealsView({ user, language, onToast, onRefresh }: { user: AuthUserView; language: "en" | "ar"; onToast: (message: string, error?: boolean) => void; onRefresh: () => void }) {
  const [deals, setDeals] = useState<PortalRow[]>([]);
  const [clients, setClients] = useState<PortalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const isAdmin = user.role === "admin";
  const load = async () => {
    setLoading(true);
    try {
      const [dealResult, clientResult] = await Promise.all([
        requestJson<{ deals: PortalRow[] }>("/api/deals"),
        isAdmin ? requestJson<{ clients: PortalRow[] }>("/api/clients") : Promise.resolve({ clients: [] }),
      ]);
      setDeals(dealResult.deals || []);
      setClients(clientResult.clients || []);
    } catch (error) { onToast(error instanceof Error ? error.message : "Could not load deals.", true); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [user.role, user.organizationId]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/deals", { method: "POST", body: form, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save deal.");
      onToast("Deal and contract saved successfully.");
      setShowForm(false);
      await load();
      onRefresh();
    } catch (error) { onToast(error instanceof Error ? error.message : "Could not save deal.", true); }
    finally { setBusy(false); }
  };
  const filtered = deals.filter((deal) => `${deal.title} ${deal.summary} ${deal.services?.join(" ") || ""}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="section-stack">
    <div className="toolbar"><div className="toolbar-left"><label className="search-box"><Icon name="search" size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agreements"/></label></div>{isAdmin && <button className="button button-primary button-small" type="button" onClick={() => setShowForm((value) => !value)}><Icon name="plus" size={14}/>New deal</button>}</div>
    {showForm && isAdmin && <form className="detail-card settings-form" onSubmit={submit}>
      <span className="section-label">CLIENT AGREEMENT</span><h3>Record a deal</h3>
      <label className="field-label">Client<select name="organizationId" required defaultValue=""><option value="" disabled>Select a client</option>{clients.map((row) => <option key={row.organization.id} value={row.organization.id}>{row.organization.companyName}</option>)}</select></label>
      <div className="form-grid-two"><label className="field-label">Deal title<input name="title" required maxLength={180} placeholder="Monthly product content package"/></label><label className="field-label">Agreement date<input name="agreementDate" type="date"/></label></div>
      <label className="field-label">Agreement details<textarea name="summary" required rows={4} placeholder="Write the latest agreed scope, deliverables, timelines and conditions"/></label>
      <div className="form-grid-two"><label className="field-label">Services (comma separated)<input name="services" placeholder="Photography, Listing optimization"/></label><label className="field-label">Deal value<input name="dealValue" type="number" min="0" step="0.01" placeholder="0.00"/></label></div>
      <div className="form-grid-two"><label className="field-label">Status<select name="status" defaultValue="agreed"><option value="negotiating">Negotiating</option><option value="agreed">Agreed</option><option value="rejected">Rejected</option><option value="ended">Ended</option></select></label><label className="field-label">Currency<select name="currency" defaultValue="EGP"><option>EGP</option><option>USD</option><option>EUR</option><option>SAR</option><option>AED</option></select></label></div>
      <div className="form-grid-two"><label className="field-label">Contract start<input name="contractStartDate" type="date"/></label><label className="field-label">Contract end<input name="contractEndDate" type="date"/></label></div>
      <div className="form-grid-two"><label className="field-label">Contract status<select name="contractStatus" defaultValue="draft"><option value="draft">Draft</option><option value="sent">Sent</option><option value="signed">Signed</option><option value="expired">Expired</option></select></label><label className="field-label">Contract copy (PDF / DOC / DOCX)<input name="contract" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"/></label></div>
      <label className="choice-chip"><input type="checkbox" name="clientVisible" value="true"/> Share this deal and contract with the client</label>
      <div className="page-actions"><button className="button button-primary button-small" disabled={busy}>{busy ? "Saving…" : "Save deal"}</button><button className="button button-secondary button-small" type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
    </form>}
    {loading ? <div className="panel panel-pad">Loading deals…</div> : filtered.length === 0 ? <div className="panel"><div className="empty-state"><Icon name="file" size={22}/><h3>No agreements yet</h3><p>Recorded client agreements and contract copies will appear here.</p></div></div> : <div className="product-card-grid">{filtered.map((deal) => <article className="detail-card" key={deal.id}>
      <div className="card-heading-row"><div><span className="section-label">{deal.organizationId === user.organizationId ? "YOUR AGREEMENT" : "CLIENT DEAL"}</span><h3>{deal.title}</h3>{isAdmin && <p className="detail-help">{clients.find((row) => row.organization.id === deal.organizationId)?.organization.companyName || "Client workspace"}</p>}</div><span className={`status-badge ${deal.status}`}>{titleCase(deal.status)}</span></div>
      <p className="detail-help">{deal.summary}</p>
      <div className="detail-list"><div><span>Agreement date</span><b>{formatDate(deal.agreementDate, language)}</b></div>{deal.dealValue != null && <div><span>Agreed value</span><b>{formatMoney(deal.dealValue, deal.currency, language)}</b></div>}<div><span>Services</span><b>{deal.services?.join(", ") || "Not specified"}</b></div><div><span>Contract status</span><b>{titleCase(deal.contractStatus)}</b></div>{deal.contractStartDate && <div><span>Contract period</span><b>{formatDate(deal.contractStartDate, language)} – {formatDate(deal.contractEndDate, language)}</b></div>}</div>
      {deal.contract && <a className="button button-secondary button-small" href={`/api/files/${deal.contract.id}`}><Icon name="download" size={14}/>{deal.contract.fileName} · v{deal.contract.versionNumber}</a>}
    </article>)}</div>}
  </div>;
}
