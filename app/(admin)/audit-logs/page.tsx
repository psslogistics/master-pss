"use client";

import { useMemo, useState } from "react";
import { Activity, ChevronDown, Search, ShieldAlert } from "lucide-react";
import { useAdmin } from "@/components/admin/admin-provider";
import { Modal, StatusBadge } from "@/components/admin/ui";
import type { AuditEvent } from "@/lib/admin-domain";

export default function AuditLogsPage() {
  const { auditEvents, employees } = useAdmin();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const types = ["All", ...Array.from(new Set(auditEvents.map((event) => event.entityType)))];
  const filtered = useMemo(() => auditEvents.filter((event) => (type === "All" || event.entityType === type) && `${event.action} ${event.entityLabel} ${event.before} ${event.after}`.toLowerCase().includes(query.toLowerCase())), [auditEvents, query, type]);
  const actorName = (id: string) => employees.find((employee) => employee.id === id)?.name ?? "System";
  return <div className="w-full"><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldAlert className="size-5" /></div><div><h1 className="text-2xl font-semibold tracking-[-0.03em]">Audit logs</h1><p className="mt-1 text-sm text-muted-foreground">Review security-sensitive and business-critical prototype events.</p></div></div>
    <section className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-xs"><div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actor, action, entity, or change" className="h-10 w-full rounded-xl border border-border pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></div><div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">{types.map((item) => <button key={item} onClick={() => setType(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${type === item ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"}`}>{item}</button>)}</div></div><div className="divide-y divide-border/60">{filtered.map((event) => <button key={event.id} onClick={() => setSelected(event)} className="grid w-full gap-3 px-4 py-4 text-left hover:bg-muted/40 sm:grid-cols-[32px_1fr_150px_130px_20px] sm:items-center"><div className="grid size-8 place-items-center rounded-xl bg-muted text-muted-foreground"><Activity className="size-4" /></div><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-foreground">{event.action}</p><StatusBadge tone={event.severity === "Security" ? "critical" : event.severity === "Important" ? "warning" : "neutral"}>{event.severity}</StatusBadge></div><p className="mt-1 text-[11px] text-muted-foreground">{event.entityType} · {event.entityLabel}</p></div><div><p className="text-xs font-medium text-muted-foreground">{actorName(event.actorEmployeeId)}</p><p className="mt-1 text-[10px] text-muted-foreground">Actor</p></div><time className="text-[11px] text-muted-foreground">{new Date(event.timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</time><ChevronDown className="size-4 -rotate-90 text-muted-foreground/60" /></button>)}</div></section>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Audit event details" description="Local prototype evidence for this change."><dl className="grid gap-4 text-xs sm:grid-cols-2"><Detail label="Action" value={selected?.action} /><Detail label="Actor" value={selected ? actorName(selected.actorEmployeeId) : ""} /><Detail label="Entity" value={selected ? `${selected.entityType} · ${selected.entityLabel}` : ""} /><Detail label="Timestamp" value={selected ? new Date(selected.timestamp).toLocaleString("en-IN") : ""} /><Detail label="Previous value" value={selected?.before ?? "Not recorded"} /><Detail label="New value" value={selected?.after ?? "Not recorded"} /></dl><div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10/60 p-3 text-[11px] leading-5 text-amber-700 dark:text-amber-300">Demo audit events are stored in this browser and are not tamper-resistant production logs.</div></Modal>
  </div>;
}

function Detail({ label, value }: { label: string; value?: string }) { return <div className="rounded-xl bg-muted/40 p-3"><dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1.5 font-medium text-foreground/80">{value}</dd></div>; }


