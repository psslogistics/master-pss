import MasterModuleWorkspace from "@/components/admin/master-module-workspace";
import ClientKycReview from "@/components/admin/client-kyc-review";
import { findAdminModuleByPath, serializeAdminNavItem } from "@/lib/admin-navigation";

export default function ClientsRoute() { const route = findAdminModuleByPath("/clients"); if (!route) return null; return <div className="space-y-5"><MasterModuleWorkspace module={serializeAdminNavItem(route)} /><ClientKycReview /></div>; }
