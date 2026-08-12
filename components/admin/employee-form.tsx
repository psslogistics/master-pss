"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Employee, EmployeeDraft, Role } from "@/lib/admin-domain";
import { makeWorkspaceSlug } from "@/lib/admin-domain";
import { Field, inputClass } from "@/components/admin/ui";
import Dropdown from "@/components/ui/dropdown";

export function EmployeeForm({ roles, employee, onSubmit, onCancel }: { roles: Role[]; employee?: Employee; onSubmit(draft: EmployeeDraft): string | undefined; onCancel(): void }) {
  const [draft, setDraft] = useState<EmployeeDraft>(() => ({ name: employee?.name ?? "", email: employee?.email ?? "", phone: employee?.phone ?? "", department: employee?.department ?? "Operations", roleId: employee?.roleId ?? roles.find((role) => role.id !== "role-super")?.id ?? "", workspaceSlug: employee?.workspaceSlug ?? "" }));
  const [slugEdited, setSlugEdited] = useState(Boolean(employee));
  const [error, setError] = useState("");
  const roleOptions = useMemo(() => roles.filter((role) => role.id !== "role-super").map((role) => ({ value: role.id, label: role.name })), [roles]);
  function update<K extends keyof EmployeeDraft>(key: K, value: EmployeeDraft[K]) { setDraft((current) => ({ ...current, [key]: value, ...(key === "name" && !slugEdited ? { workspaceSlug: makeWorkspaceSlug(String(value)) } : {}) })); }
  function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (draft.name.trim().length < 3) return setError("Enter the employee's full name.");
    if (!/^\S+@\S+\.\S+$/.test(draft.email)) return setError("Enter a valid work email.");
    if (!draft.workspaceSlug || !/^[a-z0-9-]+$/.test(draft.workspaceSlug)) return setError("Workspace may contain lowercase letters, numbers, and hyphens.");
    const message = onSubmit(draft); if (message) setError(message);
  }
  return <form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input className={inputClass} value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Rahul Sharma" /></Field><Field label="Work email"><input className={inputClass} value={draft.email} onChange={(event) => update("email", event.target.value)} type="email" placeholder="rahul@psslogistics.in" /></Field><Field label="Phone"><input className={inputClass} value={draft.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+91 98765 00000" /></Field><Field label="Department"><input className={inputClass} value={draft.department} onChange={(event) => update("department", event.target.value)} placeholder="Operations" /></Field></div><Field label="Workspace slug" hint={`Workspace preview: ${draft.workspaceSlug || "employee"}.psslogistics.in`}><input className={inputClass} value={draft.workspaceSlug} onChange={(event) => { setSlugEdited(true); update("workspaceSlug", event.target.value.toLowerCase().replace(/\s+/g, "-")); }} /></Field><Field label="Role"><Dropdown label="Select employee role" value={draft.roleId} options={roleOptions} onChange={(value) => update("roleId", value)} className="w-full" /></Field>{error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive">{error}</p>}<div className="flex justify-end gap-2 border-t border-border/60 pt-5"><button type="button" onClick={onCancel} className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent" >Cancel</button><button type="submit" className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">{employee ? "Save changes" : "Create employee"}</button></div></form>;
}
