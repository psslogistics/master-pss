import MasterModuleWorkspace, { serializeAdminNavItem } from "@/components/admin/master-module-workspace";
import { findAdminModuleByPath } from "@/lib/admin-navigation";

export default function AlertsAttentionRoute() { const route = findAdminModuleByPath("/alerts-attention"); if (!route) return null; return <MasterModuleWorkspace module={serializeAdminNavItem(route)} />; }
