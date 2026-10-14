"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type DropdownProps = {
  label: string;
  value: string;
  options: (string | { value: string; label: string })[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onChange: (value: string) => void;
  className?: string;
  portal?: boolean;
};

export default function Dropdown({ label, value, options, open: controlledOpen, onOpenChange, onChange, className = "", portal = false }: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [portalPosition, setPortalPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const open = controlledOpen ?? internalOpen;
  const setOpen = useCallback((next: boolean) => { setInternalOpen(next); onOpenChange?.(next); }, [onOpenChange]);
  const selectOption = useCallback((optionValue: string) => { setOpen(false); onChange(optionValue); }, [onChange, setOpen]);
  useEffect(() => {
    if (!portal || !open || !triggerRef.current) { setPortalPosition(null); return; }
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = Math.min(192, Math.max(48, options.length * 34 + 12));
      const top = rect.bottom + 4 + menuHeight > window.innerHeight - 8 && rect.top - 4 - menuHeight >= 8 ? rect.top - 4 - menuHeight : rect.bottom + 4;
      setPortalPosition({ top, left: rect.left, width: rect.width });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => { window.removeEventListener("resize", updatePosition); window.removeEventListener("scroll", updatePosition, true); };
  }, [open, options.length, portal]);
  useEffect(() => {
    const close = (event: PointerEvent) => { const target = event.target as Node; if (ref.current && !ref.current.contains(target) && (!menuRef.current || !menuRef.current.contains(target))) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [setOpen]);
  const menu = open ? <div ref={menuRef} role="listbox" aria-label={`${label} options`} className={portal ? "fixed z-[100] max-h-48 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl" : "absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"} style={portal && portalPosition ? { top: portalPosition.top, left: portalPosition.left, width: portalPosition.width } : undefined}>{["", ...options.filter(Boolean)].map((option, index) => { const optionValue = typeof option === "string" ? option : option.value; const optionLabel = typeof option === "string" ? option : option.label; return <button key={`${optionValue}-${index}`} type="button" role="option" aria-selected={value === optionValue} onPointerDown={(event) => { event.preventDefault(); selectOption(optionValue); }} onClick={(event) => { if (event.detail === 0) selectOption(optionValue); }} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${value === optionValue ? "bg-primary/10 font-semibold text-primary" : "hover:bg-accent"}`}>{optionLabel || label}{value === optionValue && <Check className="h-3.5 w-3.5" />}</button>; })}</div> : null;
  return <div ref={ref} className={`relative ${className}`}><button ref={triggerRef} type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-9 w-full items-center justify-between rounded-xl border border-input bg-background px-3 text-left text-xs text-foreground outline-none transition hover:border-primary/50 focus:border-primary focus:ring-4 focus:ring-primary/10"><span className={value ? "truncate" : "truncate text-muted-foreground"}>{options.find((option) => (typeof option === "string" ? option : option.value) === value) instanceof Object ? (options.find((option) => (typeof option === "string" ? option : option.value) === value) as { label: string }).label : value || label}</span><ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} /></button>{portal ? (typeof document !== "undefined" && portalPosition ? createPortal(menu, document.body) : null) : menu}</div>;
}
