export type KycDocument = { document_type: string; status: string };
export type KycApprovalInput = {
  phone_verified_at?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  aadhaar_last4?: string | null;
  documents?: KycDocument[] | null;
};

const requiredDocuments = new Set(["aadhaar", "gst", "pan"]);
const acceptedDocumentStatuses = new Set(["submitted", "approved"]);

export function hasRequiredKycDocuments(documents: KycDocument[] | null | undefined): boolean {
  const eligibleTypes = new Set((documents ?? [])
    .filter((document) => requiredDocuments.has(document.document_type.trim().toLowerCase())
      && acceptedDocumentStatuses.has(document.status.trim().toLowerCase()))
    .map((document) => document.document_type.trim().toLowerCase()));
  return [...requiredDocuments].every((type) => eligibleTypes.has(type));
}

export function getKycApprovalBlockers(input: KycApprovalInput): string[] {
  const blockers: string[] = [];
  if (!input.gst_number?.trim()) blockers.push("GST number is missing");
  if (!input.pan_number?.trim()) blockers.push("PAN number is missing");
  if (!/^\d{4}$/.test(input.aadhaar_last4 ?? "")) blockers.push("Aadhaar last four digits are missing or invalid");
  if (!input.phone_verified_at?.trim()) blockers.push("Mobile OTP is not verified");
  if (!hasRequiredKycDocuments(input.documents)) blockers.push("Submitted Aadhaar, GST, and PAN documents are required");
  return blockers;
}
