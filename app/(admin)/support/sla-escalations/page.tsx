import MasterModuleWorkspace, { serializeAdminNavItem } from "@/components/admin/master-module-workspace";
import { findAdminModuleByPath } from "@/lib/admin-navigation";

export default function SlaEscalationsRoute() { const route = findAdminModuleByPath("/support/sla-escalations"); if (!route) return null; return <MasterModuleWorkspace module={serializeAdminNavItem(route)} />; }
