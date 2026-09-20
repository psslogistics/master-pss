"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminState, AuditEvent, EmployeeDraft, Permission, PermissionKey } from "@/lib/admin-domain";
import type { CrmContact, CrmFollowUp, CrmInteraction, CrmNote, CrmProspect, CrmProspectStage, CrmRelationshipHealth, MasterWorkspaceState } from "@/lib/master-domain";
import { createEmptyAdminState } from "@/lib/admin-domain";
import { pssApi } from "@/lib/pss-api";

function emitAdminToast(message: string, tone: "success" | "error" | "info" | "warning" = "success") {
  window.dispatchEvent(new CustomEvent("pss-admin-toast", { detail: { message, tone } }));
}

function parseMasterPayload<T>(row: { payload_json?: string | null }): T | null {
  if (!row.payload_json) return null;
  try { return JSON.parse(row.payload_json) as T; } catch { return null; }
}

interface AdminContextValue extends AdminState {
  hydrated: boolean;
  permissionCatalog: Permission[];
  createEmployee(draft: EmployeeDraft): Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  updateEmployee(id: string, draft: EmployeeDraft): Promise<{ ok: boolean; error?: string }>;
  toggleEmployeeStatus(id: string): Promise<void>;
  setPermissionOverride(employeeId: string, key: PermissionKey, mode: "inherit" | "grant" | "revoke"): Promise<void>;
  toggleRolePermission(roleId: string, key: PermissionKey): void;
  refreshRoles(): Promise<boolean>;
  assignClient(clientId: string, employeeId: string): Promise<{ ok: boolean; error?: string }>;
  mutateWorkspace(label: string, updater: (workspace: MasterWorkspaceState) => MasterWorkspaceState, audit?: { entityType: "Session" | "Shipment" | "Pickup" | "Ticket" | "Exception" | "Billing" | "Transaction" | "Report" | "Integration" | "System"; entityId?: string; entityLabel?: string; severity?: "Info" | "Important" | "Security" }): void;
  createProspect(input: Omit<CrmProspect, "id" | "createdAt">): Promise<{ ok: boolean; id?: string; error?: string }>;
  updateProspect(id: string, input: Partial<Omit<CrmProspect, "id" | "createdAt">>): Promise<void>;
  updateProspectStage(id: string, stage: CrmProspectStage): Promise<void>;
  convertProspectToClient(id: string): Promise<{ ok: boolean; clientId?: string; error?: string }>;
  createCrmContact(input: Omit<CrmContact, "id">): Promise<boolean>;
  updateCrmContact(id: string, input: Partial<Omit<CrmContact, "id">>): Promise<boolean>;
  setPrimaryCrmContact(id: string): Promise<boolean>;
  createCrmInteraction(input: Omit<CrmInteraction, "id" | "timestamp">): Promise<boolean>;
  createCrmNote(input: Omit<CrmNote, "id" | "timestamp">): Promise<boolean>;
  createCrmFollowUp(input: Omit<CrmFollowUp, "id">): Promise<boolean>;
  updateCrmFollowUpStatus(id: string, status: CrmFollowUp["status"]): Promise<boolean>;
  snoozeCrmFollowUp(id: string, dueDate: string): Promise<boolean>;
  updateClientRelationshipHealth(clientId: string, health: CrmRelationshipHealth): Promise<boolean>;
  refreshEmployees(): Promise<void>;
  employeeLoadError: string;
  workspaceLoadError: string;
}

const AdminContext = createContext<AdminContextValue | null>(null);

function createAudit(state: AdminState, input: Omit<AdminState["auditEvents"][number], "id" | "timestamp" | "actorEmployeeId">) {
  return [{ ...input, id: `audit-${Date.now()}`, timestamp: new Date().toISOString(), actorEmployeeId: "authenticated-user" }, ...state.auditEvents];
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminState>(createEmptyAdminState);
  const [permissionCatalog, setPermissionCatalog] = useState<AdminContextValue["permissionCatalog"]>([]);
  const [hydrated] = useState(true);
  const [employeeLoadError, setEmployeeLoadError] = useState("");
  const [workspaceLoadError, setWorkspaceLoadError] = useState("");

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
      const result = await response.json() as { roles?: Array<{ id: string; role_code: string; name: string; description?: string | null; scope: string }>; rolePermissions?: Array<{ role_id: string; permission_key: PermissionKey }>; permissions?: Array<{ permission_key: PermissionKey; label: string; description: string; permission_group: string; panel: string; resource: string; action: string; route: string; assignable_to_employee: boolean }> };
      setPermissionCatalog((result.permissions ?? []).map((permission) => ({ key: permission.permission_key, label: permission.label, description: permission.description, group: permission.permission_group, panel: permission.panel, resource: permission.resource, action: permission.action, route: permission.route, assignableToEmployee: permission.assignable_to_employee })));
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
      const [{ data: clientRows }, { data: clientAssignments }, { data: overrideRows }] = await Promise.all([
        supabase.from("client_accounts").select("id,client_code,legal_name,status").order("legal_name"),
        supabase.from("employee_client_assignments").select("client_id,employee_user_id"),
        supabase.from("employee_permission_overrides").select("employee_user_id,permission_key,mode"),
      ]);
      const assigneeByClient = new Map((clientAssignments ?? []).map((assignment) => [assignment.client_id, assignment.employee_user_id]));
      const employees = result.employees.map((item) => { const assignment = Array.isArray(item.assignment) ? item.assignment[0] : item.assignment; const roleCode = assignment?.role?.role_code ?? "operations_executive"; return { id: item.user_id, employeeCode: item.employee_code, name: item.profile?.display_name ?? item.profile?.email ?? "Employee", email: item.profile?.email ?? "", phone: item.profile?.phone ?? "", department: item.department ?? "Operations", roleId: assignment?.role?.id ?? "", workspaceSlug: item.workspace_slug ?? "", status: item.employment_status === "disabled" ? "Disabled" as const : item.employment_status === "invited" ? "Invited" as const : "Active" as const, lastActive: item.last_active_at ? new Date(item.last_active_at).toLocaleDateString() : "Never", joinedAt: item.joined_at ?? "", permissionOverrides: (overrideRows ?? []).filter((override) => override.employee_user_id === item.user_id).map((override) => ({ permissionKey: override.permission_key as PermissionKey, mode: override.mode as "grant" | "revoke" })), isSuperAdmin: roleCode === "super_admin" }; });
      const clients = (clientRows ?? []).map((client) => ({ id: client.id, code: client.client_code ?? "", name: client.legal_name, city: "", status: client.status === "active" ? "Active" as const : "On hold" as const, onboardedByEmployeeId: "", assignedToEmployeeId: assigneeByClient.get(client.id) ?? "", shipmentVolume: 0, openTickets: 0, lastActivity: "Profile data only" }));
      setState((current) => ({ ...current, employees, clients }));
  }, []);

  useEffect(() => {
    if (hydrated) { const timer = window.setTimeout(() => { void Promise.all([refreshRoles(), refreshEmployees()]).catch(() => undefined); }, 0); return () => window.clearTimeout(timer); }
  }, [hydrated, refreshEmployees, refreshRoles]);

  useEffect(() => {
    let cancelled = false;
    void pssApi<{ data: Record<string, Array<Record<string, unknown>>> }>("/v1/dashboard/summary").then(({ data }) => {
      if (cancelled) return;
      setWorkspaceLoadError("");
      const shipments = data.shipments ?? [];
      const pickups = data.pickups ?? [];
      const tickets = data.tickets ?? [];
      const notifications = data.notifications ?? [];
      const returns = data.returns ?? [];
      const exceptions = data.exceptions ?? [];
      const ndrCases = data.ndr ?? [];
      const billing = data.billing ?? [];
      const wallet = data.wallet ?? [];
      const tasks = data.tasks ?? [];
      const activity = data.activity ?? [];
      setState((current) => ({ ...current, workspace: { ...current.workspace,
        shipments: shipments.map((row) => ({ id: String(row.id), reference: String(row.tracking_number ?? row.id), clientId: String(row.client_id), consignor: String(row.origin ?? ""), consignee: String(row.consignee ?? ""), origin: String(row.origin ?? ""), destination: String(row.destination ?? ""), courier: String(row.provider ?? "Unassigned"), service: "Standard", status: String(row.status ?? "Booked") as MasterWorkspaceState["shipments"][number]["status"], declaredWeight: Number(row.total_weight_kg ?? 0), measuredWeight: Number(row.total_weight_kg ?? 0), pieces: Number(row.pieces ?? 1), paymentMode: "Prepaid", codAmount: 0, bookedAt: String(row.created_at ?? ""), eta: String(row.edd ?? ""), ownerEmployeeId: "" })),
        pickups: pickups.map((row) => ({ id: String(row.id), reference: String(row.id), shipmentId: row.shipment_id ? String(row.shipment_id) : undefined, clientId: String(row.client_id), scheduledDate: String(row.requested_date ?? ""), window: String(row.requested_time_slot ?? ""), location: String(row.pickup_address ?? ""), driver: "Unassigned", status: String(row.status ?? "Scheduled") as MasterWorkspaceState["pickups"][number]["status"], source: "Standalone" })),
        tickets: tickets.map((row) => ({ id: String(row.id), number: String(row.id), clientId: String(row.client_id), shipmentId: row.shipment_id ? String(row.shipment_id) : undefined, assignedToEmployeeId: String(row.assigned_to_user_id ?? ""), subject: String(row.title ?? ""), category: "Support", priority: String(row.priority ?? "Normal") as MasterWorkspaceState["tickets"][number]["priority"], status: String(row.status ?? "Open") as MasterWorkspaceState["tickets"][number]["status"], createdAt: String(row.created_at ?? ""), slaDueAt: "", lastMessage: String(row.description ?? "") })),
        notifications: notifications.map((row) => ({ id: String(row.id), title: String(row.title ?? ""), detail: String(row.message ?? ""), category: "Operations", severity: "Info", read: Boolean(row.is_read), entityId: row.shipment_id ? String(row.shipment_id) : undefined, createdAt: String(row.created_at ?? "") })),
        returns: returns.map((row) => ({ id: String(row.id), reference: String(row.reference ?? row.id), shipmentId: String(row.shipment_id ?? ""), clientId: String(row.client_id), reason: String(row.reason ?? ""), status: String(row.status ?? "Documents pending") as MasterWorkspaceState["returns"][number]["status"], invoiceUploaded: Boolean(row.invoice_uploaded), challanGenerated: Boolean(row.challan_generated), eWayBillRequired: Boolean(row.eway_bill_required), notes: String(row.notes ?? "") })),
        exceptions: exceptions.map((row) => ({ id: String(row.id), reference: String(row.reference ?? row.id), shipmentId: String(row.shipment_id ?? ""), clientId: String(row.client_id), category: String(row.category ?? "Exception"), severity: String(row.severity ?? "Normal") as MasterWorkspaceState["exceptions"][number]["severity"], status: String(row.status ?? "Open") as MasterWorkspaceState["exceptions"][number]["status"], ownerEmployeeId: row.assigned_to_user_id ? String(row.assigned_to_user_id) : undefined, title: String(row.title ?? ""), details: String(row.details ?? row.description ?? ""), recommendedAction: String(row.recommended_action ?? "Review record"), createdAt: String(row.created_at ?? "") })),
        ndrCases: ndrCases.map((row) => ({ id: String(row.id), reference: String(row.reference ?? row.id), shipmentId: String(row.shipment_id ?? ""), clientId: String(row.client_id), reason: String(row.reason ?? ""), attempt: Number(row.attempt ?? 1), deadline: String(row.deadline ?? ""), status: String(row.status ?? "Open") as MasterWorkspaceState["ndrCases"][number]["status"], priority: String(row.priority ?? "Normal") as MasterWorkspaceState["ndrCases"][number]["priority"] })),
        billing: billing.map((row) => ({ id: String(row.id), invoiceNumber: String(row.invoice_number ?? row.id), clientId: String(row.client_id), shipmentId: row.shipment_id ? String(row.shipment_id) : undefined, declaredWeight: Number(row.declared_weight ?? 0), measuredWeight: Number(row.measured_weight ?? 0), billableWeight: Number(row.billable_weight ?? row.measured_weight ?? 0), baseCharge: Number(row.amount ?? row.base_charge ?? 0), tax: Number(row.tax ?? 0), total: Number(row.amount ?? row.total ?? 0), status: String(row.status ?? "Pending") as MasterWorkspaceState["billing"][number]["status"], podState: "Pending" })),
        wallets: wallet.map((row) => ({ id: String(row.id), clientId: String(row.client_id), balance: Number(row.balance_after ?? row.balance ?? row.amount ?? 0), holdAmount: Number(row.hold_amount ?? 0), approvalRequired: Boolean(row.approval_required), status: String(row.status ?? "Available") as MasterWorkspaceState["wallets"][number]["status"] })),
        tasks: tasks.map((row) => ({ id: String(row.id), title: String(row.title ?? ""), clientId: row.client_id ? String(row.client_id) : undefined, assignedToEmployeeId: String(row.assigned_to_user_id ?? ""), status: String(row.status ?? "TODO").toUpperCase() as MasterWorkspaceState["tasks"][number]["status"], priority: String(row.priority ?? "MEDIUM").toUpperCase() as MasterWorkspaceState["tasks"][number]["priority"], dueDate: String(row.due_at ?? "") })),
        activities: activity.map((row) => ({ id: String(row.id), actorEmployeeId: String(row.actor_user_id ?? "System"), module: String(row.entity_type ?? "System"), action: String(row.action ?? "Activity"), entityId: row.entity_id ? String(row.entity_id) : undefined, entityLabel: row.entity_id ? String(row.entity_id) : undefined, timestamp: String(row.created_at ?? "") })),
      } }));
    }).catch(() => { if (!cancelled) setWorkspaceLoadError("Operational data could not be loaded from production. Retry after checking the API connection."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const kinds = ["crm.prospect", "crm.contact", "crm.interaction", "crm.note", "crm.followup", "crm.health"];
    const loadCrm = () => {
      void Promise.all(kinds.map((kind) => pssApi<{ data: Array<{ payload_json?: string | null }> }>(`/v1/master-records?kind=${encodeURIComponent(kind)}`))).then((responses) => {
        if (cancelled) return;
        const [prospects, contacts, interactions, notes, followUps, health] = responses;
        setState((current) => ({ ...current, workspace: { ...current.workspace,
          crmProspects: prospects.data.map((row) => parseMasterPayload<CrmProspect>(row)).filter((row): row is CrmProspect => Boolean(row)),
          crmContacts: contacts.data.map((row) => parseMasterPayload<CrmContact>(row)).filter((row): row is CrmContact => Boolean(row)),
          crmInteractions: interactions.data.map((row) => parseMasterPayload<CrmInteraction>(row)).filter((row): row is CrmInteraction => Boolean(row)),
          crmNotes: notes.data.map((row) => parseMasterPayload<CrmNote>(row)).filter((row): row is CrmNote => Boolean(row)),
          crmFollowUps: followUps.data.map((row) => parseMasterPayload<CrmFollowUp>(row)).filter((row): row is CrmFollowUp => Boolean(row)),
          crmClientHealth: Object.fromEntries(health.data.map((row) => { const value = parseMasterPayload<{ clientId: string; health: CrmRelationshipHealth }>(row); return value ? [value.clientId, value.health] : null; }).filter((row): row is [string, CrmRelationshipHealth] => Boolean(row))),
        } }));
      }).catch(() => undefined);
    };
    const useIdleCallback = typeof window.requestIdleCallback === "function";
    const idleHandle = useIdleCallback
      ? window.requestIdleCallback(loadCrm, { timeout: 1500 })
      : window.setTimeout(loadCrm, 500);
    return () => { cancelled = true; if (useIdleCallback) window.cancelIdleCallback(idleHandle); else window.clearTimeout(idleHandle); };
  }, []);

  const persistCrm = useCallback(async (kind: string, id: string, title: string, payload: unknown, clientId?: string) => {
    try { await pssApi(`/v1/master-records`, { method: "POST", headers: { "Idempotency-Key": `crm-${kind}-${id}-${crypto.randomUUID()}` }, body: JSON.stringify({ id, kind, title, client_id: clientId, status: "active", payload }) }); return true; }
    catch { emitAdminToast(`${title} could not be saved to production.`, "error"); return false; }
  }, []);

  const commitCrm = useCallback((label: string, updater: (workspace: MasterWorkspaceState) => MasterWorkspaceState, entityId: string, entityLabel: string, _severity?: AuditEvent["severity"]) => {
    commit((current) => {
      const nextWorkspace = updater(current.workspace);
      return { ...current, workspace: nextWorkspace };
    });
    emitAdminToast(`${label} saved to production${entityLabel ? ` · ${entityLabel}` : entityId ? ` · ${entityId}` : ""}.`, _severity === "Security" ? "warning" : "success");
  }, [commit]);

  const createEmployee: AdminContextValue["createEmployee"] = useCallback(async (draft) => {
    try {
      const response = await fetch("/api/admin/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: draft.email, name: draft.name, phone: draft.phone, employeeId: draft.employeeId, department: draft.department, workspaceSlug: draft.workspaceSlug, roleId: draft.roleId, temporaryPassword: draft.temporaryPassword }) });
      const result = await response.json() as { error?: string; employee?: { userId?: string } };
      if (!response.ok || !result.employee?.userId) return { ok: false, error: result.error ?? "Unable to create employee." };
      await refreshEmployees();
      emitAdminToast(`${draft.name.trim()} was created and invited.`, "success");
      return { ok: true, id: result.employee.userId };
    } catch {
      return { ok: false, error: "Unable to reach the employee service." };
    }
  }, [refreshEmployees]);

  const updateEmployee: AdminContextValue["updateEmployee"] = useCallback(async (id, draft) => {
    const duplicate = state.employees.find((employee) => employee.id !== id && (employee.email.toLowerCase() === draft.email.trim().toLowerCase() || employee.workspaceSlug.toLowerCase() === draft.workspaceSlug.trim().toLowerCase()));
    if (duplicate) return { ok: false, error: "Email and workspace slug must be unique." };
    try {
      const response = await fetch("/api/admin/invite", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: id, email: draft.email, name: draft.name, phone: draft.phone, employeeCode: draft.employeeId, department: draft.department, workspaceSlug: draft.workspaceSlug, roleId: draft.roleId }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) return { ok: false, error: result.error ?? "Unable to update employee." };
    } catch { return { ok: false, error: "Unable to reach the employee service." }; }
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

  const setPermissionOverride = useCallback(async (employeeId: string, key: PermissionKey, mode: "inherit" | "grant" | "revoke") => {
    const response = await fetch("/api/admin/employee-permission-override", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId, permissionKey: key, mode }) });
    if (!response.ok) { emitAdminToast("Permission override could not be saved.", "error"); return; }
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

  const mutateWorkspace = useCallback<AdminContextValue["mutateWorkspace"]>((label, updater, _audit) => {
    commit((current) => {
      const nextWorkspace = updater(current.workspace);
      return { ...current, workspace: nextWorkspace };
    });
    emitAdminToast(`${label} updated in production${_audit?.entityLabel ? ` · ${_audit.entityLabel}` : ""}.`, _audit?.severity === "Security" ? "warning" : "success");
  }, [commit]);

  const createProspect = useCallback<AdminContextValue["createProspect"]>(async (input) => {
    if (!input.name.trim() || !input.company.trim() || !input.email.trim()) return { ok: false, error: "Name, company, and email are required." };
    if (state.workspace.crmProspects.some((item) => item.email.toLowerCase() === input.email.trim().toLowerCase() || item.company.toLowerCase() === input.company.trim().toLowerCase())) return { ok: false, error: "A prospect with this email or company already exists." };
    const id = `prospect-${Date.now()}`; const prospect = { ...input, id, name: input.name.trim(), company: input.company.trim(), email: input.email.trim().toLowerCase(), createdAt: new Date().toISOString() };
    if (!await persistCrm("crm.prospect", id, input.company, prospect)) return { ok: false, error: "Could not save prospect to production." };
    commitCrm("Created prospect", (workspace) => ({ ...workspace, crmProspects: [prospect, ...workspace.crmProspects] }), id, input.company);
    return { ok: true, id };
  }, [commitCrm, persistCrm, state.workspace.crmProspects]);

  const updateProspect = useCallback<AdminContextValue["updateProspect"]>(async (id, input) => { const current = state.workspace.crmProspects.find((item) => item.id === id); if (!current) return; const next = { ...current, ...input }; if (!await persistCrm("crm.prospect", id, next.company, next)) return; commitCrm("Updated prospect", (workspace) => ({ ...workspace, crmProspects: workspace.crmProspects.map((item) => item.id === id ? next : item) }), id, next.company); }, [commitCrm, persistCrm, state.workspace.crmProspects]);
  const updateProspectStage = useCallback<AdminContextValue["updateProspectStage"]>(async (id, stage) => { const prospect = state.workspace.crmProspects.find((item) => item.id === id); if (prospect) await updateProspect(id, { stage }); }, [state.workspace.crmProspects, updateProspect]);
  const convertProspectToClient = useCallback<AdminContextValue["convertProspectToClient"]>(async (id) => {
    const prospect = state.workspace.crmProspects.find((item) => item.id === id);
    if (!prospect) return { ok: false, error: "Prospect not found." };
    if (prospect.stage !== "Won") return { ok: false, error: "Only won prospects can be converted." };
    if (prospect.convertedClientId) return { ok: false, error: "This prospect is already converted." };
    const clientCode = `CL-${String(Date.now()).slice(-8)}`;
    let created: { id: string; client_code?: string | null; legal_name: string; status?: string };
    try { const response = await fetch("/api/admin/client-membership", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ legalName: prospect.company, clientCode }) }); const result = await response.json() as { client?: typeof created; error?: string }; if (!response.ok || !result.client) return { ok: false, error: result.error ?? "Unable to create the client account." }; created = result.client; if (prospect.ownerEmployeeId) { const assignment = await fetch("/api/admin/employee-client-assignment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: created.id, employeeId: prospect.ownerEmployeeId }) }); if (!assignment.ok) return { ok: false, error: "Client was created but assignment could not be saved." }; } } catch { return { ok: false, error: "Unable to reach the client onboarding service." }; }
    const clientId = created.id; const updatedProspect = { ...prospect, convertedClientId: clientId };
    const relatedPersistence = await Promise.all([
      persistCrm("crm.prospect", id, prospect.company, updatedProspect),
      ...state.workspace.crmContacts.filter((row) => row.prospectId === id).map((row) => persistCrm("crm.contact", row.id, row.name, { ...row, prospectId: undefined, clientId }, clientId)),
      ...state.workspace.crmInteractions.filter((row) => row.prospectId === id).map((row) => persistCrm("crm.interaction", row.id, row.subject, { ...row, prospectId: undefined, clientId }, clientId)),
      ...state.workspace.crmFollowUps.filter((row) => row.prospectId === id).map((row) => persistCrm("crm.followup", row.id, row.title, { ...row, prospectId: undefined, clientId }, clientId)),
      ...state.workspace.crmNotes.filter((row) => row.prospectId === id).map((row) => persistCrm("crm.note", row.id, "CRM note", { ...row, prospectId: undefined, clientId }, clientId)),
    ]);
    if (!relatedPersistence.every(Boolean)) return { ok: false, clientId, error: "Client was created, but one or more CRM records could not be linked. Refresh before retrying." };
    commit((current) => {
      const workspace = { ...current.workspace, crmProspects: current.workspace.crmProspects.map((item) => item.id === id ? updatedProspect : item), crmContacts: current.workspace.crmContacts.map((item) => item.prospectId === id ? { ...item, prospectId: undefined, clientId } : item), crmInteractions: current.workspace.crmInteractions.map((item) => item.prospectId === id ? { ...item, prospectId: undefined, clientId } : item), crmFollowUps: current.workspace.crmFollowUps.map((item) => item.prospectId === id ? { ...item, prospectId: undefined, clientId } : item), crmNotes: current.workspace.crmNotes.map((item) => item.prospectId === id ? { ...item, prospectId: undefined, clientId } : item) };
      return { ...current, clients: [{ id: created.id, code: created.client_code ?? clientCode, name: created.legal_name, city: "Pending setup", status: created.status === "active" ? "Active" as const : "On hold" as const, onboardedByEmployeeId: prospect.ownerEmployeeId, assignedToEmployeeId: prospect.ownerEmployeeId, shipmentVolume: 0, openTickets: 0, lastActivity: "Just now" }, ...current.clients], workspace };
    });
    emitAdminToast(`${prospect.company} was converted into a client.`, "success");
    return { ok: true, clientId };
  }, [commit, persistCrm, state.workspace.crmContacts, state.workspace.crmFollowUps, state.workspace.crmInteractions, state.workspace.crmNotes, state.workspace.crmProspects]);
  const createCrmContact = useCallback<AdminContextValue["createCrmContact"]>(async (input) => { const id = `crm-contact-${Date.now()}`; const contact = { ...input, id }; if (!await persistCrm("crm.contact", id, input.name, contact, input.clientId)) return false; commitCrm("Created CRM contact", (workspace) => ({ ...workspace, crmContacts: [contact, ...workspace.crmContacts] }), input.clientId ?? input.prospectId ?? "crm", input.name); return true; }, [commitCrm, persistCrm]);
  const updateCrmContact = useCallback<AdminContextValue["updateCrmContact"]>(async (id, input) => { const current = state.workspace.crmContacts.find((item) => item.id === id); if (!current) return false; const next = { ...current, ...input }; if (!await persistCrm("crm.contact", id, next.name, next, next.clientId)) return false; commitCrm("Updated CRM contact", (workspace) => ({ ...workspace, crmContacts: workspace.crmContacts.map((item) => item.id === id ? next : item) }), id, next.name); return true; }, [commitCrm, persistCrm, state.workspace.crmContacts]);
  const setPrimaryCrmContact = useCallback<AdminContextValue["setPrimaryCrmContact"]>(async (id) => { const contact = state.workspace.crmContacts.find((item) => item.id === id); if (!contact) return false; const key = contact.clientId ? "clientId" : "prospectId"; const nextRows = state.workspace.crmContacts.map((item) => item[key] === contact[key] ? { ...item, isPrimary: item.id === id } : item); const rows = nextRows.filter((item) => item[key] === contact[key]); if (!(await Promise.all(rows.map((row) => persistCrm("crm.contact", row.id, row.name, row, row.clientId))).then((results) => results.every(Boolean)))) return false; commitCrm("Set primary CRM contact", (workspace) => ({ ...workspace, crmContacts: nextRows }), id, contact.name, "Info"); return true; }, [commitCrm, persistCrm, state.workspace.crmContacts]);
  const createCrmInteraction = useCallback<AdminContextValue["createCrmInteraction"]>(async (input) => { const id = `crm-interaction-${Date.now()}`; const interaction = { ...input, id, timestamp: new Date().toISOString() }; if (!await persistCrm("crm.interaction", id, input.subject, interaction, input.clientId)) return false; commitCrm("Added CRM interaction", (workspace) => ({ ...workspace, crmInteractions: [interaction, ...workspace.crmInteractions] }), input.clientId ?? input.prospectId ?? "crm", input.subject, "Info"); return true; }, [commitCrm, persistCrm]);
  const createCrmNote = useCallback<AdminContextValue["createCrmNote"]>(async (input) => { const id = `crm-note-${Date.now()}`; const note = { ...input, id, timestamp: new Date().toISOString() }; if (!await persistCrm("crm.note", id, "CRM note", note, input.clientId)) return false; commitCrm("Added CRM note", (workspace) => ({ ...workspace, crmNotes: [note, ...workspace.crmNotes] }), input.clientId ?? input.prospectId ?? "crm", "CRM note", "Info"); return true; }, [commitCrm, persistCrm]);
  const createCrmFollowUp = useCallback<AdminContextValue["createCrmFollowUp"]>(async (input) => { const id = `crm-followup-${Date.now()}`; const followUp = { ...input, id }; if (!await persistCrm("crm.followup", id, input.title, followUp, input.clientId)) return false; commitCrm("Created CRM follow-up", (workspace) => ({ ...workspace, crmFollowUps: [followUp, ...workspace.crmFollowUps] }), input.clientId ?? input.prospectId ?? "crm", input.title); return true; }, [commitCrm, persistCrm]);
  const updateCrmFollowUpStatus = useCallback<AdminContextValue["updateCrmFollowUpStatus"]>(async (id, status) => { const followUp = state.workspace.crmFollowUps.find((item) => item.id === id); if (!followUp) return false; const next = { ...followUp, status }; if (!await persistCrm("crm.followup", id, followUp.title, next, next.clientId)) return false; commitCrm(`Marked follow-up ${status.toLowerCase()}`, (workspace) => ({ ...workspace, crmFollowUps: workspace.crmFollowUps.map((item) => item.id === id ? next : item) }), id, followUp.title, "Info"); return true; }, [commitCrm, persistCrm, state.workspace.crmFollowUps]);
  const snoozeCrmFollowUp = useCallback<AdminContextValue["snoozeCrmFollowUp"]>(async (id, dueDate) => { const followUp = state.workspace.crmFollowUps.find((item) => item.id === id); if (!followUp) return false; const next = { ...followUp, status: "Snoozed" as const, dueDate }; if (!await persistCrm("crm.followup", id, followUp.title, next, next.clientId)) return false; commitCrm("Snoozed CRM follow-up", (workspace) => ({ ...workspace, crmFollowUps: workspace.crmFollowUps.map((item) => item.id === id ? next : item) }), id, followUp.title, "Info"); return true; }, [commitCrm, persistCrm, state.workspace.crmFollowUps]);
  const updateClientRelationshipHealth = useCallback<AdminContextValue["updateClientRelationshipHealth"]>(async (clientId, health) => { const note = { id: `crm-note-${Date.now()}`, clientId, content: `Relationship health changed to ${health}.`, authorEmployeeId: "authenticated-user", timestamp: new Date().toISOString() }; if (!await persistCrm("crm.health", clientId, "Relationship health", { clientId, health })) return false; if (!await persistCrm("crm.note", note.id, "CRM note", note, clientId)) return false; commitCrm("Updated client relationship health", (workspace) => ({ ...workspace, crmClientHealth: { ...workspace.crmClientHealth, [clientId]: health }, crmNotes: [note, ...workspace.crmNotes] }), clientId, health, health === "At risk" ? "Security" : "Info"); return true; }, [commitCrm, persistCrm]);

  const value = useMemo(() => ({ ...state, permissionCatalog, hydrated, employeeLoadError, workspaceLoadError, createEmployee, updateEmployee, toggleEmployeeStatus, setPermissionOverride, toggleRolePermission, assignClient, mutateWorkspace, createProspect, updateProspect, updateProspectStage, convertProspectToClient, createCrmContact, updateCrmContact, setPrimaryCrmContact, createCrmInteraction, createCrmNote, createCrmFollowUp, updateCrmFollowUpStatus, snoozeCrmFollowUp, updateClientRelationshipHealth, refreshEmployees, refreshRoles }), [state, permissionCatalog, hydrated, employeeLoadError, workspaceLoadError, createEmployee, updateEmployee, toggleEmployeeStatus, setPermissionOverride, toggleRolePermission, assignClient, mutateWorkspace, createProspect, updateProspect, updateProspectStage, convertProspectToClient, createCrmContact, updateCrmContact, setPrimaryCrmContact, createCrmInteraction, createCrmNote, createCrmFollowUp, updateCrmFollowUpStatus, snoozeCrmFollowUp, updateClientRelationshipHealth, refreshEmployees, refreshRoles]);
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdmin must be used within AdminProvider");
  return context;
}
