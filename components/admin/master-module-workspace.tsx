"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Check, LifeBuoy, Package, Plus, Search, Settings2, ShieldCheck, Truck, Users, Wallet, X } from "lucide-react";
import { useAdmin } from "@/components/admin/admin-provider";
import { EmptyState, Field, Modal, StatusBadge, inputClass } from "@/components/admin/ui";
import Dropdown from "@/components/ui/dropdown";
import type { AdminNavItem } from "@/lib/admin-navigation";
import type { MasterWorkspaceState } from "@/lib/master-domain";
import { cn } from "@/lib/utils";
import { pssApi } from "@/lib/pss-api";

type Tone = "neutral" | "positive" | "warning" | "critical" | "navy";
type Props = { module: Omit<AdminNavItem, "icon"> };
type ClientSummary = { id: string; name: string; code?: string; city?: string; assignedToEmployeeId?: string; status?: string; shipmentVolume?: number };

const routeMeta: Record<string, { eyebrow: string; primary: string; description?: string }> = {
  "/alerts-attention": { eyebrow: "Attention queue", primary: "Acknowledge selected" },
  "/operations/shipments": { eyebrow: "Shipment register", primary: "Export shipments" },
  "/operations/bookings": { eyebrow: "Booking desk", primary: "New booking" },
  "/operations/tracking": { eyebrow: "Movement control", primary: "Refresh tracking" },
  "/operations/pickups": { eyebrow: "Pickup control", primary: "Schedule pickup" },
  "/operations/returns": { eyebrow: "RTO desk", primary: "Review documents" },
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
  "/system/settings",
]);

function hasSupportedWorkspaceWrite(href: string) { return supportedWorkspaceWrites.has(href); }
function hasSupportedRecordAction(href: string) { return href === "/system/security-sessions"; }

function tone(status: string): Tone { return /critical|breached|failed|delayed|escalated|high|hold|disconnected/i.test(status) ? "critical" : /pending|review|warning|assigned|in progress|degraded|due/i.test(status) ? "warning" : /delivered|approved|paid|active|healthy|connected|resolved|settled|ready|collected/i.test(status) ? "positive" : "neutral"; }
function clientName(id: string, clients: { id: string; name: string }[]) { return clients.find((client) => client.id === id)?.name ?? "Unknown client"; }
function employeeName(id: string, employees: { id: string; name: string }[]) { return employees.find((employee) => employee.id === id)?.name ?? "Unassigned"; }
function dataSourceLabel(href: string) {
  if (href === "/clients") return "Supabase client_accounts";
  if (href === "/clients/onboarding") return "Cloudflare D1 onboarding record";
  if (href === "/system/security-sessions") return "Supabase Auth session";
  if (href === "/integrations/couriers") return "Cloudflare Worker provider state";
  if (href === "/integrations/api-webhooks") return "Cloudflare D1 integration records";
  if (href === "/clients/activity" || href === "/employee-activity") return "Cloudflare D1 activity records";
  return "Cloudflare D1 production record";
}
export default function MasterModuleWorkspace({ module }: Props) {
  const { clients, employees, workspace } = useAdmin();
  const router = useRouter();
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [enabledCourierOptions, setEnabledCourierOptions] = useState<string[]>([]);
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
    void Promise.resolve().then(() => { if (active) setLiveRowsLoading(true); });
    const recordRows = (items: Array<Record<string, unknown>>) => items.map((item) => ({ id: String(item.id), title: String(item.title ?? item.name ?? item.reference ?? "Untitled record"), detail: String(item.detail ?? item.description ?? item.subject ?? ""), status: String(item.status ?? "pending"), meta: String(item.meta ?? item.created_at ?? "") }));
    const source = module.href === "/operations/shipments" || module.href === "/operations/bookings" || module.href === "/operations/tracking"
      ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/shipments").then((result) => recordRows(result.data ?? []))
      : module.href === "/operations/pickups"
        ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/pickups").then((result) => recordRows(result.data ?? []))
        : module.href === "/operations/returns"
          ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/returns").then((result) => recordRows(result.data ?? []))
          : module.href === "/operations/exceptions"
            ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/exceptions").then((result) => recordRows(result.data ?? []))
            : module.href === "/support/tickets" || module.href === "/support/sla-escalations"
              ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/tickets").then((result) => recordRows(result.data ?? []))
              : module.href === "/finance/wallets"
                ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/wallet").then((result) => (result.data ?? []).map((item) => ({ id: String(item.id), title: `${String(item.type ?? "adjustment")} · ₹${Number(item.amount ?? 0).toLocaleString("en-IN")}`, detail: `${String(item.client_id ?? "Client")} · ${String(item.reference ?? "No reference")}`, status: String(item.status ?? "pending"), meta: `Balance after: ₹${Number(item.balance_after ?? 0).toLocaleString("en-IN")} · ${String(item.created_at ?? "")}` })))
              : module.href === "/finance/billing-invoices"
                ? pssApi<{ data: Array<Record<string, unknown>> }>("/v1/billing").then((result) => recordRows(result.data ?? []))
              : module.href === "/finance/transactions"
                ? Promise.all([
                  pssApi<{ data: Array<Record<string, unknown>> }>("/v1/wallet"),
                  pssApi<{ data: Array<Record<string, unknown>> }>("/v1/billing"),
                ]).then(([wallet, billing]) => [
                  ...recordRows(wallet.data ?? []).map((row) => ({ ...row, title: `Wallet · ${row.title}` })),
                  ...recordRows(billing.data ?? []).map((row) => ({ ...row, title: `Billing · ${row.title}` })),
                ])
              : module.href === "/integrations/couriers"
      ? Promise.all([
        pssApi<{ data: Record<string, { configured?: boolean; enabled?: boolean; capabilities?: string[]; activation_blockers?: string[] }> }>("/v1/provider-capabilities"),
        pssApi<{ data: Array<{ id: string; provider: string; account_name: string; account_type: string; client_id?: string | null; status: string; credential_secret_name: string }> }>("/v1/provider-accounts"),
      ]).then(([capabilities, accounts]) => [
        ...Object.entries(capabilities.data).map(([provider, value]) => ({ id: provider, title: provider[0].toUpperCase() + provider.slice(1), detail: (value.capabilities ?? []).join(" · ") || "No enabled capabilities", status: value.enabled ? "Enabled" : value.configured ? "Configured, disabled" : "Disabled", meta: value.enabled ? "Ready for provider calls" : (value.activation_blockers ?? ["provider_calls_disabled"]).join(" · ") })),
        ...accounts.data.map((account) => ({ id: `account-${account.id}`, title: `${account.provider} · ${account.account_name}`, detail: `${account.account_type} · ${account.client_id ?? "Default account"}`, status: account.status, meta: `Secret binding ${account.credential_secret_name}` })),
      ])
              : module.href === "/integrations/api-webhooks"
                ? Promise.all([
          pssApi<{ data: Array<{ id: string; name: string; key_prefix: string; status: string; last_used_at?: string | null; created_at?: string | null }> }>("/v1/api-keys"),
          pssApi<{ data: Array<{ id: string; provider: string; event_id: string; event_type: string; status: string; processed_at?: string | null; created_at?: string | null }> }>("/v1/webhook-events"),
          pssApi<{ data: Array<{ id: string; provider: string; operation: string; status: string; error_code?: string | null; updated_at?: string | null }> }>("/v1/integration-requests"),
        ]).then(([keys, webhooks, requests]) => [
          ...keys.data.map((item) => ({ id: item.id, title: item.name, detail: `${item.key_prefix} · API key`, status: item.status, meta: item.last_used_at ? `Last used ${item.last_used_at}` : `Created ${item.created_at ?? "recently"}` })),
          ...webhooks.data.map((item) => ({ id: `webhook-${item.id}`, title: `${item.provider} webhook`, detail: `${item.event_type} · ${item.event_id}`, status: item.status, meta: item.processed_at ? `Processed ${item.processed_at}` : `Received ${item.created_at ?? "recently"}` })),
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
      : pssApi<{ data: Array<Record<string, unknown>> }>(`/v1/master-records?kind=${encodeURIComponent(module.href)}`).then((result) => recordRows(result.data || []));
    void source
      .then((result) => { if (!active) return; setLiveRows(result as Row[]); setLiveRowsLoading(false); })
      .catch(() => { if (active) { setLiveRows([]); setLiveRowsLoading(false); } });
    return () => { active = false; };
  }, [module.href, refreshKey]);

  // Production records are the only source rendered by released workspaces.
  // Empty API responses must remain empty; domain fixtures are never a fallback.
  const rows = useMemo(() => liveRows, [liveRows]);
  const filtered = rows.filter((row) => `${row.title} ${row.detail} ${row.status}`.toLowerCase().includes(query.toLowerCase()) && (filter === "All" || row.status === filter));
  const selected = rows.find((row) => row.id === selectedId) ?? filtered[0];
  const setValue = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  function primaryAction() {
    if (/export/i.test(meta.primary)) { downloadCsv(module.label, rows); setNotice(`${module.label} export downloaded locally.`); return; }
    if (/refresh|check/i.test(meta.primary)) { setRefreshKey((value) => value + 1); setNotice(`${module.label} refreshed from production.`); return; }
    if (/mark all read/i.test(meta.primary)) { void Promise.all(liveRows.filter((item) => item.status !== "Read").map((item) => pssApi(`/v1/notifications/${item.id}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ is_read: true }) }))).then(() => { setNotice("All notifications were marked as read in production."); setRefreshKey((value) => value + 1); }).catch((error) => setNotice(error instanceof Error ? error.message : "Unable to update notifications.")); return; }
    if (/run selected|revoke selected|acknowledge selected|escalate selected/i.test(meta.primary)) { if (!selected) { setNotice("Select a production record before taking this action."); return; } void performAction(meta.primary, selected.id); return; }
    if (!hasSupportedWorkspaceWrite(module.href)) { setNotice(`${module.label} is currently read-only. No production write is enabled for this module.`); return; }
    setForm({}); setModal(meta.primary);
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
    if (href === "/integrations/couriers" && id.startsWith("account-")) { try { await pssApi(`/v1/provider-accounts/${encodeURIComponent(id.slice("account-".length))}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ status: "disabled" }) }); setNotice("Provider account binding disabled in production."); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to disable the provider account binding."); } return; }
    if (href === "/integrations/api-webhooks") { try { await pssApi(`/v1/api-keys/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ status: "revoked" }) }); setNotice("API credential revoked in production."); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to revoke the production API credential."); } return; }
    if (href === "/system/security-sessions") { try { await pssApi(`/v1/security/sessions/${encodeURIComponent(id)}/revoke`, { method: "POST" }); setNotice("Current Supabase session revoked. Returning to sign in…"); window.setTimeout(() => router.push("/login"), 700); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to revoke the current security session."); } return; }
    if (href === "/support/tickets" || href === "/support/sla-escalations") { try { await pssApi(`/v1/tickets/${id}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ status: href === "/support/sla-escalations" ? "escalated" : "resolved" }) }); setNotice(`${action} persisted in production.`); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to update the production ticket."); } return; }
    if (!hasSupportedWorkspaceWrite(href)) { setNotice(`${module.label} is currently read-only. No production write is enabled for this module.`); return; }
    try { await pssApi(`/v1/master-records/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ status: /revoke/i.test(action) ? "revoked" : /run/i.test(action) ? "completed" : /escalate/i.test(action) ? "escalated" : "resolved" }) }); setNotice(`${action} persisted in production.`); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to persist the production action."); }
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
      try { const selectedProvider = form.courier?.toLowerCase(); const provider = selectedProvider === "delhivery" || selectedProvider === "ekart" ? selectedProvider : undefined; const result = await pssApi<{ data: { id: string; status: string } }>("/v1/shipments", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ client_id: clientId, provider, origin: form.origin || "", destination: form.destination || "", origin_address: { line: form.origin || "", name: form.consignor || "", phone: form.consignorPhone || "" }, destination_address: { line: form.destination || "", name: form.consignee || "", phone: form.consigneePhone || "" }, consignee: form.consignee || "", total_weight_kg: Number(form.weight) || 1, pieces: Number(form.pieces) || 1, description: form.description || form.consignor || "" }) }); setNotice(`Shipment ${result.data.id} was created in production${provider ? ` with ${provider}` : " with courier dispatch pending"}.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create the production shipment."); }
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
      try { const result = await pssApi<{ data: { id: string } }>("/v1/tickets", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ client_id: form.client || clients[0]?.id, shipment_id: form.shipment || undefined, title: form.subject || "New operational support request", description: form.message || "Ticket created from Master workspace.", priority: (form.priority || "normal").toLowerCase() }) }); setNotice(`Ticket ${result.data.id} was created in production.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create the production ticket."); }
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
      try { const result = await pssApi<{ data: { id: string; status: string } }>("/v1/pickups", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ client_id: form.client || clients[0]?.id, shipment_id: form.shipment || undefined, scheduled_date: form.date || new Date().toISOString().slice(0, 10), window: form.window || "Business hours", location: form.location || form.address || "Operations address", notes: form.notes || "Created from Master panel" }) }); setNotice(`Pickup ${result.data.id} persisted in production with status ${result.data.status}.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create the production pickup."); }
    } else if (href === "/operations/returns") {
      try { const result = await pssApi<{ data: { id: string; status: string } }>("/v1/returns", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ client_id: form.client || clients[0]?.id, shipment_id: form.shipment, reason: form.reason || "Return requested from Master panel" }) }); setNotice(`Return ${result.data.id} persisted in production with status ${result.data.status}.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create the production return."); }
    } else if (href.includes("api-webhooks")) {
      try { const result = await pssApi<{ data: { id: string; secret?: string } }>("/v1/api-keys", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ client_id: form.client || clients[0]?.id, name: form.name || "Master integration key", environment: "live", scopes: (form.scope || "shipments.read").split(",").map((value) => value.trim()).filter(Boolean) }) }); setCredentialSecret(result.data.secret ? { id: result.data.id, secret: result.data.secret } : null); setNotice(`API credential ${result.data.id} created. Copy the secret below now; it will not be shown again.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create API credential."); }
    } else if (href === "/integrations/couriers") {
      try { const result = await pssApi<{ data: { id: string } }>("/v1/provider-accounts", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ provider: form.provider, account_name: form.accountName, account_type: form.accountType || "production", credential_secret_name: form.secretName, client_id: form.client || undefined, capabilities: (form.capabilities || "tracking").split(",").map((value) => value.trim()).filter(Boolean) }) }); setNotice(`Provider account binding ${result.data.id} created in production.`); setRefreshKey((value) => value + 1); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to create the provider account binding."); }
    } else if (href === "/system/settings" || href === "/departments" || href.includes("automation/") || href.includes("insights/") || href.includes("security-sessions") || href.includes("scheduled-jobs")) {
      try {
        const title = form.name || form.rule || form.title || meta.primary;
        const result = await pssApi<{ data: { id: string; status: string } }>("/v1/master-records", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ kind: href, title, detail: form.notes || form.condition || form.trigger || "Production Master record", status: href.includes("settings") ? "active" : "pending", meta: form.manager || form.schedule || form.action || "Created from Master panel", payload: form }) });
        setLiveRows((current) => [{ id: result.data.id, title, detail: form.notes || form.condition || form.trigger || "Production Master record", status: result.data.status, meta: form.manager || form.schedule || form.action || "Created from Master panel" }, ...current]);
        setNotice(`${module.label} record ${result.data.id} persisted in production.`);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to persist the Master record."); }
    } else {
      try { const result = await pssApi<{ data: { id: string; status: string } }>("/v1/master-records", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ kind: href, title: form.name || form.title || meta.primary, detail: form.notes || "Production Master record", status: "pending", meta: form.action || "Created from Master panel", payload: form }) }); setNotice(`${module.label} record ${result.data.id} persisted in production.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to persist the production record."); }
    }
    setModal(null);
  }

  const readOnly = !hasSupportedWorkspaceWrite(module.href) && !hasSupportedRecordAction(module.href) && !/export|refresh|check|mark all read/i.test(meta.primary);
  return <div className="flex min-h-full w-full flex-col gap-5">
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 xl:flex-row xl:items-end xl:justify-between"><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ModuleIcon href={module.href} /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">{meta.eyebrow}</p><h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{module.label}</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{module.description}</p></div></div><div className="flex flex-wrap items-center gap-2"><StatusBadge tone={readOnly ? "warning" : "positive"}>{readOnly ? "Read-only · implementation pending" : "Live API workspace"}</StatusBadge><button onClick={primaryAction} disabled={readOnly} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-3.5" />{readOnly ? "Read-only" : meta.primary}</button></div></header>
    {notice && <button onClick={() => setNotice(null)} className="flex w-full items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-left text-xs text-primary"><span>{notice}</span><X className="size-4" /></button>}
    {credentialSecret && <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><p className="font-semibold text-amber-900 dark:text-amber-200">One-time API secret · {credentialSecret.id}</p><code className="mt-2 block break-all rounded-lg border border-amber-500/20 bg-background/70 p-3 font-mono text-xs">{credentialSecret.secret}</code><p className="mt-2 text-xs text-amber-800 dark:text-amber-200">Copy this secret now. It is held only in this page state and will not be retrieved or displayed again.</p><button type="button" onClick={() => setCredentialSecret(null)} className="mt-3 h-8 rounded-lg border border-amber-500/30 px-3 text-xs font-semibold text-amber-900 dark:text-amber-100">I copied the secret</button></section>}
    <section className="grid gap-3 sm:grid-cols-3">{metrics(module.href, workspace, clients, rows).map((item) => <Metric key={item.label} {...item} />)}</section>
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs"><div className="flex shrink-0 flex-col gap-2 border-b border-border/70 p-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} className={cn(inputClass, "h-9 pl-9 text-xs")} placeholder={`Search ${module.label.toLowerCase()}`} /></div><Dropdown label="Filter records" value={filter === "All" ? "" : filter} onChange={(value) => setFilter(value || "All")} options={[...new Set(rows.map((row) => row.status))]} className="w-full shrink-0 sm:w-48" /></div><div className="grid min-h-[420px] min-w-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="min-h-0 min-w-0 overflow-y-auto divide-y divide-border/70">{filtered.map((row) => <button key={row.id} onClick={() => setSelectedId(row.id)} className={cn("grid w-full gap-3 px-4 py-3 text-left transition hover:bg-muted/40 sm:grid-cols-[10px_minmax(0,1fr)_140px_90px] sm:items-center", selected?.id === row.id && "bg-primary/5")}><span className={cn("size-2 rounded-full", row.status && `bg-${tone(row.status) === "critical" ? "destructive" : tone(row.status) === "warning" ? "amber-500" : tone(row.status) === "positive" ? "emerald-500" : "primary"}`)} /><span className="min-w-0"><span className="block truncate text-xs font-semibold">{row.title}</span><span className="mt-1 block truncate text-[11px] text-muted-foreground">{row.detail}</span></span><span className="text-[11px] text-muted-foreground">{row.meta}</span><StatusBadge tone={tone(row.status)}>{row.status}</StatusBadge></button>)}{filtered.length === 0 && <div className="p-4">{liveRowsLoading ? <p className="text-xs text-muted-foreground">Loading production records…</p> : <EmptyState title="No records found" description="Try another search or filter." />}</div>}</div><div className="flex min-h-0 min-w-0 flex-col border-t border-border/70 p-4 xl:border-l xl:border-t-0"><DetailPanel module={module} row={selected} onAction={performAction} /></div></div></section>
    <ActionModal module={module} open={Boolean(modal)} action={modal} form={form} setValue={setValue} onClose={() => setModal(null)} onSubmit={submit} clients={clients} employees={employees} courierOptions={courierOptions.map((provider) => provider[0].toUpperCase() + provider.slice(1))} />
  </div>;
}

type Row = { id: string; title: string; detail: string; status: string; meta: string };

function metrics(href: string, workspace: MasterWorkspaceState, clients: ClientSummary[], rows: Row[] = []) { if (href.includes("shipments") || href.includes("tracking") || href.includes("bookings")) return [{ label: "Total shipments", value: String(workspace.shipments.length), tone: "navy" as Tone }, { label: "In movement", value: String(workspace.shipments.filter((item) => !["Delivered", "Booked"].includes(item.status)).length), tone: "positive" as Tone }, { label: "Exceptions", value: String(workspace.exceptions.filter((item) => item.status !== "Resolved").length), tone: "critical" as Tone }]; if (href.includes("finance")) return [{ label: "Client accounts", value: String(clients.length), tone: "navy" as Tone }, { label: "Pending review", value: String(workspace.transactions.filter((item) => item.status === "Pending").length), tone: "warning" as Tone }, { label: "Ledger records", value: String(workspace.transactions.length + workspace.billing.length), tone: "positive" as Tone }]; if (href.includes("support")) return [{ label: "Open tickets", value: String(workspace.tickets.filter((item) => !["Resolved", "Closed"].includes(item.status)).length), tone: "navy" as Tone }, { label: "Escalated", value: String(workspace.tickets.filter((item) => item.status === "Escalated").length), tone: "critical" as Tone }, { label: "Messages", value: String(workspace.ticketMessages.length), tone: "positive" as Tone }]; return [{ label: "Records", value: String(rows.length), tone: "navy" as Tone }, { label: "Pending", value: String(rows.filter((item) => /pending|review|warning/i.test(item.status)).length), tone: "warning" as Tone }, { label: "Production records", value: String(rows.length), tone: "positive" as Tone }]; }

function Metric({ label, value, tone: itemTone }: { label: string; value: string; tone: Tone }) { return <div className="rounded-xl border border-border bg-card p-4 shadow-xs"><p className={cn("text-xl font-semibold", itemTone === "critical" && "text-destructive", itemTone === "warning" && "text-amber-600", itemTone === "positive" && "text-emerald-600", itemTone === "navy" && "text-primary")}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>; }
function ModuleIcon({ href }: { href: string }) { if (href.includes("finance")) return <Wallet className="size-[18px]" />; if (href.includes("support")) return <LifeBuoy className="size-[18px]" />; if (href.includes("client")) return <Users className="size-[18px]" />; if (href.includes("integrations")) return <Truck className="size-[18px]" />; if (href.includes("security")) return <ShieldCheck className="size-[18px]" />; if (href.includes("report") || href.includes("analytics") || href.includes("performance")) return <BarChart3 className="size-[18px]" />; if (href.includes("automation")) return <Settings2 className="size-[18px]" />; return <Package className="size-[18px]" />; }
function downloadCsv(label: string, rows: Row[]) { const csv = ["Title,Detail,Status,Meta", ...rows.map((row) => [row.title, row.detail, row.status, row.meta].map((value) => `"${value.replaceAll('"', '""')}"`).join(","))].join("\n"); const link = document.createElement("a"); link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; link.download = `${label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-export.csv`; link.click(); }

function DetailPanel({ module, row, onAction }: { module: Props["module"]; row?: Row; onAction(action: string, id: string): void }) {
  const { employees } = useAdmin();
  const [assigneeId, setAssigneeId] = useState("");
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const [ticketMessages, setTicketMessages] = useState<Array<{ id: string; message: string; author_user_id?: string | null; created_at?: string | null }>>([]);
  const isTicket = module.href === "/support/tickets" || module.href === "/support/sla-escalations";
  const ticketId = row?.id;
  useEffect(() => {
    if (!isTicket || !ticketId) return;
    let active = true;
    void pssApi<{ data: Array<{ id: string; message: string; author_user_id?: string | null; created_at?: string | null }> }>(`/v1/tickets/${encodeURIComponent(ticketId)}/messages`).then((result) => { if (active) setTicketMessages(result.data ?? []); }).catch(() => { if (active) setTicketMessages([]); });
    return () => { active = false; };
  }, [isTicket, ticketId]);
  const sendReply = async () => {
    if (!row || !reply.trim() || replying) return;
    setReplying(true);
    try {
      await pssApi(`/v1/tickets/${encodeURIComponent(row.id)}/messages`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ message: reply.trim() }) });
      setReply("");
      const result = await pssApi<{ data: Array<{ id: string; message: string; author_user_id?: string | null; created_at?: string | null }> }>(`/v1/tickets/${encodeURIComponent(row.id)}/messages`);
      setTicketMessages(result.data ?? []);
    } finally {
      setReplying(false);
    }
  };
  if (!row) return <div className="grid h-full min-h-52 place-items-center text-center text-xs text-muted-foreground">Select a record to inspect its relationships and next action.</div>;
  const isPickup = module.href === "/operations/pickups";
   const canAct = isPickup || module.href === "/operations/exceptions" || module.href === "/tasks" || module.href === "/support/tickets" || module.href === "/support/sla-escalations" || module.href === "/finance/wallets" || module.href === "/finance/billing-invoices" || hasSupportedRecordAction(module.href) || (module.href === "/integrations/api-webhooks" && !row.id.startsWith("webhook-") && !row.id.startsWith("integration-")) || (module.href === "/integrations/couriers" && row.id.startsWith("account-"));
   const action = isPickup ? `Assign pickup:${assigneeId}` : module.href === "/operations/exceptions" ? "Resolve exception" : module.href === "/tasks" ? "Complete task" : module.href === "/support/tickets" ? "Resolve ticket" : module.href === "/finance/wallets" || module.href === "/finance/billing-invoices" ? "Approve finance record" : module.href === "/integrations/api-webhooks" ? "Revoke credential" : module.href === "/integrations/couriers" ? "Disable provider account" : module.href.includes("scheduled") ? "Run job" : module.href.includes("security") ? "Revoke session" : "Escalate ticket";
   const actionLabel = isPickup ? "Assign pickup" : action;
   return <div className="space-y-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Selected record</p><h2 className="mt-1 text-base font-semibold">{row.title}</h2><p className="mt-1 text-xs text-muted-foreground">{row.detail}</p></div><div className="grid gap-2"><Info label="Status" value={row.status} /><Info label="Context" value={row.meta} /><Info label="Data source" value={dataSourceLabel(module.href)} /></div><div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">Related records, activity, notifications, and audit evidence are updated by supported actions.</div>{isTicket && <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3"><p className="text-xs font-semibold">Reply to client</p>{ticketMessages.length ? <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-2">{ticketMessages.map((message) => <div key={message.id} className="rounded-lg bg-muted/50 p-2 text-[11px] leading-5"><p className="text-[10px] text-muted-foreground">{message.author_user_id ?? "Support"} · {message.created_at ? new Date(message.created_at).toLocaleString() : "Recently"}</p><p className="mt-1">{message.message}</p></div>)}</div> : <p className="text-[11px] text-muted-foreground">No messages recorded yet.</p>}<textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={4} className={cn(inputClass, "h-auto py-2")} placeholder="Write a production support reply" /><button type="button" disabled={!reply.trim() || replying} onClick={() => void sendReply()} className="h-9 w-full rounded-lg bg-primary text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{replying ? "Sending…" : "Send reply"}</button></div>}{isPickup && <label className="grid gap-1.5 text-xs font-semibold"><span>Assign to active employee</span><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={inputClass}><option value="">Choose employee</option>{employees.filter((employee) => employee.status === "Active").map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>}{canAct ? <button disabled={isPickup && !assigneeId} onClick={() => onAction(action, row.id)} className="h-9 w-full rounded-lg bg-primary text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{actionLabel}</button> : <p className="text-[11px] text-muted-foreground">{module.capabilities.slice(0, 2).join(" · ")}</p>}</div>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/40 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-xs font-medium">{value}</p></div>; }

function ActionModal({ module, open, action, form, setValue, onClose, onSubmit, clients, employees, courierOptions }: { module: Props["module"]; open: boolean; action: string | null; form: Record<string, string>; setValue(key: string, value: string): void; onClose(): void; onSubmit(): void; clients: { id: string; name: string }[]; employees: { id: string; name: string }[]; courierOptions: string[] }) {
  const href = module.href;
  if (href === "/integrations/couriers") {
    const providerFields = [
      { key: "provider", label: "Provider", options: ["delhivery", "ekart"] },
      { key: "accountName", label: "Account name" },
      { key: "accountType", label: "Account type", options: ["production", "staging"] },
      { key: "secretName", label: "Cloudflare secret name" },
      { key: "client", label: "Client binding (optional)", options: clients.map((item) => item.id) },
      { key: "capabilities", label: "Capabilities" },
    ];
    return <Modal open={open} onClose={onClose} title={action ?? "Courier account"} description="This action is persisted through the authenticated production API." size="lg"><div className="grid gap-4 sm:grid-cols-2">{providerFields.map((field) => <Field key={field.key} label={field.label}>{field.options ? <Dropdown label={field.label} value={form[field.key] ?? ""} onChange={(value) => setValue(field.key, value)} options={field.options.map((option) => ({ value: option, label: option.includes("-") ? clientName(option, clients) : option }))} /> : <input type="text" value={form[field.key] ?? ""} onChange={(event) => setValue(field.key, event.target.value)} className={inputClass} placeholder={field.label} />}</Field>)}</div><div className="mt-6 flex justify-end gap-2 border-t border-border/70 pt-4"><button onClick={onClose} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold">Cancel</button><button onClick={onSubmit} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><Check className="size-3.5" />Save to production</button></div></Modal>;
  }
  const availableCouriers = courierOptions.length ? courierOptions : ["Dispatch pending"];
  const fields: { key: string; label: string; type?: "text" | "date"; options?: string[] }[] = href === "/tasks" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "title", label: "Task title" }, { key: "description", label: "Description" }, { key: "priority", label: "Priority", options: ["Low", "Medium", "High", "Urgent"] }, { key: "dueAt", label: "Due date", type: "date" }, { key: "assignee", label: "Assignee", options: employees.map((item) => item.id) }] : href === "/operations/exceptions" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "shipment", label: "Shipment reference" }, { key: "category", label: "Category" }, { key: "title", label: "Exception title" }, { key: "severity", label: "Severity", options: ["low", "medium", "high", "critical"] }, { key: "assignee", label: "Assignee", options: employees.map((item) => item.id) }, { key: "details", label: "Details" }] : href === "/operations/pickups" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "shipment", label: "Shipment reference" }, { key: "date", label: "Pickup date", type: "date" }, { key: "window", label: "Pickup window" }, { key: "location", label: "Pickup location" }, { key: "notes", label: "Notes" }] : href === "/operations/returns" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "shipment", label: "Shipment reference" }, { key: "reason", label: "Return reason" }] : href === "/operations/bookings" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "consignor", label: "Consignor" }, { key: "consignee", label: "Consignee" }, { key: "origin", label: "Origin" }, { key: "destination", label: "Destination" }, { key: "weight", label: "Weight (kg)" }, { key: "pieces", label: "Pieces" }, { key: "courier", label: "Courier", options: availableCouriers }, { key: "paymentMode", label: "Payment mode", options: ["Prepaid", "COD"] }, { key: "codAmount", label: "COD amount" }] : href === "/support/tickets" ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "shipment", label: "Shipment reference" }, { key: "subject", label: "Subject" }, { key: "category", label: "Category", options: ["Delivery issue", "Pickup issue", "Billing", "KYC", "General support"] }, { key: "priority", label: "Priority", options: ["Urgent", "High", "Normal"] }, { key: "assignee", label: "Assignee", options: employees.map((item) => item.id) }, { key: "message", label: "Initial message" }] : href === "/clients" || href === "/clients/onboarding" ? [{ key: "name", label: "Client name" }, { key: "clientCode", label: "Client code (optional)" }, { key: "city", label: "City" }, { key: "assignee", label: "Responsible employee", options: employees.map((item) => item.id) }] : href === "/departments" ? [{ key: "name", label: "Department name" }, { key: "manager", label: "Manager", options: employees.map((item) => item.id) }, { key: "capacity", label: "Capacity %" }] : href.includes("finance") ? [{ key: "client", label: "Client", options: clients.map((item) => item.id) }, { key: "amount", label: "Amount" }, { key: "direction", label: "Direction", options: ["Debit", "Credit"] }, { key: "reason", label: "Reason" }] : href === "/insights/reports" ? [{ key: "name", label: "Report name" }, { key: "dateFrom", label: "From", type: "date" }, { key: "dateTo", label: "To", type: "date" }] : href === "/system/settings" ? [{ key: "timezone", label: "Timezone", options: ["Asia/Kolkata", "UTC", "Asia/Dubai"] }, { key: "retention", label: "Shipment retention", options: ["30 days", "90 days", "365 days"] }, { key: "courier", label: "Default courier", options: availableCouriers }, { key: "walletApproval", label: "Wallet approval", options: ["true", "false"] }, { key: "alerts", label: "Operational alerts", options: ["true", "false"] }] : href.includes("workflow-rules") || href.includes("notification-rules") ? [{ key: "name", label: "Rule name" }, { key: "trigger", label: "Trigger" }, { key: "condition", label: "Condition" }, { key: "action", label: "Action" }] : href.includes("api-webhooks") ? [{ key: "name", label: "Credential name" }, { key: "kind", label: "Type", options: ["API key", "Webhook"] }, { key: "scope", label: "Scope" }] : [{ key: "name", label: `${action ?? "Record"} name` }, { key: "notes", label: "Notes" }];
  return <Modal open={open} onClose={onClose} title={action ?? "Workspace action"} description="This action is persisted through the authenticated production API." size="lg"><div className="grid gap-4 sm:grid-cols-2">{fields.map((field) => <Field key={field.key} label={field.label}>{field.options ? <Dropdown label={field.label} value={form[field.key] ?? ""} onChange={(value) => setValue(field.key, value)} options={field.options.map((option) => ({ value: option, label: option.includes("-") ? (field.key === "client" ? clientName(option, clients) : employeeName(option, employees)) : option }))} /> : <input type={field.type ?? "text"} value={form[field.key] ?? ""} onChange={(event) => setValue(field.key, event.target.value)} className={inputClass} placeholder={field.label} />}</Field>)}</div><div className="mt-6 flex justify-end gap-2 border-t border-border/70 pt-4"><button onClick={onClose} className="h-9 rounded-lg border border-border px-3 text-xs font-semibold">Cancel</button><button onClick={onSubmit} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><Check className="size-3.5" />Save to production</button></div></Modal>;
}
