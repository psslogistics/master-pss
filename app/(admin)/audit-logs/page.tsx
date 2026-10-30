"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { useAdmin } from "@/components/admin/admin-provider";
import { Modal, StatusBadge } from "@/components/admin/ui";
import type { AuditEvent } from "@/lib/admin-domain";
import { activityDetailsSummary, activitySnapshotPair, normalizeActivityEntityType } from "@/lib/activity-audit";
import { pssApi } from "@/lib/pss-api";

type ActivityRow = { id: string; action?: string; entity_type?: string; entity_id?: string; actor_user_id?: string; created_at?: string; details_json?: string | Record<string, unknown> | null };
type AdminAuditRow = { id: string; action?: string; entity_type?: string; entity_id?: string | null; actor_user_id?: string; created_at?: string; before_state?: Record<string, unknown> | null; after_state?: Record<string, unknown> | null };
type PageMeta = { next_offset?: number; total?: number; has_more?: boolean };
type AuditPageState = { offset: number; total: number | null; hasMore: boolean };
export default function AuditLogsPage() {
  const { employees } = useAdmin();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All");
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [eventDetails, setEventDetails] = useState<Record<string, string | Record<string, unknown> | null>>({});
  const [eventSources, setEventSources] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceWarning, setSourceWarning] = useState("");
  const [visibleCount, setVisibleCount] = useState(100);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pages, setPages] = useState<{ worker: AuditPageState; master: AuditPageState }>({ worker: { offset: 0, total: null, hasMore: false }, master: { offset: 0, total: null, hasMore: false } });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSourceWarning("");
    setVisibleCount(100);
    try {
      const [operationalResult, adminResult] = await Promise.allSettled([
        pssApi<{ data: ActivityRow[]; pagination?: PageMeta }>("/v1/activity?limit=100&offset=0", { cache: "no-store" }),
        fetch("/api/admin/audit-events?limit=100&offset=0", { cache: "no-store" }).then(async (response) => {
          const result = await response.json().catch(() => ({})) as { data?: AdminAuditRow[]; pagination?: PageMeta; error?: string };
          if (!response.ok) throw new Error(result.error ?? `Super Admin audit events failed (${response.status}).`);
          return result;
        }),
      ]);
      if (operationalResult.status === "rejected" && adminResult.status === "rejected") {
        throw new Error("Neither operational activity nor Super Admin audit events could be loaded.");
      }
      if (operationalResult.status === "rejected" || adminResult.status === "rejected") {
        setSourceWarning("One audit source is unavailable. The events shown are partial; retry to load both sources.");
      }
      const operationalPage = operationalResult.status === "fulfilled" ? operationalResult.value : null;
      const adminPage = adminResult.status === "fulfilled" ? adminResult.value : null;
      const operationalRows = operationalPage?.data ?? [];
      const adminRows = adminPage?.data ?? [];
      const mappedOperational = operationalRows.map((row) => ({ row, source: "Worker" as const, details: row.details_json ?? null }));
      const mappedAdmin = adminRows.map((row) => ({ row, source: "Super Admin" as const, details: { before: row.before_state ?? undefined, after: row.after_state ?? undefined } }));
      const combined = [...mappedOperational, ...mappedAdmin]
        .sort((a, b) => (Date.parse(b.row.created_at ?? "") || 0) - (Date.parse(a.row.created_at ?? "") || 0) || String(b.row.id).localeCompare(String(a.row.id)));
      setPages({
        worker: { offset: Number(operationalPage?.pagination?.next_offset ?? operationalRows.length), total: typeof operationalPage?.pagination?.total === "number" ? operationalPage.pagination.total : null, hasMore: Boolean(operationalPage?.pagination?.has_more) },
        master: { offset: Number(adminPage?.pagination?.next_offset ?? adminRows.length), total: typeof adminPage?.pagination?.total === "number" ? adminPage.pagination.total : null, hasMore: Boolean(adminPage?.pagination?.has_more) },
      });
      setEventDetails(Object.fromEntries(combined.map(({ row, details, source }) => [`${source}:${row.id}`, details])));
      setEventSources(Object.fromEntries(combined.map(({ row, source }) => [`${source}:${row.id}`, source])));
      setEvents(combined.map(({ row, source }) => {
        const entityType = normalizeActivityEntityType(row.entity_type);
        const timestamp = row.created_at && Number.isFinite(Date.parse(row.created_at)) ? row.created_at : "";
        return {
          id: `${source}:${row.id}`,
          action: row.action?.trim() || "Activity recorded",
          entityType,
          entityId: row.entity_id ?? row.id,
          entityLabel: row.entity_id ?? "ID not recorded",
          actorEmployeeId: row.actor_user_id ?? "System",
          timestamp,
          ...activitySnapshotPair(source === "Super Admin" ? { before: row.before_state, after: row.after_state } : row.details_json),
          severity: "Info" as const,
        };
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Activity could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const types = ["All", ...Array.from(new Set(events.map((event) => event.entityType)))];
  const loadedEvents = useMemo(() => events.slice(0, visibleCount), [events, visibleCount]);
  const filtered = useMemo(() => loadedEvents.filter((event) => (type === "All" || event.entityType === type) && `${event.action} ${event.entityLabel} ${event.actorEmployeeId}`.toLowerCase().includes(query.toLowerCase())), [loadedEvents, query, type]);
  const feedTotal = pages.worker.total !== null && pages.master.total !== null ? pages.worker.total + pages.master.total : null;
  const hasMore = visibleCount < events.length || pages.worker.hasMore || pages.master.hasMore;
  const actorName = (id: string) => employees.find((employee) => employee.id === id)?.name ?? (id === "System" ? "System" : id);
  const formatTime = (value: string) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Timestamp unavailable";
  const selectedDetails = selected ? eventDetails[selected.id] : null;
  const selectedSummary = activityDetailsSummary(selectedDetails);
  const selectedSource = selected ? eventSources[selected.id] : "";

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    if (visibleCount < events.length) { setVisibleCount((count) => count + 100); return; }
    setLoadingMore(true);
    const requests = await Promise.allSettled([
      pages.worker.hasMore ? pssApi<{ data: ActivityRow[]; pagination?: PageMeta }>(`/v1/activity?limit=100&offset=${pages.worker.offset}`, { cache: "no-store" }) : Promise.resolve(null),
      pages.master.hasMore ? fetch(`/api/admin/audit-events?limit=100&offset=${pages.master.offset}`, { cache: "no-store" }).then(async (response) => { const result = await response.json().catch(() => ({})) as { data?: AdminAuditRow[]; pagination?: PageMeta; error?: string }; if (!response.ok) throw new Error(result.error ?? `Super Admin audit events failed (${response.status}).`); return result; }) : Promise.resolve(null),
    ]);
    const worker = requests[0].status === "fulfilled" ? requests[0].value : null;
    const master = requests[1].status === "fulfilled" ? requests[1].value : null;
    const workerFailed = requests[0].status === "rejected";
    const masterFailed = requests[1].status === "rejected";
    const workerRows = worker?.data ?? [];
    const masterRows = master?.data ?? [];
    const mapped = [
      ...workerRows.map((row) => ({ row, source: "Worker" as const, details: row.details_json ?? null })),
      ...masterRows.map((row) => ({ row, source: "Super Admin" as const, details: { before: row.before_state ?? undefined, after: row.after_state ?? undefined } })),
    ];
    const nextEvents = mapped.map(({ row, source }) => {
      const entityType = normalizeActivityEntityType(row.entity_type);
      return { id: `${source}:${row.id}`, action: row.action?.trim() || "Activity recorded", entityType, entityId: row.entity_id ?? row.id, entityLabel: row.entity_id ?? "ID not recorded", actorEmployeeId: row.actor_user_id ?? "System", timestamp: row.created_at && Number.isFinite(Date.parse(row.created_at)) ? row.created_at : "", ...activitySnapshotPair(source === "Super Admin" ? { before: row.before_state, after: row.after_state } : row.details_json), severity: "Info" as const };
    });
    for (const item of mapped) {
      const key = `${item.source}:${item.row.id}`;
      setEventDetails((current) => ({ ...current, [key]: item.details }));
      setEventSources((current) => ({ ...current, [key]: item.source }));
    }
    if (worker || master) {
      setEvents((current) => [...current, ...nextEvents.filter((event) => !current.some((existing) => existing.id === event.id))].sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0) || b.id.localeCompare(a.id)));
      setVisibleCount((count) => count + 100);
      setPages((current) => ({
        worker: workerFailed || !worker ? current.worker : { offset: Number(worker.pagination?.next_offset ?? current.worker.offset + workerRows.length), total: typeof worker.pagination?.total === "number" ? worker.pagination.total : current.worker.total, hasMore: Boolean(worker.pagination?.has_more) },
        master: masterFailed || !master ? current.master : { offset: Number(master.pagination?.next_offset ?? current.master.offset + masterRows.length), total: typeof master.pagination?.total === "number" ? master.pagination.total : current.master.total, hasMore: Boolean(master.pagination?.has_more) },
      }));
      if (workerFailed || masterFailed) setSourceWarning("One audit source could not load its next page. The other source continued; use Load older events to retry the failed source.");
    } else {
      setSourceWarning("Older audit events could not be loaded. Use Refresh to retry the feed.");
      // Keep failed sources available for retry; the next click re-requests their same offsets.
    }
    setLoadingMore(false);
  }

  return <div className="flex min-h-full w-full flex-col"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldAlert className="size-5" /></div><div><h1 className="text-2xl font-semibold tracking-[-0.03em]">Activity logs</h1><p className="mt-1 text-sm text-muted-foreground">Search the combined production activity feed. Before/after snapshots are only shown when the source records them.</p></div></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-input px-3 text-xs font-semibold disabled:opacity-50"><RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />{loading ? "Refreshing…" : "Refresh"}</button></div>
    <p className="mt-3 text-[11px] text-muted-foreground">Showing {Math.min(visibleCount, events.length).toLocaleString("en-IN")} of {feedTotal === null ? "an unknown total" : `${feedTotal.toLocaleString("en-IN")} events`}. Use “Load older events” to continue through the timeline.</p>
    {sourceWarning && <p role="status" className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-800">{sourceWarning}</p>}
    <section className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs"><div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actor, action, or entity" className="h-10 w-full rounded-xl border border-border pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></div><div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">{types.map((item) => <button type="button" key={item} onClick={() => setType(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${type === item ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"}`}>{item}</button>)}</div></div>
      {error ? <div role="alert" className="m-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}<button type="button" onClick={() => void load()} className="ml-3 underline">Retry</button></div> : loading ? <p role="status" className="p-5 text-sm text-muted-foreground">Loading activity…</p> : filtered.length ? <><div className="divide-y divide-border/60">{filtered.map((event) => <button type="button" key={event.id} onClick={() => setSelected(event)} className="grid w-full gap-3 px-4 py-4 text-left hover:bg-muted/40 sm:grid-cols-[32px_1fr_150px_160px_20px] sm:items-center"><div className="grid size-8 place-items-center rounded-xl bg-muted text-muted-foreground"><Activity className="size-4" /></div><div><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-foreground">{event.action}</p><StatusBadge tone="neutral">Recorded</StatusBadge></div><p className="mt-1 text-[11px] text-muted-foreground">{event.entityType} · {event.entityLabel}</p></div><div><p className="break-all text-xs font-medium text-muted-foreground">{actorName(event.actorEmployeeId)}</p><p className="mt-1 text-[10px] text-muted-foreground">Actor ID</p></div><time className="text-[11px] text-muted-foreground">{formatTime(event.timestamp)}</time><ChevronDown className="size-4 -rotate-90 text-muted-foreground/60" /></button>)}</div>{hasMore && <div className="border-t border-border/60 p-4 text-center"><button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="h-9 rounded-lg border border-border px-4 text-xs font-semibold hover:bg-muted/40 disabled:opacity-50">{loadingMore ? "Loading older events…" : "Load older events"}</button></div>}</> : <div className="p-8 text-center"><p className="text-sm font-medium">{events.length ? "No activity matches these filters" : "No production activity found"}</p><p className="mt-1 text-xs text-muted-foreground">Try another search or refresh the activity feed.</p></div>}
    </section>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Activity event details" description="Values appear only when they were captured by the source event."><dl className="grid gap-4 text-xs sm:grid-cols-2"><Detail label="Action" value={selected?.action} /><Detail label="Source" value={selectedSource} /><Detail label="Actor ID" value={selected ? actorName(selected.actorEmployeeId) : ""} /><Detail label="Entity" value={selected ? `${selected.entityType} · ${selected.entityLabel}` : ""} /><Detail label="Timestamp" value={selected ? formatTime(selected.timestamp) : ""} /><Detail label="Previous value" value={selected?.before} /><Detail label="New value" value={selected?.after} /></dl>{selectedSummary.length > 0 && <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recorded details</p><ul className="mt-2 space-y-1 text-xs text-foreground/80">{selectedSummary.map((item) => <li key={item}>{item}</li>)}</ul></div>}<div className="mt-5 rounded-xl border border-primary/25 bg-primary/5 p-3 text-[11px] leading-5 text-muted-foreground">Events are loaded newest first from the Worker activity feed and Super Admin audit history. Continue loading older events to inspect the full timeline.</div></Modal>
  </div>;
}

function Detail({ label, value }: { label: string; value?: string }) { return <div className="rounded-xl bg-muted/40 p-3"><dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</dt><dd className="mt-1.5 break-words font-medium text-foreground/80">{value || "Unavailable"}</dd></div>; }
