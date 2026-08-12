"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "positive" | "warning" | "critical" | "navy" }) {
  const tones = { neutral: "border-border bg-muted text-muted-foreground", positive: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", warning: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300", critical: "border-destructive/25 bg-destructive/10 text-destructive", navy: "border-primary/25 bg-primary/10 text-primary" };
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", tones[tone])}>{children}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center"><div><p className="font-semibold text-foreground">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>;
}

export function Modal({ open, onClose, title, description, children, size = "md" }: { open: boolean; onClose(): void; title: string; description?: string; children: React.ReactNode; size?: "md" | "lg" }) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-background/60 p-4 backdrop-blur-sm" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className={cn("max-h-[90vh] w-full overflow-auto rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-150", size === "lg" ? "max-w-3xl" : "max-w-lg")}>
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border/60 bg-popover/95 px-5 py-4 backdrop-blur-xl">
        <div><h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>
        <button onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"><X className="size-4" /></button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span>{children}{hint && <span className="mt-1.5 block text-[11px] text-muted-foreground">{hint}</span>}</label>;
}

export const inputClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-4 focus:ring-primary/10";

export function SegmentedPicker({ value, options, onChange, label }: { value: string; options: { value: string; label: string }[]; onChange(value: string): void; label: string }) {
  return <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2">{options.map((option) => <button type="button" role="radio" aria-checked={value === option.value} key={option.value} onClick={() => onChange(option.value)} className={cn("rounded-lg border px-3 py-2.5 text-left text-xs transition", value === option.value ? "border-primary bg-primary/5 font-semibold text-primary ring-4 ring-primary/10" : "border-border text-muted-foreground hover:border-primary/50 hover:bg-accent")}>{option.label}</button>)}</div>;
}
