import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
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
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch { return NextResponse.json({ error: "Server provisioning is not configured" }, { status: 503 }); }
  const { data: previousOverride } = await admin.from("employee_permission_overrides").select("employee_user_id,permission_key,mode,assigned_by").eq("employee_user_id", body.employeeId).eq("permission_key", body.permissionKey).maybeSingle();
  const result = body.mode === "inherit"
    ? await admin.from("employee_permission_overrides").delete().eq("employee_user_id", body.employeeId).eq("permission_key", body.permissionKey)
    : await admin.from("employee_permission_overrides").upsert({ employee_user_id: body.employeeId, permission_key: body.permissionKey, mode: body.mode, assigned_by: actor.userId }, { onConflict: "employee_user_id,permission_key" });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  const { error: auditError } = await supabase.from("admin_audit_events").insert({ actor_user_id: actor.userId, action: body.mode === "inherit" ? "Removed employee permission override" : `${body.mode === "grant" ? "Granted" : "Revoked"} employee permission`, entity_type: "Employee", entity_id: body.employeeId, after_state: { permissionKey: body.permissionKey, mode: body.mode } });
  if (auditError) {
    if (previousOverride) {
      await admin.from("employee_permission_overrides").upsert(previousOverride, { onConflict: "employee_user_id,permission_key" });
    } else {
      await admin.from("employee_permission_overrides").delete().eq("employee_user_id", body.employeeId).eq("permission_key", body.permissionKey);
    }
    return NextResponse.json({ error: "Permission change was rolled back because its audit event could not be recorded." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
