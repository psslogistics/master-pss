import type { AdminState, AuditEvent, Client, Employee, PermissionKey, Role } from "@/lib/admin-domain";

// Frontend-only fixture boundary. Replace this file with API adapters later.
export const demoRoles: Role[] = [
  { id: "role-super", name: "Super Admin", description: "Unrestricted organization control.", department: "Leadership", permissionKeys: [], color: "navy" },
  { id: "role-ops", name: "Operations Executive", description: "Bookings, tracking, pickups, and assigned clients.", department: "Operations", color: "blue", permissionKeys: ["dashboard.view", "clients.view", "shipments.view", "shipments.create", "shipments.edit", "tracking.view", "tracking.update", "pickup.view", "pickup.create", "tickets.view", "tickets.reply", "tickets.close"] },
  { id: "role-crm", name: "Client Relationship Manager", description: "Client ownership and support coordination.", department: "Client Success", color: "violet", permissionKeys: ["dashboard.view", "clients.view", "clients.create", "clients.edit", "tickets.view", "tickets.reply", "tickets.close", "reports.view"] },
  { id: "role-finance", name: "Finance Executive", description: "Billing, invoices, and finance reporting.", department: "Finance", color: "emerald", permissionKeys: ["dashboard.view", "clients.view", "billing.view", "billing.create", "reports.view", "reports.export"] },
  { id: "role-support", name: "Support Executive", description: "Assigned support queue and client response.", department: "Support", color: "amber", permissionKeys: ["dashboard.view", "clients.view", "tickets.view", "tickets.reply", "tickets.close"] },
];

export const demoEmployees: Employee[] = [
  { id: "emp-admin", employeeCode: "EMP-0001", name: "Gaurav Sharma", email: "admin@psslogistics.in", phone: "+91 98765 00101", department: "Leadership", roleId: "role-super", workspaceSlug: "admin", status: "Active", lastActive: "Now", joinedAt: "2024-01-12", permissionOverrides: [], isSuperAdmin: true },
  { id: "emp-rahul", employeeCode: "EMP-0018", name: "Rahul Sharma", email: "rahul@psslogistics.in", phone: "+91 98765 00118", department: "Operations", roleId: "role-ops", workspaceSlug: "rahul", status: "Active", lastActive: "8 min ago", joinedAt: "2025-03-18", permissionOverrides: [{ permissionKey: "billing.view", mode: "grant" }] },
  { id: "emp-ananya", employeeCode: "EMP-0021", name: "Ananya Mehta", email: "ananya@psslogistics.in", phone: "+91 98765 00121", department: "Client Success", roleId: "role-crm", workspaceSlug: "ananya", status: "Active", lastActive: "24 min ago", joinedAt: "2025-06-02", permissionOverrides: [] },
  { id: "emp-vikram", employeeCode: "EMP-0025", name: "Vikram Rao", email: "vikram@psslogistics.in", phone: "+91 98765 00125", department: "Finance", roleId: "role-finance", workspaceSlug: "vikram", status: "Active", lastActive: "1 hr ago", joinedAt: "2025-09-14", permissionOverrides: [{ permissionKey: "billing.approve", mode: "grant" }] },
  { id: "emp-sana", employeeCode: "EMP-0032", name: "Sana Khan", email: "sana@psslogistics.in", phone: "+91 98765 00132", department: "Support", roleId: "role-support", workspaceSlug: "sana", status: "Invited", lastActive: "Never", joinedAt: "2026-08-10", permissionOverrides: [] },
];

export const demoClients: Client[] = [
  { id: "client-1", code: "CL-1042", name: "Arvind Components Pvt Ltd", city: "Gurugram", status: "Active", onboardedByEmployeeId: "emp-ananya", assignedToEmployeeId: "emp-rahul", shipmentVolume: 184, openTickets: 1, lastActivity: "12 min ago" },
  { id: "client-2", code: "CL-1038", name: "BlueStone Retail", city: "Bengaluru", status: "Active", onboardedByEmployeeId: "emp-ananya", assignedToEmployeeId: "emp-rahul", shipmentVolume: 132, openTickets: 2, lastActivity: "31 min ago" },
  { id: "client-3", code: "CL-1026", name: "Kaveri Textiles", city: "Surat", status: "Active", onboardedByEmployeeId: "emp-rahul", assignedToEmployeeId: "emp-ananya", shipmentVolume: 96, openTickets: 0, lastActivity: "2 hrs ago" },
  { id: "client-4", code: "CL-1019", name: "Northwind Pharma", city: "Mumbai", status: "On hold", onboardedByEmployeeId: "emp-ananya", assignedToEmployeeId: "emp-ananya", shipmentVolume: 74, openTickets: 3, lastActivity: "Yesterday" },
  { id: "client-5", code: "CL-1012", name: "Orion Auto Parts", city: "Pune", status: "Active", onboardedByEmployeeId: "emp-rahul", assignedToEmployeeId: "emp-rahul", shipmentVolume: 211, openTickets: 1, lastActivity: "3 hrs ago" },
  { id: "client-6", code: "CL-1007", name: "Jaipur Craft House", city: "Jaipur", status: "Active", onboardedByEmployeeId: "emp-ananya", assignedToEmployeeId: "emp-sana", shipmentVolume: 48, openTickets: 2, lastActivity: "5 hrs ago" },
];

export type TicketStatus = "Open" | "In progress" | "Waiting for client" | "Resolved" | "Closed" | "Escalated";
export interface DemoTicket { id: string; number: string; clientId: string; assignedToEmployeeId: string; subject: string; priority: "Urgent" | "High" | "Normal"; status: TicketStatus; createdAt: string; slaDueAt: string; escalatedAt?: string; shipmentReference?: string; lastMessage: string; }
export interface DemoTicketMessage { id: string; ticketId: string; author: string; role: "Client" | "Employee" | "System"; body: string; timestamp: string; }
export interface DemoAlert { id: string; title: string; detail: string; severity: "Critical" | "Warning" | "Review"; category: "SLA" | "Ownership" | "Security" | "Operations"; entityId: string; acknowledged: boolean; }
export interface DemoSettings { timezone: string; shipmentRetention: string; walletApprovalRequired: boolean; operationalAlerts: boolean; }

export const demoTickets: DemoTicket[] = [
  { id: "ticket-1", number: "TK-1042", clientId: "client-1", assignedToEmployeeId: "emp-rahul", subject: "Delivery attempt is missing from portal", priority: "High", status: "In progress", createdAt: "2026-08-12T08:30:00+05:30", slaDueAt: "2026-08-13T08:30:00+05:30", shipmentReference: "PSS-2026-004821", lastMessage: "The delivery attempt is still not visible in our portal." },
  { id: "ticket-2", number: "TK-1038", clientId: "client-2", assignedToEmployeeId: "emp-rahul", subject: "Pickup has not been confirmed", priority: "Urgent", status: "Escalated", createdAt: "2026-08-11T08:10:00+05:30", slaDueAt: "2026-08-12T08:10:00+05:30", escalatedAt: "2026-08-12T08:10:00+05:30", lastMessage: "Please confirm whether today's pickup is still scheduled." },
  { id: "ticket-3", number: "TK-1026", clientId: "client-4", assignedToEmployeeId: "emp-ananya", subject: "Request for KYC document status", priority: "Normal", status: "Waiting for client", createdAt: "2026-08-12T06:45:00+05:30", slaDueAt: "2026-08-13T06:45:00+05:30", lastMessage: "We have requested the missing authorization letter." },
];

export const demoTicketMessages: DemoTicketMessage[] = [
  { id: "message-1", ticketId: "ticket-1", author: "Northwind Pharma", role: "Client", body: "The delivery attempt is still not visible in our portal.", timestamp: "Today, 09:14" },
  { id: "message-2", ticketId: "ticket-1", author: "Rahul Sharma", role: "Employee", body: "I am checking the courier milestone and will update the shipment record.", timestamp: "Today, 09:32" },
  { id: "message-3", ticketId: "ticket-2", author: "System", role: "System", body: "Resolution SLA breached. Ticket escalated to Super Admin.", timestamp: "Today, 08:10" },
];

export const demoAlerts: DemoAlert[] = [
  { id: "alert-1", title: "SLA breach requires review", detail: "TK-1038 has exceeded its 24-hour resolution target.", severity: "Critical", category: "SLA", entityId: "ticket-2", acknowledged: false },
  { id: "alert-2", title: "Client ownership gap", detail: "Jaipur Craft House is assigned to an invited employee.", severity: "Warning", category: "Ownership", entityId: "client-6", acknowledged: false },
  { id: "alert-3", title: "New employee invitation pending", detail: "Sana Khan has not accepted the Support invitation.", severity: "Review", category: "Security", entityId: "emp-sana", acknowledged: false },
];

export const demoSettings: DemoSettings = { timezone: "Asia/Kolkata", shipmentRetention: "90 days", walletApprovalRequired: true, operationalAlerts: true };

export const demoAuditEvents: AuditEvent[] = [
  { id: "audit-1", actorEmployeeId: "emp-admin", action: "Granted permission", entityType: "Permission", entityId: "emp-rahul", entityLabel: "Rahul Sharma", timestamp: "2026-08-12T10:42:00+05:30", before: "Role permissions only", after: "billing.view granted", severity: "Important" },
  { id: "audit-2", actorEmployeeId: "emp-admin", action: "Transferred client", entityType: "Client", entityId: "client-1", entityLabel: "Arvind Components Pvt Ltd", timestamp: "2026-08-12T09:18:00+05:30", before: "Ananya Mehta", after: "Rahul Sharma", severity: "Important" },
  { id: "audit-3", actorEmployeeId: "emp-admin", action: "Escalated ticket", entityType: "Client", entityId: "ticket-2", entityLabel: "TK-1038 · BlueStone Retail", timestamp: "2026-08-12T08:10:00+05:30", before: "Assigned to Rahul Sharma", after: "Visible to Super Admin", severity: "Security" },
];

export const seedState: AdminState = { roles: demoRoles, employees: demoEmployees, clients: demoClients, auditEvents: demoAuditEvents };
export const employeeWorkspaceDomain = "psslogistics.in";
export const permissionGroups: Record<string, PermissionKey[]> = {
  baseline: ["dashboard.view", "tickets.view", "notifications.view"],
  operations: ["shipments.view", "shipments.create", "tracking.view", "pickup.view"],
  support: ["tickets.view", "tickets.reply", "tickets.close"],
};
