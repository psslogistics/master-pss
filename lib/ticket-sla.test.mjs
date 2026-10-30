import assert from "node:assert/strict";
import test from "node:test";
import { getTicketSlaState, isTicketSlaAttention } from "./ticket-sla.ts";

const now = Date.parse("2026-10-29T12:00:00.000Z");

test("resolved and closed tickets do not remain in the active SLA queue", () => {
  assert.equal(getTicketSlaState({ status: "resolved", slaDueAt: "2026-10-28T00:00:00.000Z" }, now), "closed");
  assert.equal(getTicketSlaState({ status: "CLOSED" }, now), "closed");
});

test("explicit escalation and past-due deadlines are surfaced", () => {
  assert.equal(getTicketSlaState({ status: "open", escalationState: "escalated", slaDueAt: "2026-10-30T12:00:00.000Z" }, now), "escalated");
  assert.equal(getTicketSlaState({ status: "open", slaDueAt: "2026-10-29T11:59:59.000Z" }, now), "overdue");
});

test("due-soon and on-track windows are deterministic", () => {
  assert.equal(getTicketSlaState({ status: "in_progress", slaDueAt: "2026-10-30T12:00:00.000Z" }, now), "due_soon");
  assert.equal(getTicketSlaState({ status: "open", slaDueAt: "2026-10-30T12:00:01.000Z" }, now), "on_track");
});

test("missing or malformed SLA deadlines are unavailable, never silently on-track", () => {
  assert.equal(getTicketSlaState({ status: "open" }, now), "unavailable");
  assert.equal(getTicketSlaState({ status: "open", slaDueAt: "not-a-date" }, now), "unavailable");
});

test("attention queue includes unassigned active tickets and excludes resolved ones", () => {
  assert.equal(isTicketSlaAttention({ status: "open", assignedToUserId: "", slaDueAt: "2026-11-05T12:00:00.000Z" }, now), true);
  assert.equal(isTicketSlaAttention({ status: "open", assignedToUserId: "employee-1", slaDueAt: "2026-10-29T11:00:00.000Z" }, now), true);
  assert.equal(isTicketSlaAttention({ status: "open", assignedToUserId: "employee-1", slaDueAt: "2026-11-05T12:00:00.000Z" }, now), false);
  assert.equal(isTicketSlaAttention({ status: "resolved", assignedToUserId: "", escalationState: "overdue" }, now), false);
});
