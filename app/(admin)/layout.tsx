import { AdminProvider } from "@/components/admin/admin-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireSuperAdmin } from "@/lib/auth/server";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return <AdminProvider><AdminShell>{children}</AdminShell></AdminProvider>;
}
