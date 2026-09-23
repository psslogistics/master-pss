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

export const decisionCards: AdminDecisionCard[] = [
  { id: "critical", label: "Critical actions", value: "0", detail: "Awaiting production records", tone: "critical", icon: ShieldAlert },
  { id: "sla", label: "SLA escalations", value: "0", detail: "Awaiting production records", tone: "warning", icon: Headphones },
  { id: "access", label: "Access reviews", value: "0", detail: "Awaiting production records", tone: "warning", icon: KeyRound },
  { id: "ownership", label: "Ownership issues", value: "0", detail: "Awaiting production records", tone: "warning", icon: Building2 },
  { id: "security", label: "Security changes", value: "0", detail: "Awaiting production records", tone: "neutral", icon: UserRoundCheck },
];

export function getSupportingMetrics(activeClients: number, activeEmployees: number, invitedEmployees: number): SupportingMetric[] {
  return [
    { id: "shipments", label: "Total shipments", value: "0", context: "Awaiting production records", tone: "neutral", icon: PackageCheck },
    { id: "clients", label: "Active clients", value: String(activeClients), context: "Supabase client memberships", tone: "neutral", icon: Building2 },
    { id: "employees", label: "Active employees", value: String(activeEmployees), context: `${invitedEmployees} invitation${invitedEmployees === 1 ? "" : "s"} pending`, tone: "neutral", icon: Users },
    { id: "tickets", label: "Open tickets", value: "0", context: "Awaiting production records", tone: "neutral", icon: Headphones },
    { id: "sla", label: "SLA breaches", value: "0", context: "Awaiting production records", tone: "neutral", icon: CircleAlert },
    { id: "delayed", label: "Delayed shipments", value: "0", context: "Awaiting production records", tone: "neutral", icon: Clock3 },
    { id: "pickups", label: "Pending pickups", value: "0", context: "Awaiting production records", tone: "neutral", icon: Truck },
    { id: "revenue", label: "Billing exposure", value: "₹0", context: "Awaiting production records", tone: "neutral", icon: BadgeIndianRupee },
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

