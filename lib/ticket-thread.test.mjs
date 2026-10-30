import assert from "node:assert/strict";
import test from "node:test";
import { getTicketThreadView } from "./ticket-thread.ts";

test("legacy tickets keep their original request visible when no reply rows exist", () => {
  assert.deepEqual(getTicketThreadView("Please arrange urgent delivery", []), {
    initialRequest: "Please arrange urgent delivery",
    replies: [],
  });
});

test("new ticket initial message is not duplicated as a reply", () => {
  const initial = { id: "initial", message: "Please arrange urgent delivery" };
  const reply = { id: "reply", message: "We are checking with the courier" };
  assert.deepEqual(getTicketThreadView(initial.message, [initial, reply]), {
    initialRequest: initial.message,
    replies: [reply],
  });
});

test("reply history remains intact when the initial message is absent from the thread", () => {
  const reply = { id: "reply", message: "We are checking with the courier" };
  assert.deepEqual(getTicketThreadView("Original request", [reply]), {
    initialRequest: "Original request",
    replies: [reply],
  });
});

test("blank descriptions do not hide the first actual reply", () => {
  const reply = { id: "reply", message: "We are checking with the courier" };
  assert.deepEqual(getTicketThreadView("  ", [reply]), {
    initialRequest: "",
    replies: [reply],
  });
});
