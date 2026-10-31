import test from "node:test";
import assert from "node:assert/strict";
import { marginFor, marginAmount, summarizeMargins, summarizeMarginsByClient } from "./margin-math.ts";

test("calculates cost-matched margins and retains negative margins", () => {
  assert.equal(marginFor({ billing_status: "paid", pss_amount: 500, provider_amount: 200 }), 300);
  assert.equal(marginFor({ billing_status: "paid", pss_amount: "100", provider_amount: "125.25" }), -25.25);
});

test("zero is a real provider cost, while missing or malformed amounts stay pending", () => {
  assert.equal(marginFor({ billing_status: "paid", pss_amount: 125, provider_amount: 0, provider_status: "accepted" }), 125);
  assert.equal(marginFor({ billing_status: "paid", pss_amount: 125, provider_amount: null }), null);
  assert.equal(marginAmount("not-a-number"), null);
  assert.deepEqual(summarizeMargins([
    { billing_status: "paid", pss_amount: 125, provider_amount: 0 },
    { billing_status: "paid", pss_amount: 250, provider_amount: null },
    { billing_status: "paid", pss_amount: 100, provider_amount: 120 },
  ]), { shipments: 3, billed: 475, matchedBilled: 225, providerCost: 120, margin: 105, pending: 1, voided: 0 });
});

test("failed provider responses never become zero-cost positive margins", () => {
  assert.equal(marginFor({ billing_status: "paid", pss_amount: 458, provider_amount: 0, provider_status: "failed" }), null);
  assert.deepEqual(summarizeMargins([
    { billing_status: "paid", pss_amount: 458, provider_amount: 0, provider_status: "failed" },
    { billing_status: "paid", pss_amount: 125, provider_amount: 0, provider_status: "accepted" },
  ]), { shipments: 2, billed: 583, matchedBilled: 125, providerCost: 0, margin: 125, pending: 1, voided: 0 });
});

test("only paid client charges contribute to revenue and profit; pending and void invoices do not", () => {
  const rows = [
    { client_id: "a", billing_status: "paid", pss_amount: 100, provider_amount: 30 },
    { client_id: "a", billing_status: "pending", pss_amount: 200, provider_amount: 10 },
    { client_id: "a", billing_status: "void", pss_amount: 50, provider_amount: 5 },
  ];
  assert.equal(marginFor(rows[1]), null);
  assert.equal(marginFor(rows[2]), null);
  assert.deepEqual(summarizeMargins(rows), { shipments: 3, billed: 100, matchedBilled: 100, providerCost: 30, margin: 70, pending: 1, voided: 1 });
  assert.deepEqual(summarizeMarginsByClient(rows), [{ clientId: "a", shipments: 3, billed: 100, matchedBilled: 100, providerCost: 30, margin: 70, pending: 1, voided: 1 }]);
});

test("groups each client's billed, matched-cost, margin, and pending amounts independently", () => {
  assert.deepEqual(summarizeMarginsByClient([
    { client_id: "a", billing_status: "paid", pss_amount: 100, provider_amount: 30 },
    { client_id: "a", billing_status: "paid", pss_amount: 200, provider_amount: null },
    { client_id: "b", billing_status: "paid", pss_amount: 80, provider_amount: 90 },
  ]), [
    { clientId: "a", shipments: 2, billed: 300, matchedBilled: 100, providerCost: 30, margin: 70, pending: 1, voided: 0 },
    { clientId: "b", shipments: 1, billed: 80, matchedBilled: 80, providerCost: 90, margin: -10, pending: 0, voided: 0 },
  ]);
});
