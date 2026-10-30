import test from "node:test";
import assert from "node:assert/strict";
import { shipmentStatusTabCounts } from "./shipment-status.ts";

const emptyLoaded = { All: 0, Active: 0, Booked: 0, "In Transit": 0, "Out for Delivery": 0, Delivered: 0, Delayed: 0, Exception: 0, Returned: 0, Cancelled: 0 };

test("uses organization totals and keeps status categories separate from the loaded page", () => {
  const counts = shipmentStatusTabCounts(7000, { booked: 40, picked_up: 22, in_transit: 12, out_for_delivery: 4, delivered: 6800, delayed: 5, exception: 100, returned: 14, rto: 1, cancelled: 2, pending: 0 }, emptyLoaded);
  assert.equal(counts.All, 7000);
  assert.equal(counts["In Transit"], 34);
  assert.equal(counts.Active, 183);
  assert.equal(counts.Delivered, 6800);
  assert.equal(counts.Returned, 15);
});

test("preserves a valid zero total instead of substituting the sum of status buckets", () => {
  assert.equal(shipmentStatusTabCounts(0, { booked: 5 }, emptyLoaded).All, 0);
});

test("falls back to visible rows only when authoritative status counts are unavailable", () => {
  const loaded = { ...emptyLoaded, All: 1, Active: 1, Booked: 1 };
  assert.deepEqual(shipmentStatusTabCounts(undefined, {}, loaded), loaded);
});
