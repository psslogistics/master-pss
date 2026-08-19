import MasterModuleWorkspace from "@/components/admin/master-module-workspace";
import { findAdminModuleByPath, serializeAdminNavItem } from "@/lib/admin-navigation";

export default function ClientsRoute() { const route = findAdminModuleByPath("/clients"); if (!route) return null; return <MasterModuleWorkspace module={serializeAdminNavItem(route)} />; }
