"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Employee, EmployeeDraft, Role } from "@/lib/admin-domain";
import { makeWorkspaceSlug } from "@/lib/admin-domain";
import { Field, inputClass } from "@/components/admin/ui";
import Dropdown from "@/components/ui/dropdown";

export function EmployeeForm({ roles, employee, onSubmit, onCancel, onSubmittingChange }: { roles: Role[]; employee?: Employee; onSubmit(draft: EmployeeDraft): string | undefined | Promise<string | undefined>; onCancel(): void; onSubmittingChange?(submitting: boolean): void }) {
  const [draft, setDraft] = useState<EmployeeDraft>(() => ({ name: employee?.name ?? "", email: employee?.email ?? "", phone: employee?.phone ?? "", employeeId: employee?.employeeCode ?? "", department: employee?.department ?? "Operations", roleId: employee?.roleId ?? roles.find((role) => role.id !== "role-super")?.id ?? "", workspaceSlug: employee?.workspaceSlug ?? "", temporaryPassword: "" }));
  const [slugEdited, setSlugEdited] = useState(Boolean(employee));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const roleOptions = useMemo(() => roles.filter((role) => role.department !== "System" && role.id !== "role-super").map((role) => ({ value: role.id, label: role.name })), [roles]);
  const selectedRoleId = draft.roleId || (!employee ? roleOptions[0]?.value ?? "" : "");
  function update<K extends keyof EmployeeDraft>(key: K, value: EmployeeDraft[K]) { setDraft((current) => ({ ...current, [key]: value, ...(key === "name" && !slugEdited ? { workspaceSlug: makeWorkspaceSlug(String(value)) } : {}) })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    if (draft.name.trim().length < 3) return setError("Enter the employee's full name.");
    if (!/^\S+@\S+\.\S+$/.test(draft.email)) return setError("Enter a valid work email.");
    if (!draft.workspaceSlug || !/^[a-z0-9-]+$/.test(draft.workspaceSlug)) return setError("Workspace may contain lowercase letters, numbers, and hyphens.");
    if (!selectedRoleId || !roleOptions.some((role) => role.value === selectedRoleId)) return setError("Select a valid employee role.");
    if (!employee && draft.temporaryPassword.length < 8) return setError("Temporary password must be at least 8 characters.");
    setSubmitting(true); onSubmittingChange?.(true);
    try {
      const message = await onSubmit({ ...draft, roleId: selectedRoleId });
      if (message) setError(message);
    } catch {
      setError("Unable to reach the employee service. Check your connection and try again.");
    } finally {
      setSubmitting(false); onSubmittingChange?.(false);
    }
  }
  return <form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input className={inputClass} value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="Rahul Sharma" disabled={submitting} /></Field><Field label="Work email (User ID)"><input className={inputClass} value={draft.email} onChange={(event) => update("email", event.target.value)} type="email" placeholder="rahul@psslogistics.in" disabled={submitting} /></Field><Field label="Employee ID" hint="Optional. Leave blank to generate the next EMP-#### ID."><input className={inputClass} value={draft.employeeId ?? ""} onChange={(event) => update("employeeId", event.target.value)} placeholder="EMP-0028" disabled={submitting} /></Field><Field label="Phone"><input className={inputClass} value={draft.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+91 98765 00000" disabled={submitting} /></Field><Field label="Department"><input className={inputClass} value={draft.department} onChange={(event) => update("department", event.target.value)} placeholder="Operations" disabled={submitting} /></Field></div><Field label="Workspace slug" hint={`Workspace preview: ${draft.workspaceSlug || "employee"}.psslogistics.in`}><input className={inputClass} value={draft.workspaceSlug} onChange={(event) => { setSlugEdited(true); update("workspaceSlug", event.target.value.toLowerCase().replace(/\s+/g, "-")); }} disabled={submitting} /></Field><Field label="Role"><Dropdown label="Select employee role" value={selectedRoleId} options={roleOptions} onChange={(value) => update("roleId", value)} className="w-full" /></Field>{!employee && <Field label="Temporary password" hint="The employee must change this password after first sign-in."><input required minLength={8} className={inputClass} value={draft.temporaryPassword} onChange={(event) => update("temporaryPassword", event.target.value)} type="password" autoComplete="new-password" placeholder="At least 8 characters" disabled={submitting} /></Field>}{error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2.5 text-xs font-medium text-destructive">{error}</p>}{submitting && <p role="status" className="text-xs text-muted-foreground">Creating employee in Supabase…</p>}<div className="flex justify-end gap-2 border-t border-border/60 pt-5"><button type="button" disabled={submitting} onClick={onCancel} className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">Cancel</button><button type="submit" disabled={submitting} aria-busy={submitting} className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70">{submitting ? "Creating…" : employee ? "Save changes" : "Create employee"}</button></div></form>;
}
