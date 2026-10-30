type ActivityDetails = Record<string, unknown>;

const activityEntityTypes: Record<string, "Employee" | "Role" | "Client" | "Permission" | "Session" | "Shipment" | "Pickup" | "Ticket" | "Exception" | "Billing" | "Transaction" | "Report" | "Integration" | "System"> = {
  employee: "Employee",
  employees: "Employee",
  role: "Role",
  roles: "Role",
  client: "Client",
  clients: "Client",
  permission: "Permission",
  permissions: "Permission",
  session: "Session",
  sessions: "Session",
  shipment: "Shipment",
  shipments: "Shipment",
  shipment_document: "Shipment",
  pickup: "Pickup",
  pickups: "Pickup",
  ticket: "Ticket",
  tickets: "Ticket",
  exception: "Exception",
  exceptions: "Exception",
  billing: "Billing",
  invoice: "Billing",
  transaction: "Transaction",
  transactions: "Transaction",
  report: "Report",
  reports: "Report",
  integration: "Integration",
  courier: "Integration",
  system: "System",
};

export function normalizeActivityEntityType(value: string | null | undefined) {
  return activityEntityTypes[String(value ?? "").trim().toLowerCase()] ?? "System";
}

const safeSnapshotKeys = new Set([
  "status",
  "priority",
  "assigned_to_user_id",
  "deadline",
  "due_at",
  "attempt",
  "severity",
  "settled_at",
  "total_weight_kg",
  "declared_value",
  "pieces",
  "is_test",
  "amount",
  "previous_amount",
  "new_amount",
  "component_code",
  "measured_weight_kg",
  "billable_weight_kg",
  "provider_dispute_status",
  "client_credit_amount",
  "provider_recovery_amount",
  "retained_amount",
  "enabled",
  "priority",
  "confidence_score",
  "rate_card_id",
  "fields",
  "reason",
  "employment_status",
  "identity_environment",
  "profile_status",
  "role_code",
  "name",
  "permissionKey",
  "permissionKeys",
  "workspaceSlug",
  "department",
  "employeeCode",
  "forced_password_change",
  "notification_sent",
  "document_statuses",
]);

const kycDocumentTypes = new Set(["aadhaar", "gst", "pan"]);
const kycDocumentStatuses = new Set(["submitted", "approved", "needs_changes", "rejected", "suspended"]);

function parseDetails(value: string | Record<string, unknown> | null | undefined): ActivityDetails {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ActivityDetails : {};
  } catch {
    return {};
  }
}

function readable(value: unknown, field = ""): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return /amount|cost|price/i.test(field) ? `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : value.toLocaleString("en-IN");
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (typeof value === "string") return value.slice(0, 180);
  if (Array.isArray(value)) return value.map((item) => readable(item)).filter(Boolean).join(", ").slice(0, 180) || undefined;
  if (typeof value === "object") {
    if (field === "document_statuses") {
      const statuses = Object.entries(value as ActivityDetails)
        .filter(([key, item]) => kycDocumentTypes.has(key) && typeof item === "string" && kycDocumentStatuses.has(item))
        .map(([key, item]) => `${key.toUpperCase()}: ${String(item).replaceAll("_", " ")}`);
      return statuses.length ? statuses.join(", ").slice(0, 180) : undefined;
    }
    const entries = Object.entries(value as ActivityDetails)
      .filter(([key]) => safeSnapshotKeys.has(key))
      .map(([key, item]) => {
        const text = readable(item, key);
        return text ? `${key.replaceAll("_", " ")}: ${text}` : "";
      })
      .filter(Boolean);
    return entries.length ? entries.join(" · ").slice(0, 240) : undefined;
  }
  return undefined;
}

export function activitySnapshotPair(value: string | Record<string, unknown> | null | undefined) {
  const details = parseDetails(value);
  const explicitBefore = readable(details.before);
  const explicitAfter = readable(details.after);
  if (explicitBefore || explicitAfter) {
    return {
      before: explicitBefore ?? "Not captured in this activity record",
      after: explicitAfter ?? "Not captured in this activity record",
    };
  }

  const oldAmount = readable(details.previous_amount, "previous_amount");
  const newAmount = readable(details.new_amount, "new_amount");
  if (oldAmount || newAmount) {
    return {
      before: oldAmount ?? "Not captured in this activity record",
      after: newAmount ?? "Not captured in this activity record",
    };
  }

  const oldStatus = readable(details.previous_status ?? details.old_status);
  const newStatus = readable(details.new_status ?? details.status);
  if (oldStatus || newStatus) {
    return {
      before: oldStatus ?? "Not captured in this activity record",
      after: newStatus ?? "Not captured in this activity record",
    };
  }

  return {
    before: "Not captured in this activity record",
    after: "Not captured in this activity record",
  };
}

export function activityDetailsSummary(value: string | Record<string, unknown> | null | undefined): string[] {
  const details = parseDetails(value);
  return Object.entries(details)
    .filter(([key]) => safeSnapshotKeys.has(key) && !["before", "after", "previous_amount", "new_amount", "status"].includes(key))
    .map(([key, item]) => {
      const text = readable(item, key);
      return text ? `${key.replaceAll("_", " ")}: ${text}` : "";
    })
    .filter(Boolean)
    .slice(0, 8);
}
