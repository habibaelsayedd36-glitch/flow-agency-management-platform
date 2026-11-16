"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/flow-icons";
import { requestJson, type PortalRow } from "@/lib/portal-types";

type Props = { language: "en" | "ar"; onNavigate: (view: string) => void };
const dateKey = (value: unknown) => {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
};

export function CalendarView({ language, onNavigate }: Props) {
  const ar = language === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [events, setEvents] = useState<PortalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [mode, setMode] = useState<"month" | "upcoming">("month");

  useEffect(() => {
    let active = true;
    requestJson<{ events: PortalRow[] }>("/api/calendar")
      .then((result) => { if (active) setEvents(result.events || []); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not load calendar."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, PortalRow[]>();
    for (const event of events) {
      const key = dateKey(event.date);
      if (!key) continue;
      map.set(key, [...(map.get(key) || []), event]);
    }
    return map;
  }, [events]);
  const monthDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(Math.ceil((offset + count) / 7) * 7)].map((_, index) => {
      const day = index - offset + 1;
      return day < 1 || day > count ? null : new Date(month.getFullYear(), month.getMonth(), day);
    });
  }, [month]);
  const selectedEvents = grouped.get(selected) || [];
  const todayKey = dateKey(new Date());
  const overdue = events.filter((event) => dateKey(event.date) < todayKey && event.status !== "completed");
  const upcoming = events.filter((event) => dateKey(event.date) >= todayKey).slice(0, 12);
  const weekdays = ar ? ["الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت","الأحد"] : ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const monthLabel = new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", { month: "long", year: "numeric" }).format(month);
  const prettyDate = (value: unknown) => new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(String(value)));
  const eventTitle = (event: PortalRow) => event.kind === "project" ? t("Project deadline", "موعد تسليم مشروع") : t("Production task", "مهمة إنتاج");
  const eventRows = mode === "upcoming" ? upcoming : selectedEvents;

  return <section className="calendar-workspace">
    <div className="calendar-summary-grid">
      <article className="listing-ops-card"><span className="section-label">{t("SCHEDULED ITEMS", "العناصر المجدولة")}</span><b>{events.length}</b><small>{t("Project and production deadlines", "مواعيد المشروعات ومراحل الإنتاج")}</small></article>
      <article className={overdue.length ? "listing-ops-card needs-attention" : "listing-ops-card"}><span className="section-label">{t("OVERDUE", "متأخر")}</span><b>{overdue.length}</b><small>{t("Items past their deadline", "عناصر تجاوزت موعدها")}</small></article>
      <article className="listing-ops-card"><span className="section-label">{t("UPCOMING", "القادمة")}</span><b>{upcoming.length}</b><small>{t("Next scheduled milestones", "أقرب المواعيد القادمة")}</small></article>
    </div>
    <div className="panel panel-pad calendar-panel">
      <div className="section-header calendar-toolbar">
        <div><span className="section-label">{t("FLOW SCHEDULE", "جدول FLOW")}</span><h2 className="section-title">{t("Calendar & deadlines", "التقويم والمواعيد النهائية")}</h2></div>
        <div className="calendar-actions">
          <button type="button" className="button button-secondary button-small" onClick={() => { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelected(todayKey); }}>{t("Today", "اليوم")}</button>
          <button type="button" className={`button button-small ${mode === "month" ? "button-primary" : "button-secondary"}`} onClick={() => setMode("month")}>{t("Month", "شهر")}</button>
          <button type="button" className={`button button-small ${mode === "upcoming" ? "button-primary" : "button-secondary"}`} onClick={() => setMode("upcoming")}>{t("Upcoming", "القادمة")}</button>
        </div>
      </div>
      {loading ? <div className="module-loading"><span className="loading-small" />{t("Loading calendar…", "جارٍ تحميل التقويم…")}</div> : error ? <div className="error-state">{error}</div> : <>
        {mode === "month" && <div className="calendar-grid-wrap">
          <div className="calendar-month-head"><button className="icon-button" type="button" aria-label={t("Previous month","الشهر السابق")} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))}><Icon name="chevron" size={16} /></button><b>{monthLabel}</b><button className="icon-button calendar-next" type="button" aria-label={t("Next month","الشهر التالي")} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))}><Icon name="chevron" size={16} /></button></div>
          <div className="calendar-grid">{weekdays.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}{monthDays.map((day, index) => {
            if (!day) return <div className="calendar-day calendar-day-empty" key={index} />;
            const key = dateKey(day); const count = grouped.get(key)?.length || 0;
            return <button type="button" key={key} className={`calendar-day ${selected === key ? "is-selected" : ""} ${todayKey === key ? "is-today" : ""}`} onClick={() => setSelected(key)}>
              <span>{new Intl.NumberFormat(ar ? "ar-EG" : "en").format(day.getDate())}</span>{count > 0 && <i>{count}</i>}
            </button>;
          })}</div>
        </div>}
        <div className="calendar-event-list">
          <div className="section-header"><div><span className="section-label">{mode === "upcoming" ? t("NEXT MILESTONES", "المواعيد التالية") : prettyDate(selected)}</span><h3 className="section-title">{mode === "upcoming" ? t("Coming up", "قريبًا") : t("Scheduled for this day", "المجدول في هذا اليوم")}</h3></div></div>
          {eventRows.length ? eventRows.map((event) => <button type="button" className="calendar-event-row" key={event.id} onClick={() => onNavigate(String(event.href || "projects"))}>
            <span className={`calendar-event-marker ${event.kind === "project" ? "project" : "task"}`} />
            <span className="calendar-event-main"><b>{event.title}</b><small>{eventTitle(event)}{event.reference ? ` · ${event.reference}` : ""}</small></span>
            <span className="calendar-event-date">{prettyDate(event.date)}</span>
            <span className="status-badge">{String(event.status || "scheduled").replaceAll("_"," ")}</span>
            <Icon name="arrow" size={14} />
          </button>) : <div className="empty-state"><span className="empty-state-icon"><Icon name="calendar" size={18} /></span><h3>{t("Nothing scheduled here", "لا توجد مواعيد هنا")}</h3><p>{t("Project deadlines and assigned production dates will appear here when they are set.", "ستظهر هنا مواعيد تسليم المشروعات ومواعيد مهام الإنتاج عند تحديدها.")}</p></div>}
        </div>
      </>}
    </div>
  </section>;
}
