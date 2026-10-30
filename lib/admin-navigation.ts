import type { IconName } from "@/lib/iconography";
import type { PermissionKey } from "@/lib/admin-domain";

export type AdminModuleStatus = "live" | "reference" | "planned";

export interface AdminNavItem {
  href: string;
  label: string;
  description: string;
  icon: IconName;
  requiredPermission: PermissionKey;
  status: AdminModuleStatus;
  capabilities: string[];
  searchKeywords: string[];
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export function serializeAdminNavItem(item: AdminNavItem): Omit<AdminNavItem, "icon"> {
  return { href: item.href, label: item.label, description: item.description, requiredPermission: item.requiredPermission, status: item.status, capabilities: item.capabilities, searchKeywords: item.searchKeywords };
}

const item = (input: AdminNavItem) => input;

export const adminNavGroups: AdminNavGroup[] = [
  { label: "Overview", items: [
    item({ href: "/dashboard", label: "Control Center", description: "Organization-wide authority, risk, ownership, and operational health.", icon: "dashboard", requiredPermission: "dashboard.view", status: "live", capabilities: ["Administrative action queue", "Organization control posture", "Operational health context"], searchKeywords: ["dashboard", "overview", "attention"] }),
    item({ href: "/alerts-attention", label: "Alerts & Attention", description: "One prioritized queue for critical operational and administrative events.", icon: "attention", requiredPermission: "alerts.view", status: "live", capabilities: ["Critical alerts", "Ownership exceptions", "Acknowledgement and delegation"], searchKeywords: ["alerts", "attention", "critical", "notification"] }),
  ] },
  { label: "Operations", items: [
    item({ href: "/operations/shipments", label: "All Shipments", description: "Organization-wide shipment register across every client and courier.", icon: "shipments", requiredPermission: "shipments.view", status: "live", capabilities: ["Global shipment search", "Client and owner scope", "Bulk export and exception context"], searchKeywords: ["shipments", "consignment", "awb"] }),
    item({ href: "/operations/bookings", label: "Bookings", description: "Create a single client-context Delhivery B2B shipment with invoice or challan and e-way bill checks.", icon: "bookings", requiredPermission: "shipments.create", status: "live", capabilities: ["Single shipment booking", "Client and courier selection", "Invoice, challan, and e-way bill validation"], searchKeywords: ["booking", "create shipment", "invoice", "eway bill"] }),
    item({ href: "/operations/tracking", label: "Tracking", description: "Search a shipment and inspect provider-reconciled milestones and shipment history.", icon: "tracking", requiredPermission: "tracking.view", status: "live", capabilities: ["LR, AWB, PUR, and PSS reference search", "Provider tracking refresh", "Read-only tracking timeline"], searchKeywords: ["tracking", "milestones", "status", "lr", "awb"] }),
    item({ href: "/operations/pickups", label: "Pickups", description: "Review and manage scheduled, standalone, failed, and unassigned pickup requests.", icon: "pickups", requiredPermission: "pickup.view", status: "live", capabilities: ["Pickup request register", "Assignment and scheduling", "Provider status and failure details"], searchKeywords: ["pickup", "assignment", "schedule"] }),
    item({ href: "/operations/returns", label: "Returns / RTO", description: "Review return requests and their linked shipment references.", icon: "returns", requiredPermission: "returns.view", status: "live", capabilities: ["Return request register", "Linked shipment context", "Request lifecycle status"], searchKeywords: ["returns", "rto", "reverse"] }),
    item({ href: "/operations/exceptions", label: "Exceptions", description: "Review shipment exceptions, assign an owner, and record resolution.", icon: "exceptions", requiredPermission: "exceptions.view", status: "live", capabilities: ["Exception register", "Owner assignment", "Resolve an exception"], searchKeywords: ["exceptions", "delay", "hold", "failed"] }),
  ] },
  { label: "Clients", items: [
    item({ href: "/clients", label: "All Clients", description: "Master client directory with risk, activity, ownership, and commercial context.", icon: "clients", requiredPermission: "clients.view", status: "live", capabilities: ["Client directory", "Account health", "Audited client workspace access"], searchKeywords: ["clients", "accounts", "customers"] }),
    item({ href: "/clients/onboarding", label: "Onboarding & KYC", description: "Start client drafts, review identity documents, and classify test or production client identities.", icon: "onboarding", requiredPermission: "clients.create", status: "live", capabilities: ["Create onboarding drafts", "GSTIN and PAN review", "Audited test or production identity classification"], searchKeywords: ["onboarding", "kyc", "gst", "pan", "test client"] }),
    item({ href: "/client-assignments", label: "Client Assignments", description: "Review current client owners and transfer operational responsibility.", icon: "assignments", requiredPermission: "clients.assign", status: "live", capabilities: ["Current owner directory", "Ownership transfer", "Recorded transfer history"], searchKeywords: ["assignment", "ownership", "transfer"] }),
    item({ href: "/rate-cards", label: "Rate Cards", description: "Upload and replace the current commercial rate card for each client.", icon: "billing", requiredPermission: "rate_cards.manage", status: "live", capabilities: ["Private file storage", "Client-scoped ownership", "Audited replacement"], searchKeywords: ["rate card", "pricing", "xlsx", "pdf"] }),
    item({ href: "/data-imports", label: "Data Imports", description: "Stage, validate, publish, and audit monthly operational datasets.", icon: "billing", requiredPermission: "rate_cards.manage", status: "live", capabilities: ["Versioned imports", "Atomic publication", "Private source retention"], searchKeywords: ["data", "import", "pincode", "oda", "csv", "monthly"] }),
    item({ href: "/pricing", label: "Client Pricing", description: "Publish PSS-controlled Delhivery B2B billing rules for each client.", icon: "billing", requiredPermission: "rate_cards.manage", status: "live", capabilities: ["Client-scoped pricing", "Configurable surcharges", "Versioned publication"], searchKeywords: ["client pricing", "delhivery", "b2b", "surcharge"] }),
    item({ href: "/client-user-access", label: "Client User Access", description: "Review and govern authenticated client users and their workspace memberships.", icon: "assignments", requiredPermission: "admin.client_users.view", status: "live", capabilities: ["Paginated authenticated client user directory", "All workspace memberships and status", "Audited membership assignment and suspension"], searchKeywords: ["client user", "membership", "access"] }),
    item({ href: "/clients/activity", label: "Client Activity", description: "Inspect recent activity events recorded by the operational Worker.", icon: "clientActivity", requiredPermission: "clients.activity.view", status: "live", capabilities: ["Worker-recorded activity feed", "Actor and entity context", "Paginated event history"], searchKeywords: ["client activity", "timeline", "history"] }),
  ] },
  { label: "CRM", items: [
    item({ href: "/crm", label: "CRM", description: "Manage client relationships, prospects, contacts, interactions, and follow-ups.", icon: "conversation", requiredPermission: "crm.view", status: "live", capabilities: ["Client relationship health", "Prospect pipeline", "Contacts and follow-ups"], searchKeywords: ["crm", "relationship", "prospects", "contacts", "follow ups", "pipeline"] }),
  ] },
  { label: "Organization", items: [
    item({ href: "/employees", label: "Employees", description: "Manage employee identity, status, workspace, role, and client coverage.", icon: "employees", requiredPermission: "employees.view", status: "live", capabilities: ["Employee lifecycle", "Workspace identity", "Access and assignment detail"], searchKeywords: ["employees", "staff", "workspace"] }),
    item({ href: "/departments", label: "Departments", description: "Define organizational ownership, managers, and functional capacity.", icon: "departments", requiredPermission: "departments.view", status: "live", capabilities: ["Department directory", "Manager assignment", "Capacity and access boundaries"], searchKeywords: ["departments", "teams", "managers"] }),
    item({ href: "/roles-permissions", label: "Roles & Permissions", description: "Manage reusable roles and granular action-based access.", icon: "roles", requiredPermission: "roles.view", status: "live", capabilities: ["Role permission matrix", "Super Admin bypass", "Employee override coverage"], searchKeywords: ["roles", "permissions", "rbac", "access"] }),
    item({ href: "/tasks", label: "Task Oversight", description: "Monitor and reassign operational work across employees and clients.", icon: "tasks", requiredPermission: "tasks.view", status: "live", capabilities: ["All employee tasks", "Overdue work", "Assignment and priority control"], searchKeywords: ["tasks", "workload", "overdue"] }),
    item({ href: "/employee-activity", label: "Employee Activity", description: "Inspect recent activity events recorded by the operational Worker.", icon: "employeeActivity", requiredPermission: "employee_activity.view", status: "live", capabilities: ["Worker-recorded activity feed", "Actor and entity context", "Paginated event history"], searchKeywords: ["employee activity", "work history", "actions"] }),
  ] },
  { label: "Support", items: [
    item({ href: "/support/tickets", label: "Tickets", description: "Organization-wide support desk with client and employee ownership.", icon: "support", requiredPermission: "tickets.view", status: "live", capabilities: ["All ticket conversations", "Client and shipment context", "Resolve and reassign actions"], searchKeywords: ["tickets", "support", "conversation"] }),
    item({ href: "/support/sla-escalations", label: "SLA & Escalations", description: "Monitor ticket deadlines, overdue work, and escalated support commitments.", icon: "sla", requiredPermission: "tickets.escalations.view", status: "live", capabilities: ["Ticket deadline monitoring", "Overdue and unassigned queue", "Escalation state and owner"], searchKeywords: ["sla", "escalations", "breach", "due"] }),
  ] },
  { label: "Finance", items: [
    item({ href: "/finance/wallets", label: "Wallets", description: "Review client balances, adjustments, holds, and wallet controls.", icon: "wallets", requiredPermission: "wallet.view", status: "live", capabilities: ["Client wallet balances", "Credit and debit controls", "Adjustment approval history"], searchKeywords: ["wallet", "balance", "credit", "debit"] }),
    item({ href: "/finance/billing-invoices", label: "Billing & Invoices", description: "Manage invoice lifecycle, billing adjustments, and approval exposure.", icon: "billing", requiredPermission: "billing.view", status: "live", capabilities: ["Invoice register", "Billing approval queue", "Outstanding and on-hold accounts"], searchKeywords: ["billing", "invoice", "outstanding"] }),
    item({ href: "/finance/transactions", label: "Transactions", description: "Inspect organization-wide wallet and billing transaction history.", icon: "transactions", requiredPermission: "transactions.view", status: "live", capabilities: ["Transaction ledger", "Reconciliation states", "Client and actor attribution"], searchKeywords: ["transactions", "payments", "ledger"] }),
    item({ href: "/finance/margins", label: "Profit Margins", description: "Compare what each client paid with the Delhivery cost for every shipment.", icon: "margins", requiredPermission: "admin.provider_cost.view", status: "live", capabilities: ["Shipment-level margin", "Client profitability", "Organization-wide totals"], searchKeywords: ["margin", "profit", "provider cost", "delhivery", "revenue"] }),
  ] },
  { label: "Reports & Insights", items: [
    item({ href: "/insights/analytics", label: "Analytics", description: "Operational analytics workspace is being completed; current generic records are not calculated analytics.", icon: "analytics", requiredPermission: "analytics.view", status: "planned", capabilities: ["Planned: authoritative operational metrics", "Planned: trend segmentation", "Planned: source-linked drill-down"], searchKeywords: ["analytics", "trends", "charts"] }),
    item({ href: "/insights/reports", label: "Reports", description: "Filter organization-wide shipment performance and export a source-backed report.", icon: "reports", requiredPermission: "reports.view", status: "live", capabilities: ["Client, status, date, and text filters", "Shipment status and delivery delay details", "Timestamped CSV export"], searchKeywords: ["reports", "export", "shipments", "delays"] }),
    item({ href: "/insights/performance", label: "Performance Center", description: "Performance metrics are being completed and will use source-backed scorecards.", icon: "performance", requiredPermission: "performance.view", status: "planned", capabilities: ["Planned: employee scorecards", "Planned: client and courier scorecards", "Planned: source-linked metrics"], searchKeywords: ["performance", "courier", "employee", "client"] }),
  ] },
  { label: "Integrations", items: [
    item({ href: "/integrations/couriers", label: "Courier Integrations", description: "Review configured courier capabilities, activation state, health, and client account access.", icon: "courierIntegrations", requiredPermission: "integrations.view", status: "live", capabilities: ["Provider capability and health state", "Activation blockers", "Client-level courier account access"], searchKeywords: ["courier", "api", "carrier"] }),
    item({ href: "/integrations/channels", label: "Communication Channels", description: "Coming soon: email, WhatsApp, and SMS delivery are not connected to production providers.", icon: "channels", requiredPermission: "integrations.view", status: "planned", capabilities: ["Planned: channel health", "Planned: sender configuration", "Planned: delivery failure monitoring"], searchKeywords: ["email", "whatsapp", "sms", "channels"] }),
    item({ href: "/integrations/api-webhooks", label: "API Keys & Webhooks", description: "Govern external API credentials, webhook endpoints, and access scope.", icon: "webhooks", requiredPermission: "api_keys.view", status: "live", capabilities: ["API key inventory", "Webhook delivery logs", "Rotation and revocation controls"], searchKeywords: ["api keys", "webhooks", "credentials"] }),
  ] },
  { label: "System", items: [
    item({ href: "/automation/workflow-rules", label: "Workflow Rules", description: "Rule execution is not connected to the production rule engine yet.", icon: "workflow", requiredPermission: "automation.view", status: "planned", capabilities: ["Planned: rule engine integration", "Planned: trigger validation", "Planned: execution history"], searchKeywords: ["workflow", "rules", "routing"] }),
    item({ href: "/automation/notification-rules", label: "Notification Rules", description: "Notification routing is not connected to a production rule engine yet.", icon: "notificationRules", requiredPermission: "automation.view", status: "planned", capabilities: ["Planned: event subscriptions", "Planned: recipient policies", "Planned: channel routing"], searchKeywords: ["notification rules", "alerts", "recipients"] }),
    item({ href: "/automation/scheduled-jobs", label: "Scheduled Jobs", description: "The production job registry and run controls are not connected yet.", icon: "scheduledJobs", requiredPermission: "automation.view", status: "planned", capabilities: ["Planned: job health", "Planned: run history and retries", "Planned: supported job controls"], searchKeywords: ["jobs", "scheduler", "worker", "cron"] }),
    item({ href: "/audit-logs", label: "Activity Logs", description: "Inspect the paginated activity feed from Worker operations and Super Admin audit events.", icon: "auditLogs", requiredPermission: "audit.view", status: "live", capabilities: ["Search within loaded events", "Actor and entity context", "Load older events from both sources"], searchKeywords: ["audit", "activity", "history"] }),
    item({ href: "/system/security-sessions", label: "Security & Sessions", description: "Monitor authentication risk, active sessions, and access reviews.", icon: "security", requiredPermission: "security.view", status: "live", capabilities: ["Active sessions", "Session revocation", "Authentication and access alerts"], searchKeywords: ["security", "sessions", "login"] }),
    item({ href: "/system/notifications", label: "Notifications", description: "Organization-wide administrative and operational notification center.", icon: "notifications", requiredPermission: "notifications.view", status: "live", capabilities: ["Priority alerts", "Read and acknowledgement state", "Category and entity filtering"], searchKeywords: ["notifications", "alerts", "unread"] }),
    item({ href: "/system/settings", label: "Platform Settings", description: "Platform-wide settings are read-only until the production settings store is connected.", icon: "settings", requiredPermission: "settings.view", status: "reference", capabilities: ["Read-only platform overview", "Production settings store not connected", "Write controls unavailable"], searchKeywords: ["settings", "platform", "configuration"] }),
  ] },
];

export const allAdminNavItems = adminNavGroups.flatMap((group) => group.items);
export const prototypeAdminNavItems = allAdminNavItems.filter((navItem) => navItem.status !== "live");

export function findAdminModuleByPath(pathname: string) {
  return allAdminNavItems
    .filter((navItem) => pathname === navItem.href || pathname.startsWith(`${navItem.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export function findAdminModuleBySegments(segments: string[]) {
  const href = `/${segments.join("/")}`;
  return allAdminNavItems.find((navItem) => navItem.href === href);
}
