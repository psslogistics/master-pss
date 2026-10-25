"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/admin/ui";

type Profile = { displayName: string; email: string; phone: string; companyName: string };

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile>({ displayName: "", email: "", phone: "", companyName: "" });
  const [savedProfile, setSavedProfile] = useState<Profile>({ displayName: "", email: "", phone: "", companyName: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) { if (active) setError("Your session has expired. Please sign in again."); return; }
        const { data, error: loadError } = await supabase.from("profiles").select("display_name,email,phone,company_name").eq("id", auth.user.id).maybeSingle();
        if (!active) return;
        if (loadError) setError("We could not load your profile. Showing available account details.");
        const nextProfile = { displayName: data?.display_name ?? auth.user.user_metadata?.full_name ?? "", email: data?.email ?? auth.user.email ?? "", phone: data?.phone ?? auth.user.user_metadata?.phone ?? "", companyName: data?.company_name ?? "" };
        setProfile(nextProfile);
        setSavedProfile(nextProfile);
      } catch {
        if (active) setError("We could not load your profile. Please retry.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [supabase]);

  async function save() {
    setSaving(true); setMessage(""); setError("");
    const { data: auth } = await supabase.auth.getUser();
    const { error: saveError } = auth.user ? await supabase.from("profiles").update({ display_name: profile.displayName.trim() || null, phone: profile.phone.trim() || null, company_name: profile.companyName.trim() || null }).eq("id", auth.user.id) : { error: new Error("No authenticated user") };
    setSaving(false);
    if (saveError) { setError("Your profile could not be saved."); return; }
    setSavedProfile(profile);
    setMessage("Profile changes saved.");
  }

  const initials = profile.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SA";
  const dirty = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  return <section className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-card shadow-xs"><header className="border-b border-border/70 bg-muted/20 p-5 sm:p-6"><div className="flex items-start gap-4"><div className="grid size-14 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary" aria-hidden="true">{initials}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Account</p><span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700"><ShieldCheck className="size-3" />Authenticated</span></div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Super Admin profile</h1><p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="size-3.5" />{profile.email || "Authenticated account"}</p></div></div></header>{loading ? <div className="p-6" role="status"> <div className="h-4 w-40 animate-pulse rounded bg-muted" /><div className="mt-4 h-10 animate-pulse rounded-lg bg-muted" /></div> : <div className="space-y-4 p-5 sm:p-6"><p className="text-sm text-muted-foreground">Manage the identity used by the control center. Email is managed by authentication and cannot be edited here.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs font-semibold">Full name<div className="relative mt-1.5"><UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input className={inputClass + " pl-9"} value={profile.displayName} onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))} /></div></label><label className="block text-xs font-semibold">Email<input className={inputClass + " mt-1.5 bg-muted"} value={profile.email} readOnly type="email" /></label><label className="block text-xs font-semibold">Mobile number<input className={inputClass + " mt-1.5"} value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} type="tel" placeholder="+91 98765 00000" /></label><label className="block text-xs font-semibold">Company / legal name<input className={inputClass + " mt-1.5"} value={profile.companyName} onChange={(event) => setProfile((current) => ({ ...current, companyName: event.target.value }))} placeholder="PSS Logistics" /></label></div>{error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}{message && <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-700"><CheckCircle2 className="size-4" />{message}</p>}<div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4"><p className="text-xs text-muted-foreground">{dirty ? "Unsaved changes" : "All changes saved"}</p><button disabled={saving || !dirty || !profile.displayName.trim()} onClick={() => void save()} className="h-10 min-w-32 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : "Save profile"}</button></div></div>}</section>;
}
