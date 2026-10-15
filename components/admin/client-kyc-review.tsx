"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Row = { client_id: string; status: string; gst_number: string | null; pan_number: string | null; aadhaar_last4: string | null; mobile_number: string | null; phone_verified_at: string | null; review_notes: string | null; client?: { legal_name: string; client_code: string | null }; documents?: Array<{ document_type: string; object_path: string; original_filename: string; status: string }> };
const statuses = ["approved", "needs_changes", "rejected", "suspended"];

export default function ClientKycReview() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [reviewStatus, setReviewStatus] = useState("approved");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from("client_kyc_profiles").select("client_id,status,gst_number,pan_number,aadhaar_last4,mobile_number,phone_verified_at,review_notes,client_accounts(legal_name,client_code),client_kyc_documents(document_type,object_path,original_filename,status)").order("updated_at", { ascending: false });
    if (error) { setMessage("KYC queue could not be loaded."); return; }
    const mapped = (data ?? []).map((item) => ({ ...item, client: Array.isArray(item.client_accounts) ? item.client_accounts[0] : item.client_accounts, documents: item.client_kyc_documents })) as unknown as Row[];
    setRows(mapped);
    if (selected) setSelected(mapped.find((item) => item.client_id === selected.client_id) ?? null);
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
    setSaving(true); setMessage("");
    const { error } = await supabase.rpc("review_client_kyc", { p_client_id: selected.client_id, p_status: reviewStatus, p_review_notes: notes || null, p_gst_number: selected.gst_number, p_pan_number: selected.pan_number, p_aadhaar_last4: selected.aadhaar_last4 });
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    setMessage(`KYC ${reviewStatus.replaceAll("_", " ")} for ${selected.client?.legal_name ?? "client"}.`); setSelected(null); await load();
  };

  return <section className="rounded-xl border border-border bg-card shadow-xs"><div className="border-b border-border/70 p-4 sm:p-5"><h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Client KYC review queue</h2><p className="mt-1 text-xs text-muted-foreground">Approve only after Aadhaar, GST, PAN, and mobile OTP verification are complete.</p></div>{message && <div role="status" className="mx-4 mt-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">{message}</div>}<div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]"><div className="divide-y divide-border/70">{rows.length ? rows.map((row) => <button key={row.client_id} type="button" onClick={() => { setSelected(row); setReviewStatus(row.status === "submitted" || row.status === "under_review" ? "approved" : row.status); setNotes(row.review_notes ?? ""); }} className={`flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-muted/30 ${selected?.client_id === row.client_id ? "bg-primary/5" : ""}`}><span><span className="block text-xs font-semibold">{row.client?.legal_name ?? row.client_id}</span><span className="mt-1 block text-[11px] text-muted-foreground">{row.client?.client_code ?? "No client code"} · {row.status.replaceAll("_", " ")}</span></span><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase">{row.status.replaceAll("_", " ")}</span></button>) : <p className="p-5 text-xs text-muted-foreground">No KYC requests have been submitted.</p>}</div><div className="border-t border-border/70 p-4 xl:border-l xl:border-t-0">{selected ? <div className="space-y-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Selected client</p><h3 className="mt-1 text-sm font-semibold">{selected.client?.legal_name ?? selected.client_id}</h3></div><div className="grid grid-cols-2 gap-2 text-xs"><Info label="GST" value={selected.gst_number ?? "Missing"} /><Info label="PAN" value={selected.pan_number ?? "Missing"} /><Info label="Aadhaar" value={selected.aadhaar_last4 ? `•••• ${selected.aadhaar_last4}` : "Missing"} /><Info label="Mobile" value={selected.mobile_number ?? "Missing"} /><Info label="OTP status" value={selected.phone_verified_at ? "Verified" : "Not verified"} /></div><div className="space-y-2"><p className="text-xs font-semibold">Documents</p>{(selected.documents ?? []).map((document) => <button type="button" key={document.document_type} onClick={() => void openDocument(document.object_path)} className="flex w-full items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-left text-xs hover:border-primary/50"><span className="flex min-w-0 items-center gap-2"><FileText className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{document.document_type.toUpperCase()} · {document.original_filename}</span></span><ExternalLink className="h-3.5 w-3.5 shrink-0" /></button>)}</div><select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-xs"><option value="approved">Approve</option>{statuses.filter((status) => status !== "approved").map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs" placeholder="Review note or correction request" /><button type="button" disabled={saving} onClick={() => void review()} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground disabled:opacity-50"><Check className="h-4 w-4" />{saving ? "Saving…" : "Save KYC decision"}</button></div> : <p className="text-xs text-muted-foreground">Select a submitted KYC request to inspect the documents and make a decision.</p>}</div></div></section>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/40 p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 truncate font-medium">{value}</p></div>; }
