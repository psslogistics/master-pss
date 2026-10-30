"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Building2, Search, UserRoundCheck, Users } from "lucide-react";
import { useAdmin } from "@/components/admin/admin-provider";
import { Modal, StatusBadge } from "@/components/admin/ui";
import Dropdown from "@/components/ui/dropdown";

export default function ClientAssignmentsPage() {
  const { clients, employees, assignClient, auditEvents, employeesLoading, employeeLoadError, refreshEmployees } = useAdmin();
  const [query, setQuery] = useState("");
  const [transferId, setTransferId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const activeEmployees = employees.filter((employee) => !employee.isSuperAdmin && employee.status === "Active");
  const filtered = useMemo(() => clients.filter((client) => `${client.name} ${client.code} ${client.city}`.toLowerCase().includes(query.toLowerCase())), [clients, query]);
  const selected = clients.find((client) => client.id === transferId);
  const employeeName = (id: string) => id ? employees.find((employee) => employee.id === id)?.name ?? "Owner unavailable" : "Unassigned";
  const history = selected ? auditEvents.filter((event) => event.entityId === selected.id && event.action === "Transferred client").slice(0, 3) : [];
  function openTransfer(clientId: string, currentId: string) { setTransferId(clientId); setAssigneeId(currentId); }
  const [transferError, setTransferError] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferSavedNeedsRefresh, setTransferSavedNeedsRefresh] = useState(false);
  async function confirm() {
    if (!selected || !assigneeId || transferSavedNeedsRefresh) return;
    setTransferError(""); setTransferring(true);
    try {
      const result = await assignClient(selected.id, assigneeId);
      if (!result.ok) { setTransferError(result.error ?? "Unable to transfer this client."); return; }
      if (result.warning) { setTransferSavedNeedsRefresh(true); setTransferError(result.warning); return; }
      setTransferId(null);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Client ownership transfer failed. Please retry.");
    } finally { setTransferring(false); }
  }
  async function retryOwnershipRefresh() {
    setTransferring(true); setTransferError("");
    try {
      const refreshed = await refreshEmployees();
      if (!refreshed) { setTransferError("The transfer is saved, but ownership is still unverified. Retry refresh before starting another transfer."); return; }
      setTransferSavedNeedsRefresh(false); setTransferId(null);
    } catch {
      setTransferError("The transfer is saved, but ownership could not be refreshed. Retry before starting another transfer.");
    } finally { setTransferring(false); }
  }
  return <div className="flex min-h-full w-full flex-col"><div><h1 className="text-2xl font-semibold tracking-[-0.03em]">Client assignments</h1><p className="mt-1 text-sm text-muted-foreground">Control operational responsibility without changing acquisition attribution.</p></div>
    {employeesLoading && <div role="status" className="mt-4 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Loading clients and employee ownership…</div>}
    {!employeesLoading && employeeLoadError && <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"><p className="text-sm text-destructive">{employeeLoadError}</p><button onClick={() => void refreshEmployees()} className="h-9 rounded-lg border border-destructive/30 px-3 text-xs font-semibold text-destructive hover:bg-destructive/10">Retry</button></div>}
    {!employeesLoading && !employeeLoadError && clients.length === 0 && <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-8 text-center"><h2 className="text-sm font-semibold">No clients are available</h2><p className="mt-1 text-xs text-muted-foreground">The organization client directory returned no records.</p><button onClick={() => void refreshEmployees()} className="mt-4 h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted/40">Refresh client directory</button></div>}
    {!employeesLoading && !employeeLoadError && clients.length > 0 && <>
    <section className="mt-6 grid gap-3 md:grid-cols-3">{[{ label: "Total clients", value: clients.length, icon: Building2 }, { label: "Assigned clients", value: clients.filter((client) => Boolean(client.assignedToEmployeeId)).length, icon: UserRoundCheck }, { label: "Unassigned clients", value: clients.filter((client) => !client.assignedToEmployeeId).length, icon: Users }].map(({ label, value, icon: Icon }) => <article key={label} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-xs"><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-[18px]" /></div><div><p className="text-xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></article>)}</section>
    <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs"><div className="border-b border-border/60 p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-xl border border-border pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Search client or client code" /></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-border/60 bg-muted/60 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{["Client", "Current owner", "Status", ""].map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-border/60">{filtered.map((client) => <tr key={client.id} className="hover:bg-muted/60"><td className="px-4 py-4"><p className="text-sm font-semibold">{client.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{client.code || "No client code"}</p></td><td className="px-4 py-4"><div className="flex items-center gap-2"><div className="grid size-7 place-items-center rounded-lg bg-primary/10 text-[9px] font-bold text-primary">{employeeName(client.assignedToEmployeeId).split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><span className="text-xs font-semibold text-foreground/80">{employeeName(client.assignedToEmployeeId)}</span></div></td><td className="px-4 py-4"><StatusBadge tone={client.status === "Active" ? "positive" : "warning"}>{client.status}</StatusBadge></td><td className="px-4 py-4"><button onClick={() => openTransfer(client.id, client.assignedToEmployeeId)} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted/40">Transfer <ArrowRight className="size-3" /></button></td></tr>)}{filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center"><p className="text-sm font-semibold">No clients match this search</p><p className="mt-1 text-xs text-muted-foreground">Try a different client name or code.</p></td></tr>}</tbody></table></div></section>
    <Modal open={Boolean(selected)} onClose={() => { if (!transferring) { setTransferId(null); setTransferSavedNeedsRefresh(false); setTransferError(""); } }} title="Transfer client responsibility" description="The onboarding attribution will remain unchanged."><div className="rounded-xl bg-muted/40 p-4"><p className="text-sm font-semibold">{selected?.name}</p><div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span>{employeeName(selected?.assignedToEmployeeId ?? "")}</span><ArrowRight className="size-3.5" /><span className="font-semibold text-primary">{employeeName(assigneeId)}</span></div></div><div className="mt-5"><p className="mb-2 text-xs font-semibold text-foreground/80">New responsible employee</p>{transferSavedNeedsRefresh ? <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Transfer submitted to {employeeName(assigneeId)}. Refresh the ownership list to confirm it.</p> : <Dropdown portal label="Select responsible employee" value={assigneeId} onChange={setAssigneeId} options={activeEmployees.map((employee) => ({ value: employee.id, label: `${employee.name} · ${clients.filter((client) => client.assignedToEmployeeId === employee.id).length} clients` }))} />}</div>{transferError && <p role={transferSavedNeedsRefresh ? "status" : "alert"} className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${transferSavedNeedsRefresh ? "bg-amber-500/10 text-amber-700" : "bg-destructive/10 text-destructive"}`}>{transferError}</p>}{history.length > 0 && <div className="mt-5 border-t border-border/60 pt-4"><p className="text-xs font-semibold text-foreground/80">Recent assignment history</p>{history.map((event) => <p key={event.id} className="mt-2 text-[11px] text-muted-foreground">{event.before} → {event.after} · {new Date(event.timestamp).toLocaleDateString("en-IN")}</p>)}</div>}<div className="mt-6 flex justify-end gap-2"><button disabled={transferring} onClick={() => { setTransferId(null); setTransferSavedNeedsRefresh(false); setTransferError(""); }} className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-xs hover:bg-accent">{transferSavedNeedsRefresh ? "Close" : "Cancel"}</button>{transferSavedNeedsRefresh ? <button disabled={transferring} onClick={() => void retryOwnershipRefresh()} className="h-9 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm disabled:opacity-50">{transferring ? "Refreshing…" : "Retry ownership refresh"}</button> : <button disabled={transferring || !assigneeId || assigneeId === selected?.assignedToEmployeeId} onClick={() => void confirm()} className="flex h-9 items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-40"><UserRoundCheck className="size-4" /> {transferring ? "Transferring…" : "Confirm transfer"}</button>}</div></Modal>
    </>}
  </div>;
}
