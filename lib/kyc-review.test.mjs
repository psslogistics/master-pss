import test from "node:test";
import assert from "node:assert/strict";
import { getKycApprovalBlockers, hasRequiredKycDocuments } from "./kyc-review.ts";

const docs = [
  { document_type: "aadhaar", status: "submitted" },
  { document_type: "gst", status: "approved" },
  { document_type: "pan", status: "submitted" },
];

test("requires one acceptable document for each required identity type", () => {
  assert.equal(hasRequiredKycDocuments(docs), true);
  assert.equal(hasRequiredKycDocuments([...docs, { document_type: "gst", status: "submitted" }]), true);
  assert.equal(hasRequiredKycDocuments([...docs.filter((item) => item.document_type !== "pan"), { document_type: "pan", status: "rejected" }]), false);
  assert.equal(hasRequiredKycDocuments([{ document_type: "unknown", status: "submitted" }, ...docs]), true);
});

test("blocks approval for missing identity, OTP, invalid Aadhaar, or documents", () => {
  assert.deepEqual(getKycApprovalBlockers({ gst_number: "GST", pan_number: "PAN", aadhaar_last4: "1234", phone_verified_at: "2026-01-01", documents: docs }), []);
  const blockers = getKycApprovalBlockers({ gst_number: " ", pan_number: null, aadhaar_last4: "12x4", documents: [] });
  assert.equal(blockers.length, 5);
});
