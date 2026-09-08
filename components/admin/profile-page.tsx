"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/admin/ui";

type Profile = { displayName: string; email: string; phone: string; companyName: string };

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile>({ displayName: "", email: "", phone: "", companyName: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (active) setError("Your session has expired. Please sign in again."); return; }
      const { data, error: loadError } = await supabase.from("profiles").select("display_name,email,phone,company_name").eq("id", auth.user.id).maybeSingle();
      if (!active) return;
      if (loadError) setError("We could not load your profile.");
      setProfile({ displayName: data?.display_name ?? auth.user.user_metadata?.full_name ?? "", email: data?.email ?? auth.user.email ?? "", phone: data?.phone ?? auth.user.user_metadata?.phone ?? "", companyName: data?.company_name ?? "" });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [supabase]);

  async function save() {
    setSaving(true); setMessage(""); setError("");
    const { data: auth } = await supabase.auth.getUser();
    const { error: saveError } = auth.user ? await supabase.from("profiles").update({ display_name: profile.displayName.trim() || null, phone: profile.phone.trim() || null, company_name: profile.companyName.trim() || null }).eq("id", auth.user.id) : { error: new Error("No authenticated user") };
    setSaving(false);
    if (saveError) { setError("Your profile could not be saved."); return; }
    setMessage("Profile changes saved.");
  }

  return <section className="mx-auto w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-xs"><header><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Account</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Super Admin profile</h1><p className="mt-1 text-sm text-muted-foreground">Manage the authenticated identity used by the control center.</p></header>{loading ? <p className="mt-6 text-sm text-muted-foreground">Loading profile…</p> : <div className="mt-6 space-y-4"><label className="block text-xs font-semibold">Full name<input className={inputClass + " mt-1.5"} value={profile.displayName} onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))} /></label><label className="block text-xs font-semibold">Email<input className={inputClass + " mt-1.5 bg-muted"} value={profile.email} readOnly type="email" /></label><label className="block text-xs font-semibold">Mobile number<input className={inputClass + " mt-1.5"} value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} type="tel" /></label><label className="block text-xs font-semibold">Company / legal name<input className={inputClass + " mt-1.5"} value={profile.companyName} onChange={(event) => setProfile((current) => ({ ...current, companyName: event.target.value }))} /></label>{error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-700">{message}</p>}<button disabled={saving || !profile.displayName.trim()} onClick={() => void save()} className="h-10 w-full rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save profile"}</button></div>}</section>;
}
