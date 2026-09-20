"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Plus, RefreshCw, Search, XCircle } from "lucide-react";
import type { AdminNavItem } from "@/lib/admin-navigation";
import { useAdmin } from "@/components/admin/admin-provider";
import { pssApi } from "@/lib/pss-api";
import { StatusBadge, inputClass } from "@/components/admin/ui";

type SerializableAdminNavItem = Omit<AdminNavItem, "icon">;
type LiveRecord = Record<string, unknown>;
type Action = "shipment" | "pickup" | "ticket" | "tracking" | "status";

const copy: Record<string, { eyebrow: string; primary: string; action?: Action }> = {
  "/operations/shipments": { eyebrow: "Shipment register", primary: "Export register" },
  "/operations/bookings": { eyebrow: "Booking desk", primary: "New booking", action: "shipment" },
  "/operations/tracking": { eyebrow: "Movement control", primary: "Track shipment", action: "tracking" },
  "/operations/pickups": { eyebrow: "Pickup control", primary: "Schedule pickup", action: "pickup" },
  "/support/tickets": { eyebrow: "Support inbox", primary: "New ticket", action: "ticket" },
  "/support/sla-escalations": { eyebrow: "SLA control", primary: "Update ticket", action: "status" },
  "/operations/exceptions": { eyebrow: "Exception control", primary: "Update exception", action: "status" },
  "/operations/returns": { eyebrow: "Returns control", primary: "Update return", action: "status" },
  "/tasks": { eyebrow: "Task oversight", primary: "Update task", action: "status" },
  "/finance/wallets": { eyebrow: "Wallet control", primary: "Update wallet", action: "status" },
  "/finance/billing-invoices": { eyebrow: "Billing control", primary: "Update invoice", action: "status" },
  "/finance/transactions": { eyebrow: "Transaction control", primary: "Update transaction", action: "status" },
};

const statusRoutes: Record<string, string> = { "/support/sla-escalations": "tickets", "/operations/exceptions": "exceptions", "/operations/returns": "returns", "/tasks": "tasks", "/finance/wallets": "wallet", "/finance/billing-invoices": "billing", "/finance/transactions": "wallet" };
const statusOptions: Record<string, string[]> = { "/support/sla-escalations": ["open", "in_progress", "waiting", "resolved", "closed", "escalated"], "/operations/exceptions": ["open", "assigned", "resolved"], "/operations/returns": ["documents_pending", "ready_for_return", "in_transit", "received"], "/tasks": ["pending", "in_progress", "completed"], "/finance/wallets": ["pending", "approved", "posted", "rejected", "void"], "/finance/billing-invoices": ["pending", "approved", "paid", "void", "cancelled"], "/finance/transactions": ["pending", "approved", "posted", "rejected", "void"] };

function stringify(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function recordsFor(href: string, workspace: ReturnType<typeof useAdmin>["workspace"], clients: ReturnType<typeof useAdmin>["clients"], employees: ReturnType<typeof useAdmin>["employees"]): LiveRecord[] {
  if (href.includes("shipments") || href.includes("bookings") || href.includes("tracking")) return workspace.shipments as unknown as LiveRecord[];
  if (href.includes("pickups")) return workspace.pickups as unknown as LiveRecord[];
  if (href.includes("tickets") || href.includes("sla")) return workspace.tickets as unknown as LiveRecord[];
  if (href.includes("returns")) return workspace.returns as unknown as LiveRecord[];
  if (href.includes("exceptions")) return workspace.exceptions as unknown as LiveRecord[];
  if (href.includes("wallet")) return workspace.wallets as unknown as LiveRecord[];
  if (href.includes("billing")) return workspace.billing as unknown as LiveRecord[];
  if (href.includes("transactions")) return workspace.transactions as unknown as LiveRecord[];
  if (href.includes("tasks")) return workspace.tasks as unknown as LiveRecord[];
  if (href.includes("activity")) return workspace.activities as unknown as LiveRecord[];
  if (href.includes("notifications") || href.includes("alerts")) return workspace.notifications as unknown as LiveRecord[];
  if (href === "/clients" || href.includes("onboarding")) return clients as unknown as LiveRecord[];
  if (href.includes("employees") || href.includes("departments")) return employees as unknown as LiveRecord[];
  return [];
}

export default function AdminModuleWorkspace({ module }: { module: SerializableAdminNavItem }) {
  const { workspace, clients, employees, workspaceLoadError } = useAdmin();
  const moduleCopy = copy[module.href] ?? { eyebrow: module.label, primary: "Unavailable" };
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [statusTarget, setStatusTarget] = useState<LiveRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [enabledProviders, setEnabledProviders] = useState<string[]>([]);
  const records = useMemo(() => recordsFor(module.href, workspace, clients, employees), [clients, employees, module.href, workspace]);
  const filtered = useMemo(() => records.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase())), [query, records]);
  useEffect(() => {
    if (module.href !== "/operations/bookings") return;
    void pssApi<{ data: Record<string, { enabled?: boolean }> }>("/v1/provider-capabilities")
      .then((result) => setEnabledProviders(Object.entries(result.data).filter(([, value]) => value.enabled).map(([provider]) => provider)))
      .catch(() => setEnabledProviders([]));
  }, [module.href]);

  function exportRecords() {
    const keys = [...new Set(filtered.flatMap((row) => Object.keys(row)))];
    const csv = [keys.join(","), ...filtered.map((row) => keys.map((key) => JSON.stringify(row[key] ?? "")).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = `${module.href.slice(1).replaceAll("/", "-") || "export"}.csv`;
    link.click();
    setNotice(`Exported ${filtered.length} records returned by the production API.`);
  }

  async function submit(payload: Record<string, string>) {
    if (!action) return;
    setSubmitting(true);
    try {
      if (action === "shipment") {
        await pssApi("/v1/shipments", { method: "POST", body: JSON.stringify({ client_id: payload.client_id, origin: payload.origin, destination: payload.destination, consignee: payload.consignee, description: payload.description, provider: payload.provider || null, total_weight_kg: Number(payload.total_weight_kg), declared_value: Number(payload.declared_value || 0), pieces: Number(payload.pieces || 1), edd: payload.edd || null }) });
      } else if (action === "pickup") {
        await pssApi("/v1/pickups", { method: "POST", body: JSON.stringify({ client_id: payload.client_id, shipment_id: payload.shipment_id || null, scheduled_date: payload.scheduled_date, window: payload.window, location: payload.location, contact_name: payload.contact_name, contact_phone: payload.contact_phone, notes: payload.notes }) });
      } else if (action === "ticket") {
        await pssApi("/v1/tickets", { method: "POST", body: JSON.stringify({ client_id: payload.client_id, shipment_id: payload.shipment_id || null, title: payload.title, description: payload.description, priority: payload.priority }) });
      } else if (action === "status") {
        const id = String(statusTarget?.id ?? "");
        const routeName = statusRoutes[module.href];
        if (!id || !routeName) throw new Error("Choose a production record to update.");
        await pssApi(`/v1/${routeName}/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: payload.status }) });
      } else {
        const shipment = workspace.shipments.find((row) => row.id === payload.shipment_id || row.reference === payload.shipment_id);
        if (!shipment) throw new Error("Choose a shipment returned by the production API.");
        const result = await pssApi<{ data?: { events?: unknown[] } }>(`/v1/shipments/${encodeURIComponent(shipment.id)}/tracking`);
        setNotice(`Tracking loaded from production (${result.data?.events?.length ?? 0} events).`);
        setAction(null);
        return;
      }
      setNotice("Saved successfully through the production API.");
      setAction(null);
      setStatusTarget(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The production API rejected the request.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="flex h-full min-h-0 w-full flex-col gap-5">
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{moduleCopy.eyebrow}</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{module.label}</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Live records are loaded from the authenticated Worker/D1 boundary. Empty results are not replaced with demo records.</p></div><div className="flex flex-wrap gap-2"><StatusBadge tone={module.status === "live" || module.href in statusRoutes ? "positive" : "warning"}>{module.status === "live" || module.href in statusRoutes ? "Live API" : "Read-only until enabled"}</StatusBadge>{moduleCopy.action && moduleCopy.action !== "status" ? <button disabled={submitting} onClick={() => setAction(moduleCopy.action ?? null)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-3.5" />{moduleCopy.primary}</button> : moduleCopy.primary === "Export register" ? <button onClick={exportRecords} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold"><Download className="size-3.5" />Export live records</button> : null}</div></header>
    {workspaceLoadError && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800">{workspaceLoadError}</div>}
    {notice && <button onClick={() => setNotice(null)} className="flex w-full items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-left text-xs text-primary"><span>{notice}</span><XCircle className="size-4" /></button>}
    <section className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-xs"><div className="flex flex-col gap-2 border-b border-border/70 p-3 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} h-9 pl-9 text-xs`} placeholder="Search live records" /></div><span className="text-[11px] text-muted-foreground">{filtered.length} of {records.length} records</span><button onClick={() => window.location.reload()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold"><RefreshCw className="size-3.5" />Refresh</button></div>{filtered.length === 0 ? <div className="grid h-48 place-items-center p-6 text-center"><div><p className="text-sm font-semibold">No production records found</p><p className="mt-1 text-xs text-muted-foreground">The Worker returned an empty result for this scope. Demo records are intentionally not shown.</p></div></div> : <div className="max-h-full overflow-auto divide-y divide-border/70">{filtered.map((row, index) => { const entries = Object.entries(row).filter(([, value]) => value !== undefined && value !== null && value !== "").slice(0, 5); const canUpdate = module.href in statusRoutes; return <div key={String(row.id ?? index)} className="grid gap-2 px-4 py-3 sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto] sm:items-center">{entries.map(([key, value]) => <div key={key} className="min-w-0"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">{key.replaceAll(/([A-Z])/g, " $1")}</p><p className="truncate text-xs font-medium">{stringify(value)}</p></div>)}{canUpdate ? <button onClick={() => { setStatusTarget(row); setAction("status"); }} className="rounded-lg border border-border px-2 py-1 text-[10px] font-semibold hover:bg-muted">Update</button> : <span className="text-[10px] text-muted-foreground">Live</span>}</div>; })}</div>}</section>
    {action && <ActionDialog action={action} moduleHref={module.href} statusTarget={statusTarget} clients={clients.map((client) => ({ value: client.id, label: client.name }))} shipments={workspace.shipments.map((shipment) => ({ value: shipment.id, label: shipment.reference }))} providers={enabledProviders} submitting={submitting} onClose={() => { setAction(null); setStatusTarget(null); }} onSubmit={submit} />}
  </div>;
}

function ActionDialog({ action, moduleHref, statusTarget, clients, shipments, providers, submitting, onClose, onSubmit }: { action: Action; moduleHref: string; statusTarget: LiveRecord | null; clients: Array<{ value: string; label: string }>; shipments: Array<{ value: string; label: string }>; providers: string[]; submitting: boolean; onClose(): void; onSubmit(payload: Record<string, string>): Promise<void> }) {
  const [payload, setPayload] = useState<Record<string, string>>({ client_id: clients[0]?.value ?? "", shipment_id: shipments[0]?.value ?? "", provider: "", priority: "Normal", pieces: "1", total_weight_kg: "1", declared_value: "0" });
  const fields = action === "shipment" ? ["client_id", "origin", "destination", "consignee", "total_weight_kg", "pieces", "provider", "declared_value", "edd", "description"] : action === "pickup" ? ["client_id", "shipment_id", "scheduled_date", "window", "location", "contact_name", "contact_phone", "notes"] : action === "ticket" ? ["client_id", "shipment_id", "title", "priority", "description"] : action === "tracking" ? ["shipment_id"] : ["status"];
  const labels: Record<string, string> = { client_id: "Client", shipment_id: "Shipment", origin: "Origin", destination: "Destination", consignee: "Consignee", total_weight_kg: "Weight (kg)", pieces: "Pieces", provider: "Provider (optional)", declared_value: "Declared value", edd: "EDD", description: "Description", scheduled_date: "Scheduled date", window: "Time window", location: "Pickup location", contact_name: "Contact name", contact_phone: "Contact phone", notes: "Notes", title: "Subject", priority: "Priority", status: "New status" };
  const optionsFor = (field: string) => field === "client_id" ? clients : field === "shipment_id" ? shipments : field === "provider" ? [{ value: "", label: providers.length ? "No provider call" : "No enabled provider" }, ...providers.map((provider) => ({ value: provider, label: provider[0].toUpperCase() + provider.slice(1) }))] : field === "priority" ? ["Normal", "High", "Urgent"].map((value) => ({ value, label: value })) : field === "status" ? (statusOptions[moduleHref] ?? []).map((value) => ({ value, label: value.replaceAll("_", " ") })) : null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"><form onSubmit={(event) => { event.preventDefault(); void onSubmit(payload); }} className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl border border-border bg-card p-5 shadow-xl"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">{action === "shipment" ? "Create shipment" : action === "pickup" ? "Schedule pickup" : action === "ticket" ? "Create support ticket" : action === "tracking" ? "Load tracking" : "Update production record"}</h2><p className="mt-1 text-xs text-muted-foreground">This action is sent to the authenticated production API.</p>{statusTarget && <p className="mt-1 text-[11px] text-muted-foreground">Record: {String(statusTarget.id ?? "unknown")}</p>}</div><button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground">×</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{fields.map((field) => { const options = optionsFor(field); return <label key={field} className={field === "description" || field === "notes" ? "sm:col-span-2" : ""}><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{labels[field]}</span>{options ? <select required={field === "client_id" || (field === "shipment_id" && action === "tracking") || field === "status"} value={payload[field] ?? ""} onChange={(event) => setPayload((current) => ({ ...current, [field]: event.target.value }))} className={`${inputClass} h-9 text-xs`}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input required={!['description', 'notes', 'edd', 'declared_value', 'provider', 'shipment_id'].includes(field)} type={field.includes("date") || field === "edd" ? "date" : "text"} value={payload[field] ?? ""} onChange={(event) => setPayload((current) => ({ ...current, [field]: event.target.value }))} className={`${inputClass} h-9 text-xs`} />}</label>; })}</div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold">Cancel</button><button disabled={submitting} className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">{submitting ? "Saving…" : "Save"}</button></div></form></div>;
}
