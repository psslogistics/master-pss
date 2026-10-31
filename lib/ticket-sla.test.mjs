import assert from "node:assert/strict";
import test from "node:test";
import { getTicketSlaState, isTicketSlaAttention } from "./ticket-sla.ts";

test("explicitly escalated status is an SLA escalation even before the state field is reconciled", () => {
  assert.equal(getTicketSlaState({ status: "escalated", slaDueAt: "2099-01-01T00:00:00Z", escalationState: "normal" }), "escalated");
  assert.equal(isTicketSlaAttention({ status: "escalated", slaDueAt: "2099-01-01T00:00:00Z", escalationState: "normal", assignedToUserId: "employee-1" }), true);
});

test("resolved and closed tickets never remain in SLA attention", () => {
  for (const status of ["resolved", "closed"]) {
    assert.equal(getTicketSlaState({ status, escalationState: "escalated" }), "closed");
    assert.equal(isTicketSlaAttention({ status, escalationState: "escalated", assignedToUserId: "" }), false);
  }
});
