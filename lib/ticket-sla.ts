export type TicketSlaInput = { status?: unknown; slaDueAt?: unknown; escalationState?: unknown };
export type TicketSlaState = "closed" | "overdue" | "escalated" | "due_soon" | "on_track" | "unavailable";

export function getTicketSlaState(ticket: TicketSlaInput, now = Date.now()): TicketSlaState {
  const status = String(ticket.status ?? "").toLowerCase().replaceAll("_", " ").trim();
  if (status === "resolved" || status === "closed") return "closed";
  const escalation = String(ticket.escalationState ?? "").toLowerCase().trim();
  if (status === "escalated" || escalation === "escalated") return "escalated";
  if (escalation === "overdue") return "overdue";
  const dueAt = String(ticket.slaDueAt ?? "").trim();
  if (!dueAt) return "unavailable";
  const due = Date.parse(dueAt);
  if (!Number.isFinite(due)) return "unavailable";
  if (due < now) return "overdue";
  if (due - now <= 24 * 60 * 60 * 1000) return "due_soon";
  return "on_track";
}

export function isTicketSlaAttention(ticket: TicketSlaInput & { assignedToUserId?: unknown }, now = Date.now()): boolean {
  const status = String(ticket.status ?? "").toLowerCase().replaceAll("_", " ").trim();
  if (status === "resolved" || status === "closed") return false;
  if (!String(ticket.assignedToUserId ?? "").trim()) return true;
  return ["overdue", "escalated", "due_soon"].includes(getTicketSlaState(ticket, now));
}
