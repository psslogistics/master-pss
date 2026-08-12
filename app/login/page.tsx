"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { demoSessionStorage } from "@/lib/admin-repository";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@psslogistics.in");
  const [password, setPassword] = useState("PSS@2026");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (demoSessionStorage.load()) router.replace("/dashboard");
  }, [router]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid work email address.");
    if (password.length < 8) return setError("Password must contain at least 8 characters.");
    if (email.toLowerCase() !== "admin@psslogistics.in" || password !== "PSS@2026") return setError("Use the demo credentials shown below.");
    setPending(true);
    demoSessionStorage.create();
    router.replace("/dashboard");
  }

  return <main className="min-h-dvh bg-muted/40 p-4 sm:p-6 lg:p-8">
    <div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-7xl overflow-hidden rounded-[28px] border border-border bg-card shadow-2xl sm:min-h-[calc(100dvh-3rem)] lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 15%, #8aa4d8 0, transparent 28%), radial-gradient(circle at 85% 78%, #6b83b3 0, transparent 30%)" }} />
        <div className="relative flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-card text-lg font-black text-primary">P</div><div><p className="font-bold tracking-tight">PSS Logistics</p><p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-200">Internal Operations</p></div></div>
        <div className="relative my-auto max-w-xl"><div className="mb-8 grid size-14 place-items-center rounded-2xl border border-border/15 bg-card/10 backdrop-blur"><ShieldCheck className="size-7 text-blue-100" /></div><h1 className="text-4xl font-semibold leading-tight tracking-[-0.035em]">One control center for every operational decision.</h1><p className="mt-5 max-w-lg text-base leading-7 text-blue-100/80">Manage employees, access, client responsibility, and critical activity from a single organization-wide workspace.</p><div className="mt-10 grid grid-cols-3 gap-3">{[["1,284", "Daily shipments"], ["42", "Active clients"], ["99.2%", "Platform uptime"]].map(([value, label]) => <div key={label} className="rounded-2xl border border-border/10 bg-card/[0.07] p-4 backdrop-blur"><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-xs text-blue-100/60">{label}</p></div>)}</div></div>
        <p className="relative text-xs text-blue-100/50">Enterprise operations prototype · PSS Logistics</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><div className="grid size-10 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">P</div><div><p className="font-bold">PSS Logistics</p><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Internal Operations</p></div></div>
          <div className="mb-8"><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"><LockKeyhole className="size-3.5" /> Super Admin access</div><h2 className="text-3xl font-semibold tracking-[-0.035em] text-foreground">Welcome back</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in to monitor and manage PSS operations.</p></div>
          <form onSubmit={submit} noValidate className="space-y-5">
            <label className="block"><span className="mb-2 block text-xs font-semibold text-foreground/80">Work email</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="h-12 w-full rounded-xl border border-border px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
            <label className="block"><span className="mb-2 block text-xs font-semibold text-foreground/80">Password</span><span className="relative block"><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" className="h-12 w-full rounded-xl border border-border px-4 pr-12 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-muted">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}
            <button disabled={pending} className={cn("flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90", pending && "opacity-70")} type="submit">{pending ? "Opening control center…" : "Sign in to control center"}<ArrowRight className="size-4" /></button>
          </form>
          <div className="mt-6 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4"><div className="flex items-center gap-2 text-xs font-bold text-amber-800"><ShieldCheck className="size-4" /> Demo access only</div><p className="mt-2 text-xs leading-5 text-amber-700/80">This prototype does not provide production authentication. Use <strong>admin@psslogistics.in</strong> and <strong>PSS@2026</strong>.</p></div>
        </div>
      </section>
    </div>
  </main>;
}

