"use client";

import { ClipboardCheck, KeyRound, ShieldCheck, UsersRound } from "lucide-react";

const cards = [
  [ShieldCheck, "Organization security", "Super Admin identity, roles, and privileged actions are audit-controlled.", "Server governed"],
  [UsersRound, "Client & employee scope", "Memberships, assignments, and role coverage are managed from Control Center.", "Organization wide"],
  [KeyRound, "API & webhooks", "Create, scope, rotate, and revoke external access through Master controls.", "Master managed"],
  [ClipboardCheck, "Operational health", "Courier, finance, support, and audit surfaces report production status.", "Live oversight"],
] as const;

export default function ProfileWorkspaceSummary() {
  return <section aria-label="Super Admin account workspace" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([Icon, title, detail, status]) => <article key={title} className="rounded-xl border border-border bg-card p-4 shadow-xs"><div className="flex items-center justify-between gap-2"><span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span><span className="rounded-full bg-muted px-2 py-1 text-[9px] font-semibold text-muted-foreground">{status}</span></div><h2 className="mt-3 text-xs font-semibold">{title}</h2><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{detail}</p></article>)}</section>;
}
