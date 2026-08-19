import MasterModuleWorkspace, { serializeAdminNavItem } from "@/components/admin/master-module-workspace";
import { findAdminModuleByPath } from "@/lib/admin-navigation";

export default function NotificationsRoute() { const route = findAdminModuleByPath("/system/notifications"); if (!route) return null; return <MasterModuleWorkspace module={serializeAdminNavItem(route)} />; }
