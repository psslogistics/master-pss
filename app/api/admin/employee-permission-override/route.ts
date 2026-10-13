import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  await requireSuperAdmin();
  const body = await request.json() as { employeeId?: string; permissionKey?: string; mode?: "inherit" | "grant" | "revoke" };
  if (!body.employeeId || !body.permissionKey || !body.mode) return NextResponse.json({ error: "employeeId, permissionKey, and mode are required" }, { status: 400 });
  const supabase = await createClient();
  const { data: permission } = await supabase.from("permissions").select("permission_key").eq("permission_key", body.permissionKey).eq("panel", "admin").eq("assignable_to_employee", true).maybeSingle();
  if (!permission) return NextResponse.json({ error: "This is not an assignable Admin permission." }, { status: 400 });
  const [{ data: employee }, { data: roleRows }] = await Promise.all([
    supabase.from("employee_profiles").select("user_id").eq("user_id", body.employeeId).maybeSingle(),
    supabase.from("user_roles").select("roles(role_code),is_active").eq("user_id", body.employeeId).eq("is_active", true),
  ]);
  if (!employee) return NextResponse.json({ error: "Employee was not found." }, { status: 404 });
  const isSuperAdmin = (roleRows ?? []).some((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.role_code === "super_admin";
  });
  if (isSuperAdmin) return NextResponse.json({ error: "Super Admin permissions cannot be overridden." }, { status: 403 });
  const { error } = await supabase.rpc("set_employee_permission_override", { target_employee_user_id: body.employeeId, target_permission_key: body.permissionKey, target_mode: body.mode });
  if (error) return NextResponse.json({ error: error.message.includes("permission_not_assignable") ? "This is not an assignable Admin permission." : "Unable to save the permission override atomically." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
