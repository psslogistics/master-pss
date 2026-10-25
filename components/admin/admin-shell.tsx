"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, LogOut, Moon, Search, Sun,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import ConfirmationToast, { type ConfirmationToastTone } from "@/components/ui/confirmationToast";
import { PssIcon } from "@/components/ui/icon";
import { BrandLogo } from "@/components/ui/brand-logo";
import { createClient } from "@/lib/supabase/client";
import { useAdmin } from "@/components/admin/admin-provider";
import { adminNavGroups, allAdminNavItems, findAdminModuleByPath, type AdminNavGroup, type AdminNavItem } from "@/lib/admin-navigation";
import { can, permissions } from "@/lib/admin-domain";
import { pssApi } from "@/lib/pss-api";

function readStoredSidebarGroups(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem("pss-admin-sidebar-groups");
    const parsed = saved ? JSON.parse(saved) as Record<string, boolean> : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function NavItems({ items, activeHref, onNavigate }: { items: AdminNavItem[]; activeHref?: string; onNavigate(): void }) {
  const router = useRouter();
  return <SidebarMenu>{items.map((item) => {
    const active = activeHref === item.href;
    return <SidebarMenuItem key={item.href}><SidebarMenuButton isActive={active} render={<Link href={item.href} prefetch={false} onMouseEnter={() => router.prefetch(item.href)} onClick={onNavigate} />} tooltip={item.label}><PssIcon name={item.icon} size="lg" className="shrink-0 opacity-70" /><span className="truncate">{item.label}</span>{active && <ChevronRight className="ml-auto size-3.5 shrink-0 opacity-40" />}</SidebarMenuButton></SidebarMenuItem>;
  })}</SidebarMenu>;
}

const adminGroupDescriptions: Record<string, string> = {
  Overview: "Organization health and attention",
  Operations: "Book, monitor, and move shipments",
  Clients: "Accounts, ownership, and pricing",
  CRM: "Relationships, prospects, and follow-ups",
  Organization: "People, teams, roles, and workload",
  Support: "Tickets, SLAs, and escalations",
  Finance: "Wallets, invoices, and transactions",
  "Reports & Insights": "Trends, performance, and exports",
  Integrations: "Couriers, channels, and webhooks",
  System: "Automation, security, and platform policy",
};

function CollapsibleNavGroup({
  group,
  expanded,
  activeHref,
  onToggle,
  onNavigate,
}: {
  group: AdminNavGroup;
  expanded: boolean;
  activeHref?: string;
  onToggle(): void;
  onNavigate(): void;
}) {
  const groupId = `admin-nav-group-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const containsActiveRoute = group.items.some((item) => item.href === activeHref);

  return <SidebarGroup className="py-1">
    <SidebarGroupLabel className="h-auto items-start px-3 py-2 text-sidebar-foreground/45 group-data-[collapsible=icon]:pointer-events-none">
      <button
        type="button"
        onClick={onToggle}
        aria-controls={groupId}
        aria-expanded={expanded}
        className="flex min-h-8 w-full items-start justify-between gap-2 rounded-md px-0 text-left transition-colors hover:text-sidebar-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden"
      >
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.12em]">{group.label}</span>
          <span className="mt-0.5 block truncate text-[10px] font-normal normal-case tracking-normal text-sidebar-foreground/35">{adminGroupDescriptions[group.label] ?? "Manage production operations"}</span>
        </span>
        <ChevronDown className={`size-3.5 shrink-0 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`} aria-hidden="true" />
      </button>
    </SidebarGroupLabel>
    <SidebarGroupContent id={groupId} hidden={!expanded} className="group-data-[collapsible=icon]:block">
      <NavItems items={group.items} activeHref={activeHref} onNavigate={onNavigate} />
    </SidebarGroupContent>
    {!expanded && containsActiveRoute && <span className="sr-only">Current section: {group.label}</span>}
  </SidebarGroup>;
}

function AdminShellInner({ children, isSuperAdmin }: { children: React.ReactNode; isSuperAdmin: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, setOpenMobile } = useSidebar();
  const { auditEvents, employees, roles, clients, workspace, workspaceLoadError } = useAdmin();
  const supabase = useMemo(() => createClient(), []);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentProfile, setCurrentProfile] = useState<{ displayName: string; email: string; phone: string }>({ displayName: "", email: "", phone: "" });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user || cancelled) return;
        setCurrentUserId(user.id);
        const { data: profile } = await supabase.from("profiles").select("display_name,email,phone").eq("id", user.id).maybeSingle();
        if (!cancelled) setCurrentProfile({ displayName: profile?.display_name ?? user.user_metadata?.full_name ?? "", email: profile?.email ?? user.email ?? "", phone: profile?.phone ?? user.user_metadata?.phone ?? "" });
      } catch {
        // The shell can still render from the identity bootstrap or auth metadata.
      }
    })();
    return () => { cancelled = true; };
  }, [supabase]);
  const currentEmployee = useMemo(() => {
    const employee = employees.find((item) => item.id === currentUserId);
    const fallback = employee ?? { id: currentUserId || "current-user", employeeCode: "", name: "", email: "", phone: "", department: "", roleId: "", workspaceSlug: "", status: "Invited" as const, lastActive: "", joinedAt: "", permissionOverrides: [], isSuperAdmin: false };
    return { ...fallback, name: currentProfile.displayName || fallback.name || "Super Admin", email: currentProfile.email || fallback.email, phone: currentProfile.phone || fallback.phone };
  }, [currentProfile, currentUserId, employees]);
  const profileInitials = useMemo(() => currentEmployee.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SA", [currentEmployee.name]);
  const currentRole = roles.find((role) => role.id === currentEmployee?.roleId);
  const visibleNavGroups = useMemo(() => adminNavGroups.map((group) => ({ ...group, items: group.items.filter((item) => isSuperAdmin || currentEmployee?.isSuperAdmin || can(currentEmployee, currentRole, item.requiredPermission)) })).filter((group) => group.items.length), [currentEmployee, currentRole, isSuperAdmin]);
  const collapsed = state === "collapsed";
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeReady, setThemeReady] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: ConfirmationToastTone } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedGroupsReady, setExpandedGroupsReady] = useState(false);
  const [shipmentSearchResults, setShipmentSearchResults] = useState<Array<{ type: string; label: string; detail: string; href: string; keywords: string }>>([]);
  const [shipmentSearchLoading, setShipmentSearchLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const activeModule = findAdminModuleByPath(pathname);
  const currentRoute = activeModule?.label ?? "Control Center";
  const activeGroupLabel = visibleNavGroups.find((group) => group.items.some((item) => item.href === activeModule?.href))?.label;

  useEffect(() => {
    const handleAuthExpired = () => {
      router.replace("/login?reason=session-expired");
      router.refresh();
    };
    window.addEventListener("pss-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("pss-auth-expired", handleAuthExpired);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setExpandedGroups(readStoredSidebarGroups());
      setExpandedGroupsReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!expandedGroupsReady) return;
    localStorage.setItem("pss-admin-sidebar-groups", JSON.stringify(expandedGroups));
  }, [expandedGroups, expandedGroupsReady]);

  const setAllGroupsExpanded = (expanded: boolean) => {
    setExpandedGroups(Object.fromEntries(visibleNavGroups.map((group) => [group.label, expanded])));
  };

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
    const term = searchQuery.trim();
    if (term.length < 2) { setShipmentSearchResults([]); setShipmentSearchLoading(false); return; }
    const timer = window.setTimeout(() => {
      setShipmentSearchLoading(true);
      void pssApi<{ data?: Array<Record<string, unknown>> }>(`/v1/shipments?view=tracking&limit=12&offset=0&search=${encodeURIComponent(term)}`)
        .then((result) => setShipmentSearchResults((result.data ?? []).map((row) => {
          const id = String(row.id ?? "");
          const pssReference = String(row.pss_reference ?? id).trim();
          const lr = String(row.lr_number ?? "").trim();
          const awb = String(row.master_awb ?? "").trim();
          const pur = String(row.pickup_reference ?? "").trim();
          const providerReference = lr || awb || pur || String(row.tracking_number ?? "").trim();
          return { type: "Shipment", label: pssReference || providerReference || id, detail: `${lr ? `LRN ${lr} · ` : ""}${providerReference ? `${providerReference} · ` : ""}${String(row.origin ?? "Not provided")} → ${String(row.destination ?? "Not provided")} · ${String(row.status ?? "")}`, href: `/operations/shipments?shipment=${encodeURIComponent(id)}`, keywords: [id, pssReference, lr, awb, pur, String(row.tracking_number ?? ""), String(row.provider_reference ?? "")].join(" ") };
        })))
        .catch(() => setShipmentSearchResults([]))
        .finally(() => setShipmentSearchLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

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

  const searchTargets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const targets = [
      ...shipmentSearchResults,
      ...allAdminNavItems.map((route) => ({ type: "Module", label: route.label, detail: `Production · ${route.description}`, href: route.href, keywords: [route.label, route.description, ...route.searchKeywords, ...route.capabilities].join(" ") })),
      ...employees.map((employee) => ({ type: "Employee", label: employee.name, detail: `${employee.employeeCode} · ${employee.department} · ${employee.status}`, href: `/employees/${employee.id}`, keywords: `${employee.name} ${employee.email} ${employee.employeeCode} ${employee.department} ${employee.workspaceSlug} ${employee.status}` })),
      ...clients.map((client) => ({ type: "Client", label: client.name, detail: `${client.code} · ${client.city} · ${client.status}`, href: "/client-assignments", keywords: `${client.name} ${client.code} ${client.city} ${client.status} ${client.lastActivity}` })),
      ...workspace.crmProspects.map((prospect) => ({ type: "Prospect", label: prospect.company, detail: `${prospect.stage} · ${prospect.name}`, href: "/crm", keywords: `${prospect.company} ${prospect.name} ${prospect.email} ${prospect.stage} ${prospect.notes}` })),
      ...workspace.crmFollowUps.map((followUp) => ({ type: "CRM follow-up", label: followUp.title, detail: `${followUp.dueDate} · ${followUp.status}`, href: "/crm", keywords: `${followUp.title} ${followUp.status} ${followUp.priority}` })),
      ...workspace.crmInteractions.map((interaction) => ({ type: "CRM interaction", label: interaction.subject, detail: `${interaction.type} · ${interaction.timestamp}`, href: "/crm", keywords: `${interaction.subject} ${interaction.type} ${interaction.notes}` })),
      ...permissions.map((permission) => ({ type: "Permission", label: permission.label, detail: `${permission.key} · ${permission.group}`, href: "/roles-permissions", keywords: `${permission.label} ${permission.key} ${permission.description} ${permission.group}` })),
      ...auditEvents.map((event) => ({ type: "Audit", label: event.action, detail: `${event.entityLabel} · ${event.severity}`, href: "/audit-logs", keywords: `${event.action} ${event.entityLabel} ${event.entityType} ${event.entityId} ${event.severity} ${event.after ?? ""}` })),
    ];
    return targets.map((target) => ({ target, score: !query ? 1 : target.label.toLowerCase() === query ? 100 : target.label.toLowerCase().startsWith(query) ? 80 : target.keywords.toLowerCase().includes(query) ? 25 : 0 })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || a.target.label.localeCompare(b.target.label)).slice(0, 12).map(({ target }) => target);
  }, [auditEvents, clients, employees, searchQuery, shipmentSearchResults, workspace.crmFollowUps, workspace.crmInteractions, workspace.crmProspects]);

  return <>
    <Sidebar collapsible="icon" variant="sidebar" className="border-r border-sidebar-border/70 dark:border-r-2 dark:border-sidebar-border dark:shadow-[1px_0_0_0_var(--sidebar-border)]">
      <SidebarHeader className={`relative items-center gap-1 border-sidebar-border/40 ${collapsed ? "p-2" : "pt-6 pb-4"}`}>
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen((value) => !value)} aria-label="Open Super Admin menu" className={`grid place-items-center rounded-full bg-sidebar-foreground/10 font-semibold text-sidebar-foreground/75 transition-all hover:bg-sidebar-foreground/15 ${collapsed ? "size-8 text-[10px]" : "mb-1 size-14 text-lg"}`}>{profileInitials}</button>
          {menuOpen && <div className={`absolute z-50 w-52 animate-in fade-in zoom-in-95 duration-150 rounded-lg border border-border bg-popover py-1 text-popover-foreground shadow-lg motion-reduce:animate-none ${collapsed ? "left-full top-0 ml-2" : "left-1/2 top-full mt-1 -translate-x-1/2"}`}>
            <Link href="/system/settings" onClick={() => setMenuOpen(false)} className="mx-1 block rounded-md px-3 py-2 hover:bg-accent"><p className="text-xs font-semibold">Super Admin profile</p><p className="mt-0.5 text-[10px] text-muted-foreground">Open account settings</p></Link>
            <button onClick={async () => { await supabase.auth.signOut({ scope: "global" }); router.replace("/login"); router.refresh(); }} className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"><LogOut className="size-4" />Sign out</button>
          </div>}
        </div>
        {!collapsed && <div className="text-center"><div className="max-w-[180px] truncate text-[15px] font-semibold tracking-tight">{currentEmployee.name || "Super Admin"}</div><div className="max-w-[180px] truncate text-[12px] text-sidebar-foreground/50">{currentEmployee.email || "Authenticated workspace"}</div></div>}
      </SidebarHeader>

      <SidebarContent className={collapsed ? "" : "px-1"}>
        {!collapsed && <div className="flex items-center justify-end gap-1 px-3 pb-1 pt-2">
          <button type="button" onClick={() => setAllGroupsExpanded(true)} className="rounded px-1.5 py-1 text-[10px] font-medium text-sidebar-foreground/45 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" title="Expand all navigation sections">
            <ChevronsDownUp className="mr-1 inline size-3" aria-hidden="true" />Expand
          </button>
          <button type="button" onClick={() => setAllGroupsExpanded(false)} className="rounded px-1.5 py-1 text-[10px] font-medium text-sidebar-foreground/45 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" title="Collapse all navigation sections">
            <ChevronsUpDown className="mr-1 inline size-3" aria-hidden="true" />Collapse
          </button>
        </div>}
        {visibleNavGroups.map((group) => <CollapsibleNavGroup key={group.label} group={group} expanded={collapsed || expandedGroups[group.label] !== false || activeGroupLabel === group.label} activeHref={activeModule?.href} onToggle={() => setExpandedGroups((current) => ({ ...current, [group.label]: current[group.label] === false }))} onNavigate={() => setOpenMobile(false)} />)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/40 py-3">
        <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : "px-1"}`}><BrandLogo compact={collapsed} className={collapsed ? "" : "h-9 w-[132px]"} />{!collapsed && <div className="min-w-0"><span className="block truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Production control plane</span></div>}</div>
      </SidebarFooter>
    </Sidebar>

    <SidebarInset className="h-svh overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <div className="flex shrink-0 items-center gap-2"><SidebarTrigger /><span className="text-sm font-semibold">{currentRoute}</span></div>
        <button onClick={() => setSearchOpen(true)} aria-label="Search control center" className="flex size-8 shrink-0 items-center justify-center gap-2 rounded-lg border border-border/60 bg-muted/40 text-sm text-muted-foreground transition-colors hover:bg-muted/60 sm:h-8 sm:w-auto sm:flex-1 sm:justify-start sm:px-3"><Search className="size-4 shrink-0 opacity-50" /><span className="hidden flex-1 truncate text-left sm:block">Search employees, clients, permissions...</span><kbd className="hidden h-5 items-center justify-center px-1.5 text-[10px] font-medium sm:inline-flex">⌘ K</kbd></button>
        <div className="relative" ref={noticeRef}><button onClick={() => setNoticeOpen((value) => !value)} aria-label="Notifications" className="relative grid size-8 shrink-0 place-items-center rounded-lg transition-colors hover:bg-accent"><Bell className="size-[18px] opacity-60" />{workspace.notifications.filter((item) => !item.read).length > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full border-2 border-background bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground">{workspace.notifications.filter((item) => !item.read).length}</span>}</button>{noticeOpen && <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl animate-in fade-in zoom-in-95 duration-150"><div className="flex items-center justify-between border-b border-border/60 px-2 py-2"><span className="text-xs font-bold">Attention required</span><span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">{workspace.notifications.filter((item) => !item.read).length} active</span></div>{workspace.notifications.filter((item) => !item.read).slice(0, 5).map((notification) => <Link href="/crm" key={notification.id} className="block rounded-lg px-2.5 py-2.5 transition-colors hover:bg-accent"><p className="text-xs font-semibold">{notification.title}</p><p className="mt-1 text-[10px] text-muted-foreground">{notification.detail}</p></Link>)}</div>}</div>
        <button onClick={toggleTheme} disabled={!themeReady} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-all duration-300 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none">{!themeReady ? <span className="size-4" /> : theme === "dark" ? <Sun className="size-4 animate-in zoom-in-75 duration-300" /> : <Moon className="size-4 animate-in zoom-in-75 duration-300" />}</button>
      </header>
      <main className="h-[calc(100svh-3.5rem)] min-h-0 min-w-0 flex-none overflow-y-auto p-4">{workspaceLoadError && <div role="alert" className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive"><span>{workspaceLoadError}</span><button onClick={() => window.location.reload()} className="shrink-0 rounded-lg border border-destructive/30 px-3 py-1.5 font-semibold hover:bg-destructive/10">Retry</button></div>}{children}</main>
    </SidebarInset>

    {searchOpen && <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onPointerDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}><div className="absolute inset-0 bg-background/60 backdrop-blur-sm" /><div className="relative mx-4 w-full max-w-lg rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"><div className="flex h-12 items-center gap-3 border-b border-border/60 px-4"><Search className="size-[18px] shrink-0 opacity-40" /><input ref={searchRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search employees, clients, shipment LR / LRN..." className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" /><kbd className="text-[10px] text-muted-foreground">ESC</kbd></div><div className="max-h-72 overflow-y-auto p-2">{shipmentSearchLoading && searchQuery.trim().length >= 2 && !searchTargets.length ? <p className="p-4 text-center text-xs text-muted-foreground">Searching production shipments…</p> : searchTargets.length ? searchTargets.map((target) => <button key={`${target.href}-${target.label}`} onClick={() => { router.push(target.href); setSearchOpen(false); setSearchQuery(""); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"><Search className="size-4 text-primary" /><span><span className="block text-xs font-semibold">{target.label}</span><span className="block text-[10px] text-muted-foreground">{target.detail}</span></span></button>) : <p className="p-4 text-center text-xs text-muted-foreground">No matching employees, clients, shipment LRs, or pages.</p>}</div></div></div>}
    {toast && <ConfirmationToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
  </>;
}

export function AdminShell({ children, isSuperAdmin = false }: { children: React.ReactNode; isSuperAdmin?: boolean }) {
  return <SidebarProvider defaultOpen><AdminShellInner isSuperAdmin={isSuperAdmin}>{children}</AdminShellInner></SidebarProvider>;
}
