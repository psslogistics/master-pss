"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getKycApprovalBlockers } from "@/lib/kyc-review";

type Row = { client_id: string; status: string; gst_number: string | null; pan_number: string | null; aadhaar_last4: string | null; mobile_number: string | null; phone_verified_at: string | null; review_notes: string | null; client?: { legal_name: string; client_code: string | null; identity_environment?: string | null }; documents?: Array<{ document_type: string; object_path: string; original_filename: string; status: string }> };
const statuses = ["approved", "needs_changes", "rejected", "suspended"];

export default function ClientKycReview() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [reviewStatus, setReviewStatus] = useState("approved");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftCode, setDraftCode] = useState("");
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [identityEnvironment, setIdentityEnvironment] = useState<"production" | "test">("production");
  const [identityReason, setIdentityReason] = useState("");
  const [savingIdentity, setSavingIdentity] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase.from("client_kyc_profiles").select("client_id,status,gst_number,pan_number,aadhaar_last4,mobile_number,phone_verified_at,review_notes,client_accounts(legal_name,client_code,identity_environment),client_kyc_documents(document_type,object_path,original_filename,status)").order("updated_at", { ascending: false });
    setLoading(false);
    if (error) { setLoadError(true); setMessage("KYC queue could not be loaded. Please retry."); return; }
    const mapped = (data ?? []).map((item) => ({ ...item, client: Array.isArray(item.client_accounts) ? item.client_accounts[0] : item.client_accounts, documents: item.client_kyc_documents })) as unknown as Row[];
    setRows(mapped);
    const requestedClientId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("client");
    const selectedClientId = selected?.client_id ?? requestedClientId;
    if (selectedClientId) {
      const match = mapped.find((item) => item.client_id === selectedClientId) ?? null;
      setSelected(match);
      if (match) {
        setReviewStatus(match.status === "submitted" || match.status === "under_review" ? "approved" : match.status);
        setNotes(match.review_notes ?? "");
        setIdentityEnvironment(match.client?.identity_environment === "test" ? "test" : "production");
      } else if (requestedClientId) {
        setMessage("This client does not have an onboarding or KYC record yet.");
      }
    }
  };

  // Initial queue load synchronizes the review UI with the authenticated Supabase session.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  const openDocument = async (path: string) => {
    const { data, error } = await supabase.storage.from("client-kyc-documents").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { setMessage("The document could not be opened."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const review = async () => {
    if (!selected) return;
    const approvalBlockers = getKycApprovalBlockers(selected);
    if (reviewStatus === "approved" && approvalBlockers.length) { setMessage(`Approval is blocked: ${approvalBlockers.join("; ")}.`); return; }
    setSaving(true); setMessage("");
    const { error } = await supabase.rpc("review_client_kyc", { p_client_id: selected.client_id, p_status: reviewStatus, p_review_notes: notes || null, p_gst_number: selected.gst_number, p_pan_number: selected.pan_number, p_aadhaar_last4: selected.aadhaar_last4 });
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    setMessage(`KYC ${reviewStatus.replaceAll("_", " ")} for ${selected.client?.legal_name ?? "client"}.`); setSelected(null); await load();
  };

  const startOnboarding = async () => {
    const legalName = draftName.trim();
    const clientCode = draftCode.trim().toUpperCase();
    if (!legalName) { setMessage("Enter the client legal name to start onboarding."); return; }
    if (legalName.length > 180) { setMessage("Client legal name must be 180 characters or fewer."); return; }
    if (clientCode && !/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(clientCode)) { setMessage("Client code must be 3–32 uppercase letters, numbers, or hyphens."); return; }
    setCreatingDraft(true); setMessage("");
    try {
      const { error } = await supabase.rpc("create_client_kyc_draft", { p_legal_name: legalName, p_client_code: clientCode || null });
      if (error) { setMessage(error.message); return; }
      setDraftName(""); setDraftCode(""); setMessage(`Onboarding draft started for ${legalName}.`);
      await load();
    } catch {
      setMessage("Onboarding could not be started. Check the connection and retry.");
    } finally { setCreatingDraft(false); }
  };

  const saveIdentityEnvironment = async () => {
    if (!selected) return;
    const reason = identityReason.trim();
    if (reason.length < 8) { setMessage("Enter a reason of at least 8 characters to classify this client identity."); return; }
    setSavingIdentity(true); setMessage("");
    try {
      const response = await fetch("/api/admin/client-environment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: selected.client_id, environment: identityEnvironment, reason }) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setMessage(result.error ?? "Client identity classification could not be saved."); return; }
      setIdentityReason("");
      setMessage(`Client identity classified as ${identityEnvironment}. The change was recorded in Activity Logs.`);
      await load();
    } catch {
      setMessage("Client identity classification could not be saved. Check the connection and retry.");
    } finally { setSavingIdentity(false); }
  };

  return <section className="rounded-xl border border-border bg-card shadow-xs"><div className="border-b border-border/70 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Client onboarding &amp; KYC queue</h2><p className="mt-1 text-xs text-muted-foreground">Start a draft, then review submitted identity documents before approval.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-input px-3 py-2 text-xs font-semibold disabled:opacity-50">{loading ? "Loading…" : "Refresh"}</button></div><div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px_auto]"><input value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={180} aria-label="Client legal name" placeholder="Client legal name" className="h-10 min-w-0 rounded-lg border border-input bg-background px-3 text-xs" /><input value={draftCode} onChange={(event) => setDraftCode(event.target.value.toUpperCase())} maxLength={32} aria-label="Client code (optional)" placeholder="Client code (optional)" className="h-10 min-w-0 rounded-lg border border-input bg-background px-3 text-xs uppercase" /><button type="button" onClick={() => void startOnboarding()} disabled={creatingDraft || !draftName.trim()} className="h-10 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50">{creatingDraft ? "Starting…" : "Start onboarding"}</button></div></div>{message && <div role={loadError ? "alert" : "status"} className="mx-4 mt-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">{message}</div>}{loadError && <button type="button" onClick={() => void load()} className="mx-4 mt-2 text-left text-xs font-semibold text-primary underline">Retry loading KYC queue</button>}<div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="divide-y divide-border/70">{loading ? <p className="p-5 text-xs text-muted-foreground">Loading onboarding records…</p> : rows.length ? rows.map((row) => <button key={row.client_id} type="button" onClick={() => { setSelected(row); setReviewStatus(row.status === "submitted" || row.status === "under_review" ? "approved" : row.status); setNotes(row.review_notes ?? ""); setIdentityEnvironment(row.client?.identity_environment === "test" ? "test" : "production"); }} className={`flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/30 ${selected?.client_id === row.client_id ? "bg-primary/5" : ""}`}><span><span className="block text-xs font-semibold">{row.client?.legal_name ?? row.client_id}</span><span className="mt-1 block text-[11px] text-muted-foreground">{row.client?.client_code ?? "No client code"} · {row.documents?.length ?? 0}/3 documents · {row.status.replaceAll("_", " ")} · {row.client?.identity_environment === "test" ? "Test identity" : "Production identity"}</span></span><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase">{row.status.replaceAll("_", " ")}</span></button>) : <p className="p-5 text-xs text-muted-foreground">No onboarding drafts or submitted KYC requests yet. Start a draft above.</p>}</div><div className="border-t border-border/70 p-4 xl:border-l xl:border-t-0">{selected ? <div className="space-y-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Selected client</p><h3 className="mt-1 text-sm font-semibold">{selected.client?.legal_name ?? selected.client_id}</h3></div><div className="grid grid-cols-2 gap-2 text-xs"><Info label="GST" value={selected.gst_number ?? "Missing"} /><Info label="PAN" value={selected.pan_number ?? "Missing"} /><Info label="Aadhaar" value={selected.aadhaar_last4 ? `•••• ${selected.aadhaar_last4}` : "Missing"} /><Info label="Mobile" value={selected.mobile_number ?? "Missing"} /><Info label="OTP status" value={selected.phone_verified_at ? "Verified" : "Not verified"} /></div><div className="space-y-2 rounded-lg border border-border/70 p-3"><p className="text-xs font-semibold">Identity environment</p><p className="text-[11px] leading-4 text-muted-foreground">Test organizations bypass the KYC booking gate. Production is the default for new clients.</p><select aria-label="Client identity environment" value={identityEnvironment} onChange={(event) => setIdentityEnvironment(event.target.value as "production" | "test")} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs"><option value="production">Production identity</option><option value="test">Test identity</option></select><input aria-label="Identity classification reason" value={identityReason} onChange={(event) => setIdentityReason(event.target.value)} maxLength={500} minLength={8} placeholder="Reason required (8–500 characters)" className="h-9 w-full rounded-lg border border-input bg-background px-3 text-xs" /><button type="button" disabled={savingIdentity || identityEnvironment === (selected.client?.identity_environment === "test" ? "test" : "production") || identityReason.trim().length < 8} onClick={() => void saveIdentityEnvironment()} className="h-9 w-full rounded-lg border border-input text-xs font-semibold disabled:opacity-50">{savingIdentity ? "Saving classification…" : "Save identity classification"}</button></div>{reviewStatus === "approved" && getKycApprovalBlockers(selected).length > 0 && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800">Approval is blocked: {getKycApprovalBlockers(selected).join("; ")}.</p>}<div className="space-y-2"><p className="text-xs font-semibold">Documents</p>{(selected.documents ?? []).map((document, index) => <button type="button" key={`${document.document_type}-${index}`} onClick={() => void openDocument(document.object_path)} className="flex w-full items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-left text-xs hover:border-primary/50"><span className="flex min-w-0 items-center gap-2"><FileText className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{document.document_type.toUpperCase()} · {document.original_filename} <span className="text-[10px] text-muted-foreground">({document.status})</span></span></span><ExternalLink className="h-3.5 w-3.5 shrink-0" /></button>)}</div><select aria-label="KYC decision" value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-xs"><option value="approved">Approve</option>{statuses.filter((status) => status !== "approved").map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select><textarea aria-label="Review note" value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs" placeholder="Review note or correction request" /><button type="button" disabled={saving || (reviewStatus === "approved" && getKycApprovalBlockers(selected).length > 0)} onClick={() => void review()} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground disabled:opacity-50"><Check className="h-4 w-4" />{saving ? "Saving…" : "Save KYC decision"}</button></div> : <p className="text-xs text-muted-foreground">Select an onboarding record to inspect its documents and make a decision.</p>}</div></div></section>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/40 p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 truncate font-medium">{value}</p></div>; }
