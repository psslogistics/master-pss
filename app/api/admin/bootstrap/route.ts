import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { readAllPages } from "@/lib/read-all-pages";

export async function GET() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const [
    { data: employees, error: employeeError },
    { data: profiles, error: profileError },
    { data: assignments, error: assignmentError },
    { data: roles, error: rolesError },
    { data: rolePermissions, error: rolePermissionsError },
    { data: permissions, error: permissionsError },
    { data: clients, error: clientsError },
    { data: clientAssignments, error: clientAssignmentsError },
    { data: permissionOverrides, error: permissionOverridesError },
  ] = await Promise.all([
    readAllPages((from, to) => supabase.from("employee_profiles").select("user_id,employee_code,department,workspace_slug,employment_status,joined_at,last_active_at,identity_environment").order("employee_code").order("user_id").range(from, to).then((result) => result.error?.code === "42703" && result.error.message.includes("identity_environment")
      ? supabase.from("employee_profiles").select("user_id,employee_code,department,workspace_slug,employment_status,joined_at,last_active_at").order("employee_code").order("user_id").range(from, to)
      : result)),
    readAllPages((from, to) => supabase.from("profiles").select("id,email,display_name,phone,status,must_change_password").order("id").range(from, to)),
    readAllPages((from, to) => supabase.from("user_roles").select("user_id,is_active,role:roles(id,role_code,name)").order("user_id").order("role_id").range(from, to)),
    readAllPages((from, to) => supabase.from("roles").select("id,role_code,name,description,scope,is_system").in("scope", ["employee", "system"]).order("name").order("role_code").range(from, to)),
    readAllPages((from, to) => supabase.from("role_permissions").select("role_id,permission_key").order("role_id").order("permission_key").range(from, to)),
    readAllPages((from, to) => supabase.from("permissions").select("permission_key,label,description,permission_group,panel,resource,action,route,assignable_to_employee,audience,sensitivity,scope_kind").eq("panel", "admin").order("permission_group").order("resource").order("action").order("label").order("permission_key").range(from, to)),
    readAllPages((from, to) => supabase.from("client_accounts").select("id,client_code,legal_name,status").order("legal_name").order("id").range(from, to)),
    readAllPages((from, to) => supabase.from("employee_client_assignments").select("client_id,employee_user_id").eq("is_active", true).order("client_id").order("employee_user_id").range(from, to)),
    readAllPages((from, to) => supabase.from("employee_permission_overrides").select("employee_user_id,permission_key,mode").order("employee_user_id").order("permission_key").range(from, to)),
  ]);
  const error = employeeError ?? profileError ?? assignmentError ?? rolesError ?? rolePermissionsError ?? permissionsError ?? clientsError ?? clientAssignmentsError ?? permissionOverridesError;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const assignmentById = new Map((assignments ?? []).map((assignment) => [assignment.user_id, assignment]));
  return NextResponse.json({
    employees: (employees ?? []).map((employee) => ({ ...employee, profile: profileById.get(employee.user_id) ?? null, assignment: assignmentById.get(employee.user_id) ?? null })),
    roles: roles ?? [],
    rolePermissions: rolePermissions ?? [],
    permissions: permissions ?? [],
    clients: clients ?? [],
    clientAssignments: clientAssignments ?? [],
    permissionOverrides: permissionOverrides ?? [],
  });
}
