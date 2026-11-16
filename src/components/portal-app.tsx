"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthScreen, type AuthUserView, type OrganizationView } from "@/components/auth-screen";
import { InstallAppButton } from "@/components/install-app-button";
import { Icon, type IconName } from "@/components/flow-icons";
import { PortalDashboard, type DashboardAction } from "@/components/portal-dashboard";
import { PortalModal, type ModalName, type ModalState } from "@/components/portal-modal";
import { PortalSections } from "@/components/portal-sections";
import { formatDate, initials, requestJson, type PortalDashboardData, type PortalRow } from "@/lib/portal-types";

const navLabels: Record<string, { en: string; ar: string }> = {
  home: { en: "Overview", ar: "نظرة عامة" }, calendar: { en: "Calendar & deadlines", ar: "التقويم والمواعيد" }, projects: { en: "Projects", ar: "المشاريع" }, products: { en: "Products", ar: "المنتجات" },
  production: { en: "Production", ar: "الإنتاج" }, photography: { en: "Photography", ar: "التصوير" }, content: { en: "Content studio", ar: "استوديو المحتوى" },
  approvals: { en: "Approvals", ar: "الموافقات" }, services: { en: "Services", ar: "الخدمات" }, marketplace: { en: "Marketplaces", ar: "المنصات" },
  billing: { en: "Invoices", ar: "الفواتير" }, payments: { en: "Payments", ar: "المدفوعات" }, messages: { en: "Messages", ar: "الرسائل" }, reports: { en: "Reports", ar: "التقارير" },
  settings: { en: "Workspace settings", ar: "إعدادات مساحة العمل" }, clients: { en: "Clients", ar: "العملاء" }, deals: { en: "Deals & contracts", ar: "الاتفاقات والعقود" }, team: { en: "Team", ar: "الفريق" },
  subscriptions: { en: "Plans & subscriptions", ar: "الخطط والاشتراكات" }, audit: { en: "Audit log", ar: "سجل التدقيق" }, notifications: { en: "Notifications", ar: "الإشعارات" },
};

const views: Record<string, { title: string; subtitle: string }> = {
  home: { title: "Workspace overview", subtitle: "Your FLOW activity, projects, and next steps." },
  calendar: { title: "Calendar & deadlines", subtitle: "See project delivery dates and production deadlines in one place." },
  projects: { title: "Projects", subtitle: "A clear view of every project and delivery milestone." },
  products: { title: "Products", subtitle: "Your product catalog and production progress, all in one place." },
  production: { title: "Production board", subtitle: "Track the real workflow stages attached to each product." },
  photography: { title: "Photography studio", subtitle: "Review photography tasks, source files, and approved versions." },
  content: { title: "Content studio", subtitle: "Create and review bilingual marketplace listing versions." },
  approvals: { title: "Approvals", subtitle: "Review deliverables and send clear feedback to the FLOW team." },
  services: { title: "Services & requests", subtitle: "Explore FLOW’s verified services and track your requests." },
  marketplace: { title: "Marketplace operations", subtitle: "View listing records and integration readiness by channel." },
  billing: { title: "Invoices", subtitle: "Review invoices, payment records, and remaining balances." },
  payments: { title: "Payments", subtitle: "A traceable ledger of payment confirmations and reconciliation." },
  messages: { title: "Messages", subtitle: "Keep project conversations and account questions together." },
  reports: { title: "Reports & analytics", subtitle: "Explore activity drawn from your actual FLOW workspace records." },
  settings: { title: "Workspace settings", subtitle: "Keep your company and onboarding information up to date." },
  clients: { title: "Client workspaces", subtitle: "Review onboarding, account assignments, and client history." },
  deals: { title: "Deals & contracts", subtitle: "Keep the latest client agreement, commercial terms, and contract copies together." },
  team: { title: "Team management", subtitle: "Manage FLOW staff roles and active access." },
  subscriptions: { title: "Plans & subscriptions", subtitle: "Configure commercial terms and monitor real product usage." },
  audit: { title: "Audit log", subtitle: "A read-only history of important administrative actions." },
  notifications: { title: "Notifications", subtitle: "Recent updates and account alerts for your workspace." },
};

const navGroups: { label: string; items: { id: string; icon: IconName; roles?: string[] }[] }[] = [
  { label: "Workspace", items: [{ id: "home", icon: "grid" }, { id: "calendar", icon: "calendar" }, { id: "projects", icon: "projects" }, { id: "products", icon: "products" }] },
  { label: "Production flow", items: [{ id: "production", icon: "production", roles: ["admin", "account_manager", "photographer", "content_creator", "production_manager"] }, { id: "photography", icon: "camera", roles: ["client", "admin", "account_manager", "photographer", "production_manager"] }, { id: "content", icon: "file", roles: ["client", "admin", "account_manager", "content_creator", "production_manager"] }, { id: "approvals", icon: "approvals" }] },
  { label: "Business", items: [{ id: "services", icon: "services" }, { id: "marketplace", icon: "marketplace" }, { id: "billing", icon: "billing", roles: ["client", "admin", "account_manager", "production_manager"] }, { id: "payments", icon: "receipt", roles: ["admin", "account_manager", "production_manager"] }] },
  { label: "Communication", items: [{ id: "messages", icon: "messages" }, { id: "reports", icon: "reports", roles: ["client", "admin", "account_manager", "production_manager"] }] },
  { label: "FLOW team", items: [{ id: "clients", icon: "clients", roles: ["admin", "account_manager", "production_manager"] }, { id: "deals", icon: "file", roles: ["admin", "client"] }, { id: "team", icon: "team", roles: ["admin"] }, { id: "subscriptions", icon: "billing", roles: ["admin", "client"] }, { id: "audit", icon: "shield", roles: ["admin"] }] },
  { label: "Account", items: [{ id: "settings", icon: "settings" }] },
];

function roleLabel(role: string, language: "en" | "ar" = "en") {
  const labels: Record<string, { en: string; ar: string }> = {
    admin: { en: "Administrator", ar: "مدير النظام" },
    account_manager: { en: "Account manager", ar: "مدير حساب" },
    production_manager: { en: "Production manager", ar: "مدير الإنتاج" },
    content_creator: { en: "Content creator", ar: "منشئ المحتوى" },
    photographer: { en: "Photographer", ar: "مصور" },
    client: { en: "Client", ar: "عميل" },
  };
  return labels[role]?.[language] || role.replaceAll("_", " ");
}

function logo(variant: "green" | "white" = "green") {
  const src = variant === "white"
    ? "https://www.flow-agency-eg.com/assets/logo/flow-lockup-white.png"
    : "https://www.flow-agency-eg.com/assets/logo/flow-lockup-green.png";
  return <img className="flow-lockup" src={src} alt="FLOW Agency" />;
}

export function PortalApp() {
  const [user, setUser] = useState<AuthUserView | null>(null);
  const [organization, setOrganization] = useState<OrganizationView | null>(null);
  const [dashboardData, setDashboardData] = useState<PortalDashboardData | null>(null);
  const [booting, setBooting] = useState(true);
  const [language, setLanguage] = useState<"en" | "ar">(() => {
    if (typeof window === "undefined") return "en";
    const saved = window.localStorage.getItem("flow-language");
    return saved === "ar" ? "ar" : "en";
  });
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("flow-theme") === "dark" ? "dark" : "light";
  });
  const [activeView, setActiveView] = useState("home");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [notifications, setNotifications] = useState<PortalRow[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0f1711" : "#143c28");
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    window.localStorage.setItem("flow-theme", theme);
  }, [theme, language]);

  const toggleTheme = () => setTheme((current) => current === "light" ? "dark" : "light");
  const text = (en: string, ar: string) => language === "ar" ? ar : en;

  const loadSession = useCallback(async () => {
    setBooting(true);
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) {
        setUser(null);
        setOrganization(null);
        setDashboardData(null);
        return;
      }
      const result = await response.json();
      setUser(result.user);
      setOrganization(result.organization);
      const portalResponse = await fetch("/api/portal", { cache: "no-store" });
      if (portalResponse.ok) setDashboardData(await portalResponse.json());
      else setDashboardData(null);
    } catch {
      setUser(null);
      setOrganization(null);
      setDashboardData(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => { void loadSession(); }, [loadSession]);

  useEffect(() => {
    if (!user || user.status !== "active" || user.organizationStatus === "pending") return;
    requestJson<{ notifications: PortalRow[]; unread: number }>("/api/notifications")
      .then((result) => { setNotifications(result.notifications); setUnreadCount(result.unread); })
      .catch(() => undefined);
  }, [user, refreshToken]);

  const showToast = useCallback((message: string, error = false) => {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 3800);
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshToken((value) => value + 1);
    await loadSession();
  }, [loadSession]);

  const handleModalDone = async (message: string) => {
    setModal(null);
    showToast(message);
    await refreshAll();
  };

  const openModal = (type: ModalName, payload?: PortalRow) => setModal({ type, payload });
  const openFromDashboard = (action: DashboardAction) => openModal(action);

  const logout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* cookie expires on its own */ }
    setUser(null);
    setOrganization(null);
    setDashboardData(null);
    setActiveView("home");
    setNotificationOpen(false);
    setMobileNavOpen(false);
  };

  const markNotificationRead = async (notification: PortalRow) => {
    if (!notification.readAt) {
      try {
        await requestJson("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: notification.id }) });
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch (error) { showToast(error instanceof Error ? error.message : "Could not update notification.", true); }
    }
    setNotificationOpen(false);
    if (notification.href) setActiveView(String(notification.href).includes("messages") ? "messages" : String(notification.href).includes("approvals") ? "approvals" : "home");
  };

  const groupLabels: Record<string, string> = { Workspace: text("Workspace", "مساحة العمل"), "Production flow": text("Production flow", "مسار الإنتاج"), Business: text("Business", "إدارة الأعمال"), Communication: text("Communication", "التواصل"), "FLOW team": text("FLOW team", "فريق FLOW"), Account: text("Account", "الحساب") };
  const subtitleTranslations: Record<string, string> = {
    home: text("Your FLOW activity, projects, and next steps.", "نشاطك ومشروعاتك والخطوات التالية على FLOW."), projects: text("A clear view of every project and delivery milestone.", "تابع كل مشروع ومراحل التسليم بوضوح."), products: text("Your product catalog and production progress, all in one place.", "كتالوج منتجاتك ومراحل تنفيذها في مكان واحد."), production: text("Track the real workflow stages attached to each product.", "تابع مراحل تنفيذ كل منتج خطوة بخطوة."), photography: text("Review photography tasks, source files, and approved versions.", "راجع مهام التصوير والملفات الأصلية والنسخ المعتمدة."), content: text("Create and review bilingual marketplace listing versions.", "أنشئ وراجع محتوى قوائم المنتجات باللغتين."), approvals: text("Review deliverables and send clear feedback to the FLOW team.", "راجع التسليمات وأرسل ملاحظاتك لفريق FLOW."), services: text("Explore FLOW’s verified services and track your requests.", "استكشف خدمات FLOW وتابع طلباتك."), marketplace: text("View listing records and integration readiness by channel.", "تابع قوائم المنتجات وحالة ربط كل منصة."), billing: text("Review invoices, payment records, and remaining balances.", "راجع الفواتير والمدفوعات والأرصدة المستحقة."), payments: text("A traceable ledger of payment confirmations and reconciliation.", "سجل واضح لتأكيد المدفوعات ومطابقتها."), messages: text("Keep project conversations and account questions together.", "تابع محادثات المشروعات واستفسارات الحساب في مكان واحد."), reports: text("Explore activity drawn from your actual FLOW workspace records.", "اطلع على تقارير مبنية على بيانات مساحة عملك الفعلية."), settings: text("Keep your company and onboarding information up to date.", "حدّث بيانات شركتك ومعلومات التسجيل."), clients: text("Review onboarding, account assignments, and client history.", "راجع تسجيل العملاء وتوزيع الحسابات وسجل كل عميل."), deals: text("Keep the latest client agreement, commercial terms, and contract copies together.", "تابع اتفاقات العملاء والشروط التجارية ونسخ العقود."), team: text("Manage FLOW staff roles and active access.", "أدر أدوار فريق FLOW وصلاحيات الدخول."), subscriptions: text("Configure commercial terms and monitor real product usage.", "اضبط شروط الاشتراك وتابع الاستخدام الفعلي."), audit: text("A read-only history of important administrative actions.", "سجل للقراءة فقط بأهم الإجراءات الإدارية."), notifications: text("Recent updates and account alerts for your workspace.", "آخر التحديثات والتنبيهات الخاصة بمساحة عملك.")
  };

  const navItems = useMemo(() => navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || (user ? item.roles.includes(user.role) : false)),
  })).filter((group) => group.items.length), [user, language]);

  if (booting) return <div className="loading-screen"><span className="loading-mark" aria-label="Loading FLOW portal" /></div>;
  if (!user) return <AuthScreen onAuthenticated={() => { void loadSession(); }} language={language} onLanguageChange={(next) => { setLanguage(next); window.localStorage.setItem("flow-language", next); }} />;

  if (user.status === "pending" || user.organizationStatus === "pending") {
    return <main className="pending-screen" dir={language === "ar" ? "rtl" : "ltr"}><section className="pending-card">{logo()}<span className="eyebrow">{text("CLIENT WORKSPACE REVIEW", "مراجعة مساحة عمل العميل")}</span><h1>{text("Welcome to FLOW,", "مرحبًا بك في FLOW،")} {user.fullName.split(" ")[0]}.</h1><p>{text("Your account request has been received. A FLOW team member will review the workspace before production access is enabled.", "تم استلام طلب حسابك. سيراجع فريق FLOW مساحة العمل قبل تفعيل الوصول إلى الإنتاج.")}</p><div className="pending-status"><span className="status-badge pending">{text("Awaiting review", "بانتظار المراجعة")}</span>{user.email && <span>{user.email}</span>}</div><p className="pending-note">{text("If email verification is configured, check your inbox for a secure confirmation link. Until activation, workspace records remain unavailable.", "إذا كان تأكيد البريد الإلكتروني مفعّلًا، تحقق من بريدك بحثًا عن رابط التأكيد. ستظل بيانات مساحة العمل غير متاحة حتى التفعيل.")}</p><div className="pending-actions"><button type="button" className="button button-secondary" onClick={() => void loadSession()}><Icon name="refresh" size={15} />{text("Check status", "التحقق من الحالة")}</button><button type="button" className="button button-primary" onClick={() => void logout()}><Icon name="logout" size={15} />{text("Sign out", "تسجيل الخروج")}</button></div></section></main>;
  }

  const viewMeta = views[activeView] || views.home;
  const translatedTitle = navLabels[activeView]?.[language] || viewMeta.title;
  const isAdmin = user.role === "admin";
  const isClient = user.role === "client";
  const roleScope = user.role;
  const actions: Record<string, { label: string; icon: IconName; modal: ModalName }[]> = {
    home: isClient ? [{ label: text("Add product", "إضافة منتج"), icon: "plus", modal: "product" }, { label: text("Request a service", "طلب خدمة"), icon: "spark", modal: "service" }] : [{ label: text("Add product", "إضافة منتج"), icon: "plus", modal: "product" }, { label: text("Create project", "إنشاء مشروع"), icon: "plus", modal: "project" }],
    products: [{ label: text("Upload files", "رفع ملفات"), icon: "upload", modal: "upload" }, { label: text("Add product", "إضافة منتج"), icon: "plus", modal: "product" }],
    projects: [{ label: text("New project", "مشروع جديد"), icon: "plus", modal: "project" }],
    services: [{ label: text("Request a service", "طلب خدمة"), icon: "plus", modal: "service" }],
    clients: [{ label: text("Add client", "إضافة عميل"), icon: "plus", modal: "client" }],
    team: [{ label: text("Add team member", "إضافة عضو للفريق"), icon: "plus", modal: "team" }],
    billing: isAdmin ? [{ label: text("Create invoice", "إنشاء فاتورة"), icon: "plus", modal: "invoice" }] : [],
    subscriptions: isAdmin ? [{ label: text("Configure plan", "إعداد الخطة"), icon: "plus", modal: "plan" }] : [],
    photography: [{ label: text("Upload photography", "رفع الصور"), icon: "upload", modal: "upload" }],
  };
  const titleActions = actions[activeView] || [];

  return (
    <div className={`portal-shell ${mobileNavOpen ? "mobile-nav-open" : ""}`} dir={language === "ar" ? "rtl" : "ltr"}>
      {mobileNavOpen && <button className="mobile-sidebar-scrim" type="button" aria-label={text("Close navigation", "إغلاق القائمة")} onClick={() => setMobileNavOpen(false)} />}
      <aside className="portal-sidebar">
        <div className="sidebar-brand">{logo("white")}</div>
        <div className="sidebar-workspace"><span className="company-mark">{initials(organization?.companyName || "FLOW")}</span><span className="sidebar-workspace-copy"><b>{organization?.companyName || "FLOW Agency"}</b><span>{isClient ? text("Client workspace", "مساحة عمل العميل") : text("Internal workspace", "مساحة العمل الداخلية")}</span></span></div>
        <nav className="sidebar-nav" aria-label={text("Main navigation", "القائمة الرئيسية")}>
          {navItems.map((group) => <div className="nav-group" key={group.label}><p className="sidebar-section-label">{groupLabels[group.label] || group.label}</p>{group.items.map((item) => <button key={item.id} type="button" className={`nav-item ${activeView === item.id ? "active" : ""}`} onClick={() => { setActiveView(item.id); setMobileNavOpen(false); }}><Icon name={item.icon} size={16} /><span>{navLabels[item.id]?.[language] || navLabels[item.id]?.[language] || views[item.id]?.title || item.id}</span>{item.id === "approvals" && dashboardData?.stats?.awaitingApproval ? <span className="nav-count">{dashboardData.stats.awaitingApproval}</span> : item.id === "messages" && unreadCount ? <span className="nav-count">{unreadCount}</span> : null}</button>)}</div>)}
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-help"><b>{text("Need support?", "محتاج مساعدة؟")}</b><p>{text("Talk to the FLOW team about your products or next steps.", "تواصل مع فريق FLOW بخصوص منتجاتك أو خطواتك القادمة.")}</p><button type="button" onClick={() => setActiveView("messages")}>{text("Message your team", "راسل فريقك")} <Icon name="arrow" size={12} /></button></div><div className="sidebar-user"><span className={`avatar ${!isClient ? "avatar-staff" : ""}`}>{initials(user.fullName)}</span><span className="sidebar-user-details"><b>{user.fullName}</b><span>{roleLabel(user.role, language)}</span></span><button className="sidebar-logout" type="button" aria-label={text("Sign out", "تسجيل الخروج")} onClick={() => void logout()}><Icon name="logout" size={16} /></button></div></div>
      </aside>

      <div className="portal-main">
        <header className="portal-topbar">
          <div className="topbar-left"><button className="mobile-menu" type="button" onClick={() => setMobileNavOpen(true)} aria-label={text("Open navigation", "فتح القائمة")}><Icon name="menu" size={18} /></button><div className="topbar-breadcrumb"><span>FLOW</span><Icon name="chevron" size={12} /><b>{translatedTitle}</b></div></div>
          <div className="topbar-actions"><InstallAppButton language={language} /><button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={theme === "light" ? text("Switch to dark mode", "التبديل للوضع الداكن") : text("Switch to light mode", "التبديل للوضع الفاتح")} title={theme === "light" ? text("Dark mode", "الوضع الداكن") : text("Light mode", "الوضع الفاتح")}><span aria-hidden="true">{theme === "light" ? "◐" : "☼"}</span><span className="theme-toggle-label">{theme === "light" ? text("Dark", "داكن") : text("Light", "فاتح")}</span></button><button className="topbar-icon-button" type="button" aria-label={text("Search products", "البحث عن المنتجات")} onClick={() => setActiveView("products")}><Icon name="search" size={17} /></button><div className="notification-anchor"><button className="topbar-icon-button" type="button" aria-label={text("Notifications", "الإشعارات")} onClick={() => { setNotificationOpen((open) => !open); setActiveView((current) => current); }}><Icon name="bell" size={17} />{unreadCount > 0 && <span className="notification-dot" />}</button>{notificationOpen && <div className="notification-popover"><div className="notification-popover-head"><span><b>{text("Notifications", "الإشعارات")}</b><small>{unreadCount ? (language === "ar" ? `${unreadCount} غير مقروء` : `${unreadCount} unread`) : text("All caught up", "لا توجد إشعارات جديدة")}</small></span><button type="button" onClick={async () => { await requestJson("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => undefined); setNotifications((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() }))); setUnreadCount(0); }}>{text("Mark all read", "تحديد الكل كمقروء")}</button></div>{notifications.length ? notifications.slice(0, 7).map((item) => <button key={item.id} type="button" className={`notification-item ${item.readAt ? "read" : ""}`} onClick={() => void markNotificationRead(item)}><span className="notification-item-dot" /><span><b>{item.title}</b><small>{item.body}</small><time>{formatDate(item.createdAt, language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></span></button>) : <div className="notification-empty"><Icon name="bell" size={18} /><span>{text("No notifications yet.", "لا توجد إشعارات حتى الآن.")}</span></div>}</div>}</div><span className="topbar-divider" /><button className="language-toggle topbar-language" type="button" onClick={() => { const next = language === "en" ? "ar" : "en"; setLanguage(next); window.localStorage.setItem("flow-language", next); }}><Icon name="globe" size={15} />{language === "en" ? "العربية" : "English"}</button><span className="topbar-divider" /><div className="topbar-profile"><span className={`avatar ${!isClient ? "avatar-staff" : ""}`}>{initials(user.fullName)}</span><span className="topbar-profile-copy"><b>{user.fullName.split(" ")[0]}</b><span>{roleLabel(user.role)}</span></span></div></div>
        </header>

        <main className="portal-content">
          <section className="page-heading"><div><h1>{translatedTitle}</h1><p>{subtitleTranslations[activeView] || viewMeta.subtitle}</p></div>{titleActions.length > 0 && <div className="page-actions">{titleActions.map((action) => <button type="button" key={action.modal} className={`button ${action.modal === "product" ? "button-primary" : "button-secondary"}`} onClick={() => openModal(action.modal)}><Icon name={action.icon} size={15} />{action.label}</button>)}</div>}</section>
          {activeView === "home" && dashboardData?.stats ? <PortalDashboard data={dashboardData} user={user as unknown as PortalRow} organization={organization as unknown as PortalRow} language={language} onNavigate={setActiveView} onAction={openFromDashboard} /> : <PortalSections view={activeView} user={user} organization={organization} language={language} refreshToken={refreshToken} onOpenModal={openModal} onToast={showToast} onRefresh={refreshAll} onNavigate={setActiveView} />}
        </main>
      </div>
      <PortalModal modal={modal} user={user} organization={organization} language={language} onClose={() => setModal(null)} onDone={(message) => void handleModalDone(message)} />
      {toast && <div className="toast-region"><div className={`toast ${toast.error ? "error" : ""}`}><Icon name={toast.error ? "close" : "check"} size={15} />{toast.message}</div></div>}
    </div>
  );
}
