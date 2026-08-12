import type { LucideIcon } from "lucide-react";
import {
  BadgeIndianRupee,
  Building2,
  CircleAlert,
  Clock3,
  Headphones,
  KeyRound,
  PackageCheck,
  ShieldAlert,
  Truck,
  UserRoundCheck,
  Users,
} from "lucide-react";

export type AdminActionSeverity = "critical" | "warning" | "review";
export type AdminActionCategory = "all" | "sla" | "access" | "ownership" | "security" | "billing";

export interface AdminActionItem {
  id: string;
  severity: AdminActionSeverity;
  category: Exclude<AdminActionCategory, "all">;
  title: string;
  entity: string;
  owner: string;
  age: string;
  recommendation: string;
  actionLabel: string;
  href: string;
}

export interface AdminDecisionCard {
  id: Exclude<AdminActionCategory, "all" | "billing"> | "critical";
  label: string;
  value: string;
  detail: string;
  tone: "critical" | "warning" | "neutral";
  icon: LucideIcon;
}

export type SupportingMetricId = "shipments" | "clients" | "employees" | "tickets" | "sla" | "delayed" | "pickups" | "revenue";

export interface SupportingMetric {
  id: SupportingMetricId;
  label: string;
  value: string;
  context: string;
  tone: "neutral" | "positive" | "warning" | "critical";
  icon: LucideIcon;
}

export const adminActionItems: AdminActionItem[] = [
  { id: "action-sla-1", severity: "critical", category: "sla", title: "Resolution SLA breached", entity: "TKT-1042 · Arvind Components", owner: "Rahul Sharma", age: "47 min overdue", recommendation: "Review the thread, reassign ownership, or add an escalation note.", actionLabel: "Review escalation", href: "/audit-logs" },
  { id: "action-access-1", severity: "warning", category: "access", title: "Privileged grant needs review", entity: "billing.approve · Vikram Rao", owner: "Super Admin", age: "2 hr pending", recommendation: "Confirm the finance approval scope and retain or revoke the override.", actionLabel: "Review access", href: "/employees/emp-vikram" },
  { id: "action-owner-1", severity: "warning", category: "ownership", title: "Client assigned to invited employee", entity: "Jaipur Craft House · CL-1007", owner: "Sana Khan", age: "5 hr exposed", recommendation: "Transfer the client to an active owner until the invitation is accepted.", actionLabel: "Transfer client", href: "/client-assignments" },
  { id: "action-sla-2", severity: "warning", category: "sla", title: "Response SLA approaching", entity: "TKT-1037 · Northwind Pharma", owner: "Ananya Mehta", age: "42 min left", recommendation: "Prompt the owner or reassign before the response window expires.", actionLabel: "Review queue", href: "/audit-logs" },
  { id: "action-security-1", severity: "review", category: "security", title: "Dormant session policy review", entity: "Finance workspace · Vikram Rao", owner: "Super Admin", age: "3 days old", recommendation: "Verify the last security event and confirm active sessions are expected.", actionLabel: "Inspect activity", href: "/audit-logs" },
  { id: "action-billing-1", severity: "critical", category: "billing", title: "Billing hold affects operations", entity: "Northwind Pharma · ₹2.8L exposure", owner: "Finance", age: "1 day on hold", recommendation: "Confirm payment disposition before restoring unrestricted operations.", actionLabel: "Review client", href: "/client-assignments" },
];

export const decisionCards: AdminDecisionCard[] = [
  { id: "critical", label: "Critical actions", value: "3", detail: "2 breached · 1 billing hold", tone: "critical", icon: ShieldAlert },
  { id: "sla", label: "SLA escalations", value: "4", detail: "Across 3 client accounts", tone: "warning", icon: Headphones },
  { id: "access", label: "Access reviews", value: "1", detail: "Privileged override pending", tone: "warning", icon: KeyRound },
  { id: "ownership", label: "Ownership issues", value: "1", detail: "Assigned owner not active", tone: "warning", icon: Building2 },
  { id: "security", label: "Security changes", value: "3", detail: "Privileged events today", tone: "neutral", icon: UserRoundCheck },
];

export function getSupportingMetrics(activeClients: number, activeEmployees: number): SupportingMetric[] {
  return [
    { id: "shipments", label: "Total shipments", value: "12,846", context: "+8.4% vs prior period", tone: "positive", icon: PackageCheck },
    { id: "clients", label: "Active clients", value: String(activeClients + 36), context: "1 account on hold", tone: "neutral", icon: Building2 },
    { id: "employees", label: "Active employees", value: String(activeEmployees), context: "1 invitation pending", tone: "neutral", icon: Users },
    { id: "tickets", label: "Open tickets", value: "18", context: "4 escalated", tone: "warning", icon: Headphones },
    { id: "sla", label: "SLA breaches", value: "3", context: "+1 since morning", tone: "critical", icon: CircleAlert },
    { id: "delayed", label: "Delayed shipments", value: "27", context: "5 need intervention", tone: "warning", icon: Clock3 },
    { id: "pickups", label: "Pending pickups", value: "14", context: "2 past cutoff", tone: "warning", icon: Truck },
    { id: "revenue", label: "Billing exposure", value: "₹18.4L", context: "₹2.8L on hold", tone: "warning", icon: BadgeIndianRupee },
  ];
}

export const dashboardRangeOptions = [
  { value: "today", label: "Today" },
  { value: "7-days", label: "Last 7 days" },
  { value: "30-days", label: "Last 30 days" },
  { value: "quarter", label: "This quarter" },
];

export const actionCategoryOptions = [
  { value: "all", label: "All action types" },
  { value: "sla", label: "SLA & support" },
  { value: "access", label: "Access reviews" },
  { value: "ownership", label: "Client ownership" },
  { value: "security", label: "Security" },
  { value: "billing", label: "Billing exposure" },
];

