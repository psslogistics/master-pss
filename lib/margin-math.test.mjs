import test from "node:test";
import assert from "node:assert/strict";
import { marginFor, marginAmount, summarizeMargins, summarizeMarginsByClient } from "./margin-math.ts";

test("calculates cost-matched margins and retains negative margins", () => {
  assert.equal(marginFor({ pss_amount: 500, provider_amount: 200 }), 300);
  assert.equal(marginFor({ pss_amount: "100", provider_amount: "125.25" }), -25.25);
});

test("zero is a real provider cost, while missing or malformed amounts stay pending", () => {
  assert.equal(marginFor({ pss_amount: 125, provider_amount: 0, provider_status: "accepted" }), 125);
  assert.equal(marginFor({ pss_amount: 125, provider_amount: null }), null);
  assert.equal(marginAmount("not-a-number"), null);
  assert.deepEqual(summarizeMargins([
    { pss_amount: 125, provider_amount: 0 },
    { pss_amount: 250, provider_amount: null },
    { pss_amount: 100, provider_amount: 120 },
  ]), { shipments: 3, billed: 475, matchedBilled: 225, providerCost: 120, margin: 105, pending: 1 });
});

test("failed provider responses never become zero-cost positive margins", () => {
  assert.equal(marginFor({ pss_amount: 458, provider_amount: 0, provider_status: "failed" }), null);
  assert.deepEqual(summarizeMargins([
    { pss_amount: 458, provider_amount: 0, provider_status: "failed" },
    { pss_amount: 125, provider_amount: 0, provider_status: "accepted" },
  ]), { shipments: 2, billed: 583, matchedBilled: 125, providerCost: 0, margin: 125, pending: 1 });
});

test("groups each client's billed, matched-cost, margin, and pending amounts independently", () => {
  assert.deepEqual(summarizeMarginsByClient([
    { client_id: "a", pss_amount: 100, provider_amount: 30 },
    { client_id: "a", pss_amount: 200, provider_amount: null },
    { client_id: "b", pss_amount: 80, provider_amount: 90 },
  ]), [
    { clientId: "a", shipments: 2, billed: 300, matchedBilled: 100, providerCost: 30, margin: 70, pending: 1 },
    { clientId: "b", shipments: 1, billed: 80, matchedBilled: 80, providerCost: 90, margin: -10, pending: 0 },
  ]);
});
