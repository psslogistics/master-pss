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
export type CrmProspectStage = "New" | "Qualified" | "Proposal" | "Negotiation" | "Won" | "Lost";
export type CrmRelationshipHealth = "Healthy" | "Watch" | "At risk";
export interface CrmProspect { id: string; name: string; company: string; email: string; phone: string; ownerEmployeeId: string; source: string; stage: CrmProspectStage; estimatedValue: number; nextFollowUpDate: string; notes: string; convertedClientId?: string; createdAt: string; }
export interface CrmContact { id: string; clientId?: string; prospectId?: string; name: string; role: string; phone: string; email: string; isPrimary: boolean; }
export interface CrmInteraction { id: string; clientId?: string; prospectId?: string; type: "Call" | "Email" | "Meeting" | "Note"; subject: string; notes: string; ownerEmployeeId: string; timestamp: string; }
export interface CrmFollowUp { id: string; clientId?: string; prospectId?: string; title: string; ownerEmployeeId: string; dueDate: string; priority: "Low" | "Medium" | "High"; status: "Open" | "Completed" | "Snoozed"; reminderEnabled: boolean; }
export interface CrmNote { id: string; clientId?: string; prospectId?: string; content: string; authorEmployeeId: string; timestamp: string; }
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
  crmProspects: CrmProspect[];
  crmContacts: CrmContact[];
  crmInteractions: CrmInteraction[];
  crmFollowUps: CrmFollowUp[];
  crmNotes: CrmNote[];
  crmClientHealth: Record<string, CrmRelationshipHealth>;
  crmSettings: { defaultFollowUpDays: number; remindersEnabled: boolean; defaultPipelineStage: CrmProspectStage };
  settings: { timezone: string; shipmentRetention: string; walletApprovalRequired: boolean; operationalAlerts: boolean; defaultCourier: string };
}
