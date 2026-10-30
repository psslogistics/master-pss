import assert from "node:assert/strict";
import test from "node:test";
import { activityDetailsSummary, activitySnapshotPair, normalizeActivityEntityType } from "./activity-audit.ts";

test("normalizes production audit entity names for meaningful type filters", () => {
  assert.equal(normalizeActivityEntityType("shipment"), "Shipment");
  assert.equal(normalizeActivityEntityType("shipment_document"), "Shipment");
  assert.equal(normalizeActivityEntityType("TICKETS"), "Ticket");
  assert.equal(normalizeActivityEntityType(undefined), "System");
});

test("renders legacy amount snapshots with INR values", () => {
  assert.deepEqual(activitySnapshotPair(JSON.stringify({ previous_amount: 100, new_amount: 125.5 })), {
    before: "₹100.00",
    after: "₹125.50",
  });
});

test("renders explicitly captured status snapshots", () => {
  assert.deepEqual(activitySnapshotPair({ before: { status: "pending" }, after: { status: "approved" } }), {
    before: "status: pending",
    after: "status: approved",
  });
});

test("renders KYC decision and document-state snapshots without exposing identity fields", () => {
  const snapshots = activitySnapshotPair({
    before: { status: "under_review", document_statuses: { aadhaar: "submitted", gst: "submitted", pan: "submitted", unknown: "private" } },
    after: { status: "approved", document_statuses: { aadhaar: "approved", gst: "approved", pan: "approved" } },
  });
  assert.deepEqual(snapshots, {
    before: "status: under_review · document statuses: AADHAAR: submitted, GST: submitted, PAN: submitted",
    after: "status: approved · document statuses: AADHAAR: approved, GST: approved, PAN: approved",
  });
});

test("does not invent snapshots for events without captured values", () => {
  assert.deepEqual(activitySnapshotPair("{\"fields\":[\"status\"]}"), {
    before: "Not captured in this activity record",
    after: "Not captured in this activity record",
  });
});

test("summaries exclude request ids and sensitive arbitrary metadata", () => {
  assert.deepEqual(activityDetailsSummary({
    request_id: "req-1",
    address: "private location",
    component_code: "freight",
    reason: "manual correction",
    previous_amount: 100,
  }), ["component code: freight", "reason: manual correction"]);
});
