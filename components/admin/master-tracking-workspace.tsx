"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronUp, Copy, MapPin, Package, RefreshCw, Search, Truck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, StatusBadge } from "@/components/admin/ui";
import type { MasterShipmentRow } from "@/components/admin/master-shipment-workspace-client-v2";
import { useIsSuperAdmin } from "@/components/admin/super-admin-context";
import { pssApi } from "@/lib/pss-api";
import { Field, Modal, inputClass } from "@/components/admin/ui";

type Props = {
  rows: MasterShipmentRow[];
  clients: Array<{ id: string; name: string; assignedToEmployeeName?: string }>;
  loading: boolean;
  error: string | null;
  total: number | null;
  onRefresh: () => void;
};

type TrackingEvent = { status: string; description: string; location: string; eventTime: string };

const text = (value: unknown, fallback = "Not available") => {
  const result = String(value ?? "").trim();
  return result || fallback;
};

const status = (value: unknown) => {
  const key = text(value, "Booked").toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  const map: Record<string, string> = { picked_up: "In transit", pickedup: "In transit", in_transit: "In transit", intransit: "In transit", out_for_delivery: "Out for delivery", delivered: "Delivered", delayed: "Delayed", exception: "Exception", returned: "Returned", rto: "Returned", cancelled: "Cancelled", canceled: "Cancelled", pending: "Booked", manifested: "Booked", booked: "Booked" };
  return map[key] ?? text(value, "Booked");
};

const dateTime = (value: unknown) => {
  if (!value) return "Not available";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? text(value) : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

function eventsFor(row: MasterShipmentRow): TrackingEvent[] {
  const raw = row.raw?.tracking_events;
  const values = Array.isArray(raw) ? raw : [];
  const events = values.map((event) => {
    const item = event && typeof event === "object" ? event as Record<string, unknown> : {};
    return { status: status(item.status), description: text(item.description, "Tracking event received from the production provider."), location: text(item.location, "Not provided"), eventTime: text(item.event_time ?? item.created_at, text(row.raw?.updated_at ?? row.raw?.created_at, "Not available")) };
  });
  return events.length ? events : [{ status: status(row.raw?.status ?? row.status), description: "Shipment status is sourced from the production provider reconciliation path.", location: text(row.raw?.current_location ?? row.raw?.origin, "Not provided"), eventTime: text(row.raw?.updated_at ?? row.raw?.created_at, "Not available") }];
}

function Identifier({ label, value }: { label: string; value: unknown }) {
  return <div className="min-w-0 rounded-md border border-border bg-muted px-3 py-2"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 truncate text-xs font-semibold text-foreground" title={text(value)}>{text(value)}</p></div>;
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  return <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-0"><span className="text-xs text-muted-foreground">{label}</span><span className="min-w-0 text-right text-xs font-medium text-foreground">{text(value)}</span></div>;
}

export default function MasterTrackingWorkspace({ rows, clients, loading, error, total, onRefresh }: Props) {
  const isSuperAdmin = useIsSuperAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeSearch = searchParams.get("shipment")?.trim() ?? "";
  const [query, setQuery] = useState(routeSearch);
  const [notice, setNotice] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [scanOpen, setScanOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) setQuery(routeSearch); });
    return () => { active = false; };
  }, [routeSearch]);

  const selected = useMemo(() => {
    if (!routeSearch) return undefined;
    const needle = routeSearch.toLowerCase();
    return rows.find((row) => {
      const values = [
        row.id,
        row.raw?.lr_number,
        row.raw?.master_awb,
        row.raw?.tracking_number,
        row.raw?.provider_reference,
        row.raw?.pickup_reference,
        row.raw?.reference,
      ];
      return values.some((value) => String(value ?? "").trim().toLowerCase() === needle);
    });
  }, [routeSearch, rows]);
  const raw = selected?.raw ?? {};
  const selectedClient = clients.find((client) => client.id === String(raw.client_id ?? ""));
  const selectedStatus = selected ? status(raw.status ?? selected.status) : "Booked";
  const events = selected ? eventsFor(selected) : [];
  const latest = events.at(-1);
  const reference = selected ? text(raw.lr_number ?? raw.master_awb ?? raw.tracking_number ?? raw.provider_reference ?? selected.id) : "";
  const referenceLabel = raw.lr_number ? "LRN" : raw.master_awb ? "Master AWB" : raw.tracking_number ? "Tracking reference" : "PSS shipment";
  const stages = selectedStatus === "Exception" ? ["Booked", "Exception", "Out for delivery", "Delivered"] : ["Booked", "In transit", "Out for delivery", "Delivered"];
  const currentStage = Math.max(0, stages.indexOf(selectedStatus));

  const search = () => {
    const value = query.trim();
    router.replace(value ? `/operations/tracking?shipment=${encodeURIComponent(value)}` : "/operations/tracking");
  };

  const copyReference = async () => {
    try { await navigator.clipboard.writeText(reference); } catch { /* Clipboard may be unavailable. */ }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  if (loading && !selected) return <div className="grid min-h-[520px] place-items-center rounded-xl border border-border bg-card text-sm text-muted-foreground">Loading production tracking…</div>;
  if (error && !selected) return <div className="grid min-h-[520px] place-items-center rounded-xl border border-border bg-card p-8 text-center"><div><p className="text-sm font-semibold">Tracking data is unavailable</p><p className="mt-1 text-xs text-muted-foreground">{error}</p><button type="button" onClick={onRefresh} className="mt-4 rounded-md border border-input px-3 py-2 text-xs font-semibold">Retry</button></div></div>;
  if (!selected) return <div className="space-y-4"><section className="rounded-xl border border-border bg-card p-3 shadow-sm"><form onSubmit={(event) => { event.preventDefault(); search(); }} className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" /><input aria-label="Search shipments in tracking" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipments, LR / LRN, AWB, PUR, or PSS reference…" className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-20 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />{query && <button type="button" aria-label="Clear shipment search" onClick={() => setQuery("")} className="absolute right-16 top-1/2 rounded p-1 text-muted-foreground hover:bg-accent"><X className="size-4" /></button>}</form></section><div className="grid min-h-[420px] place-items-center rounded-xl border border-border bg-card p-8 text-center"><EmptyState title={routeSearch ? "Shipment not found" : "Search a shipment to track it"} description={routeSearch ? `No organization-wide shipment matched “${routeSearch}”.` : "Enter an LR/LRN, AWB, pickup reference, or PSS reference to open its tracking timeline."} /></div></div>;

  return <div className="relative min-h-full w-full min-w-0 bg-background text-foreground">
    <main className="mx-auto w-full max-w-[1400px] space-y-4 p-4 sm:p-6">
      <section className="rounded-xl border border-border bg-card p-3 shadow-sm"><form onSubmit={(event) => { event.preventDefault(); search(); }} className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" /><input aria-label="Search shipments in tracking" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipments, LR / LRN, AWB, PUR, or PSS reference…" className="h-10 w-full rounded-lg border border-input bg-card pl-9 pr-20 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />{query && <button type="button" aria-label="Clear shipment search" onClick={() => { setQuery(""); router.replace("/operations/tracking"); }} className="absolute right-16 top-1/2 rounded p-1 text-muted-foreground hover:bg-accent"><X className="size-4" /></button>}<button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-primary/90">Track</button></form></section>
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="px-4 pb-4 pt-5 sm:px-6"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-md bg-rose-500/10 text-rose-600"><Truck className="size-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-tight">{referenceLabel} {reference}</h1><button type="button" aria-label="Copy shipment reference" onClick={() => void copyReference()} className="rounded p-1 text-muted-foreground hover:bg-accent"><Copy className="size-3.5" /></button></div><p className="mt-1 text-sm text-muted-foreground">{text(raw.master_awb ? `Master AWB: ${raw.master_awb} · ` : "")}{text(raw.pieces ?? 1, "1")} {Number(raw.pieces ?? 1) === 1 ? "Box" : "Boxes"}</p><p className="mt-1 text-sm text-muted-foreground">· Created on: {dateTime(raw.created_at)}</p></div></div><button type="button" onClick={onRefresh} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-xs font-semibold text-foreground/80 shadow-sm transition hover:bg-muted"><RefreshCw className="size-3.5" />Refresh tracking</button></div><div className="mt-4 border-t border-border pt-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"><Identifier label="PSS shipment ID" value={selected.id} /><Identifier label="Client" value={selectedClient?.name ?? "Client unavailable"} /><Identifier label="Account owner" value={selectedClient?.assignedToEmployeeName ?? "Unassigned"} /><Identifier label="LR / LRN" value={raw.lr_number} /><Identifier label="AWB / waybill" value={raw.master_awb ?? raw.tracking_number ?? raw.provider_reference} /><Identifier label="Box AWB(s)" value={raw.box_awbs_json} /><Identifier label="Invoice number" value={raw.invoice_number} /><Identifier label="Pickup reference" value={raw.pickup_reference} /><Identifier label="Provider booking ID" value={raw.provider_booking_id} /><Identifier label="Provider pickup ID" value={raw.provider_pickup_id} /></div><div className="mt-3 flex flex-wrap gap-2"><StatusBadge tone={selectedStatus === "Exception" ? "critical" : selectedStatus === "Delivered" ? "positive" : "warning"}>{selectedStatus}</StatusBadge><StatusBadge tone="navy">{text(raw.provider, "Delhivery")}</StatusBadge></div><div className={cn("mt-4 flex items-start gap-3 rounded-md px-3 py-3", selectedStatus === "Exception" ? "bg-rose-500/10" : "bg-emerald-500/10/70")}><Truck className={cn("mt-0.5 size-4 shrink-0", selectedStatus === "Exception" ? "text-rose-600" : "text-emerald-600")} /><div><p className="text-sm font-medium">{selectedStatus === "Booked" ? "Ready to Ship" : selectedStatus}</p><p className="mt-0.5 text-xs text-muted-foreground">{latest?.description}</p></div></div></div></div></section>
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="flex items-center gap-2 border-b border-border px-4 py-4 sm:px-5"><div className="grid size-7 place-items-center rounded-md bg-rose-500/10 text-rose-600"><Truck className="size-4" /></div><h2 className="text-base font-semibold text-foreground">Shipment tracking</h2></div><div className="px-4 py-5 sm:px-6"><ol aria-label="Shipment tracking" className="space-y-0">{stages.map((stage, index) => { const complete = index <= currentStage; const active = index === currentStage; return <li key={stage} className="relative flex gap-3"><div className="flex w-4 shrink-0 flex-col items-center"><span className={cn("z-10 mt-0.5 grid size-4 place-items-center rounded-full border-2 bg-card", complete ? "border-emerald-500" : "border-input")}>{complete && <span className="size-2 rounded-full bg-emerald-500/100" />}</span>{index < stages.length - 1 && <span className={cn("w-0.5 flex-1", index < currentStage ? "bg-emerald-500/100" : "bg-border")} />}</div><div className={cn("min-w-0 flex-1", index < stages.length - 1 ? "pb-7" : "pb-1")}><div className={cn("text-sm font-semibold", active ? "text-foreground" : "text-muted-foreground/70")}>{stage === "Booked" ? "Manifested" : stage}</div>{active && latest && <><p className="mt-0.5 text-xs text-muted-foreground">{dateTime(latest.eventTime)}</p>{latest.location !== "Not provided" && <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-foreground/80"><MapPin className="size-3.5 text-primary" />Current location: {latest.location}</p>}</>}{active && events.length > 1 && <div className="mt-3"><button type="button" onClick={() => setScanOpen(!scanOpen)} className="inline-flex items-center gap-1.5 px-1 py-2 text-xs font-medium text-primary">{scanOpen ? "Hide movement history" : "View movement history"}<ChevronDown className={cn("size-3.5 transition", scanOpen && "rotate-180")} /></button>{scanOpen && <div className="mt-3 space-y-3 border-l-2 border-primary/30 pl-3 text-xs">{[...events].reverse().map((event, index) => <div key={`${event.eventTime}-${index}`}><span className="block text-muted-foreground">{dateTime(event.eventTime)}</span><span className="mt-0.5 block font-medium text-foreground/80">{event.description}</span>{event.location !== "Not provided" && <span className="mt-0.5 flex items-center gap-1 text-muted-foreground"><MapPin className="size-3" />{event.location}</span>}</div>)}</div>}</div>}</div></li>; })}</ol></div></section>
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><button type="button" onClick={() => setSummaryOpen(!summaryOpen)} aria-expanded={summaryOpen} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-muted sm:px-5"><span className="flex items-center gap-2 text-sm font-semibold text-foreground"><Package className="size-4 text-rose-600" />Order summary</span>{summaryOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}</button>{summaryOpen && <div className="border-t border-border px-4 pb-4 sm:px-5"><div className="mt-4 space-y-1"><DetailRow label="Box count" value={raw.pieces} /><DetailRow label="Chargeable weight" value={`${Math.max(20, Number(raw.total_weight_kg ?? 0), Number(raw.weight_override_kg ?? 0)).toFixed(2)} kg`} /><DetailRow label="Invoice value" value={raw.declared_value ? `₹${raw.declared_value}` : undefined} /><DetailRow label="E-way bills" value={raw.eway_bills} /><DetailRow label="Last provider update" value={raw.updated_at} /></div></div>}</section>
      {isSuperAdmin && <ProviderDataCorrections shipment={selected} />}
      <p className="text-center text-[11px] text-muted-foreground">Showing one shipment detail from the organization-wide tracking scope ({total === null ? "total count unavailable" : `${total.toLocaleString("en-IN")} total shipments`}). Search to open another shipment.</p>
    </main>
    {notice && <div role="status" className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground/80 shadow-lg"><CheckCircle2 className="size-3.5 text-emerald-600" />{notice}<button type="button" aria-label="Dismiss notice" onClick={() => setNotice("")}><X className="size-3.5" /></button></div>}
    {copied && <div role="status" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-950 px-4 py-2 text-xs font-medium text-white">Copied</div>}
  </div>;
}

type ProviderCorrection = { id: string; field: string; provider_value: string; correction_value: string; reason: string; actor_user_id: string; created_at: string };
const correctionFields = [
  ["lr_number", "LR / LRN", "lr_number"], ["master_awb", "Master AWB", "master_awb"], ["provider_reference", "Provider reference", "provider_reference"],
  ["tracking_number", "Tracking number", "tracking_number"], ["status", "Courier status", "status"], ["weight", "Courier weight", "total_weight_kg"],
  ["eta", "ETA", "edd"], ["delivered_at", "Delivered at", "delivered_at"],
] as const;

function ProviderDataCorrections({ shipment }: { shipment: MasterShipmentRow }) {
  const [corrections, setCorrections] = useState<ProviderCorrection[]>([]);
  const [loadingCorrections, setLoadingCorrections] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [field, setField] = useState("lr_number");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const shipmentId = shipment.id;
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLoadingCorrections(true); setLoadError(null); } });
    void pssApi<{ data: ProviderCorrection[] }>(`/v1/shipments/${encodeURIComponent(shipmentId)}/provider-corrections`)
      .then((result) => { if (active) setCorrections(result.data ?? []); })
      .catch((error) => { if (active) { setCorrections([]); setLoadError(error instanceof Error ? error.message : "Correction history could not be loaded."); } })
      .finally(() => { if (active) setLoadingCorrections(false); });
    return () => { active = false; };
  }, [shipmentId, reload]);
  const currentValue = String(shipment.raw?.[correctionFields.find(([key]) => key === field)?.[2] ?? field] ?? "").trim() || "No provider value recorded";
  async function save() {
    if (!value.trim() || reason.trim().length < 8 || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await pssApi(`/v1/shipments/${encodeURIComponent(shipmentId)}/provider-corrections`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ field, correction_value: value.trim(), reason: reason.trim() }) });
      setOpen(false);
      setField("lr_number"); setValue(""); setReason("");
      setReload((current) => current + 1);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Correction proposal could not be recorded.");
    } finally {
      setSaving(false);
    }
  }
  return <section className="overflow-hidden rounded-xl border border-amber-500/30 bg-card shadow-sm"><div className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-4 sm:px-5"><h2 className="text-sm font-semibold">Internal provider-data correction proposals</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Courier-reported facts stay unchanged. Proposals are separately attributed and audited.</p></div><div className="space-y-3 p-4 sm:p-5">{loadingCorrections ? <p className="text-xs text-muted-foreground">Loading correction history…</p> : loadError ? <div role="alert" className="text-xs text-destructive">{loadError}<button type="button" onClick={() => setReload((current) => current + 1)} className="ml-2 underline">Retry</button></div> : corrections.length ? <div className="max-h-64 space-y-2 overflow-y-auto">{corrections.map((item) => <article key={item.id} className="rounded-lg border border-border bg-background p-3 text-xs"><p className="font-semibold">{item.field.replaceAll("_", " ")}: {item.provider_value || "No provider value"} → {item.correction_value}</p><p className="mt-1 whitespace-pre-wrap leading-5 text-muted-foreground">{item.reason}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.actor_user_id} · {item.created_at ? new Date(item.created_at).toLocaleString() : "Time unavailable"}</p></article>)}</div> : <p className="text-xs text-muted-foreground">No internal corrections recorded for this shipment.</p>}<button type="button" onClick={() => { setOpen(true); setSaveError(null); }} className="h-9 rounded-lg border border-amber-600/40 px-3 text-xs font-semibold hover:bg-amber-500/10">Record internal correction</button></div><Modal open={open} onClose={() => { if (!saving) setOpen(false); }} title="Record internal provider-data correction" description="Creates an audited internal proposal. It does not overwrite Delhivery’s reported shipment data." size="lg"><div className="space-y-4"><Field label="Provider-managed field"><select value={field} onChange={(event) => setField(event.target.value)} className={inputClass}>{correctionFields.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><div className="rounded-lg border border-border bg-muted/30 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Current provider value</p><p className="mt-1 break-all text-xs font-medium">{currentValue}</p></div><Field label="Proposed internal value"><input value={value} onChange={(event) => setValue(event.target.value)} maxLength={250} className={inputClass} placeholder="Enter the value to document" /></Field><Field label="Reason (8–500 characters)"><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} className={`${inputClass} h-auto py-2`} placeholder="Explain the evidence and why this correction is proposed" /></Field>{saveError && <p role="alert" className="text-xs text-destructive">{saveError}</p>}<div className="flex justify-end gap-2 border-t border-border/70 pt-4"><button type="button" disabled={saving} onClick={() => setOpen(false)} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold disabled:opacity-50">Cancel</button><button type="button" disabled={saving || !value.trim() || reason.trim().length < 8} onClick={() => void save()} className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Recording…" : "Record proposal"}</button></div></div></Modal></section>;
}
