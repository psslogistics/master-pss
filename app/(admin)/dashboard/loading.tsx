export default function DashboardLoading() {
  return <div className="flex min-h-full w-full flex-col gap-4" role="status" aria-live="polite" aria-label="Loading control center">
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Organization control</p>
      <h1 className="text-2xl font-semibold tracking-[-0.035em]">Super Admin Control Center</h1>
      <p className="text-xs text-muted-foreground">Loading production control data…</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-card" />)}</div>
    <div className="grid gap-4 lg:grid-cols-3"><div className="h-48 animate-pulse rounded-xl border border-border bg-card" /><div className="h-48 animate-pulse rounded-xl border border-border bg-card lg:col-span-2" /></div>
    <div className="min-h-80 animate-pulse rounded-xl border border-border bg-card" />
  </div>;
}
