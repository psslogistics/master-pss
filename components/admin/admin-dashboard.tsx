"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDot,
  Download,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Handshake,
  UserRoundCog,
  Users,
} from "lucide-react";
import {
  actionCategoryOptions,
  dashboardRangeOptions,
  decisionCards,
  getSupportingMetrics,
  type AdminActionCategory,
  type AdminActionItem,
  type SupportingMetricId,
} from "@/components/admin/admin-dashboard-data";
import { useAdmin } from "@/components/admin/admin-provider";
import { Modal, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import Dropdown from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";

const METRIC_STORAGE_KEY = "pss_admin_supporting_metrics_v2";
const DEFAULT_METRICS: SupportingMetricId[] = ["shipments", "clients", "employees", "sla"];
const activitySeries: Record<string, number[]> = {
  today: [28, 38, 34, 48, 51, 62, 59, 72],
  "7-days": [32, 41, 47, 44, 58, 63, 71, 76],
  "30-days": [26, 36, 42, 53, 49, 61, 68, 79],
  quarter: [22, 31, 39, 48, 56, 65, 73, 82],
};

export default function AdminDashboard() {
  const { employees, clients, auditEvents, workspace } = useAdmin();
  const [range, setRange] = useState("7-days");
  const [category, setCategory] = useState<AdminActionCategory>("all");
  const [queueView, setQueueView] = useState<"open" | "critical">("open");
  const [selectedAction, setSelectedAction] = useState<AdminActionItem | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<SupportingMetricId[]>(DEFAULT_METRICS);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now] = useState(() => Date.now());
  const metricsRef = useRef<HTMLDivElement>(null);

  const activeEmployees = employees.filter((employee) => employee.status === "Active").length;
  const activeClients = clients.filter((client) => client.status === "Active").length;
  const invitedEmployees = employees.filter((employee) => employee.status === "Invited").length;
  const unownedRisk = clients.filter((client) => {
    const owner = employees.find((employee) => employee.id === client.assignedToEmployeeId);
    return !owner || owner.status !== "Active";
  }).length;
  const crmDue = workspace.crmFollowUps.filter((followUp) => followUp.status === "Open" && followUp.dueDate <= new Date().toISOString().slice(0, 10));
  const crmAtRisk = clients.filter((client) => (workspace.crmClientHealth[client.id] ?? (client.status !== "Active" || client.openTickets >= 3 || (workspace.wallets.find((wallet) => wallet.clientId === client.id)?.holdAmount ?? 0) > 0 ? "At risk" : "Healthy")) === "At risk");
  const crmUnassigned = workspace.crmProspects.filter((prospect) => !prospect.ownerEmployeeId);
  const liveMetrics = useMemo(() => {
    const delayed = workspace.shipments.filter((shipment) => shipment.eta && new Date(shipment.eta).getTime() < now && !["Delivered", "delivered"].includes(String(shipment.status))).length;
    const openTickets = workspace.tickets.filter((ticket) => !["Resolved", "Closed", "resolved", "closed"].includes(String(ticket.status))).length;
    const slaBreaches = workspace.tickets.filter((ticket) => {
      if (["Resolved", "Closed", "resolved", "closed"].includes(String(ticket.status)) || !ticket.slaDueAt) return false;
      const due = new Date(ticket.slaDueAt).getTime();
      return Number.isFinite(due) && due < now;
    }).length;
    const pendingPickups = workspace.pickups.filter((pickup) => !["Completed", "Cancelled", "completed", "cancelled"].includes(String(pickup.status))).length;
    const billingExposure = workspace.billing.filter((item) => !["Paid", "paid", "settled"].includes(String(item.status))).reduce((sum, item) => sum + Number(item.total || 0), 0);
    return getSupportingMetrics(activeClients, activeEmployees).map((metric) => {
      if (metric.id === "shipments") return { ...metric, value: String(workspace.shipments.length), context: "Production shipment records" };
      if (metric.id === "clients") return { ...metric, value: String(activeClients), context: "Supabase client memberships" };
      if (metric.id === "tickets") return { ...metric, value: String(openTickets), context: `${workspace.tickets.length} total production tickets` };
      if (metric.id === "sla") return { ...metric, value: String(slaBreaches), context: "Open tickets past their production SLA" };
      if (metric.id === "delayed") return { ...metric, value: String(delayed), context: "Based on production EDD and status" };
      if (metric.id === "pickups") return { ...metric, value: String(pendingPickups), context: "Open production pickup requests" };
      if (metric.id === "revenue") return { ...metric, value: `₹${billingExposure.toLocaleString("en-IN")}`, context: "Unsettled production billing" };
      return metric;
    });
  }, [activeClients, activeEmployees, now, workspace.billing, workspace.pickups, workspace.shipments, workspace.tickets]);
  const metrics = liveMetrics;
  const liveActions = useMemo(() => [
    ...workspace.tickets.filter((ticket) => !["Resolved", "Closed", "resolved", "closed"].includes(String(ticket.status))).map((ticket) => ({ id: `ticket-${ticket.id}`, severity: String(ticket.priority).toLowerCase() === "urgent" ? "critical" as const : "warning" as const, category: "sla" as const, title: "Open support ticket", entity: `${ticket.number} · ${ticket.subject || "Production ticket"}`, owner: employees.find((employee) => employee.id === ticket.assignedToEmployeeId)?.name || "Unassigned", age: ticket.createdAt ? `${Math.max(0, Math.round((now - new Date(ticket.createdAt).getTime()) / 3600000))} hr old` : "Production record", recommendation: "Review the production ticket and update its status or assignment.", actionLabel: "Review ticket", href: "/support/tickets" })),
    ...workspace.exceptions.filter((item) => !["Resolved", "resolved", "Closed", "closed"].includes(String(item.status))).map((item) => ({ id: `exception-${item.id}`, severity: "critical" as const, category: "sla" as const, title: "Shipment exception", entity: String(item.shipmentId || item.id), owner: "Operations", age: "Production record", recommendation: "Open the exception queue and record the next resolution action.", actionLabel: "Review exception", href: "/operations/exceptions" })),
    ...clients.filter((client) => { const owner = employees.find((employee) => employee.id === client.assignedToEmployeeId); return !owner || owner.status !== "Active"; }).map((client) => ({ id: `owner-${client.id}`, severity: "warning" as const, category: "ownership" as const, title: "Client owner is not active", entity: `${client.name} · ${client.code}`, owner: client.assignedToEmployeeId || "Unassigned", age: "Production record", recommendation: "Assign the client to an active employee.", actionLabel: "Review assignment", href: "/client-assignments" })),
  ], [clients, employees, now, workspace.exceptions, workspace.tickets]);
  const liveDecisionCards = decisionCards.map((card) => {
    if (card.id === "critical") return { ...card, value: String(liveActions.filter((item) => item.severity === "critical").length), detail: "Production records requiring attention" };
    if (card.id === "sla") return { ...card, value: String(liveActions.filter((item) => item.category === "sla").length), detail: "Open tickets and exceptions" };
    if (card.id === "ownership") return { ...card, value: String(liveActions.filter((item) => item.category === "ownership").length), detail: "Clients without an active owner" };
    return { ...card, value: "0", detail: "No production records in this category" };
  });
  const displayedMetrics = selectedMetrics.map((id) => metrics.find((metric) => metric.id === id)).filter(Boolean) as ReturnType<typeof getSupportingMetrics>;
  const filteredActions = liveActions.filter((item) => (category === "all" || item.category === category) && (queueView === "open" || item.severity === "critical"));
  const series = activitySeries[range];
  const chartPoints = series.map((value, index) => `${(index / (series.length - 1)) * 460},${112 - value}`).join(" ");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(localStorage.getItem(METRIC_STORAGE_KEY) ?? "null") as SupportingMetricId[] | null;
        if (Array.isArray(stored) && stored.length === 4 && stored.every((id) => metrics.some((metric) => metric.id === id))) setSelectedMetrics(stored);
      } catch { /* deterministic defaults remain */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [metrics]);

  useEffect(() => {
    const close = (event: PointerEvent) => { if (metricsRef.current && !metricsRef.current.contains(event.target as Node)) setMetricsOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMetricsOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, []);

  function showCategory(id: (typeof decisionCards)[number]["id"]) {
    setCategory(id === "critical" ? "all" : id);
    setQueueView(id === "critical" ? "critical" : "open");
    document.getElementById("admin-action-center")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function toggleMetric(id: SupportingMetricId) {
    setSelectedMetrics((current) => {
      if (current.includes(id)) {
        if (current.length === 1) return current;
        const next = current.filter((item) => item !== id);
        localStorage.setItem(METRIC_STORAGE_KEY, JSON.stringify(next));
        return next;
      }
      if (current.length >= 4) return current;
      const next = [...current, id];
      localStorage.setItem(METRIC_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function refresh() {
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshing(false);
      window.dispatchEvent(new CustomEvent("pss-admin-toast", { detail: { message: "Control center data refreshed.", tone: "success" } }));
    }, 700);
  }

  function exportSummary() {
    const rows = liveActions.map((item) => [item.severity, item.category, item.title, item.entity, item.owner, item.age].join(","));
    const csv = `Severity,Category,Action,Entity,Owner,Age\n${rows.join("\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pss-super-admin-action-center.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    window.dispatchEvent(new CustomEvent("pss-admin-toast", { detail: { message: "Action center exported as CSV.", tone: "info" } }));
  }

  return <div className="flex min-h-full w-full flex-col gap-4">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"><ShieldCheck className="size-3.5 text-primary" /> Organization control</div>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-foreground">Super Admin Control Center</h1>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Govern access, ownership, escalations, and operational risk across PSS Logistics.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/employees" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/80"><Plus className="size-3.5" /> Create employee</Link>
        <Link href="/client-assignments" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold shadow-xs transition-colors hover:bg-muted"><Building2 className="size-3.5 text-primary" /> Assign client</Link>
        <Link href="/roles-permissions" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold shadow-xs transition-colors hover:bg-muted"><KeyRound className="size-3.5 text-primary" /> Review access</Link>
      </div>
    </header>

    <section aria-label="Administrative decisions" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {liveDecisionCards.map((card) => {
        const Icon = card.icon;
        return <button key={card.id} onClick={() => showCategory(card.id)} className={cn("group rounded-xl border bg-card p-3.5 text-left shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md", card.tone === "critical" ? "border-destructive/30" : card.tone === "warning" ? "border-amber-500/25" : "border-border")}>
          <div className="flex items-start justify-between gap-3"><div className={cn("grid size-8 place-items-center rounded-lg", card.tone === "critical" ? "bg-destructive/10 text-destructive" : card.tone === "warning" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary")}><Icon className="size-4" /></div><ChevronRight className="size-3.5 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" /></div>
          <div className="mt-3 flex items-end justify-between gap-2"><div><p className="text-xs font-semibold text-muted-foreground">{card.label}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{card.detail}</p></div><span className={cn("text-2xl font-bold tracking-tight tabular-nums", card.tone === "critical" && "text-destructive", card.tone === "warning" && "text-amber-700 dark:text-amber-300")}>{card.value}</span></div>
        </button>;
      })}
    </section>

    <section className="grid gap-4 lg:grid-cols-3">
      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><PanelHeader icon={Handshake} title="CRM attention" href="/crm" linkLabel="Open CRM" /><div className="divide-y divide-border/60"><Link href="/crm" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"><CalendarClock className="size-4 text-amber-600" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Follow-ups due</span><span className="block text-[10px] text-muted-foreground">Require relationship owner action today.</span></span><span className="font-mono text-sm font-bold">{crmDue.length}</span></Link><Link href="/crm" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"><Building2 className="size-4 text-destructive" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">At-risk accounts</span><span className="block text-[10px] text-muted-foreground">Health affected by tickets, holds, or account status.</span></span><span className="font-mono text-sm font-bold text-destructive">{crmAtRisk.length}</span></Link><Link href="/crm" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"><Users className="size-4 text-primary" /><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Unassigned prospects</span><span className="block text-[10px] text-muted-foreground">Prospects without an accountable owner.</span></span><span className="font-mono text-sm font-bold">{crmUnassigned.length}</span></Link></div></article>
      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:col-span-2"><PanelHeader icon={CalendarClock} title="Upcoming relationship work" href="/crm" linkLabel="View follow-ups" /><div className="grid gap-2 p-3 sm:grid-cols-2">{workspace.crmFollowUps.filter((followUp) => followUp.status !== "Completed").slice(0, 4).map((followUp) => <Link href="/crm" key={followUp.id} className="rounded-lg border border-border/70 p-3 hover:bg-muted/40"><div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-semibold">{followUp.title}</p><StatusBadge tone={followUp.priority === "High" ? "critical" : "warning"}>{followUp.priority}</StatusBadge></div><p className="mt-1 text-[10px] text-muted-foreground">{followUp.dueDate} · {followUp.clientId ? clients.find((client) => client.id === followUp.clientId)?.name : workspace.crmProspects.find((prospect) => prospect.id === followUp.prospectId)?.company}</p></Link>)}{workspace.crmFollowUps.filter((followUp) => followUp.status !== "Completed").length === 0 && <p className="p-4 text-xs text-muted-foreground">No open CRM follow-ups.</p>}</div></article>
    </section>

    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
      <article id="admin-action-center" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div><div className="flex items-center gap-2"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-50 motion-reduce:animate-none" /><span className="relative inline-flex size-2 rounded-full bg-destructive" /></span><h2 className="text-sm font-semibold">Action Center</h2><StatusBadge tone="critical">{liveActions.filter((item) => item.severity === "critical").length} critical</StatusBadge></div><p className="mt-1 text-[11px] text-muted-foreground">Decisions requiring Super Admin intervention or delegation.</p></div>
          <div className="flex flex-wrap items-center gap-2"><div className="inline-flex rounded-lg bg-muted p-0.5 text-[11px]"><button onClick={() => setQueueView("open")} className={cn("rounded-md px-2.5 py-1.5 transition-all", queueView === "open" ? "bg-background font-semibold text-foreground shadow-xs" : "text-muted-foreground")}>All open</button><button onClick={() => setQueueView("critical")} className={cn("rounded-md px-2.5 py-1.5 transition-all", queueView === "critical" ? "bg-background font-semibold text-foreground shadow-xs" : "text-muted-foreground")}>Critical only</button></div><div className="w-40"><Dropdown label="Action type" value={category} options={actionCategoryOptions} onChange={(value) => setCategory(value as AdminActionCategory)} /></div></div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[620px] divide-y divide-border/60">
            {filteredActions.length ? filteredActions.map((item) => <button key={item.id} onClick={() => setSelectedAction(item)} className="group grid w-full grid-cols-[10px_minmax(180px,1.25fr)_minmax(110px,.7fr)_86px_108px] items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/50">
              <span className={cn("size-2.5 rounded-full", item.severity === "critical" ? "bg-destructive" : item.severity === "warning" ? "bg-amber-500" : "bg-primary")} />
              <span className="min-w-0"><span className="flex items-center gap-2"><span className="truncate text-xs font-semibold text-foreground">{item.title}</span><span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{item.category}</span></span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{item.entity}</span></span>
              <span><span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Accountable owner</span><span className="mt-1 block truncate text-xs font-semibold">{item.owner}</span></span>
              <span className={cn("text-[11px] font-semibold tabular-nums", item.severity === "critical" ? "text-destructive" : "text-muted-foreground")}>{item.age}</span>
              <span className="inline-flex items-center justify-end gap-1 text-[11px] font-semibold text-primary">{item.actionLabel}<ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" /></span>
            </button>) : <div className="grid h-40 place-items-center text-xs text-muted-foreground">No actions match this view.</div>}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border bg-muted/25 px-4 py-2.5 text-[10px] text-muted-foreground"><span>{filteredActions.length} of {liveActions.length} decisions shown</span><span>Sorted by severity and SLA risk</span></div>
      </article>

      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3.5"><div className="flex items-center gap-2"><UserRoundCog className="size-4 text-primary" /><h2 className="text-sm font-semibold">Organization Control</h2></div><p className="mt-1 text-[11px] text-muted-foreground">Identity, capacity, and ownership posture.</p></div>
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-muted/25"><ControlStat label="Active" value={activeEmployees} detail="employees" /><ControlStat label="Pending" value={invitedEmployees} detail="invitations" tone={invitedEmployees ? "warning" : undefined} /><ControlStat label="At risk" value={unownedRisk} detail="client owners" tone={unownedRisk ? "critical" : undefined} /></div>
        <div className="space-y-4 p-4">
          <ControlProgress label="Workforce activation" value={`${activeEmployees}/${employees.length}`} percent={(activeEmployees / employees.length) * 100} detail="Active identities" />
          <ControlProgress label="Client ownership health" value={`${clients.length - unownedRisk}/${clients.length}`} percent={((clients.length - unownedRisk) / clients.length) * 100} detail="Owned by active employees" tone={unownedRisk ? "warning" : "positive"} />
          <ControlProgress label="Access review coverage" value="92%" percent={92} detail="Privileged grants reviewed" tone="positive" />
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border p-3"><Link href="/employees" className="rounded-lg border border-border px-3 py-2.5 text-center text-[11px] font-semibold transition-colors hover:bg-muted">Manage identities</Link><Link href="/roles-permissions" className="rounded-lg border border-border px-3 py-2.5 text-center text-[11px] font-semibold transition-colors hover:bg-muted">Access policy</Link></div>
      </article>
    </section>

    <section className="rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xs font-semibold">Organization operating context</h2><p className="mt-0.5 text-[10px] text-muted-foreground">Supporting metrics for the selected period—not the primary decision queue.</p></div><div className="flex items-center gap-2"><div className="w-36"><Dropdown label="Date range" value={range} options={dashboardRangeOptions} onChange={setRange} /></div><div className="relative" ref={metricsRef}><Button variant="outline" size="sm" onClick={() => setMetricsOpen((value) => !value)} aria-expanded={metricsOpen}><SlidersHorizontal className="size-3.5 text-primary" /> Metrics</Button>{metricsOpen && <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl animate-in fade-in zoom-in-95 duration-150"><div className="flex items-center justify-between border-b border-border pb-2"><span className="text-xs font-bold">Show 4 metrics</span><span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{selectedMetrics.length}/4</span></div><div className="mt-2 space-y-1">{metrics.map((metric) => { const selected = selectedMetrics.includes(metric.id); const disabled = !selected && selectedMetrics.length >= 4; return <button key={metric.id} disabled={disabled} onClick={() => toggleMetric(metric.id)} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-all", selected ? "bg-primary/10 font-semibold text-primary" : "hover:bg-accent", disabled && "cursor-not-allowed opacity-40")}><span className={cn("grid size-4 place-items-center rounded border", selected ? "border-primary bg-primary text-primary-foreground" : "border-input")}><Check className={cn("size-3", !selected && "opacity-0")} /></span>{metric.label}</button>; })}</div></div>}</div><Button variant="outline" size="sm" onClick={refresh}><RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} /> Refresh</Button><Button variant="outline" size="sm" onClick={exportSummary}><Download className="size-3.5" /> Export</Button></div></div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">{displayedMetrics.map((metric, index) => { const Icon = metric.icon; return <div key={metric.id} className={cn("flex items-center gap-3 px-4 py-3.5", index > 0 && "border-t border-border sm:border-t-0 sm:border-l", index === 2 && "sm:border-l-0 xl:border-l", index > 1 && "xl:border-l")}><div className={cn("grid size-8 place-items-center rounded-lg", metric.tone === "critical" ? "bg-destructive/10 text-destructive" : metric.tone === "warning" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : metric.tone === "positive" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary")}><Icon className="size-4" /></div><div className="min-w-0"><div className="flex items-baseline gap-2"><span className="text-lg font-bold tabular-nums">{metric.value}</span><span className="truncate text-xs font-semibold text-muted-foreground">{metric.label}</span></div><p className="truncate text-[10px] text-muted-foreground">{metric.context}</p></div></div>; })}</div>
    </section>

    <section className="grid gap-4 lg:grid-cols-3">
      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <PanelHeader icon={Users} title="Capacity & Ownership" href="/client-assignments" linkLabel="Assignments" />
        <div className="space-y-1.5 p-3">{employees.filter((employee) => !employee.isSuperAdmin).map((employee) => { const assigned = clients.filter((client) => client.assignedToEmployeeId === employee.id); const load = Math.min(assigned.reduce((sum, client) => sum + client.shipmentVolume + client.openTickets * 18, 0) / 6, 100); return <div key={employee.id} className="rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"><div className="flex items-center gap-2.5"><div className="grid size-7 place-items-center rounded-lg bg-primary/10 text-[9px] font-bold text-primary">{initials(employee.name)}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><p className="truncate text-[11px] font-semibold">{employee.name}</p><span className={cn("text-[10px] font-semibold", load > 80 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>{Math.round(load)}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", load > 80 ? "bg-amber-500" : "bg-primary")} style={{ width: `${load}%` }} /></div></div><span className="w-14 text-right text-[9px] text-muted-foreground">{assigned.length} clients</span></div></div>; })}</div>
      </article>

      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <PanelHeader icon={ShieldCheck} title="Governance & Access" href="/roles-permissions" linkLabel="Policies" />
        <div className="divide-y divide-border/60"><GovernanceRow icon={KeyRound} label="Privileged overrides" value="2" detail="1 awaiting review" tone="warning" /><GovernanceRow icon={Users} label="Reusable roles" value="5" detail="4 delegated roles" /><GovernanceRow icon={CircleDot} label="Disabled identities" value={String(employees.filter((employee) => employee.status === "Disabled").length)} detail="No active sessions" tone="positive" /><GovernanceRow icon={ShieldCheck} label="Super Admin accounts" value="1" detail="Explicit system bypass" /></div>
      </article>

      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <PanelHeader icon={Activity} title="Privileged Activity" href="/audit-logs" linkLabel="Audit log" />
        <div className="divide-y divide-border/60">{auditEvents.slice(0, 5).map((event) => <Link href="/audit-logs" key={event.id} className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"><span className={cn("mt-1.5 size-2 shrink-0 rounded-full", event.severity === "Security" ? "bg-destructive" : event.severity === "Important" ? "bg-amber-500" : "bg-primary")} /><span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className="truncate text-[11px] font-semibold">{event.action}</span><span className="shrink-0 font-mono text-[9px] text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{event.entityLabel}{event.after ? ` · ${event.after}` : ""}</span></span></Link>)}</div>
      </article>
    </section>

    <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="flex items-center justify-between border-b border-border px-4 py-3.5"><div><div className="flex items-center gap-2"><BarChart3 className="size-4 text-primary" /><h2 className="text-sm font-semibold">Operational Pulse</h2></div><p className="mt-1 text-[11px] text-muted-foreground">Secondary organization trend for context after administrative decisions.</p></div><StatusBadge tone="positive">94.8% on time</StatusBadge></div><div className="grid gap-4 p-4 md:grid-cols-[1fr_180px]"><div className="relative h-32"><div className="absolute inset-0 flex flex-col justify-between"><span className="border-b border-border/50" /><span className="border-b border-border/50" /><span className="border-b border-border/50" /><span /></div><svg viewBox="0 0 460 120" preserveAspectRatio="none" className="absolute inset-0 size-full"><defs><linearGradient id="admin-pulse" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity=".22"/><stop offset="100%" stopColor="var(--primary)" stopOpacity="0"/></linearGradient></defs><polygon points={`0,120 ${chartPoints} 460,120`} fill="url(#admin-pulse)"/><polyline points={chartPoints} fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/></svg></div><div className="space-y-3"><MiniDistribution label="Delivered" value="68%" width={68} tone="positive" /><MiniDistribution label="In transit" value="19%" width={19} /><MiniDistribution label="Delayed" value="9%" width={9} tone="warning" /><MiniDistribution label="Exception" value="4%" width={4} tone="critical" /></div></div></article>
      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><PanelHeader icon={Building2} title="Client Risk Watch" href="/client-assignments" linkLabel="All clients" /><div className="divide-y divide-border/60">{crmAtRisk.slice(0, 4).map((client) => { const hold = workspace.wallets.find((wallet) => wallet.clientId === client.id)?.holdAmount ?? 0; return <RiskRow key={client.id} name={client.name} detail={`${client.openTickets} open tickets${hold ? ` · ₹${hold.toLocaleString("en-IN")} hold` : ""}`} status={!client.assignedToEmployeeId ? "Assign" : "Intervene"} tone={hold ? "critical" : "warning"} />; })}{!crmAtRisk.length && <p className="p-4 text-xs text-muted-foreground">No production client risk records.</p>}</div></article>
    </section>

    <Modal open={Boolean(selectedAction)} onClose={() => setSelectedAction(null)} title={selectedAction?.title ?? "Administrative action"} description="Decision context and recommended next step.">
      {selectedAction && <div className="space-y-4"><div className="rounded-xl border border-border bg-muted/30 p-4"><div className="flex items-center justify-between gap-3"><StatusBadge tone={selectedAction.severity === "critical" ? "critical" : selectedAction.severity === "warning" ? "warning" : "navy"}>{selectedAction.severity}</StatusBadge><span className="text-[11px] font-semibold text-muted-foreground">{selectedAction.age}</span></div><p className="mt-3 text-sm font-semibold">{selectedAction.entity}</p><p className="mt-1 text-xs text-muted-foreground">Accountable owner: <strong className="text-foreground">{selectedAction.owner}</strong></p></div><div><p className="text-xs font-semibold">Recommended response</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedAction.recommendation}</p></div><div className="flex justify-end gap-2 border-t border-border pt-4"><Button variant="outline" onClick={() => setSelectedAction(null)}>Close</Button><Link href={selectedAction.href} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/80">{selectedAction.actionLabel}<ArrowRight className="size-3.5" /></Link></div></div>}
    </Modal>
  </div>;
}

function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join(""); }

function ControlStat({ label, value, detail, tone }: { label: string; value: number; detail: string; tone?: "warning" | "critical" }) {
  return <div className="px-3 py-3 text-center"><p className={cn("text-xl font-bold tabular-nums", tone === "critical" && "text-destructive", tone === "warning" && "text-amber-700 dark:text-amber-300")}>{value}</p><p className="text-[10px] font-semibold">{label}</p><p className="mt-0.5 text-[9px] text-muted-foreground">{detail}</p></div>;
}

function ControlProgress({ label, value, percent, detail, tone = "neutral" }: { label: string; value: string; percent: number; detail: string; tone?: "neutral" | "positive" | "warning" }) {
  return <div><div className="flex items-center justify-between text-[11px]"><span className="font-semibold">{label}</span><span className="font-mono font-bold">{value}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", tone === "positive" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-primary")} style={{ width: `${percent}%` }} /></div><p className="mt-1 text-[9px] text-muted-foreground">{detail}</p></div>;
}

function PanelHeader({ icon: Icon, title, href, linkLabel }: { icon: typeof Users; title: string; href: string; linkLabel: string }) {
  return <div className="flex items-center justify-between border-b border-border px-4 py-3.5"><div className="flex items-center gap-2"><Icon className="size-4 text-primary" /><h2 className="text-sm font-semibold">{title}</h2></div><Link href={href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">{linkLabel}<ChevronRight className="size-3" /></Link></div>;
}

function GovernanceRow({ icon: Icon, label, value, detail, tone = "neutral" }: { icon: typeof Users; label: string; value: string; detail: string; tone?: "neutral" | "positive" | "warning" }) {
  return <div className="flex items-center gap-3 px-4 py-3"><div className={cn("grid size-8 place-items-center rounded-lg", tone === "warning" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : tone === "positive" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary")}><Icon className="size-4" /></div><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold">{label}</p><p className="text-[10px] text-muted-foreground">{detail}</p></div><span className="font-mono text-sm font-bold">{value}</span></div>;
}

function MiniDistribution({ label, value, width, tone = "neutral" }: { label: string; value: string; width: number; tone?: "neutral" | "positive" | "warning" | "critical" }) {
  return <div><div className="mb-1 flex justify-between text-[10px]"><span className="font-semibold">{label}</span><span className="font-mono">{value}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", tone === "positive" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : tone === "critical" ? "bg-destructive" : "bg-primary")} style={{ width: `${width}%` }} /></div></div>;
}

function RiskRow({ name, detail, status, tone }: { name: string; detail: string; status: string; tone: "positive" | "warning" | "critical" }) {
  return <Link href="/client-assignments" className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"><span className={cn("size-2 shrink-0 rounded-full", tone === "positive" ? "bg-emerald-500" : tone === "warning" ? "bg-amber-500" : "bg-destructive")} /><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold">{name}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{detail}</span></span><span className={cn("text-[10px] font-semibold", tone === "positive" ? "text-emerald-700 dark:text-emerald-300" : tone === "warning" ? "text-amber-700 dark:text-amber-300" : "text-destructive")}>{status}</span><ChevronRight className="size-3 text-muted-foreground" /></Link>;
}
