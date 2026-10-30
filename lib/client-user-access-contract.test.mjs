import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("client access directory paginates every source and checks view permission", async () => {
  const route = await source("app/api/admin/client-membership/route.ts");
  assert.match(route, /authorizeAdminTaskPermission\("admin\.client_users\.view"\)/);
  assert.equal((route.match(/readAllPages\(/g) ?? []).length, 4);
  assert.match(route, /Unable to load the complete client access directory/);
});

test("membership changes validate status, require manage permission, and audit with rollback", async () => {
  const route = await source("app/api/admin/client-membership/route.ts");
  assert.match(route, /authorizeAdminTaskPermission\("admin\.client_users\.manage"\)/);
  assert.match(route, /membershipStatus !== "active" && membershipStatus !== "suspended"/);
  assert.match(route, /before_state: previous/);
  assert.match(route, /after_state:/);
  assert.match(route, /Membership change was rolled back because its audit event could not be recorded/);
});

test("client access UI exposes all memberships and actionable directory load errors", async () => {
  const page = await source("app/(admin)/client-user-access/page.tsx");
  assert.match(page, /memberships\.filter\(\(item\) => item\.user_id === user\.id\)/);
  assert.match(page, /Current memberships/);
  assert.match(page, /Retry/);
  assert.match(page, /canResetPasswords/);
});

test("client access navigation is live and uses the view permission", async () => {
  const navigation = await source("lib/admin-navigation.ts");
  assert.match(navigation, /href: "\/client-user-access"[^\n]+requiredPermission: "admin\.client_users\.view", status: "live"/);
});
