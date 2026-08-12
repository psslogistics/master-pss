import { notFound } from "next/navigation";
import AdminModuleWorkspace from "@/components/admin/admin-module-workspace";
import { findAdminModuleBySegments, prototypeAdminNavItems } from "@/lib/admin-navigation";

export function generateStaticParams() {
  return prototypeAdminNavItems.map((module) => ({ module: module.href.slice(1).split("/") }));
}

export default async function RegisteredAdminModulePage({ params }: { params: Promise<{ module: string[] }> }) {
  const { module: segments } = await params;
  const registeredModule = findAdminModuleBySegments(segments);
  if (!registeredModule || registeredModule.status === "live") notFound();
  return <AdminModuleWorkspace module={{
    href: registeredModule.href,
    label: registeredModule.label,
    description: registeredModule.description,
    requiredPermission: registeredModule.requiredPermission,
    status: registeredModule.status,
    capabilities: registeredModule.capabilities,
    searchKeywords: registeredModule.searchKeywords,
  }} />;
}
