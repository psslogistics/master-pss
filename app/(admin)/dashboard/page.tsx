import Link from "next/link";
import { Building2, KeyRound, Plus, ShieldCheck } from "lucide-react";
import AdminDashboardLoader from "@/components/admin/admin-dashboard-loader";

export default function DashboardPage() {
  return <>
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground"><ShieldCheck className="size-3.5 text-primary" /> Organization control</div>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-foreground">Super Admin Control Center</h1>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Govern access, ownership, escalations, and operational risk across PSS Logistics.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/employees" prefetch={false} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/80"><Plus className="size-3.5" /> Create employee</Link>
        <Link href="/client-assignments" prefetch={false} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold shadow-xs transition-colors hover:bg-muted"><Building2 className="size-3.5 text-primary" /> Assign client</Link>
        <Link href="/roles-permissions" prefetch={false} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold shadow-xs transition-colors hover:bg-muted"><KeyRound className="size-3.5 text-primary" /> Review access</Link>
      </div>
    </header>
    <AdminDashboardLoader />
  </>;
}
