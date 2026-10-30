"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Check, LifeBuoy, Package, Plus, Search, Settings2, ShieldCheck, Truck, Users, Wallet, X } from "lucide-react";
import { useAdmin } from "@/components/admin/admin-provider";
import { EmptyState, Field, Modal, StatusBadge, inputClass } from "@/components/admin/ui";
import Dropdown from "@/components/ui/dropdown";
import type { AdminNavItem } from "@/lib/admin-navigation";
import { cn } from "@/lib/utils";
import { getTicketSlaState, isTicketSlaAttention } from "@/lib/ticket-sla";
import { getTicketThreadView } from "@/lib/ticket-thread";
import { pssApi } from "@/lib/pss-api";
import MasterShipmentWorkspace, { type MasterShipmentRow } from "@/components/admin/master-shipment-workspace-client-v2";
import MasterTrackingWorkspace from "@/components/admin/master-tracking-workspace";
import MasterBookingWorkspace from "@/components/admin/master-booking-workspace";
import MarginWorkspace from "@/components/admin/margin-workspace";

type Tone = "neutral" | "positive" | "warning" | "critical" | "navy";
type Props = { module: Omit<AdminNavItem, "icon"> };
type ClientSummary = { id: string; name: string; code?: string; city?: string; assignedToEmployeeId?: string; status?: string; shipmentVolume?: number | null };
type CourierPolicy = {
  id: string;
  provider: string;
  account_name: string;
  account_type?: string;
  client_id?: string | null;
  status: string;
  enabled?: boolean;
  configured?: boolean;
  explicitly_configured?: boolean;
  priority?: number;
  confidence_score?: number;
  rate_card_id?: string | null;
  notes?: string | null;
  policy_updated_at?: string | null;
};
type CourierAccessRow = CourierPolicy & { clientId: string; clientName: string };

const routeMeta: Record<string, { eyebrow: string; primary: string; description?: string }> = {
  "/alerts-attention": { eyebrow: "Attention queue", primary: "Acknowledge selected" },
  "/operations/shipments": { eyebrow: "Shipment register", primary: "Export shipments" },
  "/operations/bookings": { eyebrow: "Booking desk", primary: "New booking" },
  "/operations/tracking": { eyebrow: "Movement control", primary: "Refresh tracking" },
  "/operations/pickups": { eyebrow: "Pickup control", primary: "Schedule pickup" },
  "/operations/returns": { eyebrow: "RTO desk", primary: "Request return" },
  "/operations/exceptions": { eyebrow: "Exception desk", primary: "Create exception" },
  "/clients": { eyebrow: "Client directory", primary: "Add client" },
  "/clients/onboarding": { eyebrow: "Verification queue", primary: "Start onboarding" },
  "/clients/activity": { eyebrow: "Client timeline", primary: "Export activity" },
  "/departments": { eyebrow: "Organization map", primary: "Create department" },
  "/tasks": { eyebrow: "Work queue", primary: "Create task" },
  "/employee-activity": { eyebrow: "Activity ledger", primary: "Export activity" },
  "/support/tickets": { eyebrow: "Support inbox", primary: "New ticket" },
  "/support/sla-escalations": { eyebrow: "SLA monitor", primary: "Escalate selected" },
  "/finance/wallets": { eyebrow: "Wallet control", primary: "Record adjustment" },
  "/finance/billing-invoices": { eyebrow: "Invoice desk", primary: "Create adjustment" },
  "/finance/transactions": { eyebrow: "Transaction ledger", primary: "Export ledger" },
  "/finance/margins": { eyebrow: "Profitability desk", primary: "Refresh margins" },
  "/insights/analytics": { eyebrow: "Analytics studio", primary: "Refresh analysis" },
  "/insights/reports": { eyebrow: "Report catalogue", primary: "Generate report" },
  "/insights/performance": { eyebrow: "Performance center", primary: "Refresh scorecards" },
  "/automation/workflow-rules": { eyebrow: "Workflow builder", primary: "Create rule" },
  "/automation/notification-rules": { eyebrow: "Notification routing", primary: "Create rule" },
  "/automation/scheduled-jobs": { eyebrow: "Job monitor", primary: "Run selected job" },
  "/integrations/couriers": { eyebrow: "Courier health", primary: "Create provider account" },
  "/integrations/channels": { eyebrow: "Channel health", primary: "Check channels" },
  "/integrations/api-webhooks": { eyebrow: "Developer access", primary: "Create credential" },
  "/system/security-sessions": { eyebrow: "Security monitor", primary: "Revoke selected" },
  "/system/notifications": { eyebrow: "Notification center", primary: "Mark all read" },
  "/system/settings": { eyebrow: "Platform controls", primary: "Save settings" },
};

const supportedWorkspaceWrites = new Set([
  "/operations/bookings",
  "/operations/pickups",
  "/operations/returns",
  "/operations/exceptions",
  "/tasks",
  "/departments",
  "/alerts-attention",
  "/support/tickets",
  "/support/sla-escalations",
  "/clients",
  "/clients/onboarding",
  "/finance/wallets",
  "/finance/billing-invoices",
  "/integrations/couriers",
  "/integrations/api-webhooks",
  "/system/notifications",
]);

function hasSupportedWorkspaceWrite(href: string) { return supportedWorkspaceWrites.has(href); }
function hasSupportedRecordAction(href: string) { return href === "/system/security-sessions"; }

function tone(status: string): Tone { return /critical|breached|failed|delayed|escalated|high|hold|disconnected/i.test(status) ? "critical" : /pending|review|warning|assigned|in progress|degraded|stale|due/i.test(status) ? "warning" : /delivered|approved|paid|active|healthy|connected|resolved|settled|ready|collected/i.test(status) ? "positive" : "neutral"; }
function clientName(id: string, clients: { id: string; name: string }[]) { return clients.find((client) => client.id === id)?.name ?? "Unknown client"; }
function employeeName(id: string, employees: { id: string; name: string }[]) { if (!id.trim()) return "Unassigned"; return employees.find((employee) => employee.id === id)?.name ?? "Owner unavailable"; }
function dataSourceLabel(href: string) {
  if (href === "/clients") return "Supabase client_accounts";
  if (href === "/clients/onboarding") return "Supabase client KYC profile and documents";
  if (href === "/system/security-sessions") return "Supabase Auth session";
  if (href === "/integrations/couriers") return "Cloudflare Worker provider state";
  if (href === "/integrations/api-webhooks") return "Cloudflare D1 integration records";
  if (href === "/clients/activity" || href === "/employee-activity") return "Cloudflare D1 activity records";
  return "Cloudflare D1 production record";
}
export default function MasterModuleWorkspace({ module }: Props) {
  const { clients, employees } = useAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();
  const meta = routeMeta[module.href] ?? { eyebrow: "Master workspace", primary: "Create record" };
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [credentialSecret, setCredentialSecret] = useState<{ id: string; secret: string } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [liveRows, setLiveRows] = useState<Row[]>([]);
  const [liveRowsLoading, setLiveRowsLoading] = useState(true);
  const [liveRowsError, setLiveRowsError] = useState<string | null>(null);
  const [shipmentOffset, setShipmentOffset] = useState(0);
  const [shipmentHasMore, setShipmentHasMore] = useState(false);
  const [shipmentLoadingMore, setShipmentLoadingMore] = useState(false);
  const [shipmentTotal, setShipmentTotal] = useState<number | null>(null);
  const [shipmentStatusCounts, setShipmentStatusCounts] = useState<Record<string, number>>({});
  const [ticketMetrics, setTicketMetrics] = useState<{ total: number | null; open: number | null; attention: number | null }>({ total: null, open: null, attention: null });
  const [ticketOffset, setTicketOffset] = useState(0);
  const [ticketHasMore, setTicketHasMore] = useState(false);
  const [ticketLoadingMore, setTicketLoadingMore] = useState(false);
  const [activityOffset, setActivityOffset] = useState(0);
  const [activityTotal, setActivityTotal] = useState<number | null>(null);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [financePages, setFinancePages] = useState<FinancePageState>({ wallet: { offset: 0, total: null, hasMore: false }, billing: { offset: 0, total: null, hasMore: false } });
  const [financeLoadingMore, setFinanceLoadingMore] = useState(false);
  const [shipmentEdit, setShipmentEdit] = useState<{ id: string; values: ShipmentEditValues } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [courierAccessRows, setCourierAccessRows] = useState<CourierAccessRow[]>([]);
  const [courierAccessLoading, setCourierAccessLoading] = useState(false);
  const [courierAccessError, setCourierAccessError] = useState<string | null>(null);
  const [enabledCourierOptions, setEnabledCourierOptions] = useState<string[]>([]);
  const shipmentQueryId = searchParams.get("shipment")?.trim() ?? "";
  const courierOptions = module.href === "/operations/bookings" || module.href === "/system/settings" ? enabledCourierOptions : [];

  useEffect(() => {
    if (module.href !== "/operations/bookings" && module.href !== "/system/settings") return;
    let active = true;
    void pssApi<{ data: Record<string, { enabled?: boolean }> }>("/v1/provider-capabilities")
      .then((result) => { if (active) setEnabledCourierOptions(Object.entries(result.data ?? {}).filter(([, capability]) => capability.enabled).map(([provider]) => provider)); })
      .catch(() => { if (active) setEnabledCourierOptions([]); });
    return () => { active = false; };
  }, [module.href]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) { setLiveRowsLoading(true); setLiveRowsError(null); if (["/finance/wallets", "/finance/billing-invoices", "/finance/transactions"].includes(module.href)) { setFinancePages({ wallet: { offset: 0, total: null, hasMore: false }, billing: { offset: 0, total: null, hasMore: false } }); setFinanceLoadingMore(false); } if (module.href === "/employee-activity" || module.href === "/clients/activity") { setActivityOffset(0); setActivityTotal(null); setActivityHasMore(false); setActivityLoadingMore(false); } if (module.href === "/support/tickets" || module.href === "/support/sla-escalations") { setTicketMetrics({ total: null, open: null, attention: null }); setTicketOffset(0); setTicketHasMore(false); } } });
    const recordRows = (items: Array<Record<string, unknown>>) => items.map((item) => {
      const reference = item.reference ?? item.tracking_number ?? item.provider_reference ?? item.awb ?? item.id;
      const route = [item.origin, item.destination].filter((value) => typeof value === "string" && value.trim()).join(" → ");
      const provider = typeof item.provider === "string" && item.provider.trim() ? item.provider : "";
      const fallbackDetail = [route, provider].filter(Boolean).join(" · ");
      const isTicket = module.href === "/support/tickets" || module.href === "/support/sla-escalations";
      const createdAt = typeof item.created_at === "string" ? Date.parse(item.created_at) : NaN;
      const ticketAge = isTicket && Number.isFinite(createdAt) ? `${Math.floor(Math.max(0, Date.now() - createdAt) / 3_600_000)}h old` : "Age unavailable";
      const assignee = isTicket ? employeeName(String(item.assigned_to_user_id ?? ""), employees) : "";
      const priority = isTicket ? String(item.priority ?? "normal").replaceAll("_", " ") : "";
      const slaState = isTicket ? getTicketSlaState({ status: item.status, slaDueAt: item.sla_due_at, escalationState: item.escalation_state }).replaceAll("_", " ") : "";
      const ticketMeta = isTicket
        ? [item.created_at ? new Date(String(item.created_at)).toLocaleString() : "Created time unavailable", assignee, `${priority} priority`, ticketAge, `SLA ${slaState}`].join(" · ")
        : String(item.meta ?? item.created_at ?? item.updated_at ?? "");
      return {
        id: String(item.id ?? reference),
        title: String(item.title ?? item.name ?? reference ?? "Production record"),
        detail: String(item.detail ?? item.description ?? item.subject ?? fallbackDetail),
        status: isTicket ? String(item.status ?? "open").replaceAll("_", " ") : String(item.status ?? "pending"),
        meta: ticketMeta,
        raw: item,
      };
    });
    const walletRows = (items: Array<Record<string, unknown>>) => items.map((item) => ({ id: String(item.id), title: `${String(item.type ?? "adjustment")} · ₹${Number(item.amount ?? 0).toLocaleString("en-IN")}`, detail: `${String(item.client_id ?? "Client")} · ${String(item.reference ?? "No reference")}`, status: String(item.status ?? "pending"), meta: `Balance after: ₹${Number(item.balance_after ?? 0).toLocaleString("en-IN")} · ${String(item.created_at ?? "")}`, raw: item }));
    const isShipmentModule = module.href === "/operations/shipments" || module.href === "/operations/tracking";
    if (isShipmentModule) {
      const search = shipmentQueryId ? `&search=${encodeURIComponent(shipmentQueryId)}` : "";
      void pssApi<{ data: Array<Record<string, unknown>>; pagination?: ShipmentPagination }>(`/v1/shipments?view=tracking&limit=50&offset=0${search}`)
        .then((result) => { if (!active) return; const data = result.data ?? []; setLiveRows(recordRows(data)); setShipmentOffset(Number(result.pagination?.next_offset ?? data.length)); setShipmentHasMore(Boolean(result.pagination?.has_more)); setShipmentTotal(typeof result.pagination?.total === "number" && Number.isFinite(result.pagination.total) ? result.pagination.total : null); setShipmentStatusCounts(result.pagination?.status_counts ?? {}); setLiveRowsLoading(false); })
        .catch((error) => { if (active) { setLiveRows([]); setLiveRowsLoading(false); setLiveRowsError(error instanceof Error ? error.message : "Production records could not be loaded."); } });
      return () => { active = false; };
    }
    const isActivityModule = module.href === "/employee-activity" || module.href === "/clients/activity";
    if (isActivityModule) {
      void pssApi<{ data: Array<Record<string, unknown>>; pagination?: ActivityPagination }>("/v1/activity?limit=100&offset=0")
        .then((result) => {
          if (!active) return;
          const data = result.data ?? [];
          setLiveRows(recordRows(data));
          setActivityOffset(Number(result.pagination?.next_offset ?? data.length));
          setActivityTotal(typeof result.pagination?.total === "number" ? result.pagination.total : null);
          setActivityHasMore(Boolean(result.pagination?.has_more));
          setLiveRowsLoading(false);
        })
        .catch((error) => { if (active) { setLiveRows([]); setLiveRowsLoading(false); setLiveRowsError(error instanceof Error ? error.message : "Activity records could not be loaded."); } });
      return () => { active = false; };
    }
    const financeRoute = ["/finance/wallets", "/finance/billing-invoices", "/finance/transactions"].includes(module.href);
    if (financeRoute) {
      const walletRequest = module.href !== "/finance/billing-invoices"
        ? pssApi<FinancePageResponse>("/v1/wallet?limit=100&offset=0")
        : Promise.resolve(null);
      const billingRequest = module.href !== "/finance/wallets"
        ? pssApi<FinancePageResponse>("/v1/billing?limit=100&offset=0")
        : Promise.resolve(null);
      void Promise.allSettled([walletRequest, billingRequest]).then(([walletSettled, billingSettled]) => {
        if (!active) return;
        const walletResult = walletSettled.status === "fulfilled" ? walletSettled.value : null;
        const billingResult = billingSettled.status === "fulfilled" ? billingSettled.value : null;
        const failures = [walletSettled.status === "rejected" ? "Wallet" : "", billingSettled.status === "rejected" ? "Billing" : ""].filter(Boolean);
        const walletItems = walletResult?.data ?? [];
        const billingItems = billingResult?.data ?? [];
        const walletRowsLoaded = walletRows(walletItems);
        const billingRowsLoaded = recordRows(billingItems);
        const nextRows = module.href === "/finance/wallets"
          ? walletRowsLoaded
          : module.href === "/finance/billing-invoices"
            ? billingRowsLoaded
            : [...walletRowsLoaded.map((row) => ({ ...row, title: `Wallet · ${row.title}` })), ...billingRowsLoaded.map((row) => ({ ...row, title: `Billing · ${row.title}` }))].sort((a, b) => Date.parse(String(b.raw?.created_at ?? b.meta)) - Date.parse(String(a.raw?.created_at ?? a.meta)));
        setLiveRows(nextRows);
        setFinancePages({
          wallet: { offset: Number(walletResult?.pagination?.next_offset ?? walletItems.length), total: typeof walletResult?.pagination?.total === "number" ? walletResult.pagination.total : null, hasMore: Boolean(walletResult?.pagination?.has_more) },
          billing: { offset: Number(billingResult?.pagination?.next_offset ?? billingItems.length), total: typeof billingResult?.pagination?.total === "number" ? billingResult.pagination.total : null, hasMore: Boolean(billingResult?.pagination?.has_more) },
        });
        setLiveRowsError(failures.length ? `${failures.join(" and ")} records could not be loaded. Showing data from the available finance source; retry to refresh.` : null);
        setLiveRowsLoading(false);
      }).catch((error) => { if (active) { setLiveRows([]); setLiveRowsLoading(false); setLiveRowsError(error instanceof Error ? error.message : "Finance records could not be loaded."); } });
      return () => { active = false; };
    }
    const source = module.status !== "live"
      ? Promise.resolve([] as Row[])
      : module.href === "/operations/pickups"
        ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/pickups").then((result) => recordRows(result.data ?? []))
        : module.href === "/operations/returns"
          ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/returns").then((result) => recordRows(result.data ?? []))
          : module.href === "/operations/exceptions"
            ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/exceptions").then((result) => recordRows(result.data ?? []))
            : module.href === "/support/tickets" || module.href === "/support/sla-escalations"
              ? pssApi<{ data: Array<Record<string, unknown>>; pagination?: { total?: number; next_offset?: number; has_more?: boolean; status_counts?: Record<string, number> } }>("/v1/tickets?limit=100&offset=0").then((result) => { const counts = result.pagination?.status_counts ?? {}; if (active) { setTicketMetrics({ total: typeof result.pagination?.total === "number" ? result.pagination.total : null, open: typeof counts.open === "number" ? counts.open : null, attention: typeof counts.attention === "number" ? counts.attention : null }); setTicketOffset(Number(result.pagination?.next_offset ?? result.data?.length ?? 0)); setTicketHasMore(Boolean(result.pagination?.has_more)); } return recordRows(result.data ?? []); })
              : module.href === "/integrations/couriers"
      ? Promise.all([
          pssApi<{ data: Record<string, { configured?: boolean; enabled?: boolean; health?: string; last_error_code?: string | null; last_checked_at?: string | null; capabilities?: string[]; activation_blockers?: string[] }> }>("/v1/provider-capabilities"),
        pssApi<{ data: Array<{ id: string; provider: string; account_name: string; account_type: string; client_id?: string | null; status: string; credential_secret_name: string }> }>("/v1/provider-accounts"),
      ]).then(([capabilities, accounts]) => [
        ...Object.entries(capabilities.data).map(([provider, value]) => ({ id: provider, title: provider[0].toUpperCase() + provider.slice(1), detail: `${(value.capabilities ?? []).join(" · ") || "No enabled capabilities"}${value.health && value.health !== "unknown" ? ` · ${value.health}` : ""}`, status: value.health === "degraded" ? "Degraded" : value.health === "pending" ? "Checking" : value.enabled ? "Enabled" : value.configured ? "Configured, disabled" : "Disabled", meta: value.last_error_code ? `Recent provider error ${value.last_error_code}` : value.last_checked_at ? `Last checked ${value.last_checked_at}` : value.enabled ? "Ready for provider calls" : (value.activation_blockers ?? ["provider_calls_disabled"]).join(" · ") })),
        ...accounts.data.map((account) => ({ id: `account-${account.id}`, title: `${account.provider} · ${account.account_name}`, detail: `${account.account_type} · ${account.client_id ?? "Default account"}`, status: account.status, meta: `Secret binding ${account.credential_secret_name}` })),
      ])
              : module.href === "/integrations/api-webhooks"
                ? Promise.all([
          pssApi<{ data: Array<{ id: string; name: string; key_prefix: string; client_id?: string; status: string; expires_at?: string | null; last_used_at?: string | null; created_at?: string | null }> }>("/v1/api-keys"),
          pssApi<{ data: Array<{ id: string; provider: string; event_id: string; event_type: string; status: string; processed_at?: string | null; created_at?: string | null }> }>("/v1/webhook-events"),
          pssApi<{ data: Array<{ id: string; provider: string; operation: string; status: string; error_code?: string | null; updated_at?: string | null }> }>("/v1/integration-requests"),
        ]).then(([keys, webhooks, requests]) => [
          ...keys.data.map((item) => ({ id: item.id, title: item.name, detail: `${item.key_prefix} · ${item.client_id ? clientName(item.client_id, clients) : "Client-scoped API key"}`, status: item.status, meta: item.last_used_at ? `Last used ${item.last_used_at}` : item.expires_at ? `Expires ${item.expires_at}` : `Created ${item.created_at ?? "recently"}` })),
          ...webhooks.data.map((item) => ({ id: `webhook-${item.id}`, title: `${item.provider} webhook`, detail: `${item.event_type} · ${item.event_id}${item.status === "received" ? " · Awaiting matching PSS shipment" : item.status === "ignored" ? " · Rejected by transition or replay guard" : ""}`, status: item.status, meta: item.processed_at ? `Processed ${item.processed_at}` : `Received ${item.created_at ?? "recently"}` })),
          ...requests.data.map((item) => ({ id: `integration-${item.id}`, title: `${item.provider} ${item.operation}`, detail: item.error_code ?? "Provider request", status: item.status, meta: item.updated_at ?? "Recently updated" })),
        ])
      : module.href === "/system/security-sessions"
        ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/security/sessions").then((result) => (result.data ?? []).map((item) => ({ id: String(item.id), title: item.current ? "Current Supabase session" : "Security session", detail: `User ${String(item.user_id ?? "")}`, status: String(item.status ?? "active"), meta: String(item.last_seen_at ?? "") })))
      : module.href === "/clients"
        ? fetch("/api/admin/client-membership").then(async (response) => { if (!response.ok) throw new Error("Unable to load the production client directory."); const result = await response.json() as { clients?: Array<{ id: string; legal_name: string; client_code?: string | null; status?: string | null }> }; return (result.clients ?? []).map((item) => ({ id: item.id, title: item.legal_name, detail: item.client_code ? `Client code ${item.client_code}` : "No client code", status: item.status === "active" ? "Active" : "On hold", meta: "Supabase client_accounts" })); })
      : module.href === "/alerts-attention" || module.href === "/system/notifications"
        ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/notifications").then((result) => (result.data ?? []).map((item) => ({ id: String(item.id), title: String(item.title ?? item.category ?? "Notification"), detail: String(item.message ?? item.description ?? ""), status: item.is_read ? "Read" : "Unread", meta: String(item.created_at ?? item.category ?? "") })))
      : module.href === "/tasks"
        ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/tasks").then((result) => recordRows(result.data ?? []))
      : module.href === "/departments"
        ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/departments").then((result) => (result.data ?? []).map((item) => ({ id: String(item.id), title: String(item.name ?? "Department"), detail: `Manager: ${String(item.manager_user_id ?? "Unassigned")}`, status: String(item.status ?? "active"), meta: `Capacity ${String(item.capacity_percent ?? 100)}%` })))
      : module.href === "/employee-activity" || module.href === "/clients/activity"
        ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/activity").then((result) => recordRows(result.data ?? []))
      : module.href === "/insights/reports" || module.href === "/insights/analytics" || module.href === "/insights/performance"
        ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/reports/shipments").then((result) => recordRows(result.data ?? []))
      : Promise.resolve([] as Row[]);
    void Promise.resolve().then(() => { if (active) setLiveRowsError(null); });
    void source
      .then((result) => { if (!active) return; setLiveRows(result as Row[]); setLiveRowsLoading(false); })
      .catch((error) => { if (active) { setLiveRows([]); setLiveRowsLoading(false); setLiveRowsError(error instanceof Error ? error.message : "Production records could not be loaded."); } });
    return () => { active = false; };
  }, [clients, employees, module.href, module.status, refreshKey, shipmentQueryId]);

  useEffect(() => {
    if (!shipmentQueryId || !liveRows.length || !["/operations/shipments", "/operations/tracking"].includes(module.href)) return;
    const matched = liveRows.find((row) => row.id === shipmentQueryId);
    if (matched) queueMicrotask(() => setSelectedId(matched.id));
  }, [liveRows, module.href, shipmentQueryId]);

  function openShipmentEditor(row: Row) {
    const raw = row.raw ?? {};
    setShipmentEdit({ id: row.id, values: { description: String(raw.description ?? ""), origin: String(raw.origin ?? ""), destination: String(raw.destination ?? ""), consignee: String(raw.consignee ?? ""), declared_value: String(raw.declared_value ?? ""), pieces: String(raw.pieces ?? "") } });
  }

  async function saveShipmentEdit(values: ShipmentEditValues) {
    if (!shipmentEdit) return;
    setActionInFlight(true);
    try {
      const payload = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim() !== "").map(([key, value]) => [key, ["total_weight_kg", "declared_value", "pieces"].includes(key) ? Number(value) : value]));
      await pssApi(`/v1/shipments/${encodeURIComponent(shipmentEdit.id)}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(payload) });
      setShipmentEdit(null);
      setNotice(`Shipment ${shipmentEdit.id} was updated in production.`);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update the shipment.");
    } finally {
      setActionInFlight(false);
    }
  }

  function loadMoreRecords() {
    const financeRoute = ["/finance/wallets", "/finance/billing-invoices", "/finance/transactions"].includes(module.href);
    if (financeRoute) {
      if (financeLoadingMore) return;
      const sources = (module.href === "/finance/wallets" ? ["wallet"] : module.href === "/finance/billing-invoices" ? ["billing"] : ["wallet", "billing"]) as Array<keyof FinancePageState>;
      const pendingSources = sources.filter((source) => financePages[source].hasMore);
      if (!pendingSources.length) return;
      setFinanceLoadingMore(true);
      const requests = pendingSources.map(async (source) => {
        const page = financePages[source];
        const endpoint = source === "wallet" ? "/v1/wallet" : "/v1/billing";
        const result = await pssApi<FinancePageResponse>(`${endpoint}?limit=100&offset=${page.offset}`);
        const nextRows = source === "wallet"
          ? result.data.map((item) => ({ id: String(item.id), title: `${String(item.type ?? "adjustment")} · ₹${Number(item.amount ?? 0).toLocaleString("en-IN")}`, detail: `${String(item.client_id ?? "Client")} · ${String(item.reference ?? "No reference")}`, status: String(item.status ?? "pending"), meta: `Balance after: ₹${Number(item.balance_after ?? 0).toLocaleString("en-IN")} · ${String(item.created_at ?? "")}`, raw: item }))
          : result.data.map((item) => { const row = recordRowsForList([item])[0]; return module.href === "/finance/transactions" ? { ...row, title: `Billing · ${row.title}` } : row; });
        if (source === "wallet" && module.href === "/finance/transactions") for (const row of nextRows) row.title = `Wallet · ${row.title}`;
        setLiveRows((current) => {
          const combined = [...current, ...nextRows.filter((row) => !current.some((existing) => existing.id === row.id))];
          return module.href === "/finance/transactions" ? combined.sort((a, b) => Date.parse(String(b.raw?.created_at ?? "")) - Date.parse(String(a.raw?.created_at ?? ""))) : combined;
        });
        setFinancePages((current) => ({ ...current, [source]: { offset: Number(result.pagination?.next_offset ?? page.offset + result.data.length), total: typeof result.pagination?.total === "number" ? result.pagination.total : current[source].total, hasMore: Boolean(result.pagination?.has_more) } }));
      });
      void Promise.all(requests).catch((error) => setLiveRowsError(error instanceof Error ? error.message : "More finance records could not be loaded.")).finally(() => setFinanceLoadingMore(false));
      return;
    }
    const isActivityModule = module.href === "/employee-activity" || module.href === "/clients/activity";
    if (isActivityModule) {
      if (!activityHasMore || activityLoadingMore) return;
      setActivityLoadingMore(true);
      void pssApi<{ data: Array<Record<string, unknown>>; pagination?: ActivityPagination }>(`/v1/activity?limit=100&offset=${activityOffset}`)
        .then((result) => {
          const nextRows = recordRowsForList(result.data ?? []);
          setLiveRows((current) => [...current, ...nextRows.filter((row) => !current.some((existing) => existing.id === row.id))]);
          setActivityOffset(Number(result.pagination?.next_offset ?? activityOffset + nextRows.length));
          setActivityTotal(typeof result.pagination?.total === "number" ? result.pagination.total : activityTotal);
          setActivityHasMore(Boolean(result.pagination?.has_more));
        })
        .catch((error) => setLiveRowsError(error instanceof Error ? error.message : "More activity records could not be loaded."))
        .finally(() => setActivityLoadingMore(false));
      return;
    }
    const isTicketModule = module.href === "/support/tickets" || module.href === "/support/sla-escalations";
    if (isTicketModule) {
      if (!ticketHasMore || ticketLoadingMore) return;
      setTicketLoadingMore(true);
      void pssApi<{ data: Array<Record<string, unknown>>; pagination?: { total?: number; next_offset?: number; has_more?: boolean; status_counts?: Record<string, number> } }>(`/v1/tickets?limit=100&offset=${ticketOffset}`)
        .then((result) => {
          const nextRows = recordRowsForList(result.data ?? []);
          setLiveRows((current) => [...current, ...nextRows.filter((row) => !current.some((existing) => existing.id === row.id))]);
          const counts = result.pagination?.status_counts ?? {};
          setTicketMetrics({ total: typeof result.pagination?.total === "number" ? result.pagination.total : null, open: typeof counts.open === "number" ? counts.open : null, attention: typeof counts.attention === "number" ? counts.attention : null });
          setTicketOffset(Number(result.pagination?.next_offset ?? ticketOffset + nextRows.length));
          setTicketHasMore(Boolean(result.pagination?.has_more));
        })
        .catch((error) => setLiveRowsError(error instanceof Error ? error.message : "More tickets could not be loaded."))
        .finally(() => setTicketLoadingMore(false));
      return;
    }
    const isShipmentModule = module.href === "/operations/shipments" || module.href === "/operations/tracking";
    if (!isShipmentModule || !shipmentHasMore || shipmentLoadingMore) return;
    setShipmentLoadingMore(true);
    const search = shipmentQueryId ? `&search=${encodeURIComponent(shipmentQueryId)}` : "";
    void pssApi<{ data: Array<Record<string, unknown>>; pagination?: ShipmentPagination }>(`/v1/shipments?view=tracking&limit=50&offset=${shipmentOffset}${search}`)
      .then((result) => {
        const nextRows = (result.data ?? []).map((item) => {
          const reference = item.reference ?? item.tracking_number ?? item.provider_reference ?? item.awb ?? item.id;
          const route = [item.origin, item.destination].filter((value) => typeof value === "string" && value.trim()).join(" → ");
          const provider = typeof item.provider === "string" && item.provider.trim() ? item.provider : "";
          return { id: String(item.id ?? reference), title: String(item.title ?? item.name ?? reference ?? "Production record"), detail: String(item.detail ?? item.description ?? item.subject ?? [route, provider].filter(Boolean).join(" · ")), status: String(item.status ?? "pending"), meta: String(item.meta ?? item.created_at ?? item.updated_at ?? ""), raw: item };
        });
        setLiveRows((current) => [...current, ...nextRows.filter((row) => !current.some((existing) => existing.id === row.id))]);
        if (result.pagination?.total !== undefined) setShipmentTotal(Number(result.pagination.total));
        if (result.pagination?.status_counts) setShipmentStatusCounts(result.pagination.status_counts);
        setShipmentOffset(Number(result.pagination?.next_offset ?? shipmentOffset + nextRows.length));
        setShipmentHasMore(Boolean(result.pagination?.has_more));
      })
      .catch((error) => setLiveRowsError(error instanceof Error ? error.message : "More shipment records could not be loaded."))
      .finally(() => setShipmentLoadingMore(false));
  }

  useEffect(() => {
    if (module.href !== "/integrations/couriers") {
      queueMicrotask(() => {
        setCourierAccessRows([]);
        setCourierAccessLoading(false);
        setCourierAccessError(null);
      });
      return;
    }
    let active = true;
    void Promise.resolve().then(() => { if (active) { setCourierAccessLoading(true); setCourierAccessError(null); } });
    if (!clients.length) {
      queueMicrotask(() => { if (active) { setCourierAccessRows([]); setCourierAccessLoading(false); } });
      return () => { active = false; };
    }
    void Promise.all(clients.map(async (client) => {
      const result = await pssApi<{ data: CourierPolicy[] }>(`/v1/provider-account-policies?client_id=${encodeURIComponent(client.id)}`);
      return (result.data ?? []).map((policy) => ({ ...policy, clientId: client.id, clientName: client.name }));
    }))
      .then((groups) => {
        if (!active) return;
        setCourierAccessRows(groups.flat().sort((a, b) => `${a.clientName} ${a.provider} ${a.account_name}`.localeCompare(`${b.clientName} ${b.provider} ${b.account_name}`)));
        setCourierAccessLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setCourierAccessRows([]);
        setCourierAccessLoading(false);
        setCourierAccessError(error instanceof Error ? error.message : "Courier access could not be loaded.");
      });
    return () => { active = false; };
  }, [clients, module.href, refreshKey]);

  // Production records are the only source rendered by released workspaces.
  // Empty API responses must remain empty; domain fixtures are never a fallback.
  const rows = useMemo(() => liveRows, [liveRows]);
  const scopedRows = module.href === "/support/sla-escalations"
    ? rows.filter((row) => isTicketSlaAttention({ status: row.status, slaDueAt: row.raw?.sla_due_at, escalationState: row.raw?.escalation_state, assignedToUserId: row.raw?.assigned_to_user_id }))
    : rows;
  const filtered = scopedRows.filter((row) => `${row.title} ${row.detail} ${row.status}`.toLowerCase().includes(query.toLowerCase()) && (filter === "All" || row.status === filter));
  const selected = rows.find((row) => row.id === selectedId) ?? filtered[0];
  const financeRoute = ["/finance/wallets", "/finance/billing-invoices", "/finance/transactions"].includes(module.href);
  const financeTotal = module.href === "/finance/wallets" ? financePages.wallet.total : module.href === "/finance/billing-invoices" ? financePages.billing.total : financePages.wallet.total !== null && financePages.billing.total !== null ? financePages.wallet.total + financePages.billing.total : null;
  const financeHasMore = module.href === "/finance/wallets" ? financePages.wallet.hasMore : module.href === "/finance/billing-invoices" ? financePages.billing.hasMore : financePages.wallet.hasMore || financePages.billing.hasMore;
  const setValue = useCallback((key: string, value: string) => setForm((current) => ({ ...current, [key]: value })), []);

  function primaryAction() {
    if (/export/i.test(meta.primary)) { downloadCsv(module.label, rows); const completeness = module.href === "/employee-activity" || module.href === "/clients/activity" ? `Showing ${rows.length} of ${activityTotal ?? "an unknown total"} events; scroll to load older events before exporting more.` : financeRoute ? `Showing ${rows.length} of ${financeTotal ?? "an unknown total"} financial records; scroll to load more before exporting the rest.` : `${rows.length} currently loaded records.`; setNotice(`${module.label} export downloaded locally. ${completeness}`); return; }
    if (/refresh|check/i.test(meta.primary)) { setRefreshKey((value) => value + 1); setNotice(`${module.label} refreshed from production.`); return; }
    if (/mark all read/i.test(meta.primary)) { void Promise.all(liveRows.filter((item) => item.status !== "Read").map((item) => pssApi(`/v1/notifications/${item.id}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ is_read: true }) }))).then(() => { setNotice("All notifications were marked as read in production."); setRefreshKey((value) => value + 1); }).catch((error) => setNotice(error instanceof Error ? error.message : "Unable to update notifications.")); return; }
    if (/run selected|revoke selected|acknowledge selected|escalate selected/i.test(meta.primary)) { if (!selected) { setNotice("Select a production record before taking this action."); return; } void performAction(meta.primary, selected.id); return; }
    if (!hasSupportedWorkspaceWrite(module.href)) { setNotice(`${module.label} is currently read-only. No production write is enabled for this module.`); return; }
    setForm({}); setModal(meta.primary);
  }

  async function toggleCourierAccess(row: CourierAccessRow) {
    if (actionInFlight) return;
    setActionInFlight(true);
    try {
      await pssApi(`/v1/provider-account-policies/${encodeURIComponent(row.id)}`, {
        method: "PUT",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          client_id: row.clientId,
          enabled: row.enabled !== true,
          priority: row.priority ?? 100,
          confidence_score: row.confidence_score ?? 0,
          rate_card_id: row.rate_card_id ?? null,
          notes: row.notes ?? null,
        }),
      });
      setNotice(`${row.enabled ? "Disabled" : "Enabled"} ${row.provider} · ${row.account_name} for ${row.clientName}.`);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Courier access could not be updated.");
    } finally {
      setActionInFlight(false);
    }
  }

  async function performAction(action: string, id: string) {
    if (actionInFlight) return;
    setActionInFlight(true);
    try {
      await performActionUnsafe(action, id);
    } finally {
      setActionInFlight(false);
    }
  }

  async function performActionUnsafe(action: string, id: string) {
    const href = module.href;
    if (href === "/operations/pickups") { const assigneeId = action.split(":")[1]; if (!assigneeId) { setNotice("Choose an active employee before assigning this pickup."); return; } try { await pssApi(`/v1/pickups/${id}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ status: "assigned", assigned_to_user_id: assigneeId }) }); setNotice("Pickup assignment persisted in production."); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to update the production pickup."); } return; }
    if (href === "/operations/exceptions") { try { await pssApi(`/v1/exceptions/${id}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ status: "resolved" }) }); setNotice(`${action} persisted in production.`); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to update the production exception."); } return; }
    if (href === "/tasks") { try { await pssApi(`/v1/tasks/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ status: "completed" }) }); setNotice("Task marked complete in production."); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to update the production task."); } return; }
    if (href === "/alerts-attention" || href === "/system/notifications") { try { await pssApi(`/v1/notifications/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ is_read: true }) }); setNotice("Notification acknowledgement persisted in production."); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to acknowledge the production notification."); } return; }
    if (href === "/finance/wallets" || href === "/finance/billing-invoices") { try { const endpoint = href === "/finance/wallets" ? "/v1/wallet" : "/v1/billing"; await pssApi(`${endpoint}/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ status: "approved" }) }); setNotice("Finance record approval persisted in production."); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to approve the finance record."); } return; }
    if (href === "/integrations/couriers" && id.startsWith("account-")) { setForm({ accountId: id.slice("account-".length) }); setModal("Manage client access"); return; }
    if (href === "/integrations/api-webhooks") { try { await pssApi(`/v1/api-keys/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ status: "revoked" }) }); setNotice("API credential revoked in production."); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to revoke the production API credential."); } return; }
    if (href === "/system/security-sessions") { try { await pssApi(`/v1/security/sessions/${encodeURIComponent(id)}/revoke`, { method: "POST" }); setNotice("Current Supabase session revoked. Returning to sign in…"); window.setTimeout(() => router.push("/login"), 700); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to revoke the current security session."); } return; }
    if (href === "/support/tickets" || href === "/support/sla-escalations") {
      try {
        if (action.startsWith("Assign ticket:")) {
          const assignedTo = action.slice("Assign ticket:".length);
          if (!assignedTo) { setNotice("Choose an active employee before assigning this ticket."); return; }
          await pssApi(`/v1/tickets/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ assigned_to_user_id: assignedTo }) });
          setNotice("Ticket assignment saved.");
        } else {
          await pssApi(`/v1/tickets/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ status: href === "/support/sla-escalations" ? "escalated" : "resolved" }) });
          setNotice(`${action} persisted in production.`);
        }
        setRefreshKey((value) => value + 1);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to update the production ticket."); }
      return;
    }
    if (!hasSupportedWorkspaceWrite(href)) { setNotice(`${module.label} is currently read-only. No production write is enabled for this module.`); return; }
    setNotice(`${module.label} does not have a supported production action for this record.`);
    return;
  }

  async function submit() {
    if (actionInFlight) return;
    setActionInFlight(true);
    try {
      await submitUnsafe();
    } finally {
      setActionInFlight(false);
    }
  }

  async function submitUnsafe() {
    const href = module.href;
    if (!hasSupportedWorkspaceWrite(href)) { setNotice(`${module.label} is currently read-only. No production write is enabled for this module.`); setModal(null); return; }
    if (href === "/operations/bookings") {
      const clientId = form.client || clients[0]?.id;
      try { const selectedProvider = form.courier?.toLowerCase(); const provider = selectedProvider === "delhivery" || selectedProvider === "trackon" || selectedProvider === "xpressbees" || selectedProvider === "rivigo" ? selectedProvider : undefined; const ewayDocument = form.ewayBillBase64 ? { name: form.ewayBillName || "eway-bill", content_type: form.ewayBillContentType || "application/octet-stream", body_base64: form.ewayBillBase64 } : undefined; let invoiceDocuments: Array<Record<string, string>> = []; try { invoiceDocuments = form.invoiceDocuments ? JSON.parse(form.invoiceDocuments) : []; } catch { throw new Error("Invoice documents could not be prepared. Please attach the invoice again."); } const result = await pssApi<{ data: { id: string; status: string } }>("/v1/shipments", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ client_id: clientId, provider, origin: form.origin || form.consignorCity || "", destination: form.destination || form.consigneeCity || "", origin_address: { line: form.consignorAddress || "", city: form.consignorCity || "", state: form.consignorState || "", pincode: form.consignorPincode || "", name: form.consignor || "", phone: form.consignorPhone || "" }, destination_address: { line: form.consigneeAddress || "", city: form.consigneeCity || "", state: form.consigneeState || "", pincode: form.consigneePincode || "", name: form.consignee || "", phone: form.consigneePhone || "" }, consignor: form.consignor || "", consignee: form.consignee || "", total_weight_kg: Number(form.weight) || 1, pieces: Number(form.pieces) || 1, description: form.description || form.consignor || "", invoice_number: form.invoiceNumber || undefined, invoice_documents: invoiceDocuments.length ? invoiceDocuments : undefined, order_id: form.orderId || undefined, payment_mode: form.paymentMode || "Prepaid", cod_amount: form.codAmount ? Number(form.codAmount) : 0, e_waybill_no: form.ewayBillNumber || undefined, ...(ewayDocument ? { eway_document: ewayDocument } : {}), dimensions: form.dimensions ? JSON.parse(form.dimensions) : undefined }) }); setNotice(`Shipment ${result.data.id} was created in production${provider ? ` with ${provider}` : " with courier dispatch pending"}.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create the production shipment."); }
    } else if (href === "/tasks") {
      try {
        const result = await pssApi<{ data: { id: string } }>("/v1/tasks", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ client_id: form.client || undefined, title: form.title || "Master task", description: form.description || "", priority: (form.priority || "medium").toLowerCase(), due_at: form.dueAt || undefined, assigned_to_user_id: form.assignee || undefined }) });
        setNotice(`Task ${result.data.id} was created in production.`); setRefreshKey((value) => value + 1);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create the production task."); }
    } else if (href === "/departments") {
      try {
        const result = await pssApi<{ data: { id: string } }>("/v1/departments", {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({
            name: form.name,
            manager_user_id: form.manager || undefined,
            capacity_percent: Number(form.capacity || 100),
            status: "active",
          }),
        });
        setNotice(`Department ${result.data.id} was created in production.`);
        setRefreshKey((value) => value + 1);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Unable to create the production department.");
      }
    } else if (href === "/operations/exceptions") {
      try { const result = await pssApi<{ data: { id: string; status: string } }>("/v1/exceptions", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ client_id: form.client || clients[0]?.id, shipment_id: form.shipment, category: form.category, title: form.title, severity: form.severity || "medium", details: form.details || undefined, assigned_to_user_id: form.assignee || undefined }) }); setNotice(`Exception ${result.data.id} was created in production.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create the production exception."); }
    } else if (href === "/support/tickets") {
      if (!form.client || !clients.some((client) => client.id === form.client)) { setNotice("Select a valid client before creating the ticket."); return; }
      if (!form.subject?.trim()) { setNotice("Enter a subject before creating the ticket."); return; }
      if (!form.message?.trim()) { setNotice("Add the initial message so the support team has enough context."); return; }
      try { const result = await pssApi<{ data: { id: string } }>("/v1/tickets", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ client_id: form.client, shipment_id: form.shipment || undefined, title: form.subject.trim(), description: form.message.trim(), priority: (form.priority || "normal").toLowerCase() }) }); setNotice(`Ticket ${result.data.id} was created in production.`); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create the production ticket."); }
    } else if (href === "/clients" || href === "/clients/onboarding") {
      const response = await fetch("/api/admin/client-membership", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ legalName: form.name, clientCode: form.clientCode || null }) });
      const result = await response.json() as { error?: string; client?: { legal_name?: string; client_code?: string | null } };
      if (!response.ok) { setNotice(result.error ?? "Unable to save client profile."); setModal(null); return; }
      setNotice(`${result.client?.legal_name ?? form.name} saved to Supabase${result.client?.client_code ? ` with code ${result.client.client_code}` : " without a client code"}.`);
      setRefreshKey((value) => value + 1);
    } else if (href === "/finance/wallets" || href === "/finance/billing-invoices") {
      try {
        const amount = Number(form.amount);
        if (!form.client) { setNotice("Choose the client before saving a finance record."); return; }
        if (!Number.isFinite(amount) || amount <= 0) { setNotice("Enter a positive finance amount."); return; }
        if (href === "/finance/wallets" && (form.reason ?? "").trim().length < 3) { setNotice("Add a clear adjustment reason before changing a wallet."); return; }
        const endpoint = href === "/finance/wallets" ? "/v1/wallet" : "/v1/billing";
        const body = href === "/finance/wallets"
          ? { client_id: form.client, type: form.direction === "Credit" ? "credit" : "debit", amount, reference: form.reason.trim() }
          : { client_id: form.client, amount, invoice_number: (form.invoiceNumber ?? "").trim() || undefined, due_date: form.dueDate || undefined };
        const result = await pssApi<{ data: { id: string; status: string } }>(endpoint, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) });
        setNotice(`${href === "/finance/wallets" ? "Wallet transaction" : "Billing record"} ${result.data.id} persisted in production with status ${result.data.status}.`);
        setRefreshKey((value) => value + 1);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to persist the finance record."); }
    } else if (href === "/operations/pickups") {
      const required = ["client", "provider", "provider_account_id", "date", "window", "location", "contact_name", "contact_phone", "city", "state", "country", "pincode", "pieces", "weight"];
      const missing = required.find((key) => !form[key]?.trim());
      if (missing) { setNotice("Complete every required pickup field before scheduling."); return; }
      if (!/^\d{6}$/.test(form.pincode.trim())) { setNotice("Pickup PIN code must contain exactly six digits."); return; }
      if (!/^\d{10}$/.test(form.contact_phone.replace(/\D/g, ""))) { setNotice("Pickup contact phone must contain a valid ten-digit number."); return; }
      const pieces = Number(form.pieces);
      const weight = Number(form.weight);
      if (!Number.isInteger(pieces) || pieces < 1 || !Number.isFinite(weight) || weight <= 0) { setNotice("Pieces must be a positive whole number and total weight must be greater than zero."); return; }
      try {
        const result = await pssApi<{ data: { id: string; status: string } }>("/v1/pickups", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ client_id: form.client, provider: form.provider, provider_account_id: form.provider_account_id, shipment_id: form.shipment || undefined, requested_date: form.date, requested_time_slot: form.window.trim(), pickup_address: form.location.trim(), contact_name: form.contact_name.trim(), contact_phone: form.contact_phone.trim(), contact_email: form.contact_email.trim() || undefined, city: form.city.trim(), state: form.state.trim(), country: form.country, pincode: form.pincode.trim(), pieces, total_weight_kg: weight, notes: form.notes.trim() || undefined }) });
        setNotice(`Pickup ${result.data.id} persisted in production with status ${result.data.status}.`);
        setRefreshKey((value) => value + 1);
        setModal(null);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create the production pickup."); return; }
    } else if (href === "/operations/returns") {
      if (!form.client || !clients.some((client) => client.id === form.client)) { setNotice("Select a valid client before requesting a return."); return; }
      if (!form.shipment?.trim()) { setNotice("Choose the shipment that needs to be returned."); return; }
      if (!form.reason?.trim()) { setNotice("Enter the reason for the return request."); return; }
      try { const result = await pssApi<{ data: { id: string; status: string } }>("/v1/returns", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ client_id: form.client, shipment_id: form.shipment.trim(), reason: form.reason.trim() }) }); setNotice(`Return ${result.data.id} persisted in production with status ${result.data.status}.`); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create the production return."); return; }
    } else if (href.includes("api-webhooks")) {
      try { if (!form.client) { setNotice("Choose the client that will own this API key."); return; } const result = await pssApi<{ data: { id: string; secret?: string } }>("/v1/api-keys", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ client_id: form.client, name: form.name || "Client integration key", environment: form.environment || "live", expires_at: form.expiresAt || undefined, scopes: (form.scope || "shipments.read").split(",").map((value) => value.trim()).filter(Boolean) }) }); setCredentialSecret(result.data.secret ? { id: result.data.id, secret: result.data.secret } : null); setNotice(`API credential ${result.data.id} created for ${clientName(form.client, clients)}. Copy the secret below now; it will not be shown again.`); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create API credential."); }
    } else if (href === "/integrations/couriers") {
      try {
        if (modal?.startsWith("Manage client")) {
          await pssApi(`/v1/provider-account-policies/${encodeURIComponent(form.accountId)}`, { method: "PUT", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ client_id: form.client, enabled: form.enabled !== "false", priority: Number(form.priority || 100), confidence_score: Number(form.confidence || 0), rate_card_id: form.rateCardId || null, notes: form.notes || null }) });
          setNotice("Courier account policy saved for this client. Client booking and quote selection will respect it.");
        } else {
          const result = await pssApi<{ data: { id: string } }>("/v1/provider-accounts", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ provider: form.provider, account_name: form.accountName, account_type: form.accountType || "production", credential_secret_name: form.secretName, client_id: form.client || undefined, capabilities: (form.capabilities || "tracking").split(",").map((value) => value.trim()).filter(Boolean) }) }); setNotice(`Provider account binding ${result.data.id} created in production.`);
        }
        setRefreshKey((value) => value + 1);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to save the courier configuration."); }
    } else {
      setNotice(`${module.label} does not have a supported production write for this action.`);
    }
    setModal(null);
  }

  const readOnly = module.status !== "live" || (!hasSupportedWorkspaceWrite(module.href) && !hasSupportedRecordAction(module.href) && !/export|refresh|check|mark all read/i.test(meta.primary));
  const isShipmentModule = module.href === "/operations/shipments" || module.href === "/operations/tracking";
  if (module.href === "/operations/bookings") {
    return <MasterBookingWorkspace clients={clients} couriers={enabledCourierOptions} busy={actionInFlight} notice={notice} onSubmit={(values) => { setForm(values); window.setTimeout(() => void submit(), 0); }} />;
  }
  if (module.href === "/finance/margins") return <MarginWorkspace module={module} />;
  if (isShipmentModule) {
    if (module.href === "/operations/tracking") {
      return <MasterTrackingWorkspace
        rows={rows}
        clients={clients.map((client) => ({ ...client, assignedToEmployeeName: employeeName(client.assignedToEmployeeId ?? "", employees) }))}
        loading={liveRowsLoading}
        error={liveRowsError}
        total={shipmentTotal}
        onRefresh={() => setRefreshKey((value) => value + 1)}
      />;
    }
    return <MasterShipmentWorkspace
      module={module}
      rows={rows}
      clients={clients.map((client) => ({ ...client, assignedToEmployeeName: employeeName(client.assignedToEmployeeId ?? "", employees) }))}
      loading={liveRowsLoading}
      error={liveRowsError}
      loadingMore={shipmentLoadingMore}
      hasMore={shipmentHasMore}
      onLoadMore={loadMoreRecords}
      onRefresh={() => setRefreshKey((value) => value + 1)}
      total={shipmentTotal}
      statusCounts={shipmentStatusCounts}
    />;
  }
  if (module.href === "/integrations/couriers") {
    return <div className="flex min-h-full w-full flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-5 xl:flex-row xl:items-end xl:justify-between"><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ModuleIcon href={module.href} /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{meta.eyebrow}</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{module.label}</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Manage which courier account each client may use for quotes, bookings, and tracking.</p></div></div><div className="flex flex-wrap items-center gap-2"><StatusBadge tone="positive">Live API workspace</StatusBadge><button onClick={primaryAction} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-sm hover:bg-muted"><Plus className="size-3.5" />Create provider account</button></div></header>
      {notice && <button onClick={() => setNotice(null)} className="flex w-full items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-left text-xs text-primary"><span>{notice}</span><X className="size-4" /></button>}
      <CourierAccessTable rows={courierAccessRows} loading={courierAccessLoading} error={courierAccessError} actionInFlight={actionInFlight} onToggle={(row) => void toggleCourierAccess(row)} onRetry={() => setRefreshKey((value) => value + 1)} />
      <ActionModal module={module} open={Boolean(modal)} action={modal} form={form} setValue={setValue} onClose={() => setModal(null)} onSubmit={submit} clients={clients} employees={employees} courierOptions={courierOptions.map((provider) => provider[0].toUpperCase() + provider.slice(1))} />
    </div>;
  }
  if (module.status !== "live") {
    return <div className="flex min-h-full w-full flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><ModuleIcon href={module.href} /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{meta.eyebrow}</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{module.label}</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{module.description}</p></div></div><StatusBadge tone="warning">{module.status === "planned" ? "Coming soon" : "Read only"}</StatusBadge></header>
      <section className="max-w-3xl rounded-xl border border-border bg-card p-5 shadow-xs"><h2 className="text-sm font-semibold">{module.status === "planned" ? "This module is not enabled yet" : "This module is reference only"}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{module.status === "planned" ? "Its production data source and supported actions are not connected. No records or changes are being simulated here." : "Production settings are not connected to an editable settings store. This page will not save changes."}</p></section>
    </div>;
  }
  return <div className="flex min-h-full w-full flex-col gap-5">
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 xl:flex-row xl:items-end xl:justify-between"><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ModuleIcon href={module.href} /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{meta.eyebrow}</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{module.label}</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{module.description}</p></div></div><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={readOnly ? "warning" : "positive"}>{readOnly ? "Read-only · implementation pending" : "Live API workspace"}</StatusBadge><button onClick={primaryAction} disabled={readOnly} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-3.5" />{readOnly ? "Read-only" : meta.primary}</button></div></header>
    {notice && <button onClick={() => setNotice(null)} className="flex w-full items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-left text-xs text-primary"><span>{notice}</span><X className="size-4" /></button>}
    {liveRowsError && <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">{liveRowsError}{rows.length > 0 && <span className="ml-1">Previously loaded rows remain visible.</span>}<button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="ml-2 underline">Retry</button></div>}
    {credentialSecret && <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><p className="font-semibold text-amber-900 dark:text-amber-200">One-time API secret · {credentialSecret.id}</p><code className="mt-2 block break-all rounded-lg border border-amber-500/20 bg-background/70 p-3 font-mono text-xs">{credentialSecret.secret}</code><p className="mt-2 text-xs text-amber-800 dark:text-amber-200">Copy this secret now. It is held only in this page state and will not be retrieved or displayed again.</p><button type="button" onClick={() => setCredentialSecret(null)} className="mt-3 h-8 rounded-lg border border-amber-500/30 px-3 text-xs font-semibold text-amber-900 dark:text-amber-100">I copied the secret</button></section>}
    <section className="grid gap-3 sm:grid-cols-3">{metrics(module.href, clients, rows, ticketMetrics).map((item) => <Metric key={item.label} {...item} />)}</section>
    {(module.href === "/employee-activity" || module.href === "/clients/activity") && <p className="-mt-3 text-[11px] text-muted-foreground">Showing {rows.length.toLocaleString("en-IN")} of {activityTotal === null ? "an unknown total" : `${activityTotal.toLocaleString("en-IN")} events`}. Scroll to load older events; export includes loaded records only.</p>}
    {financeRoute && <p className="-mt-3 text-[11px] text-muted-foreground">Showing {rows.length.toLocaleString("en-IN")} of {financeTotal === null ? "an unknown total" : `${financeTotal.toLocaleString("en-IN")} records`}{financeHasMore ? ". Scroll to load more; export includes loaded records only." : ". Export includes currently loaded records only."}</p>}
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs"><div className="flex shrink-0 flex-col gap-2 border-b border-border/70 p-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={cn(inputClass, "h-9 pl-9 text-xs")} placeholder={`Search ${module.label.toLowerCase()}`} /></div><Dropdown label="Filter records" value={filter === "All" ? "" : filter} onChange={(value) => setFilter(value || "All")} options={[...new Set(rows.map((row) => row.status))]} className="w-full shrink-0 sm:w-48" /></div><div className="grid min-h-[420px] min-w-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="min-h-0 min-w-0 overflow-y-auto divide-y divide-border/70" onScroll={(event) => { const element = event.currentTarget; if (element.scrollTop + element.clientHeight >= element.scrollHeight - 160) loadMoreRecords(); }}>{filtered.map((row) => <button key={row.id} onClick={() => setSelectedId(row.id)} className={cn("grid w-full gap-3 px-4 py-3 text-left transition hover:bg-muted/40 sm:grid-cols-[10px_minmax(0,1fr)_140px_90px] sm:items-center", selected?.id === row.id && "bg-primary/5")}><span className={cn("size-2 rounded-full", row.status && `bg-${tone(row.status) === "critical" ? "destructive" : tone(row.status) === "warning" ? "amber-500" : tone(row.status) === "positive" ? "emerald-500" : "primary"}`)} /><span className="min-w-0"><span className="block truncate text-xs font-semibold">{row.title}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{row.detail}</span></span><span className="text-[11px] text-muted-foreground">{row.meta}</span><StatusBadge tone={tone(row.status)}>{row.status}</StatusBadge></button>)}{(shipmentLoadingMore || ticketLoadingMore || activityLoadingMore || financeLoadingMore) && <p className="p-3 text-center text-xs text-muted-foreground">{ticketLoadingMore ? "Loading more tickets…" : activityLoadingMore ? "Loading older activity…" : financeLoadingMore ? "Loading more finance records…" : "Loading more shipments…"}</p>}{filtered.length === 0 && <div className="p-4">{liveRowsLoading ? <p className="text-xs text-muted-foreground">Loading production records…</p> : liveRowsError ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3"><p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Production data could not be loaded.</p><p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">{liveRowsError}</p><button type="button" onClick={() => setRefreshKey((value) => value + 1)} className="mt-2 rounded-md border border-amber-500/40 px-2 py-1 text-[11px] font-semibold text-amber-900 dark:text-amber-100">Retry</button></div> : <EmptyState {...emptyStateCopy(module.href, query, filter)} />}</div>}</div><div className="flex min-h-0 min-w-0 flex-col border-t border-border/70 p-4 xl:border-l xl:border-t-0"><DetailPanel module={module} row={selected} onAction={performAction} onEdit={openShipmentEditor} /></div></div></section>
    <ActionModal module={module} open={Boolean(modal)} action={modal} form={form} setValue={setValue} onClose={() => setModal(null)} onSubmit={submit} clients={clients} employees={employees} courierOptions={courierOptions.map((provider) => provider[0].toUpperCase() + provider.slice(1))} />
    {shipmentEdit && <ShipmentEditModal values={shipmentEdit.values} open saving={actionInFlight} onChange={(values) => setShipmentEdit((current) => current ? { ...current, values } : current)} onClose={() => setShipmentEdit(null)} onSubmit={() => void saveShipmentEdit(shipmentEdit.values)} />}
  </div>;
}

type ShipmentPagination = { next_offset?: number; has_more?: boolean; total?: number; status_counts?: Record<string, number> };
type ActivityPagination = { next_offset?: number; has_more?: boolean; total?: number; limit?: number; offset?: number };
type FinancePagination = { next_offset?: number; has_more?: boolean; total?: number; limit?: number; offset?: number };
type FinancePageResponse = { data: Array<Record<string, unknown>>; pagination?: FinancePagination };
type FinancePageState = Record<"wallet" | "billing", { offset: number; total: number | null; hasMore: boolean }>;
type ShipmentEditValues = Record<string, string>;
type Row = MasterShipmentRow;
function recordRowsForList(items: Array<Record<string, unknown>>): Row[] { return items.map((item) => { const reference = item.reference ?? item.tracking_number ?? item.provider_reference ?? item.awb ?? item.id; const route = [item.origin, item.destination].filter((value) => typeof value === "string" && value.trim()).join(" → "); const provider = typeof item.provider === "string" && item.provider.trim() ? item.provider : ""; return { id: String(item.id ?? reference), title: String(item.title ?? item.name ?? reference ?? "Production record"), detail: String(item.detail ?? item.description ?? item.subject ?? [route, provider].filter(Boolean).join(" · ")), status: String(item.status ?? "pending"), meta: String(item.meta ?? item.created_at ?? item.updated_at ?? ""), raw: item }; }); }

function metrics(href: string, clients: ClientSummary[], rows: Row[] = [], ticketMetrics: { total: number | null; open: number | null; attention: number | null }) { if (href.includes("support")) return [{ label: "Total tickets", value: ticketMetrics.total === null ? "Unavailable" : String(ticketMetrics.total), tone: "navy" as Tone }, { label: "Open tickets", value: ticketMetrics.open === null ? "Unavailable" : String(ticketMetrics.open), tone: "warning" as Tone }, { label: "Needs attention", value: ticketMetrics.attention === null ? "Unavailable" : String(ticketMetrics.attention), tone: "critical" as Tone }]; if (href.includes("finance")) return [{ label: "Client accounts", value: String(clients.length), tone: "navy" as Tone }, { label: "Records loaded", value: String(rows.length), tone: "positive" as Tone }, { label: "Pending in loaded records", value: String(rows.filter((item) => /pending|review|warning/i.test(item.status)).length), tone: "warning" as Tone }]; return [{ label: "Records", value: String(rows.length), tone: "navy" as Tone }, { label: "Pending", value: String(rows.filter((item) => /pending|review|warning/i.test(item.status)).length), tone: "warning" as Tone }, { label: "Production records", value: String(rows.length), tone: "positive" as Tone }]; }

function emptyStateCopy(href: string, query: string, filter: string) {
  if (query.trim() || filter !== "All") return { title: "No matching records", description: "Clear the search or filter to view all production records." };
  if (href === "/integrations/channels") return { title: "No communication provider configured", description: "Email, WhatsApp, and SMS delivery remain unavailable until a production provider and sender credentials are configured." };
  if (href.includes("workflow-rules")) return { title: "Workflow rules are unavailable", description: "A production rule engine is not connected, so this workspace cannot create or run rules." };
  if (href.includes("notification-rules")) return { title: "Notification routing is unavailable", description: "Production event subscriptions and notification routing are not connected." };
  if (href.includes("scheduled-jobs")) return { title: "Scheduled job controls are unavailable", description: "The production scheduler registry and run controls are not connected." };
  if (href === "/system/settings") return { title: "Using platform defaults", description: "No workspace overrides have been saved; production defaults remain active." };
  return { title: "No production records yet", description: "This workspace is connected to production. Records will appear after the first authorized action." };
}

function Metric({ label, value, tone: itemTone }: { label: string; value: string; tone: Tone }) { return <div className="rounded-xl border border-border bg-card p-4 shadow-xs"><p className={cn("text-xl font-semibold", itemTone === "critical" && "text-destructive", itemTone === "warning" && "text-amber-600", itemTone === "positive" && "text-emerald-600", itemTone === "navy" && "text-primary")}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>; }
function ModuleIcon({ href }: { href: string }) { if (href.includes("finance")) return <Wallet className="size-[18px]" />; if (href.includes("support")) return <LifeBuoy className="size-[18px]" />; if (href.includes("client")) return <Users className="size-[18px]" />; if (href.includes("integrations")) return <Truck className="size-[18px]" />; if (href.includes("security")) return <ShieldCheck className="size-[18px]" />; if (href.includes("report") || href.includes("analytics") || href.includes("performance")) return <BarChart3 className="size-[18px]" />; if (href.includes("automation")) return <Settings2 className="size-[18px]" />; return <Package className="size-[18px]" />; }
function downloadCsv(label: string, rows: Row[]) { const csv = ["Title,Detail,Status,Meta", ...rows.map((row) => [row.title, row.detail, row.status, row.meta].map((value) => `"${value.replaceAll('"', '""')}"`).join(","))].join("\n"); const link = document.createElement("a"); link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; link.download = `${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-export.csv`; link.click(); }

function ShipmentEditModal({ values, open, saving, onChange, onClose, onSubmit }: { values: ShipmentEditValues; open: boolean; saving: boolean; onChange(values: ShipmentEditValues): void; onClose(): void; onSubmit(): void }) {
  const setValue = (key: string, value: string) => onChange({ ...values, [key]: value });
  const fields = [
    ["origin", "Origin"], ["destination", "Destination"], ["consignee", "Consignee"], ["declared_value", "Declared value"], ["pieces", "Pieces"], ["description", "Description"],
  ] as const;
  return <Modal open={open} onClose={onClose} title="Edit shipment details" description="Courier-owned references, status, reconciled weight, and ETA are provider-managed and cannot be edited here." size="lg"><div className="grid gap-4 sm:grid-cols-2">{fields.map(([key, label]) => <Field key={key} label={label}><input value={values[key] ?? ""} onChange={(event) => setValue(key, event.target.value)} className={inputClass} /></Field>)}</div><div className="mt-6 flex justify-end gap-2 border-t border-border/70 pt-4"><button type="button" onClick={onClose} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold">Cancel</button><button type="button" disabled={saving} onClick={onSubmit} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Check className="size-3.5" />{saving ? "Saving…" : "Save shipment"}</button></div></Modal>;
}

function DetailPanel({ module, row, onAction, onEdit }: { module: Props["module"]; row?: Row; onAction(action: string, id: string): void; onEdit?: (row: Row) => void }) {
  const { employees, clients } = useAdmin();
  const [renderTime] = useState(() => Date.now());
  const [assigneeId, setAssigneeId] = useState("");
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageReload, setMessageReload] = useState(0);
  const [ticketMessages, setTicketMessages] = useState<Array<{ id: string; message: string; author_user_id?: string | null; created_at?: string | null }>>([]);
  const isTicket = module.href === "/support/tickets" || module.href === "/support/sla-escalations";
  const ticketId = row?.id;
  const currentAssignee = String(row?.raw?.assigned_to_user_id ?? "");
  useEffect(() => { queueMicrotask(() => setAssigneeId(currentAssignee)); }, [ticketId, currentAssignee]);
  useEffect(() => {
    if (!isTicket || !ticketId) return;
    let active = true;
    void Promise.resolve().then(() => { if (active) { setMessageLoading(true); setMessageError(null); } });
    void pssApi<{ data: Array<{ id: string; message: string; author_user_id?: string | null; created_at?: string | null }> }>(`/v1/tickets/${encodeURIComponent(ticketId)}/messages`)
      .then((result) => { if (active) { setTicketMessages(result.data ?? []); setMessageError(null); } })
      .catch((error) => { if (active) { setTicketMessages([]); setMessageError(error instanceof Error ? error.message : "Ticket conversation could not be loaded."); } })
      .finally(() => { if (active) setMessageLoading(false); });
    return () => { active = false; };
  }, [isTicket, ticketId, messageReload]);
  const isShipment = module.href === "/operations/shipments" || module.href === "/operations/bookings" || module.href === "/operations/tracking";
  const sendReply = async () => {
    if (!row || !reply.trim() || replying) return;
    setReplying(true);
    try {
      await pssApi(`/v1/tickets/${encodeURIComponent(row.id)}/messages`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ message: reply.trim() }) });
      setReply("");
      try {
        const result = await pssApi<{ data: Array<{ id: string; message: string; author_user_id?: string | null; created_at?: string | null }> }>(`/v1/tickets/${encodeURIComponent(row.id)}/messages`);
        setTicketMessages(result.data ?? []);
        setMessageError(null);
      } catch {
        setMessageError("Reply sent, but the conversation could not be refreshed. Retry to reload it.");
      }
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Reply could not be sent.");
    } finally {
      setReplying(false);
    }
  };
  if (!row) return <div className="grid h-full min-h-52 place-items-center text-center text-xs text-muted-foreground">Select a record to inspect its relationships and next action.</div>;
  const isPickup = module.href === "/operations/pickups";
  const assignedTo = String(row.raw?.assigned_to_user_id ?? "");
  const selectedAssignee = assigneeId || assignedTo;
  const slaState = isTicket ? getTicketSlaState({ status: row.status, slaDueAt: row.raw?.sla_due_at, escalationState: row.raw?.escalation_state }) : null;
  const canAct = isPickup || module.href === "/operations/exceptions" || module.href === "/tasks" || module.href === "/support/tickets" || module.href === "/support/sla-escalations" || module.href === "/finance/wallets" || module.href === "/finance/billing-invoices" || hasSupportedRecordAction(module.href) || (module.href === "/integrations/api-webhooks" && !row.id.startsWith("webhook-") && !row.id.startsWith("integration-")) || (module.href === "/integrations/couriers" && row.id.startsWith("account-"));
  const action = isPickup ? `Assign pickup:${assigneeId}` : isTicket && assigneeId && assigneeId !== assignedTo ? `Assign ticket:${assigneeId}` : module.href === "/operations/exceptions" ? "Resolve exception" : module.href === "/tasks" ? "Complete task" : module.href === "/support/tickets" ? "Resolve ticket" : module.href === "/finance/wallets" || module.href === "/finance/billing-invoices" ? "Approve finance record" : module.href === "/integrations/api-webhooks" ? "Revoke credential" : module.href === "/integrations/couriers" ? "Manage client access" : module.href.includes("scheduled") ? "Run job" : module.href.includes("security") ? "Revoke session" : "Escalate ticket";
  const actionLabel = isPickup ? "Assign pickup" : action.startsWith("Assign ticket:") ? "Assign ticket" : action;
  const createdAt = row.raw?.created_at ? Date.parse(String(row.raw.created_at)) : NaN;
  const ticketAge = Number.isFinite(createdAt) ? `${Math.max(0, Math.floor((renderTime - createdAt) / 3_600_000))}h` : "Unavailable";
  const slaLabel = slaState?.replaceAll("_", " ") ?? "Unavailable";
  const ticketThread = getTicketThreadView(row.raw?.description, ticketMessages);
  return <div className="space-y-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Selected record</p><h2 className="mt-1 text-base font-semibold">{row.title}</h2><p className="mt-1 text-xs text-muted-foreground">{row.detail}</p></div>{isShipment && <ShipmentIdentifierGrid raw={row.raw ?? {}} />}
    {isTicket && <div className="grid grid-cols-2 gap-2"><Info label="Client" value={clientName(String(row.raw?.client_id ?? ""), clients)} /><Info label="Assigned to" value={assignedTo ? employeeName(assignedTo, employees) : "Unassigned"} /><Info label="Priority" value={String(row.raw?.priority ?? "Normal")} /><Info label="Ticket age" value={ticketAge} /><Info label="SLA state" value={slaLabel} /><Info label="SLA deadline" value={row.raw?.sla_due_at ? new Date(String(row.raw.sla_due_at)).toLocaleString() : "Unavailable"} /></div>}
    {module.href === "/clients" && <Link href={`/clients/onboarding?client=${encodeURIComponent(row.id)}`} className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-primary/30 bg-primary/5 px-3 text-xs font-semibold text-primary hover:bg-primary/10">Open client onboarding &amp; KYC</Link>}
    <div className="grid gap-2"><Info label="Status" value={row.status} /><Info label="Context" value={row.meta} /><Info label="Data source" value={dataSourceLabel(module.href)} /></div>
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">Related records, activity, notifications, and audit evidence are updated by supported actions.</div>
    {isTicket && <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3"><p className="text-xs font-semibold">Request &amp; conversation</p>{ticketThread.initialRequest && <div className="rounded-lg border border-border bg-background p-2 text-[11px] leading-5"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Initial request</p><p className="mt-1 whitespace-pre-wrap">{ticketThread.initialRequest}</p></div>}{messageLoading ? <p className="text-[11px] text-muted-foreground">Loading replies…</p> : messageError ? <div className="text-[11px] text-destructive">{messageError}<button type="button" onClick={() => setMessageReload((value) => value + 1)} className="ml-2 underline">Retry</button></div> : ticketThread.replies.length ? <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-2">{ticketThread.replies.map((message) => <div key={message.id} className="rounded-lg bg-muted/50 p-2 text-[11px] leading-5"><p className="text-[10px] text-muted-foreground">{message.author_user_id ?? "Support"} · {message.created_at ? new Date(message.created_at).toLocaleString() : "Recently"}</p><p className="mt-1 whitespace-pre-wrap">{message.message}</p></div>)}</div> : <p className="text-[11px] text-muted-foreground">No replies recorded yet.</p>}<textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} className={cn(inputClass, "h-auto py-2")} placeholder="Write a production support reply" /><button type="button" disabled={!reply.trim() || replying} onClick={() => void sendReply()} className="h-9 w-full rounded-lg bg-primary text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{replying ? "Sending…" : "Send reply"}</button></div>}
    {isPickup && <label className="grid gap-1.5 text-xs font-semibold"><span>Assign to active employee</span><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={inputClass}><option value="">Choose employee</option>{employees.filter((employee) => employee.status === "Active").map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>}
    {isTicket && <label className="grid gap-1.5 text-xs font-semibold"><span>Assign ticket to employee</span><select value={selectedAssignee} onChange={(event) => setAssigneeId(event.target.value)} className={inputClass}><option value="">Unassigned</option>{employees.filter((employee) => employee.status === "Active").map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>}
    {isShipment && onEdit ? <button onClick={() => onEdit(row)} className="h-9 w-full rounded-lg bg-primary text-xs font-semibold text-primary-foreground">Edit shipment details</button> : canAct ? <button disabled={(isPickup && !assigneeId) || (isTicket && action.startsWith("Assign ticket:") === false && ["Resolved", "Closed"].includes(row.status))} onClick={() => onAction(action, row.id)} className="h-9 w-full rounded-lg bg-primary text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{actionLabel}</button> : <p className="text-[11px] text-muted-foreground">{module.capabilities.slice(0, 2).join(" · ")}</p>}</div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/40 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-xs font-medium">{value}</p></div>; }
function PickupActionModal({ open, action, form, setValue, onClose, onSubmit, clients, courierOptions }: { open: boolean; action: string | null; form: Record<string, string>; setValue(key: string, value: string): void; onClose(): void; onSubmit(): void; clients: { id: string; name: string }[]; courierOptions: string[] }) {
  const [accounts, setAccounts] = useState<Array<{ id: string; provider: string; account_name: string }>>([]);
  const [accountsClientId, setAccountsClientId] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorClientId, setLoadErrorClientId] = useState("");
  const [accountReload, setAccountReload] = useState(0);
  useEffect(() => {
    if (!open || !form.client) return;
    let active = true;
    void pssApi<{ data: Array<{ id: string; provider: string; account_name: string; enabled?: boolean }> }>(`/v1/provider-account-policies?client_id=${encodeURIComponent(form.client)}`)
      .then((result) => { if (active) { setAccounts((result.data ?? []).filter((account) => account.enabled === true)); setAccountsClientId(form.client); setLoadError(null); setLoadErrorClientId(""); } })
      .catch((error) => { if (active) { setAccounts([]); setAccountsClientId(form.client); setLoadError(error instanceof Error ? error.message : "Courier accounts could not be loaded for this client."); setLoadErrorClientId(form.client); } })
    return () => { active = false; };
  }, [accountReload, form.client, open]);
  const providerAccounts = accountsClientId === form.client ? accounts.filter((account) => account.provider === (form.provider ?? "").toLowerCase()) : [];
  const loading = Boolean(open && form.client && accountsClientId !== form.client);
  const currentLoadError = loadErrorClientId === form.client ? loadError : null;
  const fields: Array<{ key: string; label: string; kind?: "text" | "date" | "email" | "tel" | "number" | "select"; options?: Array<{ value: string; label: string }>; required?: boolean }> = [
    { key: "client", label: "Client", kind: "select", required: true, options: clients.map((client) => ({ value: client.id, label: client.name })) },
    { key: "provider", label: "Courier", kind: "select", required: true, options: courierOptions.map((provider) => ({ value: provider.toLowerCase(), label: provider })) },
    { key: "provider_account_id", label: "Active courier account", kind: "select", required: true, options: providerAccounts.map((account) => ({ value: account.id, label: account.account_name })) },
    { key: "shipment", label: "Shipment reference (optional)" },
    { key: "date", label: "Pickup date", kind: "date", required: true },
    { key: "window", label: "Pickup time window", required: true },
    { key: "location", label: "Pickup address", required: true },
    { key: "contact_name", label: "Pickup contact name", required: true },
    { key: "contact_phone", label: "Pickup contact phone", kind: "tel", required: true },
    { key: "contact_email", label: "Pickup contact email (optional)", kind: "email" },
    { key: "city", label: "Pickup city", required: true },
    { key: "state", label: "Pickup state", required: true },
    { key: "country", label: "Country", kind: "select", required: true, options: [{ value: "India", label: "India" }] },
    { key: "pincode", label: "Pickup PIN code", kind: "text", required: true },
    { key: "pieces", label: "Pieces", kind: "number", required: true },
    { key: "weight", label: "Total weight (kg)", kind: "number", required: true },
    { key: "notes", label: "Notes (optional)" },
  ];
  return <Modal open={open} onClose={onClose} title={action ?? "Schedule pickup"} description="Choose a client-authorized active courier account and enter the pickup details required by the provider." size="lg">
    {currentLoadError && <div role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"><p>Courier accounts could not be loaded: {currentLoadError}</p><button type="button" onClick={() => setAccountReload((value) => value + 1)} className="mt-2 rounded-md border border-destructive/30 px-2 py-1 font-semibold">Retry account lookup</button></div>}
    <div className="grid gap-4 sm:grid-cols-2">{fields.map((field) => <Field key={field.key} label={`${field.label}${field.required ? " *" : ""}`}>
      {field.kind === "select" ? <Dropdown label={field.label} value={form[field.key] ?? ""} onChange={(value) => {
        setValue(field.key, value);
        if (field.key === "client") { setValue("provider", ""); setValue("provider_account_id", ""); }
        if (field.key === "provider") setValue("provider_account_id", "");
      }} options={field.options ?? []} /> : <input type={field.kind ?? "text"} value={form[field.key] ?? ""} onChange={(event) => setValue(field.key, event.target.value)} className={inputClass} placeholder={field.label} required={field.required} />}
    </Field>)}</div>
    <p className="mt-3 text-xs text-muted-foreground">{loading && form.client ? "Loading client courier accounts…" : form.client && form.provider && providerAccounts.length === 0 && !currentLoadError ? "No active account is enabled for this client and courier." : "* Required by the pickup API. No address or courier account is assumed."}</p>
    <div className="mt-6 flex justify-end gap-2 border-t border-border/70 pt-4"><button type="button" onClick={onClose} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold">Cancel</button><button type="button" disabled={loading || Boolean(currentLoadError) || (Boolean(form.client && form.provider) && providerAccounts.length === 0)} onClick={onSubmit} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Check className="size-3.5" />Schedule pickup</button></div>
  </Modal>;
}

function ShipmentIdentifierGrid({ raw }: { raw: Record<string, unknown> }) { const value = (key: string) => { const result = String(raw[key] ?? "").trim(); return result || "Not available"; }; const awb = value("master_awb") !== "Not available" ? value("master_awb") : value("tracking_number") !== "Not available" ? value("tracking_number") : value("provider_reference"); return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><Info label="Shipment record" value={value("id")} /><Info label="LR / LRN" value={value("lr_number")} /><Info label="AWB / waybill" value={awb} /><Info label="Invoice number" value={value("invoice_number")} /><Info label="Pickup reference" value={value("pickup_reference")} /><Info label="Provider booking ID" value={value("provider_booking_id")} /></div>; }

function CourierAccessTable({ rows, loading, error, actionInFlight, onToggle, onRetry }: { rows: CourierAccessRow[]; loading: boolean; error: string | null; actionInFlight: boolean; onToggle(row: CourierAccessRow): void; onRetry(): void }) {
  return <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
    <div className="border-b border-border/70 p-4"><h2 className="text-sm font-semibold">Client courier access</h2><p className="mt-1 text-xs text-muted-foreground">Each row is one client-to-courier permission. Toggle access without opening a separate form.</p></div>
    {loading ? <div className="p-6 text-xs text-muted-foreground">Loading active courier accounts for each client…</div> : error ? <div className="m-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4"><p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Courier access could not be loaded.</p><p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">{error}</p><button type="button" onClick={onRetry} className="mt-3 rounded-md border border-amber-500/40 px-2 py-1 text-[11px] font-semibold text-amber-900 dark:text-amber-100">Retry</button></div> : rows.length === 0 ? <div className="p-6 text-xs text-muted-foreground">No active provider accounts are available for the current clients.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="border-b border-border/70 bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Client name</th><th className="px-4 py-3">Courier account</th><th className="px-4 py-3">Access</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-border/70">{rows.map((row) => <tr key={`${row.clientId}-${row.id}`} className="hover:bg-muted/20"><td className="px-4 py-3 font-semibold">{row.clientName}</td><td className="px-4 py-3"><p className="font-semibold">{row.provider[0]?.toUpperCase() + row.provider.slice(1)}</p><p className="mt-1 text-[11px] text-muted-foreground">{row.account_name}</p></td><td className="px-4 py-3"><StatusBadge tone={row.enabled ? "positive" : "critical"}>{row.enabled ? "ON" : "OFF"}</StatusBadge></td><td className="px-4 py-3 text-right"><button type="button" disabled={actionInFlight} onClick={() => onToggle(row)} className={cn("inline-flex h-8 min-w-20 items-center justify-center rounded-lg border px-3 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50", row.enabled ? "border-destructive/30 text-destructive hover:bg-destructive/10" : "border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300")}>{row.enabled ? "Turn off" : "Turn on"}</button></td></tr>)}</tbody></table></div>}
  </section>;
}

function ActionModal({ module, open, action, form, setValue, onClose, onSubmit, clients, employees, courierOptions }: { module: Props["module"]; open: boolean; action: string | null; form: Record<string, string>; setValue(key: string, value: string): void; onClose(): void; onSubmit(): void; clients: { id: string; name: string }[]; employees: { id: string; name: string }[]; courierOptions: string[] }) {
  const href = module.href;
  useEffect(() => {
    if (!open || href !== "/integrations/couriers" || !action?.startsWith("Manage client") || !form.accountId || !form.client) return;
    void pssApi<{ data: Array<{ id: string; enabled?: boolean; priority?: number; confidence_score?: number; rate_card_id?: string | null; notes?: string | null }> }>(`/v1/provider-account-policies?client_id=${encodeURIComponent(form.client)}`)
      .then((result) => {
        const policy = result.data.find((item) => item.id === form.accountId);
        if (!policy) return;
        setValue("enabled", policy.enabled === false ? "false" : "true");
        setValue("priority", String(policy.priority ?? 100));
        setValue("confidence", String(policy.confidence_score ?? 0));
        setValue("rateCardId", policy.rate_card_id ?? "");
        setValue("notes", policy.notes ?? "");
      })
      .catch(() => undefined);
  }, [action, form.accountId, form.client, href, open, setValue]);
  if (href === "/integrations/couriers") {
    if (action?.startsWith("Manage client")) {
      const policyFields = [
        { key: "client", label: "Client", options: clients.map((item) => item.id) },
        { key: "enabled", label: "Account available to this client", options: ["true", "false"] },
        { key: "priority", label: "Routing priority (lower wins)" },
        { key: "confidence", label: "Confidence score (0–100)" },
        { key: "rateCardId", label: "Rate card reference (optional)" },
        { key: "notes", label: "Notes (optional)" },
      ];
      return <Modal open={open} onClose={onClose} title="Manage courier account for client" description="This policy is enforced server-side for booking, tracking, and quote selection." size="lg"><div className="grid gap-4 sm:grid-cols-2">{policyFields.map((field) => <Field key={field.key} label={field.label}>{field.options ? <Dropdown label={field.label} value={form[field.key] ?? ""} onChange={(value) => setValue(field.key, value)} options={field.options.map((option) => ({ value: option, label: option.includes("-") ? clientName(option, clients) : option === "true" ? "Enabled" : option === "false" ? "Disabled" : option }))} /> : <input type="text" value={form[field.key] ?? ""} onChange={(event) => setValue(field.key, event.target.value)} className={inputClass} placeholder={field.label} />}</Field>)}</div><div className="mt-6 flex justify-end gap-2 border-t border-border/70 pt-4"><button onClick={onClose} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold">Cancel</button><button onClick={onSubmit} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><Check className="size-3.5" />Save policy</button></div></Modal>;
    }
    const providerFields = [
      { key: "provider", label: "Provider", options: ["delhivery", "ekart", "trackon", "xpressbees", "rivigo"] },
      { key: "accountName", label: "Account name" },
      { key: "accountType", label: "Account type", options: ["production", "staging"] },
      { key: "secretName", label: "Cloudflare secret name" },
      { key: "client", label: "Client binding (optional)", options: clients.map((item) => item.id) },
      { key: "capabilities", label: "Capabilities" },
    ];
    return <Modal open={open} onClose={onClose} title={action ?? "Courier account"} description="This action is persisted through the authenticated production API." size="lg"><div className="grid gap-4 sm:grid-cols-2">{providerFields.map((field) => <Field key={field.key} label={field.label}>{field.options ? <Dropdown label={field.label} value={form[field.key] ?? ""} onChange={(value) => setValue(field.key, value)} options={field.options.map((option) => ({ value: option, label: option.includes("-") ? clientName(option, clients) : option }))} /> : <input type="text" value={form[field.key] ?? ""} onChange={(event) => setValue(field.key, event.target.value)} className={inputClass} placeholder={field.label} />}</Field>)}</div><div className="mt-6 flex justify-end gap-2 border-t border-border/70 pt-4"><button onClick={onClose} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold">Cancel</button><button onClick={onSubmit} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><Check className="size-3.5" />Save to production</button></div></Modal>;
  }
  const availableCouriers = courierOptions.length ? courierOptions : ["Dispatch pending"];
  if (href === "/operations/pickups") {
    return <PickupActionModal open={open} action={action} form={form} setValue={setValue} onClose={onClose} onSubmit={onSubmit} clients={clients} courierOptions={courierOptions} />;
  }
  const fields: { key: string; label: string; type?: "text" | "date"; options?: string[] }[] = href === "/tasks" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "title", label: "Task title" }, { key: "description", label: "Description" }, { key: "priority", label: "Priority", options: ["Low", "Medium", "High", "Urgent"] }, { key: "dueAt", label: "Due date", type: "date" }, { key: "assignee", label: "Assignee", options: employees.map((item) => item.id) }] : href === "/operations/exceptions" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "shipment", label: "Shipment reference" }, { key: "category", label: "Category" }, { key: "title", label: "Exception title" }, { key: "severity", label: "Severity", options: ["low", "medium", "high", "critical"] }, { key: "assignee", label: "Assignee", options: employees.map((item) => item.id) }, { key: "details", label: "Details" }] : href === "/operations/pickups" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "shipment", label: "Shipment reference" }, { key: "date", label: "Pickup date", type: "date" }, { key: "window", label: "Pickup window" }, { key: "location", label: "Pickup location" }, { key: "notes", label: "Notes" }] : href === "/operations/returns" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "shipment", label: "Shipment reference" }, { key: "reason", label: "Return reason" }] : href === "/operations/bookings" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "consignor", label: "Consignor name" }, { key: "consignorAddress", label: "Consignor complete address" }, { key: "consignorCity", label: "Consignor city" }, { key: "consignorState", label: "Consignor state" }, { key: "consignorPincode", label: "Consignor pincode" }, { key: "consignorPhone", label: "Consignor phone" }, { key: "consignee", label: "Consignee name" }, { key: "consigneeAddress", label: "Consignee complete address" }, { key: "consigneeCity", label: "Consignee city" }, { key: "consigneeState", label: "Consignee state" }, { key: "consigneePincode", label: "Consignee pincode" }, { key: "consigneePhone", label: "Consignee phone" }, { key: "origin", label: "Origin city" }, { key: "destination", label: "Destination city" }, { key: "weight", label: "Weight (kg)" }, { key: "pieces", label: "Pieces" }, { key: "courier", label: "Courier", options: availableCouriers }, { key: "paymentMode", label: "Payment mode", options: ["Prepaid", "COD"] }, { key: "codAmount", label: "COD amount" }] : href === "/support/tickets" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "shipment", label: "Shipment reference (optional)" }, { key: "subject", label: "Subject" }, { key: "priority", label: "Priority", options: ["Urgent", "High", "Normal"] }, { key: "message", label: "Initial message" }] : href === "/clients" || href === "/clients/onboarding" ? [{ key: "name", label: "Client name" }, { key: "clientCode", label: "Client code (optional)" }, { key: "city", label: "City" }, { key: "assignee", label: "Responsible employee", options: employees.map((item) => item.id) }] : href === "/departments" ? [{ key: "name", label: "Department name" }, { key: "manager", label: "Manager", options: employees.map((item) => item.id) }, { key: "capacity", label: "Capacity %" }] : href.includes("finance") ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "amount", label: "Amount" }, { key: "direction", label: "Direction", options: ["Debit", "Credit"] }, { key: "reason", label: "Reason" }] : href === "/insights/reports" ? [{ key: "name", label: "Report name" }, { key: "dateFrom", label: "From", type: "date" }, { key: "dateTo", label: "To", type: "date" }] : href === "/system/settings" ? [{ key: "timezone", label: "Timezone", options: ["Asia/Kolkata", "UTC", "Asia/Dubai"] }, { key: "retention", label: "Shipment retention", options: ["30 days", "90 days", "365 days"] }, { key: "courier", label: "Default courier", options: availableCouriers }, { key: "walletApproval", label: "Wallet approval", options: ["true", "false"] }, { key: "alerts", label: "Operational alerts", options: ["true", "false"] }] : href.includes("workflow-rules") || href.includes("notification-rules") ? [{ key: "name", label: "Rule name" }, { key: "trigger", label: "Trigger" }, { key: "condition", label: "Condition" }, { key: "action", label: "Action" }] : href.includes("api-webhooks") ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "name", label: "Credential name" }, { key: "environment", label: "Environment", options: ["live", "test"] }, { key: "expiresAt", label: "Expiry (optional)", type: "date" }, { key: "scope", label: "Scopes (comma-separated)" }] : [{ key: "name", label: `${action ?? "Record"} name` }, { key: "notes", label: "Notes" }];
  return <Modal open={open} onClose={onClose} title={action ?? "Workspace action"} description="This action is persisted through the authenticated production API." size="lg"><div className="grid gap-4 sm:grid-cols-2">{fields.map((field) => <Field key={field.key} label={field.label}>{field.options ? <Dropdown label={field.label} value={form[field.key] ?? ""} onChange={(value) => setValue(field.key, value)} options={field.options.map((option) => ({ value: option, label: option.includes("-") ? (field.key === "client" ? clientName(option, clients) : employeeName(option, employees)) : option }))} /> : <input type={field.type ?? "text"} value={form[field.key] ?? ""} onChange={(event) => setValue(field.key, event.target.value)} className={inputClass} placeholder={field.label} />}</Field>)}</div><div className="mt-6 flex justify-end gap-2 border-t border-border/70 pt-4"><button onClick={onClose} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold">Cancel</button><button onClick={onSubmit} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><Check className="size-3.5" />Save to production</button></div></Modal>;
}

