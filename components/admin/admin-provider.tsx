"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminState, AuditEvent, EmployeeDraft, PermissionKey } from "@/lib/admin-domain";
import type { MasterWorkspaceState } from "@/lib/master-domain";
import { makeWorkspaceSlug, nextEmployeeCode, seedState } from "@/lib/admin-domain";
import { demoSessionStorage, localAdminRepository } from "@/lib/admin-repository";

function emitAdminToast(message: string, tone: "success" | "error" | "info" | "warning" = "success") {
  window.dispatchEvent(new CustomEvent("pss-admin-toast", { detail: { message, tone } }));
}

interface AdminContextValue extends AdminState {
  hydrated: boolean;
  createEmployee(draft: EmployeeDraft): { ok: true; id: string } | { ok: false; error: string };
  updateEmployee(id: string, draft: EmployeeDraft): { ok: boolean; error?: string };
  toggleEmployeeStatus(id: string): void;
  setPermissionOverride(employeeId: string, key: PermissionKey, mode: "inherit" | "grant" | "revoke"): void;
  toggleRolePermission(roleId: string, key: PermissionKey): void;
  assignClient(clientId: string, employeeId: string): void;
  resetDemo(): void;
  mutateWorkspace(label: string, updater: (workspace: MasterWorkspaceState) => MasterWorkspaceState, audit?: { entityType: "Session" | "Shipment" | "Pickup" | "Ticket" | "Exception" | "Billing" | "Transaction" | "Report" | "Integration" | "System"; entityId?: string; entityLabel?: string; severity?: "Info" | "Important" | "Security" }): void;
  mutateAdminState(label: string, updater: (state: AdminState) => AdminState, audit?: { entityType: AuditEvent["entityType"]; entityId?: string; entityLabel?: string; severity?: AuditEvent["severity"] }): void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

function createAudit(state: AdminState, input: Omit<AdminState["auditEvents"][number], "id" | "timestamp" | "actorEmployeeId">) {
  return [{ ...input, id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), actorEmployeeId: "emp-admin" }, ...state.auditEvents];
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminState>(seedState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setState(localAdminRepository.load());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const commit = useCallback((updater: (current: AdminState) => AdminState) => {
    setState((current) => {
      const next = updater(current);
      localAdminRepository.save(next);
      return next;
    });
  }, []);

  const createEmployee: AdminContextValue["createEmployee"] = useCallback((draft) => {
    const email = draft.email.trim().toLowerCase();
    const slug = (draft.workspaceSlug || makeWorkspaceSlug(draft.name)).trim().toLowerCase();
    if (state.employees.some((employee) => employee.email.toLowerCase() === email)) return { ok: false, error: "An employee with this email already exists." };
    if (state.employees.some((employee) => employee.workspaceSlug.toLowerCase() === slug)) return { ok: false, error: "This workspace slug is already in use." };
    const id = `emp-${Date.now()}`;
    commit((current) => {
      const employee = { id, employeeCode: nextEmployeeCode(current.employees), name: draft.name.trim(), email, phone: draft.phone.trim(), department: draft.department, roleId: draft.roleId, workspaceSlug: slug, status: "Invited" as const, lastActive: "Never", joinedAt: new Date().toISOString().slice(0, 10), permissionOverrides: [] };
      return { ...current, employees: [...current.employees, employee], auditEvents: createAudit(current, { action: "Created employee", entityType: "Employee", entityId: id, entityLabel: employee.name, after: `${employee.department} · Invited`, severity: "Security" }) };
    });
    emitAdminToast(`${draft.name.trim()} was created and invited.`, "success");
    return { ok: true, id };
  }, [commit, state.employees]);

  const updateEmployee: AdminContextValue["updateEmployee"] = useCallback((id, draft) => {
    const duplicate = state.employees.find((employee) => employee.id !== id && (employee.email.toLowerCase() === draft.email.trim().toLowerCase() || employee.workspaceSlug.toLowerCase() === draft.workspaceSlug.trim().toLowerCase()));
    if (duplicate) return { ok: false, error: "Email and workspace slug must be unique." };
    commit((current) => {
      const existing = current.employees.find((employee) => employee.id === id);
      if (!existing) return current;
      const nextEmployee = { ...existing, ...draft, email: draft.email.trim().toLowerCase(), workspaceSlug: draft.workspaceSlug.trim().toLowerCase() };
      return { ...current, employees: current.employees.map((employee) => employee.id === id ? nextEmployee : employee), auditEvents: createAudit(current, { action: "Updated employee", entityType: "Employee", entityId: id, entityLabel: existing.name, before: `${existing.department} · ${existing.roleId}`, after: `${draft.department} · ${draft.roleId}`, severity: "Important" }) };
    });
    emitAdminToast(`${draft.name.trim()}'s employee profile was updated.`, "success");
    return { ok: true };
  }, [commit, state.employees]);

  const toggleEmployeeStatus = useCallback((id: string) => {
    const existing = state.employees.find((employee) => employee.id === id);
    if (!existing || existing.isSuperAdmin) return;
    const nextStatus = existing.status === "Disabled" ? "Active" : "Disabled";
    commit((current) => ({ ...current, employees: current.employees.map((employee) => employee.id === id ? { ...employee, status: nextStatus } : employee), auditEvents: createAudit(current, { action: nextStatus === "Disabled" ? "Disabled employee" : "Enabled employee", entityType: "Employee", entityId: id, entityLabel: existing.name, before: existing.status, after: nextStatus, severity: "Security" }) }));
    emitAdminToast(`${existing.name}'s access is now ${nextStatus.toLowerCase()}.`, nextStatus === "Disabled" ? "warning" : "success");
  }, [commit, state.employees]);

  const setPermissionOverride = useCallback((employeeId: string, key: PermissionKey, mode: "inherit" | "grant" | "revoke") => {
    commit((current) => {
    const employee = current.employees.find((item) => item.id === employeeId);
    if (!employee || employee.isSuperAdmin) return current;
    const overrides = employee.permissionOverrides.filter((override) => override.permissionKey !== key);
    if (mode !== "inherit") overrides.push({ permissionKey: key, mode });
    return { ...current, employees: current.employees.map((item) => item.id === employeeId ? { ...item, permissionOverrides: overrides } : item), auditEvents: createAudit(current, { action: mode === "inherit" ? "Removed permission override" : `${mode === "grant" ? "Granted" : "Revoked"} permission`, entityType: "Permission", entityId: employeeId, entityLabel: employee.name, before: key, after: mode, severity: "Important" }) };
    });
    emitAdminToast(`${key} is now set to ${mode}.`, mode === "revoke" ? "warning" : "success");
  }, [commit]);

  const toggleRolePermission = useCallback((roleId: string, key: PermissionKey) => {
    commit((current) => {
    const role = current.roles.find((item) => item.id === roleId);
    if (!role || role.id === "role-super") return current;
    const has = role.permissionKeys.includes(key);
    const permissionKeys = has ? role.permissionKeys.filter((item) => item !== key) : [...role.permissionKeys, key];
    return { ...current, roles: current.roles.map((item) => item.id === roleId ? { ...item, permissionKeys } : item), auditEvents: createAudit(current, { action: has ? "Removed role permission" : "Added role permission", entityType: "Role", entityId: roleId, entityLabel: role.name, before: has ? key : "Not assigned", after: has ? "Not assigned" : key, severity: "Important" }) };
    });
    emitAdminToast(`Role permission ${key} was updated.`, "success");
  }, [commit]);

  const assignClient = useCallback((clientId: string, employeeId: string) => {
    const client = state.clients.find((item) => item.id === clientId);
    const employee = state.employees.find((item) => item.id === employeeId);
    commit((current) => {
    const client = current.clients.find((item) => item.id === clientId);
    if (!client || client.assignedToEmployeeId === employeeId) return current;
    const before = current.employees.find((employee) => employee.id === client.assignedToEmployeeId)?.name ?? "Unassigned";
    const after = current.employees.find((employee) => employee.id === employeeId)?.name ?? "Unassigned";
    return { ...current, clients: current.clients.map((item) => item.id === clientId ? { ...item, assignedToEmployeeId: employeeId, lastActivity: "Just now" } : item), auditEvents: createAudit(current, { action: "Transferred client", entityType: "Client", entityId: clientId, entityLabel: client.name, before, after, severity: "Important" }) };
    });
    if (client && employee) emitAdminToast(`${client.name} was assigned to ${employee.name}.`, "success");
  }, [commit, state.clients, state.employees]);

  const resetDemo = useCallback(() => setState(localAdminRepository.reset()), []);

  const mutateWorkspace = useCallback<AdminContextValue["mutateWorkspace"]>((label, updater, audit) => {
    commit((current) => {
      const nextWorkspace = updater(current.workspace);
      const event = createAudit(current, { action: label, entityType: audit?.entityType ?? "System", entityId: audit?.entityId ?? "workspace", entityLabel: audit?.entityLabel ?? label, before: "Previous local state", after: "Updated local state", severity: audit?.severity ?? "Important" });
      const activity = { id: `activity-${Date.now()}`, actorEmployeeId: "emp-admin", module: audit?.entityType ?? "System", action: label, entityId: audit?.entityId, entityLabel: audit?.entityLabel, timestamp: new Date().toISOString() };
      const notification = { id: `notification-${Date.now()}`, title: label, detail: audit?.entityLabel ? `${audit.entityLabel} was updated in the local workspace.` : "A local workspace action was completed.", category: audit?.entityType === "Billing" || audit?.entityType === "Transaction" ? "Finance" as const : audit?.entityType === "Ticket" ? "Support" as const : audit?.entityType === "System" ? "System" as const : "Operations" as const, severity: audit?.severity === "Security" ? "Critical" as const : "Info" as const, read: false, entityId: audit?.entityId, createdAt: new Date().toISOString() };
      return { ...current, workspace: { ...nextWorkspace, activities: [activity, ...nextWorkspace.activities].slice(0, 200), notifications: [notification, ...nextWorkspace.notifications].slice(0, 100) }, auditEvents: event };
    });
    emitAdminToast(`${label} saved locally.`, "success");
  }, [commit]);

  const mutateAdminState = useCallback<AdminContextValue["mutateAdminState"]>((label, updater, audit) => {
    commit((current) => ({ ...updater(current), auditEvents: createAudit(current, { action: label, entityType: audit?.entityType ?? "System", entityId: audit?.entityId ?? "workspace", entityLabel: audit?.entityLabel ?? label, before: "Previous local state", after: "Updated local state", severity: audit?.severity ?? "Important" }) }));
    emitAdminToast(`${label} saved locally.`, "success");
  }, [commit]);

  const value = useMemo(() => ({ ...state, hydrated, createEmployee, updateEmployee, toggleEmployeeStatus, setPermissionOverride, toggleRolePermission, assignClient, resetDemo, mutateWorkspace, mutateAdminState }), [state, hydrated, createEmployee, updateEmployee, toggleEmployeeStatus, setPermissionOverride, toggleRolePermission, assignClient, resetDemo, mutateWorkspace, mutateAdminState]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdmin must be used within AdminProvider");
  return context;
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!demoSessionStorage.load()) router.replace("/login");
      else setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);
  if (!ready) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Checking demo access…</div>;
  return children;
}
