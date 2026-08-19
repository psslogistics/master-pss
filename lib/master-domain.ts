export type ShipmentStatus = "Booked" | "Picked up" | "In transit" | "Out for delivery" | "Delivered" | "Delayed" | "Returned";
export type PickupStatus = "Scheduled" | "Assigned" | "Collected" | "Failed" | "Cancelled";
export type RecordStatus = "Draft" | "Pending" | "Approved" | "On hold" | "Resolved" | "Active" | "Disabled" | "Failed";

export interface MasterShipment {
  id: string;
  reference: string;
  clientId: string;
  consignor: string;
  consignee: string;
  origin: string;
  destination: string;
  courier: string;
  service: string;
  status: ShipmentStatus;
  declaredWeight: number;
  measuredWeight: number;
  pieces: number;
  paymentMode: "Prepaid" | "COD";
  codAmount: number;
  bookedAt: string;
  eta: string;
  ownerEmployeeId: string;
  exceptionId?: string;
}

export interface MasterTrackingEvent { id: string; shipmentId: string; milestone: string; location: string; timestamp: string; note?: string; }
export interface MasterPickup { id: string; reference: string; shipmentId?: string; clientId: string; scheduledDate: string; window: string; location: string; driver: string; status: PickupStatus; source: "Booking" | "Standalone"; }
export interface MasterReturn { id: string; reference: string; shipmentId: string; clientId: string; reason: string; status: "Documents pending" | "Ready for return" | "In transit" | "Received"; invoiceUploaded: boolean; challanGenerated: boolean; eWayBillRequired: boolean; notes: string; }
export interface MasterException { id: string; reference: string; shipmentId: string; clientId: string; category: string; severity: "Critical" | "High" | "Normal"; status: "Open" | "Assigned" | "Resolved"; ownerEmployeeId?: string; title: string; details: string; recommendedAction: string; createdAt: string; }
export interface MasterNdrCase { id: string; reference: string; shipmentId: string; clientId: string; reason: string; attempt: number; deadline: string; status: "Open" | "Reattempt requested" | "Client action complete" | "Resolved"; priority: "High" | "Normal"; }
export interface MasterTicket { id: string; number: string; clientId: string; shipmentId?: string; assignedToEmployeeId: string; subject: string; category: string; priority: "Urgent" | "High" | "Normal"; status: "Open" | "In progress" | "Waiting for client" | "Resolved" | "Closed" | "Escalated"; createdAt: string; slaDueAt: string; lastMessage: string; }
export interface MasterTicketMessage { id: string; ticketId: string; author: string; role: "Client" | "Employee" | "System"; body: string; timestamp: string; }
export interface MasterWallet { id: string; clientId: string; balance: number; holdAmount: number; approvalRequired: boolean; status: "Available" | "On hold" | "Suspended"; }
export interface MasterTransaction { id: string; clientId: string; shipmentId?: string; reference: string; type: "Shipment debit" | "Recharge" | "Refund" | "Failed payment" | "Billing adjustment"; amount: number; direction: "Debit" | "Credit"; status: "Pending" | "Settled" | "Failed" | "Refunded"; createdAt: string; description: string; }
export interface MasterBillingRecord { id: string; invoiceNumber: string; clientId: string; shipmentId?: string; declaredWeight: number; measuredWeight: number; billableWeight: number; baseCharge: number; tax: number; total: number; status: "Draft" | "Pending approval" | "Approved" | "Paid" | "Disputed" | "On hold"; podState: "Pending" | "Available"; }
export interface MasterReport { id: string; name: string; category: "Pickup" | "Delivery" | "Shipment" | "Financial" | "Performance"; dateFrom: string; dateTo: string; status: "Ready" | "Generating" | "Failed"; lastRun: string; }
export interface MasterActivity { id: string; actorEmployeeId: string; module: string; action: string; entityId?: string; entityLabel?: string; timestamp: string; }
export interface MasterNotification { id: string; title: string; detail: string; category: "Operations" | "Support" | "Finance" | "Security" | "System"; severity: "Info" | "Warning" | "Critical"; read: boolean; entityId?: string; createdAt: string; }
export interface MasterDepartment { id: string; name: string; managerEmployeeId?: string; memberEmployeeIds: string[]; capacity: number; status: "Active" | "Disabled"; }
export interface MasterTask { id: string; title: string; clientId?: string; assignedToEmployeeId: string; status: "TODO" | "IN_PROGRESS" | "COMPLETED"; priority: "LOW" | "MEDIUM" | "HIGH"; dueDate: string; }
export interface MasterAutomationRule { id: string; name: string; trigger: string; condition: string; action: string; enabled: boolean; lastRun: string; executions: number; }
export interface MasterScheduledJob { id: string; name: string; schedule: string; status: "Healthy" | "Running" | "Failed" | "Paused"; nextRun: string; lastRun: string; retries: number; }
export interface MasterCourierIntegration { id: string; name: string; mode: "Courier" | "Email" | "WhatsApp" | "SMS"; status: "Connected" | "Degraded" | "Disconnected"; latency: string; lastChecked: string; services: string[]; }
export interface MasterApiCredential { id: string; name: string; kind: "API key" | "Webhook"; scope: string; status: "Active" | "Revoked"; lastUsed: string; deliveries: number; }
export interface MasterSecuritySession { id: string; employeeId: string; device: string; location: string; risk: "Low" | "Review" | "High"; lastActive: string; status: "Active" | "Revoked"; }
export interface MasterWorkspaceState {
  version: number;
  shipments: MasterShipment[];
  trackingEvents: MasterTrackingEvent[];
  pickups: MasterPickup[];
  returns: MasterReturn[];
  exceptions: MasterException[];
  ndrCases: MasterNdrCase[];
  tickets: MasterTicket[];
  ticketMessages: MasterTicketMessage[];
  wallets: MasterWallet[];
  transactions: MasterTransaction[];
  billing: MasterBillingRecord[];
  reports: MasterReport[];
  activities: MasterActivity[];
  notifications: MasterNotification[];
  departments: MasterDepartment[];
  tasks: MasterTask[];
  automationRules: MasterAutomationRule[];
  scheduledJobs: MasterScheduledJob[];
  integrations: MasterCourierIntegration[];
  apiCredentials: MasterApiCredential[];
  sessions: MasterSecuritySession[];
  settings: { timezone: string; shipmentRetention: string; walletApprovalRequired: boolean; operationalAlerts: boolean; defaultCourier: string };
}

const now = "2026-08-18T10:00:00+05:30";
export function createSeedWorkspace(): MasterWorkspaceState {
  const shipments: MasterShipment[] = [
    { id: "ship-1", reference: "PSS-2026-004821", clientId: "client-1", consignor: "Arvind Components", consignee: "Northwind Pharma", origin: "Gurugram", destination: "Mumbai", courier: "Delhivery", service: "Express", status: "Out for delivery", declaredWeight: 10, measuredWeight: 10.5, pieces: 2, paymentMode: "Prepaid", codAmount: 0, bookedAt: "2026-08-17", eta: "Today", ownerEmployeeId: "emp-rahul" },
    { id: "ship-2", reference: "PSS-2026-004822", clientId: "client-2", consignor: "BlueStone Retail", consignee: "Kaveri Textiles", origin: "Bengaluru", destination: "Surat", courier: "Blue Dart", service: "Priority", status: "Delayed", declaredWeight: 4, measuredWeight: 5, pieces: 1, paymentMode: "COD", codAmount: 18500, bookedAt: "2026-08-16", eta: "Tomorrow", ownerEmployeeId: "emp-rahul", exceptionId: "exception-1" },
    { id: "ship-3", reference: "PSS-2026-004823", clientId: "client-5", consignor: "Orion Auto Parts", consignee: "Jaipur Craft House", origin: "Pune", destination: "Jaipur", courier: "DTDC", service: "Standard", status: "In transit", declaredWeight: 18, measuredWeight: 18, pieces: 4, paymentMode: "Prepaid", codAmount: 0, bookedAt: "2026-08-15", eta: "Aug 20", ownerEmployeeId: "emp-ananya" },
  ];
  return {
    version: 2,
    shipments,
    trackingEvents: shipments.flatMap((shipment) => [
      { id: `${shipment.id}-booked`, shipmentId: shipment.id, milestone: "Booked", location: shipment.origin, timestamp: "2026-08-17 09:10" },
      { id: `${shipment.id}-movement`, shipmentId: shipment.id, milestone: shipment.status, location: shipment.destination, timestamp: "Today 08:42", note: shipment.status === "Delayed" ? "Courier exception requires owner review." : "Movement update received." },
    ]),
    pickups: [
      { id: "pickup-1", reference: "PU-2026-0918", shipmentId: "ship-1", clientId: "client-1", scheduledDate: "2026-08-18", window: "10:00–13:00", location: "Gurugram warehouse", driver: "Rakesh Kumar", status: "Assigned", source: "Booking" },
      { id: "pickup-2", reference: "PU-2026-0919", clientId: "client-5", scheduledDate: "2026-08-19", window: "13:00–16:00", location: "Pune warehouse", driver: "Unassigned", status: "Scheduled", source: "Standalone" },
    ],
    returns: [{ id: "return-1", reference: "RTO-2026-021", shipmentId: "ship-2", clientId: "client-2", reason: "Address incomplete", status: "Documents pending", invoiceUploaded: false, challanGenerated: false, eWayBillRequired: true, notes: "Awaiting client delivery challan." }],
    exceptions: [{ id: "exception-1", reference: "EX-2026-044", shipmentId: "ship-2", clientId: "client-2", category: "Delivery delay", severity: "High", status: "Open", ownerEmployeeId: "emp-rahul", title: "Shipment delayed at Bengaluru hub", details: "Courier milestone has not moved within the expected window.", recommendedAction: "Contact courier and notify client", createdAt: "2026-08-18 08:30" }],
    ndrCases: [{ id: "ndr-1", reference: "NDR-2026-031", shipmentId: "ship-2", clientId: "client-2", reason: "Customer unavailable", attempt: 1, deadline: "2026-08-19", status: "Open", priority: "High" }],
    tickets: [{ id: "ticket-1", number: "TK-1042", clientId: "client-1", shipmentId: "ship-1", assignedToEmployeeId: "emp-rahul", subject: "Delivery attempt is missing from portal", category: "Delivery issue", priority: "High", status: "In progress", createdAt: "2026-08-17 09:00", slaDueAt: "2026-08-18 09:00", lastMessage: "Please confirm the courier milestone." }, { id: "ticket-2", number: "TK-1038", clientId: "client-2", assignedToEmployeeId: "emp-ananya", subject: "Pickup has not been confirmed", category: "Pickup issue", priority: "Urgent", status: "Escalated", createdAt: "2026-08-16 08:10", slaDueAt: "2026-08-17 08:10", lastMessage: "Please confirm whether today's pickup is scheduled." }],
    ticketMessages: [{ id: "message-1", ticketId: "ticket-1", author: "BlueStone Retail", role: "Client", body: "Please confirm the courier milestone.", timestamp: "Today 09:14" }, { id: "message-2", ticketId: "ticket-1", author: "Rahul Sharma", role: "Employee", body: "I am checking the shipment timeline and will update this ticket.", timestamp: "Today 09:32" }, { id: "message-3", ticketId: "ticket-2", author: "System", role: "System", body: "Resolution SLA breached. Ticket escalated to Super Admin.", timestamp: "Yesterday 08:10" }],
    wallets: [{ id: "wallet-1", clientId: "client-1", balance: 184500, holdAmount: 28000, approvalRequired: true, status: "On hold" }, { id: "wallet-2", clientId: "client-2", balance: 92000, holdAmount: 0, approvalRequired: false, status: "Available" }, { id: "wallet-3", clientId: "client-5", balance: 245000, holdAmount: 0, approvalRequired: false, status: "Available" }],
    transactions: [{ id: "txn-1", clientId: "client-1", shipmentId: "ship-1", reference: "TXN-9921", type: "Shipment debit", amount: 42800, direction: "Debit", status: "Settled", createdAt: "Today 10:42", description: "Shipment booking debit" }, { id: "txn-2", clientId: "client-2", reference: "WAL-0182", type: "Billing adjustment", amount: 12000, direction: "Debit", status: "Pending", createdAt: "Aug 17", description: "Weight adjustment awaiting approval" }],
    billing: [{ id: "bill-1", invoiceNumber: "INV-2048", clientId: "client-1", shipmentId: "ship-1", declaredWeight: 10, measuredWeight: 10.5, billableWeight: 10.5, baseCharge: 40000, tax: 7200, total: 47200, status: "Pending approval", podState: "Pending" }, { id: "bill-2", invoiceNumber: "INV-2031", clientId: "client-5", shipmentId: "ship-3", declaredWeight: 18, measuredWeight: 18, billableWeight: 18, baseCharge: 26500, tax: 4770, total: 31270, status: "Paid", podState: "Available" }],
    reports: [{ id: "report-1", name: "Complete shipment report", category: "Shipment", dateFrom: "2026-08-01", dateTo: "2026-08-18", status: "Ready", lastRun: "Today 09:00" }, { id: "report-2", name: "Financial report", category: "Financial", dateFrom: "2026-08-01", dateTo: "2026-08-18", status: "Ready", lastRun: "Yesterday" }],
    activities: [{ id: "activity-1", actorEmployeeId: "emp-admin", module: "Assignments", action: "Transferred client responsibility", entityId: "client-1", entityLabel: "Arvind Components", timestamp: now }],
    notifications: [{ id: "notification-1", title: "SLA breach requires review", detail: "TK-1038 has exceeded its resolution target.", category: "Support", severity: "Critical", read: false, entityId: "ticket-2", createdAt: now }, { id: "notification-2", title: "Shipment exception needs an owner", detail: "PSS-2026-004822 is delayed at Bengaluru hub.", category: "Operations", severity: "Warning", read: false, entityId: "exception-1", createdAt: now }],
    departments: [{ id: "dept-ops", name: "Operations", managerEmployeeId: "emp-rahul", memberEmployeeIds: ["emp-rahul"], capacity: 80, status: "Active" }, { id: "dept-success", name: "Client Success", managerEmployeeId: "emp-ananya", memberEmployeeIds: ["emp-ananya", "emp-sana"], capacity: 60, status: "Active" }, { id: "dept-finance", name: "Finance", managerEmployeeId: "emp-vikram", memberEmployeeIds: ["emp-vikram"], capacity: 40, status: "Active" }],
    tasks: [{ id: "task-1", title: "Review delayed BlueStone shipment", clientId: "client-2", assignedToEmployeeId: "emp-rahul", status: "IN_PROGRESS", priority: "HIGH", dueDate: "2026-08-18" }, { id: "task-2", title: "Approve Northwind billing adjustment", clientId: "client-1", assignedToEmployeeId: "emp-vikram", status: "TODO", priority: "MEDIUM", dueDate: "2026-08-19" }],
    automationRules: [{ id: "rule-1", name: "Escalate breached ticket", trigger: "Ticket SLA breached", condition: "Status is not Resolved", action: "Notify Super Admin and manager", enabled: true, lastRun: "Today 08:10", executions: 18 }, { id: "rule-2", name: "Flag delayed shipment", trigger: "Tracking milestone delayed", condition: "Delay exceeds 12 hours", action: "Create exception", enabled: true, lastRun: "Today 08:42", executions: 31 }],
    scheduledJobs: [{ id: "job-1", name: "SLA monitor", schedule: "Every 15 minutes", status: "Healthy", nextRun: "In 8 minutes", lastRun: "Today 09:52", retries: 0 }, { id: "job-2", name: "Daily report preparation", schedule: "Every day · 18:00", status: "Healthy", nextRun: "Today 18:00", lastRun: "Yesterday 18:00", retries: 0 }],
    integrations: [{ id: "integration-1", name: "Delhivery", mode: "Courier", status: "Connected", latency: "248 ms", lastChecked: "2 min ago", services: ["Express", "COD", "Tracking"] }, { id: "integration-2", name: "Blue Dart", mode: "Courier", status: "Degraded", latency: "1.8 s", lastChecked: "8 min ago", services: ["Priority", "Tracking"] }, { id: "integration-3", name: "Operations email", mode: "Email", status: "Connected", latency: "120 ms", lastChecked: "1 min ago", services: ["Notifications", "Reports"] }],
    apiCredentials: [{ id: "credential-1", name: "Client portal webhooks", kind: "Webhook", scope: "shipments:write, tracking:read", status: "Active", lastUsed: "Today 09:44", deliveries: 1842 }, { id: "credential-2", name: "Reporting API", kind: "API key", scope: "reports:read", status: "Active", lastUsed: "Yesterday", deliveries: 412 }],
    sessions: [{ id: "session-1", employeeId: "emp-admin", device: "Chrome · Windows", location: "Pune, IN", risk: "Low", lastActive: "Now", status: "Active" }, { id: "session-2", employeeId: "emp-vikram", device: "Safari · macOS", location: "Mumbai, IN", risk: "Review", lastActive: "1 hr ago", status: "Active" }],
    settings: { timezone: "Asia/Kolkata", shipmentRetention: "90 days", walletApprovalRequired: true, operationalAlerts: true, defaultCourier: "Delhivery" },
  };
}
