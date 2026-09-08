"use client";

import { useMemo, useState } from "react";
import { BarChart3, Check, LifeBuoy, Package, Plus, Search, Settings2, ShieldCheck, Truck, Users, Wallet, X } from "lucide-react";
import { useAdmin } from "@/components/admin/admin-provider";
import { EmptyState, Field, Modal, StatusBadge, inputClass } from "@/components/admin/ui";
import Dropdown from "@/components/ui/dropdown";
import type { AdminNavItem } from "@/lib/admin-navigation";
import type { MasterShipment, MasterTicket, MasterWorkspaceState } from "@/lib/master-domain";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "positive" | "warning" | "critical" | "navy";
type Props = { module: Omit<AdminNavItem, "icon"> };
type ClientSummary = { id: string; name: string; code?: string; city?: string; assignedToEmployeeId?: string; status?: string; shipmentVolume?: number };

const routeMeta: Record<string, { eyebrow: string; primary: string; description?: string }> = {
  "/alerts-attention": { eyebrow: "Attention queue", primary: "Acknowledge selected" },
  "/operations/shipments": { eyebrow: "Shipment register", primary: "Export shipments" },
  "/operations/bookings": { eyebrow: "Booking desk", primary: "New booking" },
  "/operations/tracking": { eyebrow: "Movement control", primary: "Refresh tracking" },
  "/operations/pickups": { eyebrow: "Pickup control", primary: "Schedule pickup" },
  "/operations/returns": { eyebrow: "RTO desk", primary: "Review documents" },
  "/operations/exceptions": { eyebrow: "Exception desk", primary: "Create exception" },
  "/clients": { eyebrow: "Client directory", primary: "Add client" },
  "/clients/onboarding": { eyebrow: "Verification queue", primary: "Start onboarding" },
  "/clients/activity": { eyebrow: "Client timeline", primary: "Export activity" },
  "/departments": { eyebrow: "Organization map", primary: "Create department" },
  "/tasks": { eyebrow: "Work queue", primary: "Create task" },
  "/employee-activity": { eyebrow: "Activity ledger", primary: "Export activity" },
  "/support/tickets": { eyebrow: "Support inbox", primary: "New ticket" },
  "/support/sla-escalations": { eyebrow: "SLA monitor", primary: "Escalate selected" },
  "/finance/wallets": { eyebrow: "Wallet control", primary: "Record adjustment" },
  "/finance/billing-invoices": { eyebrow: "Invoice desk", primary: "Create adjustment" },
  "/finance/transactions": { eyebrow: "Transaction ledger", primary: "Export ledger" },
  "/insights/analytics": { eyebrow: "Analytics studio", primary: "Refresh analysis" },
  "/insights/reports": { eyebrow: "Report catalogue", primary: "Generate report" },
  "/insights/performance": { eyebrow: "Performance center", primary: "Refresh scorecards" },
  "/automation/workflow-rules": { eyebrow: "Workflow builder", primary: "Create rule" },
  "/automation/notification-rules": { eyebrow: "Notification routing", primary: "Create rule" },
  "/automation/scheduled-jobs": { eyebrow: "Job monitor", primary: "Run selected job" },
  "/integrations/couriers": { eyebrow: "Courier health", primary: "Check integrations" },
  "/integrations/channels": { eyebrow: "Channel health", primary: "Check channels" },
  "/integrations/api-webhooks": { eyebrow: "Developer access", primary: "Create credential" },
  "/system/security-sessions": { eyebrow: "Security monitor", primary: "Revoke selected" },
  "/system/notifications": { eyebrow: "Notification center", primary: "Mark all read" },
  "/system/settings": { eyebrow: "Platform controls", primary: "Save settings" },
};

function tone(status: string): Tone { return /critical|breached|failed|delayed|escalated|high|hold|disconnected/i.test(status) ? "critical" : /pending|review|warning|assigned|in progress|degraded|due/i.test(status) ? "warning" : /delivered|approved|paid|active|healthy|connected|resolved|settled|ready|collected/i.test(status) ? "positive" : "neutral"; }
function clientName(id: string, clients: { id: string; name: string }[]) { return clients.find((client) => client.id === id)?.name ?? "Unknown client"; }
function employeeName(id: string, employees: { id: string; name: string }[]) { return employees.find((employee) => employee.id === id)?.name ?? "Unassigned"; }
function money(value: number) { return `₹${value.toLocaleString("en-IN")}`; }
export default function MasterModuleWorkspace({ module }: Props) {
  const { clients, employees, workspace, mutateWorkspace } = useAdmin();
  const meta = routeMeta[module.href] ?? { eyebrow: "Master workspace", primary: "Create record" };
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const rows = useMemo(() => getRows(module.href, workspace, clients, employees), [clients, employees, module.href, workspace]);
  const filtered = rows.filter((row) => `${row.title} ${row.detail} ${row.status}`.toLowerCase().includes(query.toLowerCase()) && (filter === "All" || row.status === filter));
  const selected = rows.find((row) => row.id === selectedId) ?? filtered[0];
  const setValue = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  function primaryAction() {
    if (module.href !== "/clients" && module.href !== "/clients/onboarding") { setNotice("This workflow is unavailable until the application backend is connected."); return; }
    if (/export/i.test(meta.primary)) { downloadCsv(module.label, rows); setNotice(`${module.label} export downloaded locally.`); return; }
    if (/refresh|check/i.test(meta.primary)) { setNotice(`${module.label} refreshed from the local demo stream.`); return; }
    if (/mark all read/i.test(meta.primary)) { mutateWorkspace("Marked all notifications read", (current) => ({ ...current, notifications: current.notifications.map((item) => ({ ...item, read: true })) }), { entityType: "System", entityLabel: module.label, severity: "Info" }); setNotice("All notifications are marked as read."); return; }
    if (/run selected|revoke selected|acknowledge selected|escalate selected/i.test(meta.primary) && selected) { performAction(meta.primary, selected.id); return; }
    setForm({}); setModal(meta.primary);
  }

  function performAction(action: string, id: string) {
    setNotice(`${action} is unavailable until the application backend is connected.`);
    return;
    /* Operational mutations are intentionally deferred to the application backend. */
    const href = module.href;
    if (href === "/operations/exceptions") mutateWorkspace("Resolved exception", (current) => ({ ...current, exceptions: current.exceptions.map((item) => item.id === id ? { ...item, status: "Resolved" } : item), shipments: current.shipments.map((item) => item.exceptionId === id ? { ...item, status: "In transit" } : item) }), { entityType: "Exception", entityId: id, entityLabel: selected?.title, severity: "Important" });
    else if (href === "/support/sla-escalations") mutateWorkspace("Escalated support ticket", (current) => ({ ...current, tickets: current.tickets.map((item) => item.id === id ? { ...item, status: "Escalated" } : item) }), { entityType: "Ticket", entityId: id, entityLabel: selected?.title, severity: "Security" });
    else if (href === "/support/tickets") mutateWorkspace("Resolved support ticket", (current) => ({ ...current, tickets: current.tickets.map((item) => item.id === id ? { ...item, status: "Resolved" } : item) }), { entityType: "Ticket", entityId: id, entityLabel: selected?.title, severity: "Important" });
    else if (href === "/system/security-sessions") mutateWorkspace("Revoked security session", (current) => ({ ...current, sessions: current.sessions.map((item) => item.id === id ? { ...item, status: "Revoked" } : item) }), { entityType: "Session", entityId: id, entityLabel: selected?.title, severity: "Security" });
    else if (href.includes("scheduled-jobs")) mutateWorkspace("Ran scheduled job", (current) => ({ ...current, scheduledJobs: current.scheduledJobs.map((item) => item.id === id ? { ...item, status: "Running", lastRun: "Just now", retries: 0 } : item) }), { entityType: "System", entityId: id, entityLabel: selected?.title, severity: "Info" });
    else mutateWorkspace(action, (current) => current, { entityType: "System", entityId: id, entityLabel: selected?.title, severity: "Info" });
    setNotice(`${action} completed locally.`);
  }

  async function submit() {
    const href = module.href;
    if (href === "/operations/bookings") {
      const clientId = form.client || clients[0]?.id;
      const id = `ship-${Date.now()}`;
      const shipment: MasterShipment = { id, reference: `PSS-2026-${String(Date.now()).slice(-6)}`, clientId, consignor: form.consignor || "Demo consignor", consignee: form.consignee || "Demo consignee", origin: form.origin || "Mumbai", destination: form.destination || "Delhi", courier: form.courier || workspace.settings.defaultCourier, service: form.service || "Express", status: "Booked", declaredWeight: Number(form.weight) || 1, measuredWeight: Number(form.weight) || 1, pieces: Number(form.pieces) || 1, paymentMode: form.paymentMode === "COD" ? "COD" : "Prepaid", codAmount: Number(form.codAmount) || 0, bookedAt: "Today", eta: "Tomorrow", ownerEmployeeId: form.owner || employees[0]?.id || "" };
      mutateWorkspace("Created booking and connected operations", (current) => ({ ...current, shipments: [shipment, ...current.shipments], trackingEvents: [{ id: `${id}-booked`, shipmentId: id, milestone: "Booked", location: shipment.origin, timestamp: "Just now" }, ...current.trackingEvents], pickups: [{ id: `pickup-${Date.now()}`, reference: `PU-${String(Date.now()).slice(-6)}`, shipmentId: id, clientId, scheduledDate: "Tomorrow", window: form.slot || "10:00–13:00", location: shipment.origin, driver: "Unassigned", status: "Scheduled", source: "Booking" }, ...current.pickups], billing: [{ id: `bill-${Date.now()}`, invoiceNumber: `INV-${String(Date.now()).slice(-5)}`, clientId, shipmentId: id, declaredWeight: shipment.declaredWeight, measuredWeight: shipment.measuredWeight, billableWeight: shipment.measuredWeight, baseCharge: 1200, tax: 216, total: 1416, status: "Pending approval", podState: "Pending" }, ...current.billing], transactions: [{ id: `txn-${Date.now()}`, clientId, shipmentId: id, reference: `TXN-${String(Date.now()).slice(-5)}`, type: "Shipment debit", amount: 1416, direction: "Debit", status: "Pending", createdAt: "Just now", description: "Booking debit" }, ...current.transactions] }), { entityType: "Shipment", entityId: id, entityLabel: shipment.reference, severity: "Important" });
      setNotice(`${shipment.reference} created with pickup, tracking, billing, and transaction records.`);
    } else if (href === "/support/tickets") {
      const id = `ticket-${Date.now()}`;
      const ticket: MasterTicket = { id, number: `TK-${String(Date.now()).slice(-4)}`, clientId: form.client || clients[0]?.id || "", shipmentId: form.shipment || undefined, assignedToEmployeeId: form.assignee || employees[0]?.id || "", subject: form.subject || "New operational support request", category: form.category || "General support", priority: (form.priority as MasterTicket["priority"]) || "Normal", status: "Open", createdAt: "Just now", slaDueAt: "Tomorrow", lastMessage: form.message || "Ticket created from Super Admin workspace." };
      mutateWorkspace("Created support ticket", (current) => ({ ...current, tickets: [ticket, ...current.tickets], ticketMessages: [{ id: `message-${Date.now()}`, ticketId: id, author: "Gaurav Sharma", role: "Employee", body: ticket.lastMessage, timestamp: "Just now" }, ...current.ticketMessages] }), { entityType: "Ticket", entityId: id, entityLabel: ticket.number, severity: "Important" });
      setNotice(`${ticket.number} created and assigned locally.`);
    } else if (href === "/clients" || href === "/clients/onboarding") {
      const response = await fetch("/api/admin/client-membership", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ legalName: form.name, clientCode: form.clientCode || null }) });
      const result = await response.json() as { error?: string; client?: { legal_name?: string; client_code?: string | null } };
      if (!response.ok) { setNotice(result.error ?? "Unable to save client profile."); setModal(null); return; }
      setNotice(`${result.client?.legal_name ?? form.name} saved to Supabase${result.client?.client_code ? ` with code ${result.client.client_code}` : " without a client code"}.`);
    } else if (href === "/finance/wallets" || href === "/finance/billing-invoices") {
      const amount = Number(form.amount) || 0;
      mutateWorkspace("Created finance adjustment", (current) => ({ ...current, transactions: [{ id: `txn-${Date.now()}`, clientId: form.client || clients[0]?.id || "", reference: `ADJ-${String(Date.now()).slice(-5)}`, type: "Billing adjustment", amount, direction: form.direction === "Credit" ? "Credit" : "Debit", status: "Pending", createdAt: "Just now", description: form.reason || "Super Admin adjustment" }, ...current.transactions] }), { entityType: "Transaction", entityId: `txn-${Date.now()}`, entityLabel: form.reason || "Finance adjustment", severity: "Important" });
      setNotice("Finance adjustment created and marked pending approval.");
    } else if (href === "/insights/reports") {
      const id = `report-${Date.now()}`;
      mutateWorkspace("Generated report", (current) => ({ ...current, reports: [{ id, name: form.name || "Custom operational report", category: "Shipment", dateFrom: form.dateFrom || "2026-08-01", dateTo: form.dateTo || "2026-08-18", status: "Ready", lastRun: "Just now" }, ...current.reports] }), { entityType: "Report", entityId: id, entityLabel: form.name || "Custom operational report", severity: "Info" });
      setNotice("Report generated and ready for local download.");
    } else if (href.includes("workflow-rules") || href.includes("notification-rules")) {
      const id = `rule-${Date.now()}`;
      mutateWorkspace("Created automation rule", (current) => ({ ...current, automationRules: [{ id, name: form.name || "New workflow rule", trigger: form.trigger || "Operational event", condition: form.condition || "Matches configured scope", action: form.action || "Notify owner", enabled: true, lastRun: "Never", executions: 0 }, ...current.automationRules] }), { entityType: "System", entityId: id, entityLabel: form.name || "New workflow rule", severity: "Info" });
      setNotice("Automation rule created locally.");
    } else if (href.includes("api-webhooks")) {
      const id = `credential-${Date.now()}`;
      mutateWorkspace("Created API credential", (current) => ({ ...current, apiCredentials: [{ id, name: form.name || "New integration credential", kind: form.kind === "Webhook" ? "Webhook" : "API key", scope: form.scope || "reports:read", status: "Active", lastUsed: "Never", deliveries: 0 }, ...current.apiCredentials] }), { entityType: "Integration", entityId: id, entityLabel: form.name || "New integration credential", severity: "Security" });
      setNotice("Credential created as a frontend-only placeholder.");
    } else if (href === "/system/settings") {
      mutateWorkspace("Saved platform settings", (current) => ({ ...current, settings: { ...current.settings, timezone: form.timezone || current.settings.timezone, shipmentRetention: form.retention || current.settings.shipmentRetention, defaultCourier: form.courier || current.settings.defaultCourier, walletApprovalRequired: form.walletApproval === "true" ? true : form.walletApproval === "false" ? false : current.settings.walletApprovalRequired, operationalAlerts: form.alerts === "true" ? true : form.alerts === "false" ? false : current.settings.operationalAlerts } }), { entityType: "System", entityLabel: "Platform settings", severity: "Important" });
      setNotice("Platform settings persisted in the local repository.");
    } else if (href === "/departments") {
      const id = `dept-${Date.now()}`;
      mutateWorkspace("Created department", (current) => ({ ...current, departments: [{ id, name: form.name || "New department", managerEmployeeId: form.manager || employees[0]?.id, memberEmployeeIds: [], capacity: Number(form.capacity) || 40, status: "Active" }, ...current.departments] }), { entityType: "System", entityId: id, entityLabel: form.name || "New department", severity: "Important" });
      setNotice("Department created locally.");
    } else {
      mutateWorkspace(`${meta.primary} completed`, (current) => current, { entityType: "System", entityLabel: module.label, severity: "Info" });
      setNotice(`${meta.primary} completed in the local demo workspace.`);
    }
    setModal(null);
  }

  return <div className="flex min-h-full w-full flex-col gap-5">
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 xl:flex-row xl:items-end xl:justify-between"><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ModuleIcon href={module.href} /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{meta.eyebrow}</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{module.label}</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{module.description}</p></div></div><div className="flex flex-wrap items-center gap-2"><StatusBadge tone="warning">Backend required</StatusBadge><button onClick={primaryAction} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-sm hover:bg-muted"><Plus className="size-3.5" />{module.href === "/clients" || module.href === "/clients/onboarding" ? meta.primary : "Unavailable"}</button></div></header>
    {notice && <button onClick={() => setNotice(null)} className="flex w-full items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-left text-xs text-primary"><span>{notice}</span><X className="size-4" /></button>}
    <section className="grid gap-3 sm:grid-cols-3">{metrics(module.href, workspace, clients).map((item) => <Metric key={item.label} {...item} />)}</section>
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs"><div className="flex shrink-0 flex-col gap-2 border-b border-border/70 p-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={cn(inputClass, "h-9 pl-9 text-xs")} placeholder={`Search ${module.label.toLowerCase()}`} /></div><Dropdown label="Filter records" value={filter === "All" ? "" : filter} onChange={(value) => setFilter(value || "All")} options={[...new Set(rows.map((row) => row.status))]} className="w-full shrink-0 sm:w-48" /></div><div className="grid min-h-[420px] min-w-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="min-h-0 min-w-0 overflow-y-auto divide-y divide-border/70">{filtered.map((row) => <button key={row.id} onClick={() => setSelectedId(row.id)} className={cn("grid w-full gap-3 px-4 py-3 text-left transition hover:bg-muted/40 sm:grid-cols-[10px_minmax(0,1fr)_140px_90px] sm:items-center", selected?.id === row.id && "bg-primary/5")}><span className={cn("size-2 rounded-full", row.status && `bg-${tone(row.status) === "critical" ? "destructive" : tone(row.status) === "warning" ? "amber-500" : tone(row.status) === "positive" ? "emerald-500" : "primary"}`)} /><span className="min-w-0"><span className="block truncate text-xs font-semibold">{row.title}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{row.detail}</span></span><span className="text-[11px] text-muted-foreground">{row.meta}</span><StatusBadge tone={tone(row.status)}>{row.status}</StatusBadge></button>)}{filtered.length === 0 && <div className="p-4"><EmptyState title="No records found" description="Try another search or filter." /></div>}</div><div className="flex min-h-0 min-w-0 flex-col border-t border-border/70 p-4 xl:border-l xl:border-t-0"><DetailPanel module={module} row={selected} onAction={performAction} /></div></div></section>
    <ActionModal module={module} open={Boolean(modal)} action={modal} form={form} setValue={setValue} onClose={() => setModal(null)} onSubmit={submit} clients={clients} employees={employees} />
  </div>;
}

type Row = { id: string; title: string; detail: string; status: string; meta: string };
function getRows(href: string, workspace: MasterWorkspaceState, clients: ClientSummary[], employees: { id: string; name: string }[]): Row[] {
  if (href === "/operations/shipments" || href === "/operations/tracking") return workspace.shipments.map((item) => ({ id: item.id, title: item.reference, detail: `${clientName(item.clientId, clients)} · ${item.origin} → ${item.destination}`, status: item.status, meta: `${item.courier} · ${item.pieces} pcs` }));
  if (href === "/operations/bookings") return workspace.shipments.map((item) => ({ id: item.id, title: item.reference, detail: `${clientName(item.clientId, clients)} · ${item.consignor} → ${item.consignee}`, status: item.status, meta: `${item.service} · ${item.declaredWeight} kg` }));
  if (href === "/operations/pickups") return workspace.pickups.map((item) => ({ id: item.id, title: item.reference, detail: `${clientName(item.clientId, clients)} · ${item.location}`, status: item.status, meta: `${item.scheduledDate} · ${item.window}` }));
  if (href === "/operations/returns") return workspace.returns.map((item) => ({ id: item.id, title: item.reference, detail: `${clientName(item.clientId, clients)} · ${item.reason}`, status: item.status, meta: item.invoiceUploaded ? "Invoice ready" : "Documents pending" }));
  if (href === "/operations/exceptions") return workspace.exceptions.map((item) => ({ id: item.id, title: item.reference, detail: `${item.title} · ${clientName(item.clientId, clients)}`, status: item.status, meta: `${item.severity} · ${employeeName(item.ownerEmployeeId ?? "", employees)}` }));
  if (href === "/clients" || href === "/clients/onboarding") return clients.map((item) => ({ id: item.id, title: item.name, detail: `${item.code ?? "No code"} · ${item.city ?? "Unknown city"} · Owner ${employeeName(item.assignedToEmployeeId ?? "", employees)}`, status: item.status ?? "Active", meta: `${item.shipmentVolume ?? 0} shipments` }));
  if (href === "/clients/activity") return workspace.activities.map((item) => ({ id: item.id, title: item.action, detail: `${item.entityLabel ?? item.entityId ?? "Workspace"} · ${item.module}`, status: "Recorded", meta: item.timestamp }));
  if (href === "/departments") return workspace.departments.map((item) => ({ id: item.id, title: item.name, detail: `${employeeName(item.managerEmployeeId ?? "", employees)} · ${item.memberEmployeeIds.length} members`, status: item.status, meta: `${item.capacity}% capacity` }));
  if (href === "/tasks") return workspace.tasks.map((item) => ({ id: item.id, title: item.title, detail: `${clientName(item.clientId ?? "", clients)} · ${employeeName(item.assignedToEmployeeId, employees)}`, status: item.status, meta: `${item.priority} · due ${item.dueDate}` }));
  if (href === "/employee-activity") return workspace.activities.map((item) => ({ id: item.id, title: item.action, detail: `${employeeName(item.actorEmployeeId, employees)} · ${item.module}`, status: "Recorded", meta: item.timestamp }));
  if (href === "/support/tickets" || href === "/support/sla-escalations") return workspace.tickets.filter((item) => href !== "/support/sla-escalations" || ["Escalated", "In progress"].includes(item.status)).map((item) => ({ id: item.id, title: item.number, detail: `${item.subject} · ${clientName(item.clientId, clients)}`, status: item.status, meta: `${item.priority} · ${employeeName(item.assignedToEmployeeId, employees)}` }));
  if (href === "/finance/wallets") return workspace.wallets.map((item) => ({ id: item.id, title: clientName(item.clientId, clients), detail: `Available ${money(item.balance)} · Hold ${money(item.holdAmount)}`, status: item.status, meta: item.approvalRequired ? "Approval required" : "No approval" }));
  if (href === "/finance/billing-invoices") return workspace.billing.map((item) => ({ id: item.id, title: item.invoiceNumber, detail: `${clientName(item.clientId, clients)} · ${item.shipmentId ?? "Unlinked"}`, status: item.status, meta: money(item.total) }));
  if (href === "/finance/transactions") return workspace.transactions.map((item) => ({ id: item.id, title: item.reference, detail: `${clientName(item.clientId, clients)} · ${item.description}`, status: item.status, meta: `${item.direction} ${money(item.amount)}` }));
  if (href === "/insights/reports") return workspace.reports.map((item) => ({ id: item.id, title: item.name, detail: `${item.category} · ${item.dateFrom} → ${item.dateTo}`, status: item.status, meta: item.lastRun }));
  if (href.includes("automation/workflow") || href.includes("automation/notification")) return workspace.automationRules.map((item) => ({ id: item.id, title: item.name, detail: `${item.trigger} → ${item.action}`, status: item.enabled ? "Active" : "Disabled", meta: `${item.executions} executions` }));
  if (href.includes("scheduled-jobs")) return workspace.scheduledJobs.map((item) => ({ id: item.id, title: item.name, detail: item.schedule, status: item.status, meta: `Next ${item.nextRun}` }));
  if (href.includes("integrations") && !href.includes("api-webhooks")) return workspace.integrations.filter((item) => href.includes("couriers") ? item.mode === "Courier" : item.mode !== "Courier").map((item) => ({ id: item.id, title: item.name, detail: `${item.mode} · ${item.services.join(", ")}`, status: item.status, meta: `${item.latency} · ${item.lastChecked}` }));
  if (href.includes("api-webhooks")) return workspace.apiCredentials.map((item) => ({ id: item.id, title: item.name, detail: `${item.kind} · ${item.scope}`, status: item.status, meta: `${item.deliveries} deliveries` }));
  if (href.includes("security-sessions")) return workspace.sessions.map((item) => ({ id: item.id, title: employeeName(item.employeeId, employees), detail: `${item.device} · ${item.location}`, status: item.status, meta: `${item.risk} risk · ${item.lastActive}` }));
  if (href.includes("notifications")) return workspace.notifications.map((item) => ({ id: item.id, title: item.title, detail: item.detail, status: item.read ? "Read" : item.severity, meta: item.createdAt }));
  if (href === "/alerts-attention") return workspace.notifications.filter((item) => !item.read).map((item) => ({ id: item.id, title: item.title, detail: item.detail, status: item.severity, meta: item.category }));
  return workspace.activities.slice(0, 12).map((item) => ({ id: item.id, title: item.action, detail: item.entityLabel ?? item.module, status: "Recorded", meta: item.timestamp }));
}

function metrics(href: string, workspace: MasterWorkspaceState, clients: ClientSummary[]) { if (href.includes("shipments") || href.includes("tracking") || href.includes("bookings")) return [{ label: "Total shipments", value: String(workspace.shipments.length), tone: "navy" as Tone }, { label: "In movement", value: String(workspace.shipments.filter((item) => !["Delivered", "Booked"].includes(item.status)).length), tone: "positive" as Tone }, { label: "Exceptions", value: String(workspace.exceptions.filter((item) => item.status !== "Resolved").length), tone: "critical" as Tone }]; if (href.includes("finance")) return [{ label: "Client accounts", value: String(clients.length), tone: "navy" as Tone }, { label: "Pending review", value: String(workspace.transactions.filter((item) => item.status === "Pending").length), tone: "warning" as Tone }, { label: "Ledger records", value: String(workspace.transactions.length + workspace.billing.length), tone: "positive" as Tone }]; if (href.includes("support")) return [{ label: "Open tickets", value: String(workspace.tickets.filter((item) => !["Resolved", "Closed"].includes(item.status)).length), tone: "navy" as Tone }, { label: "Escalated", value: String(workspace.tickets.filter((item) => item.status === "Escalated").length), tone: "critical" as Tone }, { label: "Messages", value: String(workspace.ticketMessages.length), tone: "positive" as Tone }]; return [{ label: "Records", value: String(workspace.activities.length), tone: "navy" as Tone }, { label: "Unread attention", value: String(workspace.notifications.filter((item) => !item.read).length), tone: "warning" as Tone }, { label: "Audit events", value: String(workspace.activities.length), tone: "positive" as Tone }]; }

function Metric({ label, value, tone: itemTone }: { label: string; value: string; tone: Tone }) { return <div className="rounded-xl border border-border bg-card p-4 shadow-xs"><p className={cn("text-xl font-semibold", itemTone === "critical" && "text-destructive", itemTone === "warning" && "text-amber-600", itemTone === "positive" && "text-emerald-600", itemTone === "navy" && "text-primary")}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>; }
function ModuleIcon({ href }: { href: string }) { if (href.includes("finance")) return <Wallet className="size-[18px]" />; if (href.includes("support")) return <LifeBuoy className="size-[18px]" />; if (href.includes("client")) return <Users className="size-[18px]" />; if (href.includes("integrations")) return <Truck className="size-[18px]" />; if (href.includes("security")) return <ShieldCheck className="size-[18px]" />; if (href.includes("report") || href.includes("analytics") || href.includes("performance")) return <BarChart3 className="size-[18px]" />; if (href.includes("automation")) return <Settings2 className="size-[18px]" />; return <Package className="size-[18px]" />; }
function downloadCsv(label: string, rows: Row[]) { const csv = ["Title,Detail,Status,Meta", ...rows.map((row) => [row.title, row.detail, row.status, row.meta].map((value) => `"${value.replaceAll('"', '""')}"`).join(","))].join("\n"); const link = document.createElement("a"); link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; link.download = `${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-export.csv`; link.click(); }

function DetailPanel({ module, row, onAction }: { module: Props["module"]; row?: Row; onAction(action: string, id: string): void }) { if (!row) return <div className="grid h-full min-h-52 place-items-center text-center text-xs text-muted-foreground">Select a record to inspect its relationships and next action.</div>; return <div className="space-y-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Selected record</p><h2 className="mt-1 text-base font-semibold">{row.title}</h2><p className="mt-1 text-xs text-muted-foreground">{row.detail}</p></div><div className="grid gap-2"><Info label="Status" value={row.status} /><Info label="Context" value={row.meta} /><Info label="Frontend state" value="Persisted in local demo repository" /></div><div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">Related records, activity, notifications, and audit evidence are updated by supported actions.</div>{module.href === "/operations/exceptions" || module.href === "/support/tickets" || module.href === "/support/sla-escalations" || module.href === "/system/security-sessions" || module.href.includes("scheduled-jobs") ? <button onClick={() => onAction(module.href === "/operations/exceptions" ? "Resolve exception" : module.href === "/support/tickets" ? "Resolve ticket" : module.href.includes("scheduled") ? "Run job" : module.href.includes("security") ? "Revoke session" : "Escalate ticket", row.id)} className="h-9 w-full rounded-lg bg-primary text-xs font-semibold text-primary-foreground">Take action</button> : <p className="text-[11px] text-muted-foreground">{module.capabilities.slice(0, 2).join(" · ")}</p>}</div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/40 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-xs font-medium">{value}</p></div>; }

function ActionModal({ module, open, action, form, setValue, onClose, onSubmit, clients, employees }: { module: Props["module"]; open: boolean; action: string | null; form: Record<string, string>; setValue(key: string, value: string): void; onClose(): void; onSubmit(): void; clients: { id: string; name: string }[]; employees: { id: string; name: string }[] }) {
  const href = module.href;
  const fields: { key: string; label: string; type?: "text" | "date"; options?: string[] }[] = href === "/operations/bookings" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "consignor", label: "Consignor" }, { key: "consignee", label: "Consignee" }, { key: "origin", label: "Origin" }, { key: "destination", label: "Destination" }, { key: "weight", label: "Weight (kg)" }, { key: "pieces", label: "Pieces" }, { key: "courier", label: "Courier", options: ["Delhivery", "Blue Dart", "DTDC", "Shiprocket"] }, { key: "paymentMode", label: "Payment mode", options: ["Prepaid", "COD"] }, { key: "codAmount", label: "COD amount" }] : href === "/support/tickets" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "shipment", label: "Shipment reference" }, { key: "subject", label: "Subject" }, { key: "category", label: "Category", options: ["Delivery issue", "Pickup issue", "Billing", "KYC", "General support"] }, { key: "priority", label: "Priority", options: ["Urgent", "High", "Normal"] }, { key: "assignee", label: "Assignee", options: employees.map((item) => item.id) }, { key: "message", label: "Initial message" }] : href === "/clients" || href === "/clients/onboarding" ? [{ key: "name", label: "Client name" }, { key: "clientCode", label: "Client code (optional)" }, { key: "city", label: "City" }, { key: "assignee", label: "Responsible employee", options: employees.map((item) => item.id) }] : href === "/departments" ? [{ key: "name", label: "Department name" }, { key: "manager", label: "Manager", options: employees.map((item) => item.id) }, { key: "capacity", label: "Capacity %" }] : href.includes("finance") ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "amount", label: "Amount" }, { key: "direction", label: "Direction", options: ["Debit", "Credit"] }, { key: "reason", label: "Reason" }] : href === "/insights/reports" ? [{ key: "name", label: "Report name" }, { key: "dateFrom", label: "From", type: "date" }, { key: "dateTo", label: "To", type: "date" }] : href === "/system/settings" ? [{ key: "timezone", label: "Timezone", options: ["Asia/Kolkata", "UTC", "Asia/Dubai"] }, { key: "retention", label: "Shipment retention", options: ["30 days", "90 days", "365 days"] }, { key: "courier", label: "Default courier", options: ["Delhivery", "Blue Dart", "DTDC"] }, { key: "walletApproval", label: "Wallet approval", options: ["true", "false"] }, { key: "alerts", label: "Operational alerts", options: ["true", "false"] }] : href.includes("workflow-rules") || href.includes("notification-rules") ? [{ key: "name", label: "Rule name" }, { key: "trigger", label: "Trigger" }, { key: "condition", label: "Condition" }, { key: "action", label: "Action" }] : href.includes("api-webhooks") ? [{ key: "name", label: "Credential name" }, { key: "kind", label: "Type", options: ["API key", "Webhook"] }, { key: "scope", label: "Scope" }] : [{ key: "name", label: `${action ?? "Record"} name` }, { key: "notes", label: "Notes" }];
  return <Modal open={open} onClose={onClose} title={action ?? "Workspace action"} description="This action updates the frontend-only master demo repository." size="lg"><div className="grid gap-4 sm:grid-cols-2">{fields.map((field) => <Field key={field.key} label={field.label}>{field.options ? <Dropdown label={field.label} value={form[field.key] ?? ""} onChange={(value) => setValue(field.key, value)} options={field.options.map((option) => ({ value: option, label: option.includes("-") ? (field.key === "client" ? clientName(option, clients) : employeeName(option, employees)) : option }))} /> : <input type={field.type ?? "text"} value={form[field.key] ?? ""} onChange={(event) => setValue(field.key, event.target.value)} className={inputClass} placeholder={field.label} />}</Field>)}</div><div className="mt-6 flex justify-end gap-2 border-t border-border/70 pt-4"><button onClick={onClose} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold">Cancel</button><button onClick={onSubmit} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><Check className="size-3.5" />Save locally</button></div></Modal>;
}
