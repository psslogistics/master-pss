import MasterModuleWorkspace from "@/components/admin/master-module-workspace";
import { findAdminModuleByPath, serializeAdminNavItem } from "@/lib/admin-navigation";

export default function SupportTicketsRoute() { const route = findAdminModuleByPath("/support/tickets"); if (!route) return null; return <MasterModuleWorkspace module={serializeAdminNavItem(route)} />; }
