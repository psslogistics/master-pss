import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/202610300002_audit_client_kyc_decisions.sql", import.meta.url), "utf8");

test("KYC review migration audits status and document-state transitions atomically", () => {
  assert.match(migration, /for update/i);
  assert.match(migration, /insert into public\.admin_audit_events/i);
  assert.match(migration, /jsonb_build_object\('status', previous_status, 'document_statuses', previous_document_states\)/i);
  assert.match(migration, /jsonb_build_object\('status', p_status, 'document_statuses', next_document_states\)/i);
  assert.match(migration, /auth\.uid\(\)/i);
});

test("KYC audit payload does not copy government identifiers or free-text notes", () => {
  const auditInsert = migration.match(/insert into public\.admin_audit_events[\s\S]*?\);/i)?.[0] ?? "";
  assert.ok(auditInsert);
  for (const sensitiveField of ["gst_number", "pan_number", "aadhaar_last4", "p_review_notes", "review_notes", "phone"]) {
    assert.doesNotMatch(auditInsert, new RegExp(sensitiveField, "i"));
  }
});
