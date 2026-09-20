"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="grid min-h-full place-items-center rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center"><div><p className="text-sm font-semibold text-destructive">This workspace could not be loaded</p><p className="mt-1 text-xs text-muted-foreground">Production workspace data could not be loaded. Retry or contact an administrator if the problem continues.</p><button onClick={() => reset()} className="mt-4 h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">Try again</button></div></div>;
}
