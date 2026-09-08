import MasterModuleWorkspace from "@/components/admin/master-module-workspace";
import ProfilePage from "@/components/admin/profile-page";
import { findAdminModuleByPath, serializeAdminNavItem } from "@/lib/admin-navigation";

export default function SettingsRoute() { const route = findAdminModuleByPath("/system/settings"); if (!route) return null; return <div className="space-y-6"><ProfilePage /><MasterModuleWorkspace module={serializeAdminNavItem(route)} /></div>; }
