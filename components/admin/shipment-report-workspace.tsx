"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { useAdmin } from "@/components/admin/admin-provider";
import { StatusBadge } from "@/components/admin/ui";
import { pssApi } from "@/lib/pss-api";
import { filterShipmentReportRows, shipmentReportCsv, shipmentReportFilename, type ShipmentReportRow } from "@/lib/shipment-report";

const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";
function Metric({ label, value }: { label: string; value: string }) { return <article className="rounded-xl border border-border bg-card p-4 shadow-xs"><p className="text-lg font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></article>; }

export default function ShipmentReportWorkspace() {
  const { clients } = useAdmin();
  const [rows, setRows] = useState<ShipmentReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const [query, setQuery] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await pssApi<{ details?: ShipmentReportRow[] }>("/v1/reports/shipments", { cache: "no-store" });
      if (!Array.isArray(result.details)) throw new Error("The report service returned an incomplete shipment dataset.");
      setRows(result.details);
      setGeneratedAt(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Shipment report could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [load]);

  const statuses = useMemo(() => [...new Set(rows.map((row) => String(row.status ?? "Unknown")))].sort(), [rows]);
  const filtered = useMemo(() => filterShipmentReportRows(rows, { query, clientId, status, dateFrom, dateTo }), [clientId, dateFrom, dateTo, query, rows, status]);

  const delayed = filtered.filter((row) => Number(row.delay_days ?? 0) > 0).length;
  const clientLabel = (id: string) => clients.find((client) => client.id === id)?.name ?? id;
  function download() {
    const generated = generatedAt || new Date().toISOString();
    const blob = new Blob([shipmentReportCsv(filtered, generated, clientLabel)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = shipmentReportFilename(generated);
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className="flex min-h-full w-full flex-col gap-5">
    <header className="flex flex-col justify-between gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Source-backed report</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Shipment report</h1><p className="mt-1 text-sm text-muted-foreground">Organization-wide shipment status and delivery timing, from the authenticated Worker report service.</p></div><div className="flex gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-input px-3 text-xs font-semibold disabled:opacity-50"><RefreshCw className="size-3.5" />Refresh</button><button type="button" onClick={download} disabled={loading || filtered.length === 0} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Download className="size-3.5" />Download CSV</button></div></header>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"><span>{error}</span><button type="button" onClick={() => void load()} className="font-semibold underline">Retry</button></div>}
    <section className="grid gap-3 sm:grid-cols-3"><Metric label="Matching shipments" value={loading ? "Loading…" : filtered.length.toLocaleString("en-IN")} /><Metric label="Delayed shipments" value={loading ? "Loading…" : delayed.toLocaleString("en-IN")} /><Metric label="Report generated" value={generatedAt ? new Date(generatedAt).toLocaleString("en-IN") : "Not generated"} /></section>
    <section className="rounded-xl border border-border bg-card p-3 shadow-xs sm:p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><label className="relative sm:col-span-2 xl:col-span-1"><span className="sr-only">Search report</span><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><input className={`${inputClass} pl-9 text-xs`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shipment or reference" /></label><label><span className="sr-only">Filter by client</span><select className={`${inputClass} text-xs`} value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label><span className="sr-only">Filter by status</span><select className={`${inputClass} text-xs`} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label><span className="sr-only">Booked from</span><input aria-label="Booked from" className={`${inputClass} text-xs`} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label><span className="sr-only">Booked through</span><input aria-label="Booked through" className={`${inputClass} text-xs`} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label></div><p className="mt-3 text-[11px] text-muted-foreground">{loading ? "Loading shipment records…" : `Showing ${filtered.length.toLocaleString("en-IN")} of ${rows.length.toLocaleString("en-IN")} records`}{generatedAt && ` · Generated ${new Date(generatedAt).toLocaleString("en-IN")}`}</p></section>
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"><div className="overflow-auto"><table className="w-full min-w-[980px] text-left text-xs"><thead className="sticky top-0 bg-muted text-[10px] uppercase tracking-wide text-muted-foreground"><tr>{["Shipment", "Client", "Courier", "Route", "Status", "Weight", "Booked", "ETA", "Delay"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{filtered.slice(0, 100).map((row) => <tr key={row.id} className="hover:bg-muted/30"><td className="px-3 py-3"><p className="font-semibold">{row.lr_number || row.master_awb || row.tracking_number || row.pss_reference || row.id}</p><p className="mt-1 text-[10px] text-muted-foreground">{row.pss_reference || row.id}</p></td><td className="max-w-48 truncate px-3 py-3">{clientLabel(row.client_id)}</td><td className="px-3 py-3">{row.provider || "Unknown"}</td><td className="max-w-56 truncate px-3 py-3">{[row.origin, row.destination].filter(Boolean).join(" → ") || "Unavailable"}</td><td className="px-3 py-3"><StatusBadge tone={String(row.status).toLowerCase().includes("deliver") ? "positive" : String(row.status).toLowerCase().includes("exception") ? "critical" : "warning"}>{row.status || "Unknown"}</StatusBadge></td><td className="px-3 py-3">{row.total_weight_kg == null ? "Unavailable" : `${row.total_weight_kg} kg`}</td><td className="px-3 py-3">{row.created_at ? new Date(row.created_at).toLocaleDateString("en-IN") : "Unavailable"}</td><td className="px-3 py-3">{row.edd ? new Date(row.edd).toLocaleDateString("en-IN") : "Unavailable"}</td><td className="px-3 py-3">{Number(row.delay_days ?? 0) > 0 ? `${row.delay_days} days` : "—"}</td></tr>)}{!loading && filtered.length === 0 && <tr><td colSpan={9} className="p-10 text-center text-sm text-muted-foreground">No shipment records match these filters.</td></tr>}</tbody></table></div>{filtered.length > 100 && <p className="border-t border-border px-3 py-2 text-center text-[11px] text-muted-foreground">Showing the first 100 rows; CSV includes all {filtered.length.toLocaleString("en-IN")} filtered records.</p>}</section>
    <p className="text-[11px] text-muted-foreground">Source: Worker shipment report. The CSV contains the selected filters and generation timestamp; it includes shipment identifiers and operational fields only.</p>
  </main>;
}
