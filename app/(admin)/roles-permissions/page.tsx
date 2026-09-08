"use client";

import { useMemo, useState } from "react";
import { Check, KeyRound, MoreHorizontal, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import { useAdmin } from "@/components/admin/admin-provider";
import { Field, inputClass, Modal, StatusBadge } from "@/components/admin/ui";
import { permissions } from "@/lib/admin-domain";
import { cn } from "@/lib/utils";

type RoleAction = "create" | "rename" | "delete" | null;

async function readRoleApiResult<T extends object>(response: Response): Promise<T & { error?: string }> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {
      error: response.redirected || response.status === 401 || response.status === 403
        ? "Your Super Admin session has expired. Please sign in again."
        : `The role request failed (${response.status}).`,
    } as T & { error?: string };
  }

  try {
    return await response.json() as T & { error?: string };
  } catch {
    return { error: "The role service returned an invalid response." } as T & { error?: string };
  }
}

export default function RolesPage() {
  const { roles, employees, toggleRolePermission, refreshRoles } = useAdmin();
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createError, setCreateError] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameRole, setRenameRole] = useState<typeof roles[number] | null>(null);
  const [rename, setRename] = useState("");
  const [renameError, setRenameError] = useState("");
  const [deleteRole, setDeleteRole] = useState<typeof roles[number] | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [pendingAction, setPendingAction] = useState<RoleAction>(null);
  const [notice, setNotice] = useState("");
  const selected = roles.find((role) => role.id === selectedId) ?? roles[0];
  const grouped = useMemo(() => Array.from(new Set(permissions.map((permission) => permission.group))).map((group) => ({ group, permissions: permissions.filter((permission) => permission.group === group && `${permission.label} ${permission.key}`.toLowerCase().includes(query.toLowerCase())) })).filter((item) => item.permissions.length), [query]);
  async function createRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction) return;
    setPendingAction("create"); setCreateError(""); setNotice("");
    const roleName = name.trim();
    try {
      const response = await fetch("/api/admin/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: roleName, description }) });
      const result = await readRoleApiResult<{ role?: { id: string } }>(response);
      if (!response.ok || !result.role) { setCreateError(result.error ?? "Unable to create role."); return; }
      const refreshed = await refreshRoles();
      setSelectedId(result.role.id); setName(""); setDescription(""); setCreateOpen(false);
      setNotice(refreshed ? `Role “${roleName}” created successfully.` : `Role “${roleName}” was created, but the list could not be refreshed. Reload the page.`);
    } catch {
      setCreateError("Unable to reach the role service. Check your connection and try again.");
    } finally {
      setPendingAction(null);
    }
  }
  function openRename(role: typeof roles[number]) { setMenuId(null); setRenameRole(role); setRename(role.name); setRenameError(""); }
  async function submitRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renameRole || pendingAction) return;
    setPendingAction("rename"); setRenameError(""); setNotice("");
    const roleName = rename.trim();
    try {
      const response = await fetch("/api/admin/roles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId: renameRole.id, name: roleName }) });
      const result = await readRoleApiResult<object>(response);
      if (!response.ok) { setRenameError(result.error ?? "Unable to rename role."); return; }
      const refreshed = await refreshRoles();
      setRenameRole(null);
      setNotice(refreshed ? `Role renamed to “${roleName}”.` : `Role renamed to “${roleName}”, but the list could not be refreshed. Reload the page.`);
    } catch {
      setRenameError("Unable to reach the role service. Check your connection and try again.");
    } finally {
      setPendingAction(null);
    }
  }
  async function submitDelete() {
    if (!deleteRole || pendingAction) return;
    setPendingAction("delete"); setDeleteError(""); setNotice("");
    const deletedId = deleteRole.id;
    const deletedName = deleteRole.name;
    try {
      const response = await fetch("/api/admin/roles", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId: deletedId }) });
      const result = await readRoleApiResult<object>(response);
      if (!response.ok) { setDeleteError(result.error ?? "Unable to delete role."); return; }
      const refreshed = await refreshRoles();
      if (selectedId === deletedId) setSelectedId("");
      setDeleteRole(null);
      setNotice(refreshed ? `Role “${deletedName}” deleted successfully.` : `Role “${deletedName}” was deleted, but the list could not be refreshed. Reload the page.`);
    } catch {
      setDeleteError("Unable to reach the role service. Check your connection and try again.");
    } finally {
      setPendingAction(null);
    }
  }
  return <div className="flex min-h-full w-full flex-col"><div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-[-0.03em]">Roles & permissions</h1><p className="mt-1 text-sm text-muted-foreground">Define reusable access bundles and inspect effective coverage.</p></div><button type="button" onClick={() => { setCreateError(""); setNotice(""); setCreateOpen(true); }} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><Plus className="size-3.5" /> New role</button></div>
    {notice && <div role="status" className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700"><span>{notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")} className="rounded p-1 hover:bg-emerald-500/10"><X className="size-3.5" /></button></div>}
    <div className="mt-6 grid min-h-0 flex-1 gap-4 xl:grid-cols-[320px_1fr]">
      <aside className="h-fit rounded-xl border border-border bg-card p-3 shadow-xs"><div className="px-2 pb-3 pt-1"><p className="text-xs font-semibold text-foreground">Organization roles</p><p className="mt-1 text-[11px] text-muted-foreground">{roles.length} reusable access profiles</p></div><div className="space-y-1">{roles.map((role) => { const count = employees.filter((employee) => employee.roleId === role.id).length; const isSelected = selected?.id === role.id; return <div key={role.id} className={cn("group relative rounded-xl border transition", isSelected ? "border-primary/20 bg-primary/10" : "border-transparent hover:bg-muted/40")}><button onClick={() => { setSelectedId(role.id); setMenuId(null); }} className="flex w-full items-center gap-3 p-3 pr-10 text-left"><div className={cn("grid size-9 shrink-0 place-items-center rounded-xl", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}><ShieldCheck className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-foreground">{role.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{count} {count === 1 ? "employee" : "employees"}</p></div></button><button type="button" aria-label={`Actions for ${role.name}`} onClick={(event) => { event.stopPropagation(); setMenuId(menuId === role.id ? null : role.id); }} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100"><MoreHorizontal className="size-4" /></button>{menuId === role.id && <div className="absolute right-2 top-11 z-20 w-36 rounded-xl border border-border bg-card p-1.5 shadow-xl"><button onClick={() => openRename(role)} className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium hover:bg-muted/40">Rename role</button><button onClick={() => { setMenuId(null); setDeleteRole(role); setDeleteError(""); }} className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-destructive hover:bg-destructive/10">Delete role</button></div>}</div>; })}</div></aside>
      {selected ? <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs"><div className="border-b border-border/60 p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold tracking-tight">{selected.name}</h2>{selected.id === "role-super" && <StatusBadge tone="navy">System privilege</StatusBadge>}</div><p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{selected.description}</p><div className="mt-3 flex gap-4 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><Users className="size-3.5" />{employees.filter((employee) => employee.roleId === selected.id).length} assigned</span><span className="flex items-center gap-1.5"><KeyRound className="size-3.5" />{selected.id === "role-super" ? permissions.length : selected.permissionKeys.length} permissions</span></div></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search permissions" className="h-10 w-full rounded-xl border border-border pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" /></div></div></div>
        {selected.id === "role-super" && <div className="m-5 rounded-xl border border-primary/20 bg-primary/10 p-4 text-xs leading-5 text-muted-foreground"><strong className="text-primary">Super Admin is unrestricted.</strong> The checked permissions below visualize coverage only; they are not individually assigned and cannot be modified.</div>}
        <div className="grid gap-px bg-muted lg:grid-cols-2">{grouped.map(({ group, permissions: groupPermissions }) => <div key={group} className="bg-card p-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{group}</h3><span className="text-[10px] text-muted-foreground">{groupPermissions.filter((permission) => selected.id === "role-super" || selected.permissionKeys.includes(permission.key)).length}/{groupPermissions.length}</span></div><div className="space-y-1">{groupPermissions.map((permission) => { const enabled = selected.id === "role-super" || selected.permissionKeys.includes(permission.key); return <button disabled={selected.id === "role-super"} onClick={() => toggleRolePermission(selected.id, permission.key)} key={permission.key} className={cn("flex w-full items-start gap-3 rounded-xl p-3 text-left transition", selected.id !== "role-super" && "hover:bg-muted/40")}><span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border", enabled ? "border-emerald-500 bg-emerald-500/100 text-primary-foreground" : "border-border text-transparent")}><Check className="size-3" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-foreground">{permission.label}</span><code className="mt-1 block text-[9px] text-muted-foreground">{permission.key}</code></span>{enabled ? <Check className="mt-1 size-3.5 text-emerald-500" /> : <X className="mt-1 size-3.5 text-muted-foreground/60" />}</button>; })}</div></div>)}</div>
      </section> : <section className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-border bg-card p-8 text-center"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Roles unavailable</p><h2 className="mt-2 text-xl font-semibold">No organization roles are available</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">Roles will appear here after the workspace finishes loading them.</p></div></section>}
    </div>
    <Modal open={createOpen} onClose={() => { if (!pendingAction) setCreateOpen(false); }} title="Create organization role" description="This role and its permissions will be stored in Supabase."><form onSubmit={createRole} className="space-y-4"><Field label="Role name"><input required minLength={2} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Operations Lead" /></Field><Field label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="What access does this role provide?" /></Field>{createError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{createError}</p>}<div className="flex justify-end gap-2 border-t border-border/60 pt-4"><button type="button" disabled={pendingAction === "create"} onClick={() => setCreateOpen(false)} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Cancel</button><button type="submit" disabled={pendingAction === "create"} aria-busy={pendingAction === "create"} className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-70">{pendingAction === "create" ? "Creating…" : "Create role"}</button></div></form></Modal>
    <Modal open={Boolean(renameRole)} onClose={() => { if (!pendingAction) setRenameRole(null); }} title="Rename role" description="The display name will be updated in Supabase; the role code and assignments remain unchanged."><form onSubmit={submitRename} className="space-y-4"><Field label="Role name"><input required minLength={2} value={rename} onChange={(event) => setRename(event.target.value)} className={inputClass} /></Field>{renameError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{renameError}</p>}<div className="flex justify-end gap-2 border-t border-border/60 pt-4"><button type="button" disabled={pendingAction === "rename"} onClick={() => setRenameRole(null)} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Cancel</button><button type="submit" disabled={pendingAction === "rename"} aria-busy={pendingAction === "rename"} className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-70">{pendingAction === "rename" ? "Saving…" : "Save name"}</button></div></form></Modal>
    <Modal open={Boolean(deleteRole)} onClose={() => { if (!pendingAction) setDeleteRole(null); }} title="Delete role" description="This permanently removes the role from Supabase and cannot be undone."><div className="space-y-4"><p className="text-sm text-muted-foreground">Delete <strong className="text-foreground">{deleteRole?.name}</strong>? Any role currently assigned to employees will be rejected by the database.</p>{deleteError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{deleteError}</p>}{pendingAction === "delete" && <p role="status" className="text-xs text-muted-foreground">Deleting role from Supabase…</p>}<div className="flex justify-end gap-2 border-t border-border/60 pt-4"><button type="button" disabled={pendingAction === "delete"} onClick={() => setDeleteRole(null)} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Cancel</button><button type="button" onClick={submitDelete} disabled={pendingAction === "delete"} aria-busy={pendingAction === "delete"} className="h-9 rounded-lg bg-destructive px-3 text-xs font-semibold text-destructive-foreground disabled:cursor-wait disabled:opacity-70">{pendingAction === "delete" ? "Deleting…" : "Delete role"}</button></div></div></Modal>
  </div>;
}


