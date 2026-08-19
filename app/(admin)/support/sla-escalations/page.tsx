import MasterModuleWorkspace from "@/components/admin/master-module-workspace";
import { findAdminModuleByPath, serializeAdminNavItem } from "@/lib/admin-navigation";

export default function SlaEscalationsRoute() { const route = findAdminModuleByPath("/support/sla-escalations"); if (!route) return null; return <MasterModuleWorkspace module={serializeAdminNavItem(route)} />; }
