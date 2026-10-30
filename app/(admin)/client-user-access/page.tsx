"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Link2, LoaderCircle, RefreshCw, Search, UserRound } from "lucide-react";
import Dropdown from "@/components/ui/dropdown";
import { EmptyState, StatusBadge, inputClass } from "@/components/admin/ui";

type User = { id: string; email?: string; createdAt: string };
type Client = { id: string; client_code?: string | null; legal_name: string; status: string };
type Membership = { user_id: string; client_id: string; membership_status: "active" | "suspended"; is_primary?: boolean; assigned_at?: string | null };
type DirectoryResponse = { users?: User[]; clients?: Client[]; memberships?: Membership[]; canResetPasswords?: boolean; error?: string };

async function readResponse(response: Response) {
  const result = await response.json() as DirectoryResponse;
  if (!response.ok) throw new Error(result.error ?? `Request failed (HTTP ${response.status}).`);
  return result;
}

export default function ClientUserAccessPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [canResetPasswords, setCanResetPasswords] = useState(false);
  const [query, setQuery] = useState("");
  const [userId, setUserId] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState<"active" | "suspended">("active");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadDirectory = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await readResponse(await fetch("/api/admin/client-membership", { signal, cache: "no-store" }));
      if (signal?.aborted) return;
      setUsers(result.users ?? []);
      setClients(result.clients ?? []);
      setMemberships(result.memberships ?? []);
      setCanResetPasswords(result.canResetPasswords === true);
    } catch (reason) {
      if (signal?.aborted) return;
      setError(reason instanceof Error ? reason.message : "Unable to load client access records.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadDirectory(controller.signal));
    return () => controller.abort();
  }, [loadDirectory]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((user) => !normalized || user.email?.toLowerCase().includes(normalized) || memberships.some((membership) => membership.user_id === user.id && clients.find((client) => client.id === membership.client_id)?.legal_name.toLowerCase().includes(normalized)));
  }, [clients, memberships, query, users]);
  const selectedUser = users.find((user) => user.id === userId);
  const selectedClient = clients.find((client) => client.id === clientId);
  const selectedMemberships = memberships.filter((item) => item.user_id === userId).sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

  function selectUser(user: User) {
    setUserId(user.id);
    const assigned = memberships.find((item) => item.user_id === user.id);
    setClientId(assigned?.client_id ?? "");
    setStatus(assigned?.membership_status ?? "active");
    setNotice("");
    setError("");
  }

  async function save() {
    if (!userId || !clientId) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await readResponse(await fetch("/api/admin/client-membership", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, clientId, membershipStatus: status }) }));
      setNotice("Membership saved and recorded in the audit log.");
      await loadDirectory();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save assignment.");
    } finally { setSaving(false); }
  }

  async function resetPassword() {
    if (!userId || temporaryPassword.length < 8 || !canResetPasswords) return;
    setResetting(true); setError(""); setNotice("");
    try {
      await readResponse(await fetch("/api/admin/password-reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, temporaryPassword }) }));
      setTemporaryPassword("");
      setNotice("Temporary password saved. The user must change it after signing in.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to reset the account password.");
    } finally { setResetting(false); }
  }

  return <div className="flex min-h-full w-full flex-col">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="flex items-center gap-2 text-xs font-medium text-primary"><Link2 className="size-4" /> Access governance</p><h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Client user access</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Review every active client account and all of its workspace memberships. Membership changes are audited.</p></div>
      <button onClick={() => { setError(""); setLoading(true); void loadDirectory(); }} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold hover:bg-muted disabled:opacity-60"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
    </header>
    <section className="mt-6 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-h-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="border-b border-border/60 p-4"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} pl-9`} placeholder="Search user email or client" aria-label="Search client users" /></div><p className="mt-2 text-xs text-muted-foreground">{loading ? "Loading directory…" : `${filteredUsers.length} users shown · ${memberships.length} memberships across ${clients.length} clients`}</p></div>
        {error && <div className="m-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" /><div className="min-w-0 flex-1"><p role="alert" className="font-medium text-destructive">{error}</p><button onClick={() => { setError(""); setLoading(true); void loadDirectory(); }} disabled={loading} className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-primary disabled:opacity-50"><RefreshCw className="size-3" />Retry</button></div></div>}
        {loading && users.length === 0 ? <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading access records…</div> : !loading && !error && filteredUsers.length === 0 ? <div className="p-4"><EmptyState title={query ? "No matching client users" : "No client users found"} description={query ? "Try another email or client name." : "Authenticated client accounts will appear here after signup."} /></div> : <div className="max-h-[min(68vh,760px)] divide-y divide-border/60 overflow-y-auto">{filteredUsers.map((user) => {
          const assigned = memberships.filter((item) => item.user_id === user.id);
          return <button key={user.id} onClick={() => selectUser(user)} aria-pressed={user.id === userId} className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/40 ${user.id === userId ? "bg-primary/5" : ""}`}>
            <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-4" /></div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.email ?? "Email unavailable"}</p>{assigned.length ? <ul className="mt-1 space-y-1">{assigned.map((membership) => { const client = clients.find((item) => item.id === membership.client_id); return <li key={`${membership.user_id}:${membership.client_id}`} className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"><span className="truncate">{client ? `${client.client_code ?? "No code"} · ${client.legal_name}` : "Client record unavailable"}</span>{membership.is_primary && <span className="rounded bg-primary/10 px-1 py-0.5 text-primary">Primary</span>}<span className={membership.membership_status === "active" ? "text-emerald-700" : "text-amber-700"}>{membership.membership_status}</span></li>; })}</ul> : <p className="mt-1 text-[11px] text-amber-700">No client workspace assigned</p>}</div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">{assigned.length} {assigned.length === 1 ? "workspace" : "workspaces"}</span>{user.id === userId && <Check className="mt-1 size-4 shrink-0 text-primary" />}
          </button>;
        })}</div>}
      </div>
      <aside className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Assignment detail</p>
        {selectedUser ? <><h2 className="mt-3 break-all text-base font-semibold">{selectedUser.email}</h2><p className="mt-1 text-xs text-muted-foreground">Users may have multiple workspace memberships. Change one client membership at a time.</p>
          {selectedMemberships.length > 0 && <div className="mt-4 space-y-2"><p className="text-xs font-semibold">Current memberships</p>{selectedMemberships.map((membership) => { const client = clients.find((item) => item.id === membership.client_id); return <button key={membership.client_id} onClick={() => { setClientId(membership.client_id); setStatus(membership.membership_status); }} className={`flex w-full items-center justify-between gap-2 rounded-lg border p-2 text-left text-xs ${clientId === membership.client_id ? "border-primary/50 bg-primary/5" : "border-border"}`}><span className="min-w-0 truncate">{client?.legal_name ?? "Unknown client"}{membership.is_primary ? " · Primary" : ""}</span><StatusBadge tone={membership.membership_status === "active" ? "positive" : "warning"}>{membership.membership_status}</StatusBadge></button>; })}</div>}
          <div className="mt-5 space-y-4"><div><p className="mb-2 text-xs font-semibold">Client workspace</p><Dropdown label="Select client workspace" value={clientId} onChange={setClientId} options={clients.filter((client) => client.status !== "disabled").map((client) => ({ value: client.id, label: `${client.client_code ?? "No client code"} · ${client.legal_name}` }))} /></div><div><p className="mb-2 text-xs font-semibold">Membership status</p><Dropdown label="Select membership status" value={status} onChange={(value) => setStatus(value as "active" | "suspended")} options={[{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }]} /></div>
            {selectedClient && <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">This status applies only to <strong className="text-foreground">{selectedClient.legal_name}</strong>. Other memberships remain unchanged.</div>}
            {canResetPasswords && <div className="border-t border-border/60 pt-4"><p className="text-xs font-semibold">Set temporary password</p><p className="mt-1 text-[11px] text-muted-foreground">Super Admin only. No email is sent; the user must change it after sign-in.</p><input type="password" minLength={8} maxLength={128} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} className={`${inputClass} mt-2`} placeholder="At least 8 characters" autoComplete="new-password" /><button disabled={temporaryPassword.length < 8 || resetting} onClick={() => void resetPassword()} className="mt-2 flex h-10 w-full items-center justify-center rounded-xl border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50">{resetting ? "Resetting…" : "Reset password"}</button></div>}
            {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-700">{notice}</p>}
            <button disabled={!clientId || saving || loading} onClick={() => void save()} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"><Link2 className="size-4" />{saving ? "Saving…" : "Save membership"}</button>
          </div></> : <div className="py-10 text-center text-sm text-muted-foreground">Select a client user to manage access.</div>}
      </aside>
    </section>
  </div>;
}
