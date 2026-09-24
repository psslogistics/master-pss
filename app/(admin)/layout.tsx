import { AdminProvider } from "@/components/admin/admin-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireSuperAdmin } from "@/lib/auth/server";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireSuperAdmin();
  const isSuperAdmin = actor.roles.some((role) => role.role_code === "super_admin");
  return <AdminProvider><AdminShell isSuperAdmin={isSuperAdmin}>{children}</AdminShell></AdminProvider>;
}
