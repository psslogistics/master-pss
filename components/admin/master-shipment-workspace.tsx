"use client";

import { useMemo, useState } from "react";
import { Download, Plus, RefreshCw, Search } from "lucide-react";
import type { AdminNavItem } from "@/lib/admin-navigation";
import { cn } from "@/lib/utils";
import { StatusBadge, inputClass } from "@/components/admin/ui";

export type MasterShipmentRow = {
  id: string;
  title: string;
  detail: string;
  status: string;
  meta: string;
  raw?: Record<string, unknown>;
};

type Props = {
  module: Omit<AdminNavItem, "icon">;
  rows: MasterShipmentRow[];
  loading: boolean;
  error: string | null;
  loadingMore: boolean;
  hasMore: boolean;
  total: number;
  statusCounts: Record<string, number>;
  onLoadMore(): void;
  onRefresh(): void;
  onPrimary(): void;
  onSelect(row: MasterShipmentRow): void;
  selected?: MasterShipmentRow;
  onEdit(row: MasterShipmentRow): void;
};

const tabs = ["All", "Active", "Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered", "Delayed", "Exception", "Returned", "Cancelled"];

function labelStatus(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusMatches(status: string, tab: string) {
  const normalized = status.toLowerCase().replaceAll(" ", "_");
  if (tab === "All") return true;
  if (tab === "Active") return !["delivered", "cancelled", "returned"].includes(normalized);
  return normalized === tab.toLowerCase().replaceAll(" ", "_");
}

function value(row: MasterShipmentRow, ...keys: string[]) {
  for (const key of keys) {
    const candidate = row.raw?.[key];
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) return String(candidate);
  }
  return "Not provided";
}

function dateValue(row: MasterShipmentRow) {
  const raw = value(row, "booking_date", "created_at", "booked_at");
  if (raw === "Not provided") return raw;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("en-GB").replaceAll("/", "-");
}

function toneFor(status: string) {
  if (/exception|cancel|delay|failed|rto/i.test(status)) return "critical" as const;
  if (/booked|picked|pending|scheduled/i.test(status)) return "warning" as const;
  if (/transit|delivered|out/i.test(status)) return "positive" as const;
  return "neutral" as const;
}

export default function MasterShipmentWorkspace({ module, rows, loading, error, loadingMore, hasMore, total, statusCounts, onLoadMore, onRefresh, onPrimary, onSelect, selected, onEdit }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("All");
  const isBooking = module.href === "/operations/bookings";
  const isTracking = module.href === "/operations/tracking";
  const filtered = useMemo(() => rows.filter((row) => {
    const haystack = `${row.title} ${row.detail} ${row.status} ${value(row, "tracking_number", "lr_number", "provider_reference", "consignor", "consignee")}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && statusMatches(row.status, tab);
  }), [query, rows, tab]);
  const counts = useMemo(() => {
    const loaded = Object.fromEntries(tabs.map((item) => [item, rows.filter((row) => statusMatches(row.status, item)).length]));
    const provider = (status: string) => Number(statusCounts[status] ?? 0);
    const all = Object.values(statusCounts).reduce((sum, count) => sum + Number(count || 0), 0);
    if (!Object.keys(statusCounts).length) return loaded;
    return {
      All: Number.isFinite(total) ? Math.max(0, total) : all,
      Active: provider("booked") + provider("picked_up") + provider("in_transit") + provider("out_for_delivery") + provider("delayed") + provider("exception"),
      Booked: provider("booked"),
      "Picked Up": provider("picked_up"),
      "In Transit": provider("in_transit"),
      "Out for Delivery": provider("out_for_delivery"),
      Delivered: provider("delivered"),
      Delayed: provider("delayed"),
      Exception: provider("exception"),
      Returned: provider("returned") + provider("rto"),
      Cancelled: provider("cancelled") + provider("canceled"),
    };
  }, [rows, statusCounts, total]);

  return <div className="flex min-h-full w-full flex-col gap-5">
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{isTracking ? "Movement control" : isBooking ? "Booking desk" : "Shipment register"}</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{module.label}</h1><p className="mt-1 max-w-3xl text-xs text-muted-foreground">Organization-wide live shipment operations across every client and courier.</p></div>
      <div className="flex flex-wrap items-center gap-2"><StatusBadge tone="positive">Live API workspace</StatusBadge><button type="button" onClick={onPrimary} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold shadow-sm hover:bg-muted">{isBooking ? <Plus className="size-3.5" /> : <Download className="size-3.5" />}{isBooking ? "New booking" : "Export shipments"}</button>{isTracking && <button type="button" onClick={onRefresh} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><RefreshCw className="size-3.5" />Refresh tracking</button>}</div>
    </header>
    <section className="grid gap-3 sm:grid-cols-3"><Metric label="Total shipments" value={String(total)} /><Metric label="In movement" value={String((counts["In Transit"] ?? 0) + (counts["Out for Delivery"] ?? 0))} tone="positive" /><Metric label="Exceptions" value={String(counts.Exception ?? 0)} tone="critical" /></section>
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="overflow-x-auto border-b border-border/70"><div className="flex min-w-max gap-1 px-3 pt-2">{tabs.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={cn("rounded-t-lg px-3 py-2 text-xs font-semibold transition", tab === item ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>{item} <span className="ml-1 text-[10px] tabular-nums">{counts[item] ?? 0}</span></button>)}</div></div>
      <div className="flex flex-col gap-2 border-b border-border/70 p-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={cn(inputClass, "h-9 pl-9 text-xs")} placeholder={`Search ${isTracking ? "tracking" : "shipments, references, clients"}`} /></div><span className="self-center text-[11px] text-muted-foreground">Loaded {rows.length} of {total}</span><button type="button" onClick={onRefresh} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted"><RefreshCw className="size-3.5" />Refresh</button></div>
      {loading ? <div className="grid min-h-[420px] place-items-center text-xs text-muted-foreground">Loading production shipments…</div> : error ? <div className="m-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs"><p className="font-semibold text-amber-900 dark:text-amber-200">Production shipments could not be loaded.</p><p className="mt-1 text-amber-800 dark:text-amber-200">{error}</p><button type="button" onClick={onRefresh} className="mt-3 rounded-md border border-amber-500/40 px-2 py-1 font-semibold">Retry</button></div> : <div className="grid min-h-[420px] min-w-0 gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-0 min-w-0 overflow-auto" onScroll={(event) => { const element = event.currentTarget; if (element.scrollTop + element.clientHeight >= element.scrollHeight - 160) onLoadMore(); }}><table className="w-full min-w-[1000px] text-left text-xs"><thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/70 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><tr>{["Courier reference", "Booking date", "Consignor", "Consignee", "Boxes", "Weight", "Courier", "ETA", "Status"].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{filtered.map((row) => { const active = selected?.id === row.id; return <tr key={row.id} onClick={() => onSelect(row)} className={cn("cursor-pointer transition hover:bg-muted/40", active && "bg-primary/5")}><td className="px-3 py-3 font-semibold text-primary">{value(row, "reference", "tracking_number", "lr_number", "provider_reference", "id")}</td><td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{dateValue(row)}</td><td className="max-w-[180px] truncate px-3 py-3">{value(row, "consignor", "origin")}</td><td className="max-w-[180px] truncate px-3 py-3">{value(row, "consignee", "destination")}</td><td className="px-3 py-3">{value(row, "pieces", "box_count")}</td><td className="px-3 py-3">{value(row, "weight_override_kg", "total_weight_kg")} kg</td><td className="px-3 py-3 uppercase">{value(row, "provider")}</td><td className="whitespace-nowrap px-3 py-3">{dateValue({ ...row, raw: { ...(row.raw ?? {}), created_at: value(row, "edd", "eta") } })}</td><td className="px-3 py-3"><StatusBadge tone={toneFor(row.status)}>{labelStatus(row.status)}</StatusBadge></td></tr>; })}</tbody></table>{loadingMore && <p className="p-3 text-center text-xs text-muted-foreground">Loading more shipments…</p>}{!filtered.length && <div className="grid min-h-48 place-items-center p-6 text-center text-xs text-muted-foreground">No matching production shipments.</div>}{hasMore && !loadingMore && <button type="button" onClick={onLoadMore} className="m-3 h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted">Load more shipments</button>}</div>
        <aside className="border-t border-border/70 p-4 xl:border-l xl:border-t-0">{selected ? <ShipmentDetail row={selected} onEdit={onEdit} /> : <div className="grid min-h-52 place-items-center text-center text-xs text-muted-foreground">Select a shipment to inspect its identifiers, status, and provider context.</div>}</aside>
      </div>}
    </section>
  </div>;
}

function Metric({ label, value, tone = "navy" }: { label: string; value: string; tone?: "navy" | "positive" | "critical" }) { return <div className="rounded-xl border border-border bg-card p-4 shadow-xs"><p className={cn("text-xl font-semibold", tone === "navy" && "text-primary", tone === "positive" && "text-emerald-600", tone === "critical" && "text-destructive")}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>; }

function ShipmentDetail({ row, onEdit }: { row: MasterShipmentRow; onEdit(row: MasterShipmentRow): void }) { return <div className="space-y-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Selected shipment</p><h2 className="mt-1 break-words text-base font-semibold">{value(row, "reference", "tracking_number", "provider_reference", "id")}</h2><p className="mt-1 text-xs text-muted-foreground">{row.detail}</p></div><div className="grid grid-cols-2 gap-2">{[["Shipment record", "id"], ["LR / LRN", "lr_number"], ["AWB / waybill", "master_awb"], ["Invoice number", "invoice_number"], ["Pickup reference", "pickup_reference"], ["Provider booking ID", "provider_booking_id"]].map(([label, key]) => <div key={key} className="rounded-lg bg-muted/40 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 break-words text-xs font-medium">{value(row, key)}</p></div>)}</div><div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">Status is sourced from the production provider reconciliation path. Use the client-style tracking surface for movement history and audit evidence.</div><button type="button" onClick={() => onEdit(row)} className="h-9 w-full rounded-lg bg-primary text-xs font-semibold text-primary-foreground">Edit shipment</button></div>; }
