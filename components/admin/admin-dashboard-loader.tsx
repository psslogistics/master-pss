"use client";

import dynamic from "next/dynamic";

const AdminDashboard = dynamic(() => import("@/components/admin/admin-dashboard"), {
  // The dashboard is still code-split, but its stable first frame should be
  // included in the server response instead of waiting for client hydration.
  loading: () => (
    <div className="flex min-h-[520px] w-full flex-col gap-4" role="status" aria-live="polite">
      <div className="h-24 animate-pulse rounded-xl border border-border bg-card" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl border border-border bg-card" />)}
      </div>
      <div className="min-h-[360px] animate-pulse rounded-xl border border-border bg-card" />
    </div>
  ),
});

export default function AdminDashboardLoader() {
  return <AdminDashboard />;
}
