import test from "node:test";
import assert from "node:assert/strict";
import { getShipmentDistribution } from "./shipment-distribution.ts";

test("normalizes provider status keys and calculates each independent share", () => {
  assert.deepEqual(getShipmentDistribution(100, {
    delivered: 60,
    picked_up: 10,
    in_transit: 5,
    out_for_delivery: 5,
    exception: 10,
  }, 20), {
    total: 100,
    delivered: 60,
    inMovement: 20,
    delayed: 20,
    exception: 10,
  });
});

test("clamps malformed counts and handles empty or invalid totals", () => {
  assert.deepEqual(getShipmentDistribution(0, { delivered: 4, exception: -3 }, 8), {
    total: 0,
    delivered: 0,
    inMovement: 0,
    delayed: 0,
    exception: 0,
  });
  assert.equal(getShipmentDistribution(Number.NaN, { delivered: 10 }, 0).total, 0);
  assert.equal(getShipmentDistribution(10, { delivered: 20 }, 50).delivered, 100);
  assert.equal(getShipmentDistribution(10, { delivered: 20 }, 50).delayed, 100);
});

test("does not infer on-time share from overlapping status and delayed counts", () => {
  const distribution = getShipmentDistribution(100, { booked: 70, exception: 10 }, 40);
  assert.equal(distribution.delayed, 40);
  assert.equal(distribution.exception, 10);
  assert.equal("onTime" in distribution, false);
});
