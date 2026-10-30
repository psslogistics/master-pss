import test from "node:test";
import assert from "node:assert/strict";
import { readAllPages } from "./read-all-pages.ts";

test("reads through all full pages and returns every row", async () => {
  const requests = [];
  const result = await readAllPages(async (from, to) => {
    requests.push([from, to]);
    const rows = Array.from({ length: Math.max(0, Math.min(3, 7 - from)) }, (_, index) => from + index);
    return { data: rows, error: null };
  }, 3);

  assert.deepEqual(result.data, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(requests, [[0, 2], [3, 5], [6, 8]]);
});

test("preserves a valid empty result", async () => {
  const result = await readAllPages(async () => ({ data: [], error: null }));
  assert.deepEqual(result, { data: [], error: null });
});

test("stops and propagates a later-page failure without reporting partial success", async () => {
  let calls = 0;
  const result = await readAllPages(async () => {
    calls += 1;
    return calls === 1
      ? { data: Array.from({ length: 2 }, (_, index) => index), error: null }
      : { data: null, error: { message: "page failed" } };
  }, 2);

  assert.equal(calls, 2);
  assert.deepEqual(result, { data: null, error: { message: "page failed" } });
});
