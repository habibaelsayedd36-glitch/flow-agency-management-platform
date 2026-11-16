"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/flow-icons";
import type { AuthUserView } from "@/components/auth-screen";
import { requestJson, type PortalRow } from "@/lib/portal-types";

type Props = { language: "en" | "ar"; user: AuthUserView; refreshToken: number; onNavigate: (view: string) => void };
export function TaskCenterView({ language, user, refreshToken, onNavigate }: Props) {
  const ar = language === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [tasks, setTasks] = useState<PortalRow[]>([]);
  const [summary, setSummary] = useState<PortalRow>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    requestJson<{ tasks: PortalRow[]; summary: PortalRow }>("/api/tasks")
      .then((result) => { if (active) { setTasks(result.tasks || []); setSummary(result.summary || {}); } })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load tasks."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshToken]);
  const filtered = tasks.filter((task) => {
    const matches = `${task.productName || ""} ${task.sku || ""} ${task.stageLabel || ""} ${task.assignedName || ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "all" || (filter === "overdue" && task.overdue) || (filter === "unassigned" && task.unassigned) || (filter === "in_progress" && task.status === "in_progress") || (filter === "pending" && task.status === "pending");
    return matches && matchesFilter;
  });
  const date = (value: unknown) => value ? new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(String(value))) : t("No deadline", "بدون موعد");
  const filters = [{id:"all",label:t("All tasks","كل المهام"),count:summary.total},{id:"overdue",label:t("Overdue","متأخرة"),count:summary.overdue},{id:"unassigned",label:t("Unassigned","غير مسندة"),count:summary.unassigned},{id:"in_progress",label:t("In progress","قيد التنفيذ"),count:summary.inProgress},{id:"pending",label:t("Pending","معلقة"),count:summary.pending}];
  return <section className="task-center">
    <div className="task-center-summary">
      <article className="listing-ops-card"><span className="section-label">{t("OPEN TASKS","المهام المفتوحة")}</span><b>{summary.total ?? 0}</b><small>{t("Active workflow steps","مراحل العمل النشطة")}</small></article>
      <article className={Number(summary.overdue)>0?"listing-ops-card needs-attention":"listing-ops-card"}><span className="section-label">{t("OVERDUE","متأخرة")}</span><b>{summary.overdue ?? 0}</b><small>{t("Past their deadline","تجاوزت موعدها")}</small></article>
      <article className="listing-ops-card"><span className="section-label">{t("UNASSIGNED","غير مسندة")}</span><b>{summary.unassigned ?? 0}</b><small>{t("Need an owner","تحتاج مسؤولًا")}</small></article>
      <article className="listing-ops-card"><span className="section-label">{t("IN PROGRESS","قيد التنفيذ")}</span><b>{summary.inProgress ?? 0}</b><small>{t("Currently being worked on","يتم العمل عليها حاليًا")}</small></article>
    </div>
    <div className="panel panel-pad">
      <div className="section-header task-center-head"><div><span className="section-label">{t("TEAM OPERATIONS","عمليات الفريق")}</span><h2 className="section-title">{t("Task center","مركز المهام")}</h2><p className="section-subtitle">{t("A live view of assigned production work and upcoming deadlines.","متابعة مباشرة لمهام الإنتاج والمسؤوليات والمواعيد.")}</p></div><button className="button button-secondary button-small" type="button" onClick={()=>onNavigate("production")}>{t("Production board","لوحة الإنتاج")}<Icon name="arrow" size={14}/></button></div>
      <div className="task-center-controls"><input className="form-input" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder={t("Search product, SKU, stage or owner…","ابحثي بالمنتج أو SKU أو المرحلة أو المسؤول…")}/><div className="task-filter-row">{filters.map((item)=><button type="button" key={item.id} className={filter===item.id?"button button-primary button-small":"button button-secondary button-small"} onClick={()=>setFilter(item.id)}>{item.label}<span className="task-filter-count">{item.count ?? 0}</span></button>)}</div></div>
      {loading ? <div className="module-loading"><span className="loading-small"/>{t("Loading tasks…","جارٍ تحميل المهام…")}</div> : error ? <div className="error-state">{error}</div> : filtered.length ? <div className="task-list">{filtered.map((task)=><article className={task.overdue?"task-row task-overdue": "task-row"} key={String(task.id)}><span className="task-stage-icon"><Icon name="production" size={16}/></span><div className="task-row-main"><b>{String(task.productName || "Product")}</b><span>{String(task.stageLabel || "")}{task.sku ? ` · ${task.sku}` : ""}</span></div><div className="task-row-owner"><small>{t("OWNER","المسؤول")}</small><b>{String(task.assignedName || t("Unassigned","غير مسندة"))}</b></div><div className="task-row-date"><small>{t("DEADLINE","الموعد النهائي")}</small><b>{date(task.deadline)}</b></div><span className={task.overdue?"status-badge overdue":"status-badge"}>{task.overdue?t("Overdue","متأخرة"):String(task.status||"pending").replaceAll("_"," ")}</span><button type="button" className="button button-secondary button-small" onClick={()=>onNavigate("production")}>{t("Open","فتح")}</button></article>)}</div> : <div className="empty-state"><span className="empty-state-icon"><Icon name="check" size={18}/></span><h3>{t("No matching tasks","لا توجد مهام مطابقة")}</h3><p>{t("Try another filter or search term.","جرّبي فلترًا أو كلمة بحث مختلفة.")}</p></div>}
    </div>
  </section>;
}
