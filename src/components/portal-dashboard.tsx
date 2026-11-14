"use client";

import { Icon, type IconName } from "@/components/flow-icons";
import { formatDate, formatMoney, statusLabel, type PortalDashboardData, type PortalRow } from "@/lib/portal-types";

export type DashboardAction = "product" | "project" | "service" | "upload";

type Props = {
  data: PortalDashboardData;
  user: PortalRow;
  organization: PortalRow | null;
  language: "en" | "ar";
  onNavigate: (view: string) => void;
  onAction: (action: DashboardAction) => void;
};

const statDefinitions: { key: keyof NonNullable<PortalDashboardData["stats"]>; label: string; foot: string; icon: IconName }[] = [
  { key: "products", label: "Products submitted", foot: "Across your workspace", icon: "products" },
  { key: "inProduction", label: "In production", foot: "Currently moving through FLOW", icon: "production" },
  { key: "awaitingApproval", label: "Awaiting approval", foot: "Your review keeps work moving", icon: "approvals" },
  { key: "activeProjects", label: "Active projects", foot: "Projects with work in progress", icon: "projects" },
];

const quickActions: { title: string; icon: IconName; action: DashboardAction }[] = [
  { title: "Add a product", icon: "plus", action: "product" },
  { title: "Create a project", icon: "projects", action: "project" },
  { title: "Request a service", icon: "spark", action: "service" },
  { title: "Upload files", icon: "upload", action: "upload" },
];

function StatusBadge({ status }: { status: unknown }) {
  const value = typeof status === "string" ? status : "pending";
  return <span className={`status-badge ${value}`}>{statusLabel(value)}</span>;
}

function EmptyState({ icon, title, detail, action, button }: { icon: IconName; title: string; detail: string; action?: () => void; button?: string }) {
  return <div className="empty-state"><span className="empty-state-icon"><Icon name={icon} size={18} /></span><h3>{title}</h3><p>{detail}</p>{button && action && <button type="button" className="button button-secondary button-small" onClick={action}>{button}<Icon name="arrow" size={14} /></button>}</div>;
}

export function PortalDashboard({ data, user, organization, language, onNavigate, onAction }: Props) {
  const t = (en: string, ar: string) => language === "ar" ? ar : en;
  const stats = data.stats;
  const arText: Record<string, string> = { "Products submitted": "المنتجات المقدمة", "Across your workspace": "في مساحة عملك", "In production": "قيد التنفيذ", "Currently moving through FLOW": "تتم معالجتها حاليًا عبر FLOW", "Awaiting approval": "بانتظار الموافقة", "Your review keeps work moving": "مراجعتك تساعد على استمرار العمل", "Active projects": "المشروعات النشطة", "Projects with work in progress": "مشروعات قيد التنفيذ", "Add a product": "إضافة منتج", "Create a project": "إنشاء مشروع", "Request a service": "طلب خدمة", "Upload files": "رفع ملفات" };
  const projects = data.projects || [];
  const activity = data.activity || [];
  const displayName = String(user.fullName || organization?.contactPerson || "there").split(" ")[0];
  const today = new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const isAdmin = user.role === "admin" || user.role === "production_manager";

  return (
    <div className="dashboard-page">
      <section className="welcome-banner">
        <div className="welcome-copy"><span className="eyebrow">{today} · {isAdmin ? t("FLOW OPERATIONS", "عمليات FLOW") : t("CLIENT WORKSPACE", "مساحة عمل العميل")}</span><h2>{isAdmin ? t("Good to see you,", "سعداء بوجودك،") : t("Good to see you,", "سعداء بوجودك،")} <em>{displayName}.</em></h2><p>{isAdmin ? t("Here’s what’s moving across FLOW today.", "إليك آخر المستجدات في FLOW اليوم.") : t("Here’s the latest across your FLOW workspace.", "إليك آخر المستجدات في مساحة عملك على FLOW.")}</p></div>
        {!isAdmin && <div className="welcome-meta">
          <div className="welcome-meta-item"><span>Workspace</span><b>{organization?.companyName || t("Your company", "شركتك")}</b></div>
          <div className="welcome-meta-item"><span>Account manager</span><b>{projects.find((project) => project.accountManagerId)?.accountManagerName || t("FLOW team", "فريق FLOW")}<small>{projects.some((project) => project.accountManagerId) ? t("assigned", "تم التعيين") : t("here to help", "جاهز للمساعدة")}</small></b></div>
        </div>}
        {isAdmin && <div className="welcome-meta"><div className="welcome-meta-item"><span>Workspace</span><b>FLOW operations</b></div><div className="welcome-meta-item"><span>Today</span><b>{formatDate(new Date(), language)}</b></div></div>}
      </section>

      <section className="stats-grid" aria-label={t("Workspace statistics", "إحصائيات مساحة العمل")}>
        {statDefinitions.map((stat) => <article className="stat-card" key={stat.key}><div className="stat-top"><span>{t(stat.label, arText[stat.label] || stat.label)}</span><span className="stat-icon"><Icon name={stat.icon} size={16} /></span></div><strong>{stats?.[stat.key] ?? 0}</strong><small>{t(stat.foot, arText[stat.foot] || stat.foot)}</small></article>)}
      </section>

      <div className="section-header"><div><span className="section-label">WORK IN MOTION</span><h2 className="section-title">Your projects</h2></div><button className="subtle-link" type="button" onClick={() => onNavigate("projects")}>View all projects <Icon name="arrow" size={14} /></button></div>
      <div className="dashboard-grid">
        <section className="panel panel-pad">
          {projects.length ? <div className="project-list">
            {projects.slice(0, 5).map((project) => <button className="project-row project-row-button" type="button" key={project.id} onClick={() => onNavigate("projects")}>
              <span className="project-name"><b>{project.name}</b><span>{project.projectCode} · {project.productCount || 0} products</span></span>
              <span><span className="table-cell-label">Status</span><StatusBadge status={project.status} /></span>
              <span className="project-manager-cell"><span className="table-cell-label">Delivery</span><b className="project-delivery-date">{project.dueDate ? formatDate(project.dueDate, language, { day: "numeric", month: "short" }) : t("Date not set", "لم يُحدد التاريخ")}</b></span>
              <span className="progress-cell"><span className="table-cell-label">Progress</span><span className="progress-line"><span style={{ width: `${Math.max(0, Math.min(100, Number(project.progress || 0)))}%` }} /></span><small>{Number(project.progress || 0)}% complete</small></span>
              <Icon name="chevron" size={16} className="project-chevron" />
            </button>)}
          </div> : <EmptyState icon="projects" title=t("Your first project starts here", "مشروعك الأول يبدأ من هنا") detail=t("Create a project or submit products and the FLOW team will help shape the next steps.", "أنشئ مشروعًا أو أضف منتجاتك وسيساعدك فريق FLOW في تحديد الخطوات التالية.") action={() => onAction("project")} button=t("Create a project", "إنشاء مشروع") />}
        </section>

        <div className="dashboard-side-stack">
          <section className="panel panel-pad">
            <div className="section-header"><div><span className="section-label">KEEP THINGS MOVING</span><h2 className="section-title">Needs your attention</h2></div><span className="stat-icon"><Icon name="approvals" size={16} /></span></div>
            {(stats?.awaitingApproval || 0) > 0 ? <div className="pending-row"><div className="pending-row-copy"><b>{stats?.awaitingApproval} item{stats?.awaitingApproval === 1 ? "" : "s"} ready for your review</b><span>Open the approval workspace to respond</span></div><button className="icon-button" type="button" aria-label={t("Review approvals", "مراجعة الموافقات")} onClick={() => onNavigate("approvals")}><Icon name="arrow" size={15} /></button></div> : <div className="attention-empty"><span className="attention-check"><Icon name="check" size={15} /></span><span><b>You’re all caught up</b><small>No approvals are waiting right now.</small></span></div>}
            <div className="card-rule" />
            <div className="mini-metric-grid"><button type="button" onClick={() => onNavigate("services")}><b>{stats?.serviceRequests ?? 0}</b><span>Open service requests</span></button><button type="button" onClick={() => onNavigate("billing")}><b>{stats?.outstandingInvoices ?? 0}</b><span>Outstanding invoices</span></button></div>
            {(stats?.outstandingAmount || 0) > 0 && <div className="amount-note">Outstanding balance <b>{formatMoney(stats?.outstandingAmount, "EGP", language)}</b></div>}
          </section>
          <section className="service-request-card"><div className="section-header"><div><span className="section-label">NEED A HAND?</span><h2 className="section-title">A new way to move forward</h2></div><span className="stat-icon"><Icon name="spark" size={16} /></span></div><p>Request a service or send a note to your FLOW account manager. We’ll pick it up from your workspace.</p><button type="button" className="button button-primary button-small" onClick={() => onAction("service")}>Request a service <Icon name="arrow" size={14} /></button></section>
        </div>
      </div>

      <section className="quick-actions" aria-label={t("Quick actions", "إجراءات سريعة")}>{quickActions.map((item) => <button className="quick-action" type="button" key={item.action} onClick={() => onAction(item.action)}><span className="quick-action-icon"><Icon name={item.icon} size={16} /></span><span>{t(item.title, arText[item.title] || item.title)}</span></button>)}</section>

      <section className="panel panel-pad activity-panel">
        <div className="section-header"><div><span className="section-label">FROM YOUR WORKSPACE</span><h2 className="section-title">Recent activity</h2></div><button type="button" className="subtle-link" onClick={() => onNavigate("notifications")}>All updates <Icon name="arrow" size={14} /></button></div>
        {activity.length ? <div className="activity-list">{activity.slice(0, 6).map((item) => <div className="activity-item" key={item.id}><span className="activity-icon"><Icon name={activityIcon(item.entityType)} size={13} /></span><div className="activity-copy"><b>{item.description}</b><span>{formatDate(item.createdAt, language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div></div>)}</div> : <EmptyState icon="clock" title=t("Your activity will appear here", "سيظهر نشاطك هنا") detail=t("Product submissions, updates, approvals and messages will be collected in one place.", "ستظهر هنا طلبات المنتجات والتحديثات والموافقات والرسائل في مكان واحد.") />}
      </section>
    </div>
  );
}

function activityIcon(entityType: unknown): IconName {
  if (entityType === "product") return "products";
  if (entityType === "project") return "projects";
  if (entityType === "invoice" || entityType === "payment") return "billing";
  if (entityType === "message") return "messages";
  if (entityType === "approval") return "approvals";
  if (entityType === "file") return "file";
  return "spark";
}
