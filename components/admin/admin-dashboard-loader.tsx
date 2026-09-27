"use client";

import dynamic from "next/dynamic";

const AdminDashboard = dynamic(() => import("@/components/admin/admin-dashboard"), {
  ssr: false,
  loading: () => (
    <div className="space-y-6" role="status" aria-label="Loading control center">
      <div className="h-8 w-80 animate-pulse rounded bg-muted" />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl border border-border bg-card/70" />)}
      </div>
      <div className="min-h-[22rem] animate-pulse rounded-xl border border-border bg-card/70" />
    </div>
  ),
});

export default function AdminDashboardLoader() {
  return <AdminDashboard />;
}
