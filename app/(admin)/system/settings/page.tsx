import MasterModuleWorkspace from "@/components/admin/master-module-workspace";
import { findAdminModuleByPath, serializeAdminNavItem } from "@/lib/admin-navigation";

export default function SettingsRoute() { const route = findAdminModuleByPath("/system/settings"); if (!route) return null; return <MasterModuleWorkspace module={serializeAdminNavItem(route)} />; }
