"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useAdmin } from "@/components/admin/admin-provider";

type AccountCode = "04" | "08" | "other";
type RateCard = { id: string; client_id: string; account_code: AccountCode; original_filename: string; byte_size: number; updated_at: string; normalization_status?: "normalized" | "manual_review" | "failed"; client_accounts?: { legal_name?: string; client_code?: string } | { legal_name?: string; client_code?: string }[] };

export default function RateCardsPage() {
  const { clients } = useAdmin();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cards, setCards] = useState<RateCard[]>([]);
  const [clientId, setClientId] = useState("");
  const [accountCode, setAccountCode] = useState<AccountCode>("other");
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch("/api/admin/rate-cards");
    const result = await response.json() as { rateCards?: RateCard[]; error?: string };
    if (response.ok) setCards(result.rateCards ?? []);
    else setNotice(result.error ?? "Unable to load rate cards.");
  };
  useEffect(() => { void load(); }, []);

  const upload = async () => {
    if (!clientId || !file) return;
    setSaving(true); setNotice("");
    const form = new FormData(); form.set("clientId", clientId); form.set("accountCode", accountCode); form.set("file", file);
    const response = await fetch("/api/admin/rate-cards", { method: "POST", body: form });
    const result = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) { setNotice(result.error ?? "Unable to upload rate card."); return; }
    setFile(null); if (fileInputRef.current) fileInputRef.current.value = "";
    setNotice(`Rate card saved for Delhivery account ${accountCode}.`); await load();
  };

  const download = async (cardId: string) => {
    const response = await fetch("/api/admin/rate-cards", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ cardId }) });
    const result = await response.json() as { url?: string; error?: string };
    if (result.url) window.open(result.url, "_blank", "noopener,noreferrer"); else setNotice(result.error ?? "Unable to prepare download.");
  };

  return <div className="space-y-5">
    <div><h1 className="text-2xl font-semibold tracking-tight">Rate cards</h1><p className="mt-1 text-sm text-muted-foreground">Upload one private source card per client and Delhivery B2B account. Extra client charges remain shared across the client’s accounts.</p></div>
    <section className="rounded-xl border border-border bg-card p-4"><div className="grid gap-3 md:grid-cols-[1fr_180px_1fr_auto]">
      <select value={clientId} onChange={(event) => setClientId(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
      <select value={accountCode} onChange={(event) => setAccountCode(event.target.value as AccountCode)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="04">Delhivery 04</option><option value="08">Delhivery 08</option><option value="other">Standard B2B</option></select>
      <div className="flex min-w-0 items-center gap-2"><input ref={fileInputRef} id="rate-card-file" type="file" accept="application/pdf,.csv,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="sr-only" /><label htmlFor="rate-card-file" className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring"><Upload className="size-4" />Choose file</label><span className="min-w-0 truncate text-sm text-muted-foreground" title={file?.name}>{file?.name ?? "No file chosen"}</span></div>
      <button disabled={!clientId || !file || saving} onClick={() => void upload()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Upload className="size-4" />{saving ? "Uploading…" : "Save rate card"}</button>
    </div>{notice && <p role="status" className="mt-3 text-xs text-muted-foreground">{notice}</p>}</section>
    <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="divide-y divide-border/60">{cards.map((card) => { const client = Array.isArray(card.client_accounts) ? card.client_accounts[0] : card.client_accounts; const normalized = card.normalization_status === "normalized"; return <div key={card.id} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{client?.legal_name ?? card.client_id}</p><p className="mt-1 truncate text-xs text-muted-foreground">Delhivery {card.account_code} · {card.original_filename} · {(card.byte_size / 1024 / 1024).toFixed(2)} MB · {new Date(card.updated_at).toLocaleDateString()}</p><p className={`mt-1 text-[10px] font-semibold ${normalized ? "text-emerald-600" : "text-amber-600"}`}>{normalized ? "Matrix normalized and ready for pricing review" : "Manual matrix review required before publishing"}</p></div><button onClick={() => void download(card.id)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"><Download className="size-3.5" />Download</button></div>; })}{!cards.length && <p className="p-8 text-center text-sm text-muted-foreground">No rate cards uploaded.</p>}</div></section>
  </div>;
}
