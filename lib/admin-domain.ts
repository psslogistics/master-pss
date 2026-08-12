export type PermissionKey =
  | "dashboard.view"
  | "alerts.view"
  | "clients.view"
  | "clients.create"
  | "clients.edit"
  | "clients.assign"
  | "clients.activity.view"
  | "shipments.view"
  | "shipments.create"
  | "shipments.edit"
  | "shipments.export"
  | "exceptions.view"
  | "tracking.view"
  | "tracking.update"
  | "pickup.view"
  | "pickup.create"
  | "pickup.assign"
  | "returns.view"
  | "tickets.view"
  | "tickets.reply"
  | "tickets.close"
  | "tickets.reassign"
  | "tickets.escalations.view"
  | "wallet.view"
  | "billing.view"
  | "billing.create"
  | "billing.approve"
  | "transactions.view"
  | "analytics.view"
  | "performance.view"
  | "reports.view"
  | "reports.export"
  | "employees.view"
  | "employees.create"
  | "employees.edit"
  | "employees.disable"
  | "departments.view"
  | "tasks.view"
  | "employee_activity.view"
  | "roles.view"
  | "roles.manage"
  | "automation.view"
  | "integrations.view"
  | "api_keys.view"
  | "security.view"
  | "notifications.view"
  | "settings.view"
  | "audit.view";

export type EmployeeStatus = "Active" | "Invited" | "Disabled";
export type OverrideMode = "grant" | "revoke";

export interface Permission {
  key: PermissionKey;
  label: string;
  description: string;
  group: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  department: string;
  permissionKeys: PermissionKey[];
  color: string;
}

export interface PermissionOverride {
  permissionKey: PermissionKey;
  mode: OverrideMode;
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  roleId: string;
  workspaceSlug: string;
  status: EmployeeStatus;
  lastActive: string;
  joinedAt: string;
  permissionOverrides: PermissionOverride[];
  isSuperAdmin?: boolean;
}

export interface Client {
  id: string;
  name: string;
  code: string;
  city: string;
  status: "Active" | "On hold";
  onboardedByEmployeeId: string;
  assignedToEmployeeId: string;
  shipmentVolume: number;
  openTickets: number;
  lastActivity: string;
}

export interface ClientAssignment {
  clientId: string;
  employeeId: string;
  assignedAt: string;
  assignedByEmployeeId: string;
}

export interface AuditEvent {
  id: string;
  actorEmployeeId: string;
  action: string;
  entityType: "Employee" | "Role" | "Client" | "Permission" | "Session";
  entityId: string;
  entityLabel: string;
  timestamp: string;
  before?: string;
  after?: string;
  severity: "Info" | "Important" | "Security";
}

export interface DashboardMetric {
  label: string;
  value: string;
  change: string;
  tone: "neutral" | "positive" | "warning" | "critical";
}

export interface DemoSession {
  employeeId: string;
  email: string;
  signedInAt: string;
}

export interface AdminState {
  employees: Employee[];
  roles: Role[];
  clients: Client[];
  auditEvents: AuditEvent[];
}

export interface EmployeeDraft {
  name: string;
  email: string;
  phone: string;
  department: string;
  roleId: string;
  workspaceSlug: string;
}

export const permissions: Permission[] = [
  { key: "dashboard.view", label: "View dashboard", description: "See assigned operational metrics.", group: "Overview" },
  { key: "alerts.view", label: "View alerts", description: "Review organization attention and alert queues.", group: "Overview" },
  { key: "clients.view", label: "View clients", description: "View clients within assigned data scope.", group: "Clients" },
  { key: "clients.create", label: "Create clients", description: "Onboard a new client account.", group: "Clients" },
  { key: "clients.edit", label: "Edit clients", description: "Update client business details.", group: "Clients" },
  { key: "clients.assign", label: "Assign clients", description: "Transfer operational client responsibility.", group: "Clients" },
  { key: "clients.activity.view", label: "View client activity", description: "Review unified client activity timelines.", group: "Clients" },
  { key: "shipments.view", label: "View shipments", description: "View shipments in assigned scope.", group: "Operations" },
  { key: "shipments.create", label: "Create bookings", description: "Create single and bulk bookings.", group: "Operations" },
  { key: "shipments.edit", label: "Edit shipments", description: "Update shipment records.", group: "Operations" },
  { key: "shipments.export", label: "Export shipments", description: "Export operational shipment data.", group: "Operations" },
  { key: "exceptions.view", label: "View exceptions", description: "Review operational holds, delays, and failures.", group: "Operations" },
  { key: "tracking.view", label: "View tracking", description: "View tracking milestones.", group: "Operations" },
  { key: "tracking.update", label: "Update tracking", description: "Add tracking actions and notes.", group: "Operations" },
  { key: "pickup.view", label: "View pickups", description: "View scheduled pickup requests.", group: "Operations" },
  { key: "pickup.create", label: "Create pickups", description: "Schedule a pickup request.", group: "Operations" },
  { key: "pickup.assign", label: "Assign pickups", description: "Assign pickup ownership.", group: "Operations" },
  { key: "returns.view", label: "View returns", description: "Review RTO movement and document readiness.", group: "Operations" },
  { key: "tickets.view", label: "View tickets", description: "View assigned support tickets.", group: "Support" },
  { key: "tickets.reply", label: "Reply to tickets", description: "Respond to assigned clients.", group: "Support" },
  { key: "tickets.close", label: "Resolve tickets", description: "Resolve or close support tickets.", group: "Support" },
  { key: "tickets.reassign", label: "Reassign tickets", description: "Transfer ticket responsibility.", group: "Support" },
  { key: "tickets.escalations.view", label: "View SLA escalations", description: "Review due-soon and breached support commitments.", group: "Support" },
  { key: "wallet.view", label: "View wallets", description: "Review client wallet balances and adjustments.", group: "Finance" },
  { key: "billing.view", label: "View billing", description: "View client billing records.", group: "Finance" },
  { key: "billing.create", label: "Create invoices", description: "Prepare invoices and adjustments.", group: "Finance" },
  { key: "billing.approve", label: "Approve billing", description: "Approve finance transactions.", group: "Finance" },
  { key: "transactions.view", label: "View transactions", description: "Review wallet and billing transaction history.", group: "Finance" },
  { key: "analytics.view", label: "View analytics", description: "Review organization operational analytics.", group: "Insights" },
  { key: "performance.view", label: "View performance", description: "Review client, employee, courier, and SLA scorecards.", group: "Insights" },
  { key: "reports.view", label: "View reports", description: "View organization reports.", group: "Insights" },
  { key: "reports.export", label: "Export reports", description: "Export report data.", group: "Insights" },
  { key: "employees.view", label: "View employees", description: "View the employee directory.", group: "Organization" },
  { key: "employees.create", label: "Create employees", description: "Invite internal employees.", group: "Organization" },
  { key: "employees.edit", label: "Edit employees", description: "Update employee identity and access.", group: "Organization" },
  { key: "employees.disable", label: "Disable employees", description: "Suspend employee access.", group: "Organization" },
  { key: "departments.view", label: "View departments", description: "Review department structure and capacity.", group: "Organization" },
  { key: "tasks.view", label: "View all tasks", description: "Review employee work across the organization.", group: "Organization" },
  { key: "employee_activity.view", label: "View employee activity", description: "Review employee workspace activity.", group: "Organization" },
  { key: "roles.view", label: "View roles", description: "Review roles and permissions.", group: "Organization" },
  { key: "roles.manage", label: "Manage roles", description: "Change reusable role permissions.", group: "Organization" },
  { key: "automation.view", label: "View automation", description: "Review workflow rules and scheduled jobs.", group: "Platform" },
  { key: "integrations.view", label: "View integrations", description: "Review courier and communication integrations.", group: "Platform" },
  { key: "api_keys.view", label: "View API keys", description: "Review external credentials and webhook endpoints.", group: "Platform" },
  { key: "security.view", label: "View security", description: "Review authentication risk and active sessions.", group: "System" },
  { key: "notifications.view", label: "View notifications", description: "Review administrative notifications.", group: "System" },
  { key: "settings.view", label: "View platform settings", description: "Review organization-wide platform configuration.", group: "System" },
  { key: "audit.view", label: "View audit log", description: "Inspect critical change history.", group: "System" },
];

export const seedState: AdminState = {
  roles: [
    { id: "role-super", name: "Super Admin", description: "Unrestricted organization control.", department: "Leadership", permissionKeys: [], color: "navy" },
    { id: "role-ops", name: "Operations Executive", description: "Bookings, tracking, pickups, and assigned clients.", department: "Operations", color: "blue", permissionKeys: ["dashboard.view", "clients.view", "shipments.view", "shipments.create", "shipments.edit", "tracking.view", "tracking.update", "pickup.view", "pickup.create", "tickets.view", "tickets.reply", "tickets.close"] },
    { id: "role-crm", name: "Client Relationship Manager", description: "Client ownership and support coordination.", department: "Client Success", color: "violet", permissionKeys: ["dashboard.view", "clients.view", "clients.create", "clients.edit", "tickets.view", "tickets.reply", "tickets.close", "reports.view"] },
    { id: "role-finance", name: "Finance Executive", description: "Billing, invoices, and finance reporting.", department: "Finance", color: "emerald", permissionKeys: ["dashboard.view", "clients.view", "billing.view", "billing.create", "reports.view", "reports.export"] },
    { id: "role-support", name: "Support Executive", description: "Assigned support queue and client response.", department: "Support", color: "amber", permissionKeys: ["dashboard.view", "clients.view", "tickets.view", "tickets.reply", "tickets.close"] },
  ],
  employees: [
    { id: "emp-admin", employeeCode: "EMP-0001", name: "Gaurav Sharma", email: "admin@psslogistics.in", phone: "+91 98765 00101", department: "Leadership", roleId: "role-super", workspaceSlug: "admin", status: "Active", lastActive: "Now", joinedAt: "2024-01-12", permissionOverrides: [], isSuperAdmin: true },
    { id: "emp-rahul", employeeCode: "EMP-0018", name: "Rahul Sharma", email: "rahul@psslogistics.in", phone: "+91 98765 00118", department: "Operations", roleId: "role-ops", workspaceSlug: "rahul", status: "Active", lastActive: "8 min ago", joinedAt: "2025-03-18", permissionOverrides: [{ permissionKey: "billing.view", mode: "grant" }] },
    { id: "emp-ananya", employeeCode: "EMP-0021", name: "Ananya Mehta", email: "ananya@psslogistics.in", phone: "+91 98765 00121", department: "Client Success", roleId: "role-crm", workspaceSlug: "ananya", status: "Active", lastActive: "24 min ago", joinedAt: "2025-06-02", permissionOverrides: [] },
    { id: "emp-vikram", employeeCode: "EMP-0025", name: "Vikram Rao", email: "vikram@psslogistics.in", phone: "+91 98765 00125", department: "Finance", roleId: "role-finance", workspaceSlug: "vikram", status: "Active", lastActive: "1 hr ago", joinedAt: "2025-09-14", permissionOverrides: [{ permissionKey: "billing.approve", mode: "grant" }] },
    { id: "emp-sana", employeeCode: "EMP-0032", name: "Sana Khan", email: "sana@psslogistics.in", phone: "+91 98765 00132", department: "Support", roleId: "role-support", workspaceSlug: "sana", status: "Invited", lastActive: "Never", joinedAt: "2026-08-10", permissionOverrides: [] },
  ],
  clients: [
    { id: "client-1", code: "CL-1042", name: "Arvind Components Pvt Ltd", city: "Gurugram", status: "Active", onboardedByEmployeeId: "emp-ananya", assignedToEmployeeId: "emp-rahul", shipmentVolume: 184, openTickets: 1, lastActivity: "12 min ago" },
    { id: "client-2", code: "CL-1038", name: "BlueStone Retail", city: "Bengaluru", status: "Active", onboardedByEmployeeId: "emp-ananya", assignedToEmployeeId: "emp-rahul", shipmentVolume: 132, openTickets: 2, lastActivity: "31 min ago" },
    { id: "client-3", code: "CL-1026", name: "Kaveri Textiles", city: "Surat", status: "Active", onboardedByEmployeeId: "emp-rahul", assignedToEmployeeId: "emp-ananya", shipmentVolume: 96, openTickets: 0, lastActivity: "2 hrs ago" },
    { id: "client-4", code: "CL-1019", name: "Northwind Pharma", city: "Mumbai", status: "On hold", onboardedByEmployeeId: "emp-ananya", assignedToEmployeeId: "emp-ananya", shipmentVolume: 74, openTickets: 3, lastActivity: "Yesterday" },
    { id: "client-5", code: "CL-1012", name: "Orion Auto Parts", city: "Pune", status: "Active", onboardedByEmployeeId: "emp-rahul", assignedToEmployeeId: "emp-rahul", shipmentVolume: 211, openTickets: 1, lastActivity: "3 hrs ago" },
    { id: "client-6", code: "CL-1007", name: "Jaipur Craft House", city: "Jaipur", status: "Active", onboardedByEmployeeId: "emp-ananya", assignedToEmployeeId: "emp-sana", shipmentVolume: 48, openTickets: 2, lastActivity: "5 hrs ago" },
  ],
  auditEvents: [
    { id: "audit-1", actorEmployeeId: "emp-admin", action: "Granted permission", entityType: "Permission", entityId: "emp-rahul", entityLabel: "Rahul Sharma", timestamp: "2026-08-12T10:42:00+05:30", before: "Role permissions only", after: "billing.view granted", severity: "Important" },
    { id: "audit-2", actorEmployeeId: "emp-admin", action: "Transferred client", entityType: "Client", entityId: "client-1", entityLabel: "Arvind Components Pvt Ltd", timestamp: "2026-08-12T09:18:00+05:30", before: "Ananya Mehta", after: "Rahul Sharma", severity: "Important" },
    { id: "audit-3", actorEmployeeId: "emp-vikram", action: "Approved billing adjustment", entityType: "Client", entityId: "client-2", entityLabel: "BlueStone Retail", timestamp: "2026-08-11T17:36:00+05:30", before: "Pending", after: "Approved", severity: "Info" },
    { id: "audit-4", actorEmployeeId: "emp-admin", action: "Created employee", entityType: "Employee", entityId: "emp-sana", entityLabel: "Sana Khan", timestamp: "2026-08-10T15:12:00+05:30", after: "Support Executive · Invited", severity: "Security" },
    { id: "audit-5", actorEmployeeId: "emp-admin", action: "Revoked all sessions", entityType: "Session", entityId: "emp-vikram", entityLabel: "Vikram Rao", timestamp: "2026-08-09T11:08:00+05:30", severity: "Security" },
  ],
};

export function isSuperAdmin(employee: Employee | undefined) {
  return employee?.isSuperAdmin === true;
}

export function getEffectivePermissions(employee: Employee, role: Role | undefined) {
  if (isSuperAdmin(employee)) return new Set<PermissionKey>(permissions.map((permission) => permission.key));
  const effective = new Set<PermissionKey>(role?.permissionKeys ?? []);
  employee.permissionOverrides.forEach((override) => {
    if (override.mode === "grant") effective.add(override.permissionKey);
    else effective.delete(override.permissionKey);
  });
  return effective;
}

export function can(employee: Employee | undefined, role: Role | undefined, permission: PermissionKey) {
  return employee ? getEffectivePermissions(employee, role).has(permission) : false;
}

export function getAssignedClientScope(clients: Client[], employeeId: string) {
  return clients.filter((client) => client.assignedToEmployeeId === employeeId);
}

export function makeWorkspaceSlug(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function nextEmployeeCode(employees: Employee[]) {
  const maximum = Math.max(...employees.map((employee) => Number(employee.employeeCode.replace("EMP-", ""))), 0);
  return `EMP-${String(maximum + 1).padStart(4, "0")}`;
}
