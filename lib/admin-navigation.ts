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
    item({ href: "/alerts-attention", label: "Alerts & Attention", description: "One prioritized queue for critical operational and administrative events.", icon: "attention", requiredPermission: "alerts.view", status: "reference", capabilities: ["Critical alerts", "Ownership exceptions", "Acknowledgement and delegation"], searchKeywords: ["alerts", "attention", "critical", "notification"] }),
  ] },
  { label: "Operations", items: [
    item({ href: "/operations/shipments", label: "All Shipments", description: "Organization-wide shipment register across every client and courier.", icon: "shipments", requiredPermission: "shipments.view", status: "reference", capabilities: ["Global shipment search", "Client and owner scope", "Bulk export and exception context"], searchKeywords: ["shipments", "consignment", "awb"] }),
    item({ href: "/operations/bookings", label: "Bookings", description: "Create and supervise single and bulk bookings on behalf of clients.", icon: "bookings", requiredPermission: "shipments.create", status: "reference", capabilities: ["Single and bulk booking", "Client-context booking", "Document and courier selection"], searchKeywords: ["booking", "create shipment", "bulk"] }),
    item({ href: "/operations/tracking", label: "Tracking", description: "Monitor milestones and perform authorized tracking interventions.", icon: "tracking", requiredPermission: "tracking.view", status: "reference", capabilities: ["Live milestone timeline", "Tracking updates", "Actions and shipment history"], searchKeywords: ["tracking", "milestones", "status"] }),
    item({ href: "/operations/pickups", label: "Pickups", description: "Supervise scheduled, standalone, failed, and unassigned pickup requests.", icon: "pickups", requiredPermission: "pickup.view", status: "reference", capabilities: ["Pickup scheduling", "Capacity and driver assignment", "Failure and cutoff monitoring"], searchKeywords: ["pickup", "driver", "schedule"] }),
    item({ href: "/operations/returns", label: "Returns / RTO", description: "Monitor automatic return movement and documentation readiness.", icon: "returns", requiredPermission: "returns.view", status: "reference", capabilities: ["RTO register", "Invoice and challan readiness", "Return milestone monitoring"], searchKeywords: ["returns", "rto", "reverse"] }),
    item({ href: "/operations/exceptions", label: "Exceptions", description: "Resolve shipment holds, delays, failures, and service-impacting events.", icon: "exceptions", requiredPermission: "exceptions.view", status: "planned", capabilities: ["Exception triage", "Owner assignment", "Resolution timeline and escalation"], searchKeywords: ["exceptions", "delay", "hold", "failed"] }),
  ] },
  { label: "Client Management", items: [
    item({ href: "/clients", label: "All Clients", description: "Master client directory with risk, activity, ownership, and commercial context.", icon: "clients", requiredPermission: "clients.view", status: "planned", capabilities: ["Client directory", "Account health", "Audited client workspace access"], searchKeywords: ["clients", "accounts", "customers"] }),
    item({ href: "/clients/onboarding", label: "Onboarding & KYC", description: "Review new client identity, business information, and submitted documents.", icon: "onboarding", requiredPermission: "clients.create", status: "reference", capabilities: ["Business verification queue", "GSTIN and PAN review", "Document decision history"], searchKeywords: ["onboarding", "kyc", "gst", "pan"] }),
    item({ href: "/client-assignments", label: "Client Assignments", description: "Transfer operational ownership while preserving onboarding attribution.", icon: "assignments", requiredPermission: "clients.assign", status: "live", capabilities: ["Capacity-aware assignment", "Ownership transfer", "Assignment history"], searchKeywords: ["assignment", "ownership", "transfer"] }),
    item({ href: "/rate-cards", label: "Rate Cards", description: "Upload and replace the current commercial rate card for each client.", icon: "billing", requiredPermission: "rate_cards.manage", status: "live", capabilities: ["Private file storage", "Client-scoped ownership", "Audited replacement"], searchKeywords: ["rate card", "pricing", "xlsx", "pdf"] }),
    item({ href: "/client-user-access", label: "Client User Access", description: "Assign authenticated client users to governed client workspaces.", icon: "assignments", requiredPermission: "clients.assign", status: "live", capabilities: ["User-to-client membership", "Membership status", "Access governance"], searchKeywords: ["client user", "membership", "access"] }),
    item({ href: "/clients/activity", label: "Client Activity", description: "Inspect cross-module actions, support events, and recent client changes.", icon: "clientActivity", requiredPermission: "clients.activity.view", status: "planned", capabilities: ["Unified client timeline", "Employee attribution", "Shipment, support, and billing events"], searchKeywords: ["client activity", "timeline", "history"] }),
  ] },
  { label: "CRM", items: [
    item({ href: "/crm", label: "CRM", description: "Manage client relationships, prospects, contacts, interactions, and follow-ups.", icon: "conversation", requiredPermission: "crm.view", status: "live", capabilities: ["Client relationship health", "Prospect pipeline", "Contacts and follow-ups"], searchKeywords: ["crm", "relationship", "prospects", "contacts", "follow ups", "pipeline"] }),
  ] },
  { label: "Organization", items: [
    item({ href: "/employees", label: "Employees", description: "Manage employee identity, status, workspace, role, and client coverage.", icon: "employees", requiredPermission: "employees.view", status: "live", capabilities: ["Employee lifecycle", "Workspace identity", "Access and assignment detail"], searchKeywords: ["employees", "staff", "workspace"] }),
    item({ href: "/departments", label: "Departments", description: "Define organizational ownership, managers, and functional capacity.", icon: "departments", requiredPermission: "departments.view", status: "planned", capabilities: ["Department directory", "Manager and member allocation", "Capacity and access boundaries"], searchKeywords: ["departments", "teams", "managers"] }),
    item({ href: "/roles-permissions", label: "Roles & Permissions", description: "Manage reusable roles and granular action-based access.", icon: "roles", requiredPermission: "roles.view", status: "live", capabilities: ["Role permission matrix", "Super Admin bypass", "Employee override coverage"], searchKeywords: ["roles", "permissions", "rbac", "access"] }),
    item({ href: "/tasks", label: "Task Oversight", description: "Monitor and reassign operational work across employees and clients.", icon: "tasks", requiredPermission: "tasks.view", status: "reference", capabilities: ["All employee tasks", "Overdue work", "Assignment and priority control"], searchKeywords: ["tasks", "workload", "overdue"] }),
    item({ href: "/employee-activity", label: "Employee Activity", description: "Organization-wide employee action and workspace activity timeline.", icon: "employeeActivity", requiredPermission: "employee_activity.view", status: "reference", capabilities: ["Activity timeline", "Employee and client filters", "Security-sensitive action context"], searchKeywords: ["employee activity", "work history", "actions"] }),
  ] },
  { label: "Support", items: [
    item({ href: "/support/tickets", label: "Tickets", description: "Organization-wide support desk with client and employee ownership.", icon: "support", requiredPermission: "tickets.view", status: "reference", capabilities: ["All ticket conversations", "Client and shipment context", "Resolve and reassign actions"], searchKeywords: ["tickets", "support", "conversation"] }),
    item({ href: "/support/sla-escalations", label: "SLA & Escalations", description: "Monitor due-soon, breached, and escalated support commitments.", icon: "sla", requiredPermission: "tickets.escalations.view", status: "planned", capabilities: ["Response and resolution SLA", "Escalation queue", "Employee SLA performance"], searchKeywords: ["sla", "escalations", "breach", "due"] }),
  ] },
  { label: "Finance", items: [
    item({ href: "/finance/wallets", label: "Wallets", description: "Review client balances, adjustments, holds, and wallet controls.", icon: "wallets", requiredPermission: "wallet.view", status: "planned", capabilities: ["Client wallet balances", "Credit and debit controls", "Adjustment approval history"], searchKeywords: ["wallet", "balance", "credit", "debit"] }),
    item({ href: "/finance/billing-invoices", label: "Billing & Invoices", description: "Manage invoice lifecycle, billing adjustments, and approval exposure.", icon: "billing", requiredPermission: "billing.view", status: "planned", capabilities: ["Invoice register", "Billing approval queue", "Outstanding and on-hold accounts"], searchKeywords: ["billing", "invoice", "outstanding"] }),
    item({ href: "/finance/transactions", label: "Transactions", description: "Inspect organization-wide wallet and billing transaction history.", icon: "transactions", requiredPermission: "transactions.view", status: "planned", capabilities: ["Transaction ledger", "Reconciliation states", "Client and actor attribution"], searchKeywords: ["transactions", "payments", "ledger"] }),
  ] },
  { label: "Insights", items: [
    item({ href: "/insights/analytics", label: "Analytics", description: "Analyze operational trends across clients, employees, couriers, and services.", icon: "analytics", requiredPermission: "analytics.view", status: "planned", capabilities: ["Operational analytics", "Trend segmentation", "Cross-domain drill-down"], searchKeywords: ["analytics", "trends", "charts"] }),
    item({ href: "/insights/reports", label: "Reports", description: "Generate, schedule, and export governed organization reports.", icon: "reports", requiredPermission: "reports.view", status: "planned", capabilities: ["Report catalogue", "Scheduled exports", "Download and audit history"], searchKeywords: ["reports", "export", "scheduled"] }),
    item({ href: "/insights/performance", label: "Performance Center", description: "Compare client, employee, courier, and SLA performance.", icon: "performance", requiredPermission: "performance.view", status: "planned", capabilities: ["Employee performance", "Client and courier scorecards", "Predictive-readiness foundation"], searchKeywords: ["performance", "courier", "employee", "client"] }),
  ] },
  { label: "Automation", items: [
    item({ href: "/automation/workflow-rules", label: "Workflow Rules", description: "Configure event-driven routing, assignment, and escalation rules.", icon: "workflow", requiredPermission: "automation.view", status: "planned", capabilities: ["Rule builder", "Trigger and condition review", "Execution history"], searchKeywords: ["workflow", "rules", "routing"] }),
    item({ href: "/automation/notification-rules", label: "Notification Rules", description: "Control operational notification triggers, recipients, and severity.", icon: "notificationRules", requiredPermission: "automation.view", status: "planned", capabilities: ["Event subscriptions", "Recipient policies", "Channel routing"], searchKeywords: ["notification rules", "alerts", "recipients"] }),
    item({ href: "/automation/scheduled-jobs", label: "Scheduled Jobs", description: "Monitor SLA workers, report jobs, retries, and scheduled processes.", icon: "scheduledJobs", requiredPermission: "automation.view", status: "planned", capabilities: ["Job health", "Run history and retries", "SLA worker supervision"], searchKeywords: ["jobs", "scheduler", "worker", "cron"] }),
  ] },
  { label: "Integrations", items: [
    item({ href: "/integrations/couriers", label: "Courier Integrations", description: "Monitor courier API connectivity, latency, errors, and credentials.", icon: "courierIntegrations", requiredPermission: "integrations.view", status: "planned", capabilities: ["Courier API health", "Service configuration", "Failure and latency logs"], searchKeywords: ["courier", "api", "carrier"] }),
    item({ href: "/integrations/channels", label: "Communication Channels", description: "Manage email, WhatsApp, and SMS delivery channels.", icon: "channels", requiredPermission: "integrations.view", status: "planned", capabilities: ["Channel health", "Sender configuration", "Delivery failure monitoring"], searchKeywords: ["email", "whatsapp", "sms", "channels"] }),
    item({ href: "/integrations/api-webhooks", label: "API Keys & Webhooks", description: "Govern external API credentials, webhook endpoints, and access scope.", icon: "webhooks", requiredPermission: "api_keys.view", status: "planned", capabilities: ["API key inventory", "Webhook delivery logs", "Rotation and revocation controls"], searchKeywords: ["api keys", "webhooks", "credentials"] }),
  ] },
  { label: "System", items: [
    item({ href: "/audit-logs", label: "Audit Logs", description: "Inspect privileged and business-critical before-and-after history.", icon: "auditLogs", requiredPermission: "audit.view", status: "live", capabilities: ["Searchable audit history", "Before and after detail", "Security severity filters"], searchKeywords: ["audit", "history", "changes"] }),
    item({ href: "/system/security-sessions", label: "Security & Sessions", description: "Monitor authentication risk, active sessions, and access reviews.", icon: "security", requiredPermission: "security.view", status: "planned", capabilities: ["Active sessions", "Session revocation", "Authentication and access alerts"], searchKeywords: ["security", "sessions", "login"] }),
    item({ href: "/system/notifications", label: "Notifications", description: "Organization-wide administrative and operational notification center.", icon: "notifications", requiredPermission: "notifications.view", status: "reference", capabilities: ["Priority alerts", "Read and acknowledgement state", "Category and entity filtering"], searchKeywords: ["notifications", "alerts", "unread"] }),
    item({ href: "/system/settings", label: "Platform Settings", description: "Control platform-wide defaults, policies, and feature configuration.", icon: "settings", requiredPermission: "settings.view", status: "planned", capabilities: ["Organization defaults", "Feature and policy configuration", "Change audit requirements"], searchKeywords: ["settings", "platform", "configuration"] }),
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
