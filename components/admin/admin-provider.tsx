"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminState, AuditEvent, EmployeeDraft, PermissionKey } from "@/lib/admin-domain";
import type { CrmContact, CrmFollowUp, CrmInteraction, CrmNote, CrmProspect, CrmProspectStage, CrmRelationshipHealth, MasterWorkspaceState } from "@/lib/master-domain";
import { createEmptyAdminState, makeWorkspaceSlug, nextEmployeeCode } from "@/lib/admin-domain";

function emitAdminToast(message: string, tone: "success" | "error" | "info" | "warning" = "success") {
  window.dispatchEvent(new CustomEvent("pss-admin-toast", { detail: { message, tone } }));
}

interface AdminContextValue extends AdminState {
  hydrated: boolean;
  createEmployee(draft: EmployeeDraft): { ok: true; id: string } | { ok: false; error: string };
  updateEmployee(id: string, draft: EmployeeDraft): { ok: boolean; error?: string };
  toggleEmployeeStatus(id: string): Promise<void>;
  setPermissionOverride(employeeId: string, key: PermissionKey, mode: "inherit" | "grant" | "revoke"): void;
  toggleRolePermission(roleId: string, key: PermissionKey): void;
  refreshRoles(): Promise<boolean>;
  assignClient(clientId: string, employeeId: string): Promise<{ ok: boolean; error?: string }>;
  resetDemo(): void;
  mutateWorkspace(label: string, updater: (workspace: MasterWorkspaceState) => MasterWorkspaceState, audit?: { entityType: "Session" | "Shipment" | "Pickup" | "Ticket" | "Exception" | "Billing" | "Transaction" | "Report" | "Integration" | "System"; entityId?: string; entityLabel?: string; severity?: "Info" | "Important" | "Security" }): void;
  mutateAdminState(label: string, updater: (state: AdminState) => AdminState, audit?: { entityType: AuditEvent["entityType"]; entityId?: string; entityLabel?: string; severity?: AuditEvent["severity"] }): void;
  createProspect(input: Omit<CrmProspect, "id" | "createdAt">): { ok: boolean; id?: string; error?: string };
  updateProspect(id: string, input: Partial<Omit<CrmProspect, "id" | "createdAt">>): void;
  updateProspectStage(id: string, stage: CrmProspectStage): void;
  convertProspectToClient(id: string): { ok: boolean; clientId?: string; error?: string };
  createCrmContact(input: Omit<CrmContact, "id">): void;
  updateCrmContact(id: string, input: Partial<Omit<CrmContact, "id">>): void;
  setPrimaryCrmContact(id: string): void;
  createCrmInteraction(input: Omit<CrmInteraction, "id" | "timestamp">): void;
  createCrmNote(input: Omit<CrmNote, "id" | "timestamp">): void;
  createCrmFollowUp(input: Omit<CrmFollowUp, "id">): void;
  updateCrmFollowUpStatus(id: string, status: CrmFollowUp["status"]): void;
  snoozeCrmFollowUp(id: string, dueDate: string): void;
  updateClientRelationshipHealth(clientId: string, health: CrmRelationshipHealth): void;
  refreshEmployees(): Promise<void>;
  employeeLoadError: string;
}

const AdminContext = createContext<AdminContextValue | null>(null);

function createAudit(state: AdminState, input: Omit<AdminState["auditEvents"][number], "id" | "timestamp" | "actorEmployeeId">) {
  return [{ ...input, id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), actorEmployeeId: "emp-admin" }, ...state.auditEvents];
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminState>(createEmptyAdminState);
  const [hydrated] = useState(true);
  const [employeeLoadError, setEmployeeLoadError] = useState("");

  const commit = useCallback((updater: (current: AdminState) => AdminState) => {
    setState((current) => {
      const next = updater(current);
      return next;
    });
  }, []);

  const refreshRoles = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/roles");
      if (!response.ok) return false;
      const result = await response.json() as { roles?: Array<{ id: string; role_code: string; name: string; description?: string | null; scope: string }>; rolePermissions?: Array<{ role_id: string; permission_key: PermissionKey }> };
      const permissionMap = new Map<string, PermissionKey[]>();
      for (const permission of result.rolePermissions ?? []) permissionMap.set(permission.role_id, [...(permissionMap.get(permission.role_id) ?? []), permission.permission_key]);
      const roles = (result.roles ?? []).map((role) => ({ id: role.id, roleCode: role.role_code, name: role.name, description: role.description ?? "", department: role.scope === "system" ? "System" : "Operations", permissionKeys: permissionMap.get(role.id) ?? [], color: role.scope === "system" ? "violet" : "blue" }));
      setState((current) => ({ ...current, roles }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const refreshEmployees = useCallback(async () => {
    const supabase = createClient();
    let response: Response;
    try { response = await fetch("/api/admin/invite"); } catch { setEmployeeLoadError("Unable to reach the employee service."); return; }
    if (!response.ok) {
      let message = `Employee data could not be loaded (${response.status}).`;
      try { const result = await response.json() as { error?: string }; if (result.error) message = result.error; } catch { /* preserve status message */ }
      setEmployeeLoadError(message); return;
    }
    const result = await response.json() as { employees?: Array<{ user_id: string; employee_code: string; department?: string | null; workspace_slug?: string | null; employment_status: string; joined_at?: string | null; last_active_at?: string | null; profile?: { email?: string; display_name?: string; phone?: string | null; status?: string }; assignment?: { is_active?: boolean; role?: { id?: string; role_code?: string; name?: string } } | Array<{ is_active?: boolean; role?: { id?: string; role_code?: string; name?: string } }> }> };
    if (!result.employees) return;
      setEmployeeLoadError("");
      const [{ data: clientRows }, { data: clientAssignments }] = await Promise.all([
        supabase.from("client_accounts").select("id,client_code,legal_name,status").order("legal_name"),
        supabase.from("employee_client_assignments").select("client_id,employee_user_id"),
      ]);
      const assigneeByClient = new Map((clientAssignments ?? []).map((assignment) => [assignment.client_id, assignment.employee_user_id]));
      const employees = result.employees.map((item) => { const assignment = Array.isArray(item.assignment) ? item.assignment[0] : item.assignment; const roleCode = assignment?.role?.role_code ?? "operations_executive"; return { id: item.user_id, employeeCode: item.employee_code, name: item.profile?.display_name ?? item.profile?.email ?? "Employee", email: item.profile?.email ?? "", phone: item.profile?.phone ?? "", department: item.department ?? "Operations", roleId: assignment?.role?.id ?? "", workspaceSlug: item.workspace_slug ?? "", status: item.employment_status === "disabled" ? "Disabled" as const : item.employment_status === "invited" ? "Invited" as const : "Active" as const, lastActive: item.last_active_at ? new Date(item.last_active_at).toLocaleDateString() : "Never", joinedAt: item.joined_at ?? "", permissionOverrides: [], isSuperAdmin: roleCode === "super_admin" }; });
      const clients = (clientRows ?? []).map((client) => ({ id: client.id, code: client.client_code ?? "", name: client.legal_name, city: "", status: client.status === "active" ? "Active" as const : "On hold" as const, onboardedByEmployeeId: "", assignedToEmployeeId: assigneeByClient.get(client.id) ?? "", shipmentVolume: 0, openTickets: 0, lastActivity: "Profile data only" }));
      setState((current) => ({ ...current, employees, clients }));
  }, []);

  useEffect(() => {
    if (hydrated) { const timer = window.setTimeout(() => { void Promise.all([refreshRoles(), refreshEmployees()]).catch(() => undefined); }, 0); return () => window.clearTimeout(timer); }
  }, [hydrated, refreshEmployees, refreshRoles]);

  const commitCrm = useCallback((label: string, updater: (workspace: MasterWorkspaceState) => MasterWorkspaceState, entityId: string, entityLabel: string, severity: AuditEvent["severity"] = "Important") => {
    commit((current) => {
      const nextWorkspace = updater(current.workspace);
      const timestamp = new Date().toISOString();
      const activity = { id: `crm-activity-${Date.now()}`, actorEmployeeId: "emp-admin", module: "CRM", action: label, entityId, entityLabel, timestamp };
      const notification = { id: `crm-notification-${Date.now()}`, title: label, detail: `${entityLabel} was updated in CRM.`, category: "System" as const, severity: severity === "Security" ? "Critical" as const : severity === "Important" ? "Warning" as const : "Info" as const, read: false, entityId, createdAt: timestamp };
      return { ...current, workspace: { ...nextWorkspace, activities: [activity, ...nextWorkspace.activities].slice(0, 200), notifications: [notification, ...nextWorkspace.notifications].slice(0, 100) }, auditEvents: createAudit(current, { action: label, entityType: "System", entityId, entityLabel, before: "Previous CRM state", after: "Updated CRM state", severity }) };
    });
    emitAdminToast(`${label} saved locally.`, "success");
  }, [commit]);

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

  const toggleEmployeeStatus = useCallback(async (id: string) => {
    const existing = state.employees.find((employee) => employee.id === id);
    if (!existing || existing.isSuperAdmin) return;
    const nextStatus = existing.status === "Disabled" ? "Active" : "Disabled";
    const response = await fetch("/api/admin/employee-status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: id, disabled: nextStatus === "Disabled" }) });
    if (!response.ok) { emitAdminToast("Unable to update employee access.", "error"); return; }
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
    const role = state.roles.find((item) => item.id === roleId);
    if (!role || role.id === "role-super") return;
    const has = role.permissionKeys.includes(key);
    void fetch("/api/admin/roles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId, permissionKey: key, enabled: !has }) }).then(async (response) => {
      if (!response.ok) { emitAdminToast("Role permission could not be saved.", "error"); return; }
      commit((current) => ({ ...current, roles: current.roles.map((item) => item.id === roleId ? { ...item, permissionKeys: has ? item.permissionKeys.filter((item) => item !== key) : [...item.permissionKeys, key] } : item), auditEvents: createAudit(current, { action: has ? "Removed role permission" : "Added role permission", entityType: "Role", entityId: roleId, entityLabel: role.name, before: has ? key : "Not assigned", after: has ? "Not assigned" : key, severity: "Important" }) }));
      emitAdminToast(`Role permission ${key} was saved.`, "success");
    }).catch(() => emitAdminToast("Role permission could not be saved.", "error"));
  }, [commit, state.roles]);

  const assignClient = useCallback(async (clientId: string, employeeId: string) => {
    const client = state.clients.find((item) => item.id === clientId);
    const employee = state.employees.find((item) => item.id === employeeId);
    if (!client || !employee) return { ok: false, error: "Choose a valid client and active employee." };
    try {
      const response = await fetch("/api/admin/employee-client-assignment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId, employeeId }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) return { ok: false, error: result.error ?? "Unable to transfer this client." };
      await refreshEmployees();
      emitAdminToast(`${client.name} was assigned to ${employee.name}.`, "success");
      return { ok: true };
    } catch { return { ok: false, error: "Unable to reach the assignment service." }; }
  }, [refreshEmployees, state.clients, state.employees]);

  const resetDemo = useCallback(() => setState(createEmptyAdminState()), []);

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

  const createProspect = useCallback<AdminContextValue["createProspect"]>((input) => {
    if (!input.name.trim() || !input.company.trim() || !input.email.trim()) return { ok: false, error: "Name, company, and email are required." };
    if (state.workspace.crmProspects.some((item) => item.email.toLowerCase() === input.email.trim().toLowerCase() || item.company.toLowerCase() === input.company.trim().toLowerCase())) return { ok: false, error: "A prospect with this email or company already exists." };
    const id = `prospect-${Date.now()}`;
    commitCrm("Created prospect", (workspace) => ({ ...workspace, crmProspects: [{ ...input, id, name: input.name.trim(), company: input.company.trim(), email: input.email.trim().toLowerCase(), createdAt: new Date().toISOString() }, ...workspace.crmProspects] }), id, input.company);
    return { ok: true, id };
  }, [commitCrm, state.workspace.crmProspects]);

  const updateProspect = useCallback<AdminContextValue["updateProspect"]>((id, input) => commitCrm("Updated prospect", (workspace) => ({ ...workspace, crmProspects: workspace.crmProspects.map((item) => item.id === id ? { ...item, ...input } : item) }), id, input.company ?? state.workspace.crmProspects.find((item) => item.id === id)?.company ?? "Prospect"), [commitCrm, state.workspace.crmProspects]);
  const updateProspectStage = useCallback<AdminContextValue["updateProspectStage"]>((id, stage) => { const prospect = state.workspace.crmProspects.find((item) => item.id === id); if (prospect) updateProspect(id, { stage }); }, [state.workspace.crmProspects, updateProspect]);
  const convertProspectToClient = useCallback<AdminContextValue["convertProspectToClient"]>((id) => {
    const prospect = state.workspace.crmProspects.find((item) => item.id === id);
    if (!prospect) return { ok: false, error: "Prospect not found." };
    if (prospect.stage !== "Won") return { ok: false, error: "Only won prospects can be converted." };
    if (prospect.convertedClientId) return { ok: false, error: "This prospect is already converted." };
    const clientId = `client-${Date.now()}`;
    commit((current) => {
      const timestamp = new Date().toISOString();
      const activity = { id: `crm-activity-${Date.now()}`, actorEmployeeId: "emp-admin", module: "CRM", action: "Converted prospect to client", entityId: clientId, entityLabel: prospect.company, timestamp };
      const notification = { id: `crm-notification-${Date.now()}`, title: "Converted prospect to client", detail: `${prospect.company} is now available in client CRM accounts.`, category: "System" as const, severity: "Info" as const, read: false, entityId: clientId, createdAt: timestamp };
      const workspace = {
        ...current.workspace,
        crmProspects: current.workspace.crmProspects.map((item) => item.id === id ? { ...item, convertedClientId: clientId } : item),
        crmContacts: current.workspace.crmContacts.map((item) => item.prospectId === id ? { ...item, prospectId: undefined, clientId } : item),
        crmInteractions: current.workspace.crmInteractions.map((item) => item.prospectId === id ? { ...item, prospectId: undefined, clientId } : item),
        crmFollowUps: current.workspace.crmFollowUps.map((item) => item.prospectId === id ? { ...item, prospectId: undefined, clientId } : item),
        crmNotes: current.workspace.crmNotes.map((item) => item.prospectId === id ? { ...item, prospectId: undefined, clientId } : item),
      };
      return {
        ...current,
        clients: [{ id: clientId, code: `CL-${String(Date.now()).slice(-4)}`, name: prospect.company, city: "Pending setup", status: "Active", onboardedByEmployeeId: prospect.ownerEmployeeId, assignedToEmployeeId: prospect.ownerEmployeeId, shipmentVolume: 0, openTickets: 0, lastActivity: "Just now" }, ...current.clients],
        workspace: { ...workspace, activities: [activity, ...workspace.activities].slice(0, 200), notifications: [notification, ...workspace.notifications].slice(0, 100) },
        auditEvents: createAudit(current, { action: "Converted prospect to client", entityType: "Client", entityId: clientId, entityLabel: prospect.company, before: "Won prospect", after: "Active client", severity: "Important" }),
      };
    });
    emitAdminToast(`${prospect.company} was converted into a client.`, "success");
    return { ok: true, clientId };
  }, [commit, state.workspace.crmProspects]);
  const createCrmContact = useCallback<AdminContextValue["createCrmContact"]>((input) => commitCrm("Created CRM contact", (workspace) => ({ ...workspace, crmContacts: [{ ...input, id: `crm-contact-${Date.now()}` }, ...workspace.crmContacts] }), input.clientId ?? input.prospectId ?? "crm", input.name), [commitCrm]);
  const updateCrmContact = useCallback<AdminContextValue["updateCrmContact"]>((id, input) => commitCrm("Updated CRM contact", (workspace) => ({ ...workspace, crmContacts: workspace.crmContacts.map((item) => item.id === id ? { ...item, ...input } : item) }), id, input.name ?? "CRM contact"), [commitCrm]);
  const setPrimaryCrmContact = useCallback<AdminContextValue["setPrimaryCrmContact"]>((id) => { const contact = state.workspace.crmContacts.find((item) => item.id === id); if (!contact) return; const key = contact.clientId ? "clientId" : "prospectId"; commitCrm("Set primary CRM contact", (workspace) => ({ ...workspace, crmContacts: workspace.crmContacts.map((item) => item[key] === contact[key] ? { ...item, isPrimary: item.id === id } : item) }), id, contact.name, "Info"); }, [commitCrm, state.workspace.crmContacts]);
  const createCrmInteraction = useCallback<AdminContextValue["createCrmInteraction"]>((input) => commitCrm("Added CRM interaction", (workspace) => ({ ...workspace, crmInteractions: [{ ...input, id: `crm-interaction-${Date.now()}`, timestamp: new Date().toISOString() }, ...workspace.crmInteractions] }), input.clientId ?? input.prospectId ?? "crm", input.subject, "Info"), [commitCrm]);
  const createCrmNote = useCallback<AdminContextValue["createCrmNote"]>((input) => commitCrm("Added CRM note", (workspace) => ({ ...workspace, crmNotes: [{ ...input, id: `crm-note-${Date.now()}`, timestamp: new Date().toISOString() }, ...workspace.crmNotes] }), input.clientId ?? input.prospectId ?? "crm", "CRM note", "Info"), [commitCrm]);
  const createCrmFollowUp = useCallback<AdminContextValue["createCrmFollowUp"]>((input) => commitCrm("Created CRM follow-up", (workspace) => ({ ...workspace, crmFollowUps: [{ ...input, id: `crm-followup-${Date.now()}` }, ...workspace.crmFollowUps] }), input.clientId ?? input.prospectId ?? "crm", input.title), [commitCrm]);
  const updateCrmFollowUpStatus = useCallback<AdminContextValue["updateCrmFollowUpStatus"]>((id, status) => { const followUp = state.workspace.crmFollowUps.find((item) => item.id === id); if (followUp) commitCrm(`Marked follow-up ${status.toLowerCase()}`, (workspace) => ({ ...workspace, crmFollowUps: workspace.crmFollowUps.map((item) => item.id === id ? { ...item, status } : item) }), id, followUp.title, "Info"); }, [commitCrm, state.workspace.crmFollowUps]);
  const snoozeCrmFollowUp = useCallback<AdminContextValue["snoozeCrmFollowUp"]>((id, dueDate) => { const followUp = state.workspace.crmFollowUps.find((item) => item.id === id); if (followUp) commitCrm("Snoozed CRM follow-up", (workspace) => ({ ...workspace, crmFollowUps: workspace.crmFollowUps.map((item) => item.id === id ? { ...item, status: "Snoozed", dueDate } : item) }), id, followUp.title, "Info"); }, [commitCrm, state.workspace.crmFollowUps]);
  const updateClientRelationshipHealth = useCallback<AdminContextValue["updateClientRelationshipHealth"]>((clientId, health) => commitCrm("Updated client relationship health", (workspace) => ({ ...workspace, crmClientHealth: { ...workspace.crmClientHealth, [clientId]: health }, crmNotes: [{ id: `crm-note-${Date.now()}`, clientId, content: `Relationship health changed to ${health}.`, authorEmployeeId: "emp-admin", timestamp: new Date().toISOString() }, ...workspace.crmNotes] }), clientId, health, health === "At risk" ? "Security" : "Info"), [commitCrm]);

  const value = useMemo(() => ({ ...state, hydrated, employeeLoadError, createEmployee, updateEmployee, toggleEmployeeStatus, setPermissionOverride, toggleRolePermission, assignClient, resetDemo, mutateWorkspace, mutateAdminState, createProspect, updateProspect, updateProspectStage, convertProspectToClient, createCrmContact, updateCrmContact, setPrimaryCrmContact, createCrmInteraction, createCrmNote, createCrmFollowUp, updateCrmFollowUpStatus, snoozeCrmFollowUp, updateClientRelationshipHealth, refreshEmployees, refreshRoles }), [state, hydrated, employeeLoadError, createEmployee, updateEmployee, toggleEmployeeStatus, setPermissionOverride, toggleRolePermission, assignClient, resetDemo, mutateWorkspace, mutateAdminState, createProspect, updateProspect, updateProspectStage, convertProspectToClient, createCrmContact, updateCrmContact, setPrimaryCrmContact, createCrmInteraction, createCrmNote, createCrmFollowUp, updateCrmFollowUpStatus, snoozeCrmFollowUp, updateClientRelationshipHealth, refreshEmployees, refreshRoles]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdmin must be used within AdminProvider");
  return context;
}

