"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, RefreshCw, ShieldAlert } from "lucide-react";
import { pssApi } from "@/lib/pss-api";

type Usage = {
  database_id: string; billing_period_start: string; billing_period_end: string;
  rows_read: number; rows_written: number; included_rows_read: number; included_rows_written: number;
  read_percent: number; write_percent: number; read_excess: number; write_excess: number;
  estimated_cost_usd: number; projected_rows_read: number; projected_cost_usd: number;
  state: "healthy" | "watch" | "alert" | "critical" | "not_configured" | "error";
  threshold_percent: number; last_synced_at: string | null; source: string; message?: string;
};

const number = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
const money = (value: number) => `$${value.toFixed(2)}`;
const percent = (value: number) => `${value.toFixed(value >= 10 ? 1 : 2)}%`;
const stateCopy: Record<Usage["state"], string> = { healthy: "Healthy", watch: "Watch", alert: "Alert", critical: "Critical", not_configured: "Not configured", error: "Unavailable" };

function Metric({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: "default" | "warning" | "danger" }) {
  return <div className={`rounded-xl border p-4 ${tone === "danger" ? "border-red-200 bg-red-50/70" : tone === "warning" ? "border-amber-200 bg-amber-50/70" : "border-border bg-card"}`}><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

export default function DevelopmentBillsWorkspace() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const load = async (manual = false) => {
    if (manual) setRefreshing(true); else setLoading(true);
    setError("");
    try { const result = await pssApi<{ data: Usage }>("/v1/platform/cloudflare-usage", { cache: "no-store" }); setUsage(result.data); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load Cloudflare usage."); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { void load(); }, []);
  const state = usage?.state ?? "error";
  const statusClass = state === "critical" || state === "error" ? "bg-red-100 text-red-800" : state === "alert" ? "bg-orange-100 text-orange-800" : state === "watch" ? "bg-amber-100 text-amber-800" : state === "not_configured" ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-800";
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Platform cost control</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Development Bills</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">A Super Admin-only view of Cloudflare D1 usage, included monthly allowances, projected overage, and the protection thresholds that guard the platform.</p></div><button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm font-semibold shadow-sm hover:bg-accent disabled:opacity-50"><RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />Refresh usage</button></div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
    {loading && !usage ? <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-border bg-muted/30" />)}</div> : usage && <>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-sky-100 text-sky-700"><Cloud className="size-5" /></span><div><h2 className="font-semibold">Cloudflare D1 monthly usage</h2><p className="text-xs text-muted-foreground">{usage.billing_period_start} through {usage.billing_period_end} · database {usage.database_id || "not connected"}</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{stateCopy[state]}</span></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Metric label="Rows read" value={number(usage.rows_read)} detail={`${percent(usage.read_percent)} of 25B included`} tone={usage.read_percent >= 90 ? "danger" : usage.read_percent >= 75 ? "warning" : "default"} /><Metric label="Rows written" value={number(usage.rows_written)} detail={`${percent(usage.write_percent)} of 50M included`} tone={usage.write_percent >= 90 ? "danger" : usage.write_percent >= 75 ? "warning" : "default"} /><Metric label="Estimated overage" value={money(usage.estimated_cost_usd)} detail={`${number(usage.read_excess)} read · ${number(usage.write_excess)} write`} tone={usage.estimated_cost_usd > 0 ? "danger" : "default"} /><Metric label="Projected cycle cost" value={money(usage.projected_cost_usd)} detail={`Projected reads: ${number(usage.projected_rows_read)}`} tone={usage.projected_cost_usd > 0 ? "warning" : "default"} /></div>
      </section>
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]"><section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-2"><ShieldAlert className="size-4 text-primary" /><h2 className="font-semibold">Protection policy</h2></div><div className="mt-4 space-y-3 text-sm text-muted-foreground"><p><strong className="text-foreground">50%</strong> — watch usage and surface a notice.</p><p><strong className="text-foreground">75%</strong> — warn Super Admin and flag expensive reads.</p><p><strong className="text-foreground">90%</strong> — alert and restrict non-essential diagnostic work.</p><p><strong className="text-foreground">95% / 98%</strong> — critical escalation and emergency read protection.</p><p className="rounded-lg bg-muted/50 p-3 text-xs">The monitor reads Cloudflare Analytics server-side. It never exposes the API token to the browser and does not query D1 just to render this page.</p></div></section><section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /><h2 className="font-semibold">Data freshness</h2></div><p className="mt-4 text-sm text-muted-foreground">{usage.last_synced_at ? `Last synced ${new Date(usage.last_synced_at).toLocaleString()}.` : "No Cloudflare snapshot is available yet."}</p><p className="mt-3 text-xs text-muted-foreground">{usage.message ?? (usage.source === "cloudflare_graphql" ? "Source: Cloudflare GraphQL Analytics API." : "Add the server-side Cloudflare Analytics credentials to enable live usage.")}</p><div className="mt-5 flex items-center gap-2 text-xs font-medium text-emerald-700"><CheckCircle2 className="size-4" />Booking and wallet flows are not disabled by this read-only dashboard.</div></section></div>
    </>}
  </div>;
}
