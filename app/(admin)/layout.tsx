import { AdminGuard, AdminProvider } from "@/components/admin/admin-provider";
import { AdminShell } from "@/components/admin/admin-shell";

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return <AdminGuard><AdminProvider><AdminShell>{children}</AdminShell></AdminProvider></AdminGuard>;
}
