"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell, ChevronRight, LogOut, Moon, RefreshCcw, Search, Sun, User,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import ConfirmationToast, { type ConfirmationToastTone } from "@/components/ui/confirmationToast";
import { PssIcon } from "@/components/ui/icon";
import { demoSessionStorage } from "@/lib/admin-repository";
import { useAdmin } from "@/components/admin/admin-provider";
import { adminNavGroups, allAdminNavItems, findAdminModuleByPath, type AdminNavItem } from "@/lib/admin-navigation";
import { can } from "@/lib/admin-domain";

function NavItems({ items, activeHref, onNavigate }: { items: AdminNavItem[]; activeHref?: string; onNavigate(): void }) {
  return <SidebarMenu>{items.map((item) => {
    const active = activeHref === item.href;
    return <SidebarMenuItem key={item.href}><SidebarMenuButton isActive={active} render={<Link href={item.href} onClick={onNavigate} />} tooltip={item.label}><PssIcon name={item.icon} size="lg" className="shrink-0 opacity-70" /><span className="truncate">{item.label}</span>{active && <ChevronRight className="ml-auto size-3.5 shrink-0 opacity-40" />}</SidebarMenuButton></SidebarMenuItem>;
  })}</SidebarMenu>;
}

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, setOpenMobile } = useSidebar();
  const { resetDemo, auditEvents, employees, roles, clients } = useAdmin();
  const currentEmployee = employees.find((employee) => employee.id === "emp-admin");
  const currentRole = roles.find((role) => role.id === currentEmployee?.roleId);
  const visibleNavGroups = useMemo(() => adminNavGroups.map((group) => ({ ...group, items: group.items.filter((item) => currentEmployee?.isSuperAdmin || can(currentEmployee, currentRole, item.requiredPermission)) })).filter((group) => group.items.length), [currentEmployee, currentRole]);
  const collapsed = state === "collapsed";
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeReady, setThemeReady] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: ConfirmationToastTone } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeModule = findAdminModuleByPath(pathname);
  const currentRoute = activeModule?.label ?? "Control Center";

  useEffect(() => {
    const saved = localStorage.getItem("pss-theme");
    const next = saved === "dark" || saved === "light" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.classList.toggle("dark", next === "dark");
    const timer = window.setTimeout(() => { setTheme(next); setThemeReady(true); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
      if (noticeRef.current && !noticeRef.current.contains(event.target as Node)) setNoticeOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); setSearchOpen((value) => !value); }
      if (event.key === "Escape") { setSearchOpen(false); setMenuOpen(false); setNoticeOpen(false); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  useEffect(() => { if (searchOpen) window.setTimeout(() => searchRef.current?.focus(), 50); }, [searchOpen]);

  useEffect(() => {
    const notify = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; tone?: ConfirmationToastTone }>).detail;
      setToast({ message: detail.message, tone: detail.tone ?? "success" });
    };
    window.addEventListener("pss-admin-toast", notify);
    return () => window.removeEventListener("pss-admin-toast", notify);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.add("theme-transition");
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("pss-theme", next);
    window.setTimeout(() => document.documentElement.classList.remove("theme-transition"), 450);
  };

  const searchTargets = useMemo(() => [
    ...allAdminNavItems.map((route) => ({ label: route.label, detail: `${route.status === "live" ? "Live" : "Prototype"} module`, href: route.href })),
    ...employees.map((employee) => ({ label: employee.name, detail: `${employee.employeeCode} · Employee`, href: `/employees/${employee.id}` })),
    ...clients.map((client) => ({ label: client.name, detail: `${client.code} · Client assignment`, href: "/client-assignments" })),
  ].filter((target) => `${target.label} ${target.detail}`.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8), [clients, employees, searchQuery]);

  return <>
    <Sidebar collapsible="icon" variant="sidebar" className="border-r border-sidebar-border/70 dark:border-r-2 dark:border-sidebar-border dark:shadow-[1px_0_0_0_var(--sidebar-border)]">
      <SidebarHeader className={`relative items-center gap-1 border-sidebar-border/40 ${collapsed ? "p-2" : "pt-6 pb-4"}`}>
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen((value) => !value)} aria-label="Open Super Admin menu" className={`grid place-items-center rounded-full bg-sidebar-foreground/10 transition-all hover:bg-sidebar-foreground/15 ${collapsed ? "size-8" : "mb-1 size-14"}`}><User className={collapsed ? "size-4 opacity-50" : "size-6 opacity-50"} /></button>
          {menuOpen && <div className={`absolute z-50 w-52 animate-in fade-in zoom-in-95 duration-150 rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg motion-reduce:animate-none ${collapsed ? "left-full top-0 ml-2" : "left-1/2 top-full mt-1 -translate-x-1/2"}`}>
            <div className="mx-1 border-b border-border/60 px-3 py-2"><p className="text-xs font-semibold">Gaurav Sharma</p><p className="mt-0.5 text-[10px] text-muted-foreground">Privileged Super Admin</p></div>
            <button onClick={() => { resetDemo(); setMenuOpen(false); setToast({ message: "Demo data restored to the PSS baseline.", tone: "info" }); }} className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-accent"><RefreshCcw className="size-4 opacity-60" />Reset demo data</button>
            <button onClick={() => { demoSessionStorage.clear(); router.replace("/login"); }} className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"><LogOut className="size-4" />Sign out</button>
          </div>}
        </div>
        {!collapsed && <div className="text-center"><div className="text-[15px] font-semibold tracking-tight">Gaurav Sharma</div><div className="text-[13px] text-sidebar-foreground/50">admin@psslogistics.in</div></div>}
      </SidebarHeader>

      <SidebarContent className={collapsed ? "" : "px-1"}>
        {visibleNavGroups.map((group) => <SidebarGroup key={group.label} className="py-2"><SidebarGroupLabel className="h-6 px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/40">{group.label}</SidebarGroupLabel><SidebarGroupContent><NavItems items={group.items} activeHref={activeModule?.href} onNavigate={() => setOpenMobile(false)} /></SidebarGroupContent></SidebarGroup>)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/40 py-3">
        <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : "px-1"}`}><div className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">P</div>{!collapsed && <div className="min-w-0"><span className="block truncate text-[15px] font-semibold tracking-tight">PSS Logistics</span><span className="block text-[10px] text-muted-foreground">Local prototype</span></div>}</div>
      </SidebarFooter>
    </Sidebar>

    <SidebarInset className="h-svh overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <div className="flex shrink-0 items-center gap-2"><SidebarTrigger /><span className="text-sm font-semibold">{currentRoute}</span></div>
        <button onClick={() => setSearchOpen(true)} aria-label="Search control center" className="flex size-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-border/60 bg-muted/40 text-sm text-muted-foreground transition-colors hover:bg-muted/60 sm:h-8 sm:w-auto sm:flex-1 sm:justify-start sm:px-3"><Search className="size-4 shrink-0 opacity-50" /><span className="hidden flex-1 truncate text-left sm:block">Search employees, clients, permissions...</span><kbd className="hidden h-5 items-center justify-center px-1.5 text-[10px] font-medium sm:inline-flex">⌘ K</kbd></button>
        <div className="relative" ref={noticeRef}><button onClick={() => setNoticeOpen((value) => !value)} aria-label="Notifications" className="relative grid size-8 shrink-0 place-items-center rounded-lg transition-colors hover:bg-accent"><Bell className="size-[18px] opacity-60" /><span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full border-2 border-background bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground">3</span></button>{noticeOpen && <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl animate-in fade-in zoom-in-95 duration-150"><div className="flex items-center justify-between border-b border-border/60 px-2 py-2"><span className="text-xs font-bold">Attention required</span><span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">3 active</span></div>{auditEvents.slice(0, 3).map((event) => <div key={event.id} className="rounded-lg px-2.5 py-2.5 transition-colors hover:bg-accent"><p className="text-xs font-semibold">{event.action}</p><p className="mt-1 text-[10px] text-muted-foreground">{event.entityLabel}</p></div>)}</div>}</div>
        <button onClick={toggleTheme} disabled={!themeReady} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-all duration-300 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none">{!themeReady ? <span className="size-4" /> : theme === "dark" ? <Sun className="size-4 animate-in zoom-in-75 duration-300" /> : <Moon className="size-4 animate-in zoom-in-75 duration-300" />}</button>
      </header>
      <main className="h-[calc(100svh-3.5rem)] min-h-0 flex-none overflow-y-auto p-4">{children}</main>
    </SidebarInset>

    {searchOpen && <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onPointerDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><div className="absolute inset-0 bg-background/60 backdrop-blur-sm" /><div className="relative mx-4 w-full max-w-lg rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"><div className="flex h-12 items-center gap-3 border-b border-border/60 px-4"><Search className="size-[18px] shrink-0 opacity-40" /><input ref={searchRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search the control center..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" /><kbd className="text-[10px] text-muted-foreground">ESC</kbd></div><div className="max-h-72 overflow-y-auto p-2">{searchTargets.length ? searchTargets.map((target) => <button key={`${target.href}-${target.label}`} onClick={() => { router.push(target.href); setSearchOpen(false); setSearchQuery(""); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"><Search className="size-4 text-primary" /><span><span className="block text-xs font-semibold">{target.label}</span><span className="block text-[10px] text-muted-foreground">{target.detail}</span></span></button>) : <p className="p-4 text-center text-xs text-muted-foreground">No matching employees, clients, or pages.</p>}</div></div></div>}
    {toast && <ConfirmationToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
  </>;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <SidebarProvider defaultOpen><AdminShellInner>{children}</AdminShellInner></SidebarProvider>;
}
