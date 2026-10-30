import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  const body = await request.json() as { employeeId?: string; permissionKey?: string; mode?: "inherit" | "grant" | "revoke" };
  if (!body.employeeId || !body.permissionKey || !body.mode) return NextResponse.json({ error: "employeeId, permissionKey, and mode are required" }, { status: 400 });
  const supabase = await createClient();
  const { data: permission } = await supabase.from("permissions").select("permission_key").eq("permission_key", body.permissionKey).eq("panel", "admin").eq("assignable_to_employee", true).maybeSingle();
  if (!permission) return NextResponse.json({ error: "This is not an assignable Admin permission." }, { status: 400 });
  const [{ data: employee, error: employeeError }, { data: roleRows, error: roleError }, { data: previousOverride, error: overrideError }] = await Promise.all([
    supabase.from("employee_profiles").select("user_id").eq("user_id", body.employeeId).maybeSingle(),
    supabase.from("user_roles").select("roles(role_code),is_active").eq("user_id", body.employeeId).eq("is_active", true),
    supabase.from("employee_permission_overrides").select("mode").eq("employee_user_id", body.employeeId).eq("permission_key", body.permissionKey).maybeSingle(),
  ]);
  if (employeeError || roleError || overrideError) return NextResponse.json({ error: "Unable to verify the current employee permission state." }, { status: 500 });
  if (!employee) return NextResponse.json({ error: "Employee was not found." }, { status: 404 });
  const isSuperAdmin = (roleRows ?? []).some((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.role_code === "super_admin";
  });
  if (isSuperAdmin) return NextResponse.json({ error: "Super Admin permissions cannot be overridden." }, { status: 403 });
  const { error } = await supabase.rpc("set_employee_permission_override", { target_employee_user_id: body.employeeId, target_permission_key: body.permissionKey, target_mode: body.mode });
  if (error) return NextResponse.json({ error: error.message.includes("permission_not_assignable") ? "This is not an assignable Admin permission." : "Unable to save the permission override atomically." }, { status: 400 });
  const { error: auditError } = await supabase.from("admin_audit_events").insert({
    actor_user_id: actor.userId,
    action: body.mode === "inherit" ? "Removed employee permission override" : `${body.mode === "grant" ? "Granted" : "Revoked"} employee permission override`,
    entity_type: "Permission",
    entity_id: body.employeeId,
    before_state: { permissionKey: body.permissionKey, mode: previousOverride?.mode ?? "inherit" },
    after_state: { permissionKey: body.permissionKey, mode: body.mode },
  });
  if (auditError) {
    const rollback = await supabase.rpc("set_employee_permission_override", { target_employee_user_id: body.employeeId, target_permission_key: body.permissionKey, target_mode: previousOverride?.mode ?? "inherit" });
    return NextResponse.json({ error: rollback.error ? "Permission changed, but audit recording and rollback both failed. Escalate this event immediately." : "Permission change was rolled back because its audit event could not be recorded." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
