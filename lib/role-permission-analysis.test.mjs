import assert from "node:assert/strict";
import test from "node:test";
import { compareRolePermissionSets, getRolePermissionDependencyIssues } from "./role-permission-analysis.ts";

test("reports missing read permissions for action grants without mutating the grant set", () => {
  const issues = getRolePermissionDependencyIssues(["shipments.create", "tickets.reply"], {
    "shipments.create": "Create shipments",
    "shipments.view": "View shipments",
    "tickets.reply": "Reply to tickets",
    "tickets.view": "View tickets",
  });
  assert.deepEqual(issues.map((issue) => [issue.permissionKey, issue.missingLabels]), [
    ["shipments.create", ["View shipments"]],
    ["tickets.reply", ["View tickets"]],
  ]);
});

test("does not report dependencies when the required view grants are present", () => {
  assert.deepEqual(getRolePermissionDependencyIssues(["shipments.create", "shipments.view"]), []);
});

test("compares effective permission sets against catalog entries", () => {
  const comparison = compareRolePermissionSets(
    ["shipments.view", "shipments.create"],
    ["shipments.view"],
    [
      { key: "shipments.view", label: "View shipments", group: "Operations" },
      { key: "shipments.create", label: "Create shipments", group: "Operations" },
    ],
  );
  assert.equal(comparison[0].same, true);
  assert.equal(comparison[1].leftEnabled, true);
  assert.equal(comparison[1].rightEnabled, false);
});
