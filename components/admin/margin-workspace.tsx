"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useAdmin } from "@/components/admin/admin-provider";
import { EmptyState, StatusBadge, inputClass } from "@/components/admin/ui";
import type { AdminNavItem } from "@/lib/admin-navigation";
import { pssApi } from "@/lib/pss-api";
import { cn } from "@/lib/utils";

type MarginRow = {
  billing_id?: string;
  shipment_id?: string;
  lr_number?: string | null;
  master_awb?: string | null;
  client_id?: string;
  invoice_number?: string | null;
  pss_amount?: number | null;
  provider_amount?: number | null;
  margin?: number | null;
  provider?: string | null;
  provider_status?: string | null;
  created_at?: string | null;
};
type Props = { module: Omit<AdminNavItem, "icon"> };
type ClientAggregate = { clientId: string; shipments: number; billed: number; providerCost: number; margin: number; pending: number };

const money = (value: number) => `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const amount = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? value : null;

export default function MarginWorkspace({ module }: Props) {
  const { clients } = useAdmin();
  const [rows, setRows] = useState<MarginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [view, setView] = useState<"shipments" | "clients">("shipments");

  const load = () => {
    setLoading(true);
    setError(null);
    void pssApi<{ data: MarginRow[]; pagination?: { total?: number } }>("/v1/pricing/internal/margins?limit=10000&sync_provider=1")
      .then((result) => setRows(result.data ?? []))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Profit margin data could not be loaded."))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const clientLabel = (id: string) => clients.find((client) => client.id === id)?.name ?? (id || "Unknown client");
  const filtered = useMemo(() => rows.filter((row) => {
    if (clientFilter !== "all" && row.client_id !== clientFilter) return false;
    const text = `${row.lr_number ?? ""} ${row.master_awb ?? ""} ${row.shipment_id ?? ""} ${row.invoice_number ?? ""} ${clientLabel(row.client_id ?? "")}`.toLowerCase();
    return !query.trim() || text.includes(query.trim().toLowerCase());
  }), [rows, clientFilter, query, clients]);
  const totals = useMemo(() => filtered.reduce<{ shipments: number; billed: number; providerCost: number; margin: number; pending: number }>((result, row) => {
    const billed = amount(row.pss_amount); const provider = amount(row.provider_amount); const margin = amount(row.margin);
    result.shipments += 1; if (billed !== null) result.billed += billed; if (provider !== null) result.providerCost += provider; if (margin !== null) result.margin += margin; else result.pending += 1;
    return result;
  }, { shipments: 0, billed: 0, providerCost: 0, margin: 0, pending: 0 }), [filtered]);
  const aggregates = useMemo(() => {
    const grouped = new Map<string, ClientAggregate>();
    for (const row of filtered) {
      const clientId = row.client_id ?? "unknown";
      const current = grouped.get(clientId) ?? { clientId, shipments: 0, billed: 0, providerCost: 0, margin: 0, pending: 0 };
      const billed = amount(row.pss_amount); const provider = amount(row.provider_amount); const margin = amount(row.margin);
      current.shipments += 1; if (billed !== null) current.billed += billed; if (provider !== null) current.providerCost += provider; if (margin !== null) current.margin += margin; else current.pending += 1;
      grouped.set(clientId, current);
    }
    return [...grouped.values()].sort((a, b) => b.margin - a.margin);
  }, [filtered]);
  const marginPercent = totals.billed > 0 ? (totals.margin / totals.billed) * 100 : null;
  const title = module.label;

  return <div className="flex min-h-full w-full flex-col gap-5">
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 xl:flex-row xl:items-end xl:justify-between">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Profitability desk</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{title}</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Internal margin visibility across every client and shipment. Margin is client billing less the recorded Delhivery provider cost.</p></div>
      <div className="flex items-center gap-2"><StatusBadge tone="positive">Super Admin only</StatusBadge><button type="button" onClick={load} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold shadow-sm hover:bg-muted disabled:opacity-50"><RefreshCw className={cn("size-3.5", loading && "animate-spin")} />Refresh margins</button></div>
    </header>
    {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive"><p className="font-semibold">Margin data could not be loaded.</p><p className="mt-1">{error}</p><button type="button" onClick={load} className="mt-3 rounded-lg border border-destructive/30 px-3 py-1.5 font-semibold">Retry</button></div>}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Client billing" value={money(totals.billed)} tone="navy" />
      <Metric label="Delhivery cost" value={money(totals.providerCost)} tone="warning" />
      <Metric label="Profit margin" value={money(totals.margin)} tone={totals.margin < 0 ? "critical" : "positive"} icon={totals.margin < 0 ? TrendingDown : TrendingUp} />
      <Metric label="Margin %" value={marginPercent === null ? "—" : `${marginPercent.toFixed(2)}%`} tone={marginPercent !== null && marginPercent < 0 ? "critical" : "positive"} />
    </section>
    <section className="rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border/70 p-3 lg:flex-row lg:items-center"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={cn(inputClass, "h-9 pl-9 text-xs")} placeholder="Search shipment, invoice, or client" /></div><select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className={cn(inputClass, "h-9 text-xs lg:w-64")}><option value="all">All clients</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
      <div className="flex gap-1 border-b border-border/70 px-3 pt-3"><Tab active={view === "shipments"} onClick={() => setView("shipments")}>By shipment ({filtered.length})</Tab><Tab active={view === "clients"} onClick={() => setView("clients")}>By client ({aggregates.length})</Tab></div>
      {loading ? <p className="p-8 text-center text-xs text-muted-foreground">Loading organization margin data…</p> : view === "shipments" ? <ShipmentTable rows={filtered} clientLabel={clientLabel} /> : <ClientTable rows={aggregates} clientLabel={clientLabel} />}
      {!loading && !error && !filtered.length && <EmptyState title="No margin records" description="Margin records appear after a shipment has both a PSS billing amount and a Delhivery provider-cost record." />}
    </section>
    <p className="text-[11px] text-muted-foreground">{totals.shipments.toLocaleString("en-IN")} shipment records in view · {totals.pending.toLocaleString("en-IN")} awaiting provider cost. Pending costs are excluded from profit totals and never treated as zero.</p>
  </div>;
}

function Metric({ label, value, tone, icon: Icon }: { label: string; value: string; tone: "navy" | "warning" | "positive" | "critical"; icon?: typeof TrendingUp }) { return <div className="rounded-xl border border-border bg-card p-4 shadow-xs"><div className="flex items-center justify-between"><p className={cn("text-xl font-semibold", tone === "critical" && "text-destructive", tone === "warning" && "text-amber-600", tone === "positive" && "text-emerald-600", tone === "navy" && "text-primary")}>{value}</p>{Icon && <Icon className={cn("size-4", tone === "critical" ? "text-destructive" : "text-emerald-600")} />}</div><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>; }
function Tab({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={cn("border-b-2 px-3 pb-2 text-xs font-semibold", active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{children}</button>; }
function ShipmentTable({ rows, clientLabel }: { rows: MarginRow[]; clientLabel(id: string): string }) { return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>{["Shipment / LR", "Client", "Invoice", "Client paid", "Delhivery cost", "Margin", "Status"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{rows.map((row, index) => <tr key={row.billing_id ?? row.shipment_id ?? `${row.client_id}-${index}`}><td className="px-4 py-3 font-semibold">{row.lr_number ?? row.master_awb ?? "LR pending"}</td><td className="px-4 py-3">{clientLabel(row.client_id ?? "")}</td><td className="px-4 py-3">{row.invoice_number ?? "—"}</td><td className="px-4 py-3">{amount(row.pss_amount) === null ? "—" : money(row.pss_amount as number)}</td><td className="px-4 py-3">{amount(row.provider_amount) === null ? <span className="text-muted-foreground">Pending</span> : money(row.provider_amount as number)}</td><td className={cn("px-4 py-3 font-semibold", amount(row.margin) !== null && row.margin! < 0 && "text-destructive")}>{amount(row.margin) === null ? "Pending" : money(row.margin as number)}</td><td className="px-4 py-3"><StatusBadge tone={amount(row.margin) === null ? "warning" : row.margin! < 0 ? "critical" : "positive"}>{row.provider_status ?? (amount(row.margin) === null ? "Awaiting cost" : "Calculated")}</StatusBadge></td></tr>)}</tbody></table></div>; }
function ClientTable({ rows, clientLabel }: { rows: ClientAggregate[]; clientLabel(id: string): string }) { return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground"><tr>{["Client", "Shipments", "Client paid", "Delhivery cost", "Profit margin", "Margin %", "Pending"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{rows.map((row) => <tr key={row.clientId}><td className="px-4 py-3 font-semibold">{clientLabel(row.clientId)}</td><td className="px-4 py-3">{row.shipments.toLocaleString("en-IN")}</td><td className="px-4 py-3">{money(row.billed)}</td><td className="px-4 py-3">{money(row.providerCost)}</td><td className={cn("px-4 py-3 font-semibold", row.margin < 0 && "text-destructive")}>{money(row.margin)}</td><td className="px-4 py-3">{row.billed > 0 ? `${((row.margin / row.billed) * 100).toFixed(2)}%` : "—"}</td><td className="px-4 py-3">{row.pending ? <StatusBadge tone="warning">{row.pending} pending</StatusBadge> : "—"}</td></tr>)}</tbody></table></div>; }
