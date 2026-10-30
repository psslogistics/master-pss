"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useAdmin } from "@/components/admin/admin-provider";
import { EmptyState, StatusBadge, inputClass } from "@/components/admin/ui";
import type { AdminNavItem } from "@/lib/admin-navigation";
import { pssApi } from "@/lib/pss-api";
import { cn } from "@/lib/utils";
import { marginAmount, marginFor, summarizeMargins, summarizeMarginsByClient } from "@/lib/margin-math";

type MarginRow = {
  billing_id?: string;
  shipment_id?: string;
  lr_number?: string | null;
  master_awb?: string | null;
  client_id?: string;
  invoice_number?: string | null;
  pss_amount?: number | null;
  provider_amount?: number | null;
  provider_status?: string | null;
  margin?: number | null;
  provider?: string | null;
  created_at?: string | null;
};
type Props = { module: Omit<AdminNavItem, "icon"> };
const money = (value: number) => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MarginWorkspace({ module }: Props) {
  const { clients } = useAdmin();
  const [rows, setRows] = useState<MarginRow[]>([]);
  const [recordCount, setRecordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [view, setView] = useState<"shipments" | "clients">("shipments");

  const load = useCallback((syncProvider = false) => {
    setLoading(true);
    setError(null);
    void (async () => {
      const limit = 500;
      const syncQuery = syncProvider ? "&sync_provider=1" : "";
      const first = await pssApi<{ data: MarginRow[]; pagination?: { total?: number } }>(`/v1/pricing/internal/margins?limit=${limit}&offset=0${syncQuery}`, { cache: "no-store" });
      const allRows = [...(first.data ?? [])];
      const total = Number(first.pagination?.total ?? allRows.length);
      while (allRows.length < total) {
        const page = await pssApi<{ data: MarginRow[]; pagination?: { total?: number } }>(`/v1/pricing/internal/margins?limit=${limit}&offset=${allRows.length}`, { cache: "no-store" });
        if (!page.data?.length) throw new Error("Margin results stopped before the API-reported total. Refresh and try again.");
        allRows.push(...page.data);
      }
      if (allRows.length !== total) throw new Error(`Loaded ${allRows.length} of ${total} margin records. Refresh and try again.`);
      setRows(allRows);
      setRecordCount(total);
    })()
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Profit margin data could not be loaded."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  const clientLabel = useCallback((id: string) => clients.find((client) => client.id === id)?.name ?? (id || "Unknown client"), [clients]);
  const filtered = useMemo(() => rows.filter((row) => {
    if (clientFilter !== "all" && row.client_id !== clientFilter) return false;
    const day = row.created_at ? new Date(row.created_at).toLocaleDateString("en-CA") : "";
    if ((fromDate || toDate) && !day) return false;
    if (fromDate && day < fromDate) return false;
    if (toDate && day > toDate) return false;
    const text = `${row.lr_number ?? ""} ${row.master_awb ?? ""} ${row.shipment_id ?? ""} ${row.invoice_number ?? ""} ${clientLabel(row.client_id ?? "")}`.toLowerCase();
    return !query.trim() || text.includes(query.trim().toLowerCase());
  }), [rows, clientFilter, fromDate, toDate, query, clientLabel]);
  const totals = useMemo(() => summarizeMargins(filtered), [filtered]);
  const aggregates = useMemo(() => summarizeMarginsByClient(filtered), [filtered]);
  const marginPercent = totals.matchedBilled > 0 ? (totals.margin / totals.matchedBilled) * 100 : null;
  const title = module.label;

  return <div className="flex min-h-full w-full flex-col gap-5">
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Profitability desk</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{title}</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Internal margin visibility across every client and shipment. Margin is client billing less the recorded Delhivery provider cost.</p></div>
      <div className="flex items-center gap-2"><StatusBadge tone="positive">Super Admin only</StatusBadge><button type="button" onClick={() => load(true)} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold shadow-sm hover:bg-muted disabled:opacity-50"><RefreshCw className={cn("size-3.5", loading && "animate-spin")} />Refresh margins &amp; costs</button></div>
    </header>
    {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive"><p className="font-semibold">Margin data could not be loaded.</p><p className="mt-1">{error}</p><button type="button" onClick={() => load()} className="mt-3 rounded-lg border border-destructive/30 px-3 py-1.5 font-semibold">Retry</button></div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="PSS billed" value={loading ? "…" : error ? "—" : money(totals.billed)} tone="navy" />
      <Metric label="Delhivery cost" value={loading ? "…" : error ? "—" : money(totals.providerCost)} tone="warning" />
      <Metric label="Profit margin" value={loading ? "…" : error ? "—" : money(totals.margin)} tone={totals.margin < 0 ? "critical" : "positive"} icon={totals.margin < 0 ? TrendingDown : TrendingUp} />
      <Metric label="Margin % · matched costs" value={loading ? "…" : error ? "—" : marginPercent === null ? "—" : `${marginPercent.toFixed(2)}%`} tone={marginPercent !== null && marginPercent < 0 ? "critical" : "positive"} />
    </section>
    <section className="rounded-xl border border-border bg-card shadow-xs">
      <div className="grid gap-3 border-b border-border/70 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_190px_160px_160px]"><div className="relative min-w-0"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={cn(inputClass, "h-9 pl-9 text-xs")} placeholder="Search shipment, invoice, or client" /></div><select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className={cn(inputClass, "h-9 text-xs")}><option value="all">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select><label className="flex items-center gap-2 text-[11px] text-muted-foreground">From<input aria-label="Margin start date" type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className={cn(inputClass, "h-9 min-w-0 text-xs")} /></label><label className="flex items-center gap-2 text-[11px] text-muted-foreground">To<input aria-label="Margin end date" type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className={cn(inputClass, "h-9 min-w-0 text-xs")} /></label></div>
      <div className="flex gap-1 border-b border-border/70 px-3 pt-3"><Tab active={view === "shipments"} onClick={() => setView("shipments")}>By shipment ({filtered.length})</Tab><Tab active={view === "clients"} onClick={() => setView("clients")}>By client ({aggregates.length})</Tab></div>
      {loading ? <p className="p-8 text-center text-xs text-muted-foreground">Loading organization margin data…</p> : view === "shipments" ? <ShipmentTable rows={filtered} clientLabel={clientLabel} /> : <ClientTable rows={aggregates} clientLabel={clientLabel} />}
      {!loading && !error && !filtered.length && <EmptyState title="No margin records" description="Margin records appear after a shipment has both a PSS billing amount and a Delhivery provider-cost record." />}
    </section>
    <p className="text-[11px] text-muted-foreground">{totals.shipments.toLocaleString("en-IN")} shipment records in view · {loading ? "Loading total…" : `${recordCount.toLocaleString("en-IN")} total billing records loaded`} · {totals.pending.toLocaleString("en-IN")} awaiting provider cost. Pending costs are excluded from profit totals and never treated as zero.</p>
  </div>;
}

function Metric({ label, value, tone, icon: Icon }: { label: string; value: string; tone: "navy" | "warning" | "positive" | "critical"; icon?: typeof TrendingUp }) { return <div className="rounded-xl border border-border bg-card p-4 shadow-xs"><div className="flex items-center justify-between"><p className={cn("text-xl font-semibold", tone === "critical" && "text-destructive", tone === "warning" && "text-amber-600", tone === "positive" && "text-emerald-600", tone === "navy" && "text-primary")}>{value}</p>{Icon && <Icon className={cn("size-4", tone === "critical" ? "text-destructive" : "text-emerald-600")} />}</div><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>; }
function Tab({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={cn("border-b-2 px-3 pb-2 text-xs font-semibold", active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{children}</button>; }
function ShipmentTable({ rows, clientLabel }: { rows: MarginRow[]; clientLabel(id: string): string }) { return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>{["Shipment / LR", "Client", "Invoice", "PSS billed", "Delhivery cost", "Margin", "Status"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{rows.map((row, index) => { const billed = marginAmount(row.pss_amount); const failedCost = ["failed", "rejected", "error"].includes(row.provider_status?.trim().toLowerCase() ?? ""); const provider = failedCost ? null : marginAmount(row.provider_amount); const margin = marginFor(row); return <tr key={row.billing_id ?? row.shipment_id ?? `${row.client_id}-${index}`}><td className="px-4 py-3 font-semibold">{row.lr_number ?? row.master_awb ?? "LR pending"}</td><td className="px-4 py-3">{clientLabel(row.client_id ?? "")}</td><td className="px-4 py-3">{row.invoice_number ?? "—"}</td><td className="px-4 py-3">{billed === null ? "—" : money(billed)}</td><td className="px-4 py-3">{provider === null ? <span className="text-muted-foreground">{failedCost ? "Unavailable" : "Pending"}</span> : money(provider)}</td><td className={cn("px-4 py-3 font-semibold", margin !== null && margin < 0 && "text-destructive")}>{margin === null ? "Pending" : money(margin)}</td><td className="px-4 py-3"><StatusBadge tone={margin === null ? "warning" : margin < 0 ? "critical" : "positive"}>{row.provider_status ?? (margin === null ? "Awaiting cost" : "Calculated")}</StatusBadge></td></tr>; })}</tbody></table></div>; }
function ClientTable({ rows, clientLabel }: { rows: ReturnType<typeof summarizeMarginsByClient>; clientLabel(id: string): string }) { return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>{["Client", "Shipments", "PSS billed", "Delhivery cost", "Profit margin", "Margin % · matched", "Pending"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{rows.map((row) => <tr key={row.clientId}><td className="px-4 py-3 font-semibold">{clientLabel(row.clientId)}</td><td className="px-4 py-3">{row.shipments.toLocaleString("en-IN")}</td><td className="px-4 py-3">{money(row.billed)}</td><td className="px-4 py-3">{money(row.providerCost)}</td><td className={cn("px-4 py-3 font-semibold", row.margin < 0 && "text-destructive")}>{money(row.margin)}</td><td className="px-4 py-3">{row.matchedBilled > 0 ? `${((row.margin / row.matchedBilled) * 100).toFixed(2)}%` : "—"}</td><td className="px-4 py-3">{row.pending ? <StatusBadge tone="warning">{row.pending} pending</StatusBadge> : "—"}</td></tr>)}</tbody></table></div>; }
