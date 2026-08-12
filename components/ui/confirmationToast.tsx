"use client";

import { Check, Info, TriangleAlert, X } from "lucide-react";
import { useEffect } from "react";

export type ConfirmationToastTone = "success" | "error" | "info" | "warning";

export default function ConfirmationToast({ message, tone = "success", onClose, duration = 3200 }: { message: string; tone?: ConfirmationToastTone; onClose: () => void; duration?: number }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onClose]);

  const styles = {
    success: { icon: Check, className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    error: { icon: TriangleAlert, className: "border-destructive/25 bg-destructive/10 text-destructive" },
    info: { icon: Info, className: "border-primary/25 bg-primary/10 text-primary" },
    warning: { icon: TriangleAlert, className: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  }[tone];
  const Icon = styles.icon;

  return <div role="status" aria-live="polite" className={`fixed bottom-5 right-5 z-70 flex max-w-sm items-center gap-2 rounded-xl border px-3.5 py-3 text-xs font-medium shadow-xl backdrop-blur-xl ${styles.className}`}><Icon className="h-4 w-4 shrink-0" /><span>{message}</span><button type="button" aria-label="Dismiss notification" onClick={onClose} className="ml-2 rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"><X className="h-3.5 w-3.5" /></button></div>;
}

