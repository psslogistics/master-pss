import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationRoot = new URL("../supabase/migrations/", import.meta.url);
const assignmentSql = await readFile(new URL("202610130003_rbac_audience_scope_hardening.sql", migrationRoot), "utf8");
const onboardingSql = await readFile(new URL("202610290001_super_admin_client_kyc_drafts.sql", migrationRoot), "utf8");
const assignmentRoute = await readFile(new URL("../app/api/admin/employee-client-assignment/route.ts", import.meta.url), "utf8");
const clientIdentitySql = await readFile(new URL("202610300001_client_test_identity_classification.sql", migrationRoot), "utf8");
const clientIdentityRoute = await readFile(new URL("../app/api/admin/client-environment/route.ts", import.meta.url), "utf8");
const adminNavigation = await readFile(new URL("./admin-navigation.ts", import.meta.url), "utf8");
const moduleWorkspace = await readFile(new URL("../components/admin/master-module-workspace.tsx", import.meta.url), "utf8");
const adminShell = await readFile(new URL("../components/admin/admin-shell.tsx", import.meta.url), "utf8");
const bootstrapRoute = await readFile(new URL("../app/api/admin/bootstrap/route.ts", import.meta.url), "utf8");
const assignmentPage = await readFile(new URL("../app/(admin)/client-assignments/page.tsx", import.meta.url), "utf8");
const auditPage = await readFile(new URL("../app/(admin)/audit-logs/page.tsx", import.meta.url), "utf8");
test("client ownership transfer is super-admin-only and accepts active clients and employees", () => {
  assert.match(assignmentSql, /if not private\.is_super_admin\(\) then[\s\S]*?raise exception 'super_admin_required'/i);
  assert.match(assignmentSql, /client_accounts where id = target_client_id and status = 'active'/i);
  assert.match(assignmentSql, /employee_profiles ep join public\.profiles p[\s\S]*?ep\.employment_status = 'active' and p\.status = 'active'/i);
  assert.match(assignmentRoute, /await requireSuperAdmin\(\)/);
  assert.match(assignmentRoute, /sessionData\.session\?\.user\.id !== actor\.userId/);
});

test("ownership transfer replaces prior active owners and records before/after attribution atomically", () => {
  assert.match(assignmentSql, /select coalesce\(array_agg\(employee_user_id\)[\s\S]*?where client_id = target_client_id and is_active = true/i);
  assert.match(assignmentSql, /delete from public\.employee_client_assignments where client_id = target_client_id/i);
  assert.match(assignmentSql, /insert into public\.admin_audit_events \(actor_user_id, action, entity_type, entity_id, before_state, after_state\)[\s\S]*?jsonb_build_object\('employeeIds', previous_employee_ids\)[\s\S]*?jsonb_build_object\('employeeId', target_employee_user_id\)/i);
  assert.match(assignmentSql, /create or replace function private\.transfer_employee_client_assignment[\s\S]*?language plpgsql[\s\S]*?security definer/i);
});

test("client ownership bootstrap paginates directories and assignment UI only shows sourced fields", () => {
  assert.match(bootstrapRoute, /readAllPages\(\(from, to\) => supabase\.from\("client_accounts"\)[\s\S]*?\.range\(from, to\)\)/);
  assert.match(bootstrapRoute, /readAllPages\(\(from, to\) => supabase\.from\("employee_client_assignments"\)[\s\S]*?\.range\(from, to\)\)/);
  assert.match(bootstrapRoute, /readAllPages\(\(from, to\) => supabase\.from\("employee_profiles"\)[\s\S]*?\.range\(from, to\)/);
  assert.match(assignmentPage, /Current owner/);
  assert.doesNotMatch(assignmentPage, /Onboarded by|Workload|Search client, code, or city/);
  assert.match(assignmentPage, /No clients match this search/);
});

test("onboarding drafts are limited to Super Admin and start in a non-active state", () => {
  assert.match(onboardingSql, /if not public\.is_super_admin\(\) then/i);
  assert.match(onboardingSql, /values \(normalized_code, normalized_name, 'on_hold'\)/i);
  assert.match(onboardingSql, /values \(created_client_id, 'draft'\)/i);
  assert.match(onboardingSql, /grant execute on function public\.create_client_kyc_draft\(text, text\) to authenticated/i);
});

test("test identity classification is explicit, reasoned, and audit-backed", () => {
  assert.match(clientIdentitySql, /identity_environment text not null default 'production'/i);
  assert.doesNotMatch(clientIdentitySql, /update public\.client_accounts[\s\S]*?set identity_environment = 'test'[\s\S]*?email/i);
  assert.match(clientIdentitySql, /Classify QA organizations through the audited Super Admin workflow/i);
  assert.match(clientIdentityRoute, /await requireSuperAdmin\(\)/);
  assert.match(clientIdentityRoute, /reason\.length < 8/);
  assert.match(clientIdentityRoute, /before_state: \{ identity_environment: previous \}/);
  assert.match(clientIdentityRoute, /after_state: \{ identity_environment: environment, reason \}/);
  assert.match(clientIdentityRoute, /Classification was rolled back because its audit event could not be recorded/);
});

test("navigation only claims booking, tracking, and audit capabilities that the workspaces provide", () => {
  assert.match(adminNavigation, /Create a single client-context Delhivery B2B shipment/);
  assert.match(adminNavigation, /Invoice, challan, and e-way bill validation/);
  assert.doesNotMatch(adminNavigation, /single and bulk bookings|Single and bulk booking/i);
  assert.match(adminNavigation, /Read-only tracking timeline/);
  assert.match(adminNavigation, /Worker operations and Super Admin audit events/);
  assert.match(moduleWorkspace, /if \(module\.status !== "live"\)/);
  assert.match(adminNavigation, /Ticket deadline monitoring/);
  assert.doesNotMatch(adminNavigation, /Response and resolution SLA|Employee SLA performance/);
});

test("shipment editor excludes provider-managed references, status, reconciled weight, and ETA", () => {
  const editSection = moduleWorkspace.match(/function openShipmentEditor[\s\S]*?async function saveShipmentEdit/)?.[0] ?? "";
  assert.match(editSection, /description: String\(raw\.description/);
  assert.match(editSection, /origin: String\(raw\.origin/);
  assert.match(editSection, /declared_value: String\(raw\.declared_value/);
  assert.match(moduleWorkspace, /Courier-owned references, status, reconciled weight, and ETA are provider-managed and cannot be edited here/);
  assert.doesNotMatch(editSection, /lr_number|master_awb|provider_reference|courier_status|weight_override_kg|total_weight_kg|eta|edd/);
});

test("global search exposes shipment lookup failures without hiding other suggestions", () => {
  assert.match(adminShell, /shipmentSearchError/);
  assert.match(adminShell, /Shipment search is temporarily unavailable/);
  assert.match(adminShell, /Other matching pages, clients, and employees are still shown/);
  assert.match(adminShell, /role="status"/);
});

test("audit pagination preserves a failed source cursor so the next load can retry it", () => {
  assert.match(auditPage, /worker: workerFailed \|\| !worker \? current\.worker/);
  assert.match(auditPage, /master: masterFailed \|\| !master \? current\.master/);
  assert.match(auditPage, /use Load older events to retry the failed source/);
  assert.doesNotMatch(auditPage, /worker: \{ \.\.\.current\.worker, hasMore: false \}, master: \{ \.\.\.current\.master, hasMore: false \}/);
});

test("sidebar quick access persists pinned and recent routes and filters them by visible permissions", () => {
  assert.match(adminShell, /pss-admin-favorite-pages/);
  assert.match(adminShell, /pss-admin-recent-pages/);
  assert.match(adminShell, /slice\(0, 5\)/);
  assert.match(adminShell, /slice\(0, 6\)/);
  assert.match(adminShell, /permittedRoutes\.get\(href\)/);
  assert.match(adminShell, /aria-pressed=\{isFavorite\}/);
});
