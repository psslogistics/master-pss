import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  const body = await request.json() as { userId?: string; temporaryPassword?: string };
  const userId = body.userId?.trim();
  const temporaryPassword = body.temporaryPassword ?? "";

  if (!userId || !temporaryPassword) return NextResponse.json({ error: "userId and temporaryPassword are required." }, { status: 400 });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
  if (temporaryPassword.length < 8 || temporaryPassword.length > 128) return NextResponse.json({ error: "Temporary password must be between 8 and 128 characters." }, { status: 400 });
  if (userId === actor.userId) return NextResponse.json({ error: "Use your own account security settings to change your password." }, { status: 400 });

  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server provisioning is not configured." }, { status: 503 });
  }

  const [{ data: target, error: targetError }, { data: targetRoles, error: roleError }] = await Promise.all([
    admin.from("profiles").select("id,email,status,must_change_password").eq("id", userId).maybeSingle(),
    admin.from("user_roles").select("is_active,roles(role_code)").eq("user_id", userId).eq("is_active", true),
  ]);
  if (targetError || roleError) return NextResponse.json({ error: "Unable to verify the target account." }, { status: 500 });
  if (!target) return NextResponse.json({ error: "Target account was not found." }, { status: 404 });
  const isSuperAdmin = (targetRoles ?? []).some((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.role_code === "super_admin";
  });
  if (isSuperAdmin) return NextResponse.json({ error: "Super Admin passwords cannot be reset from this control." }, { status: 403 });

  const { error: profileError } = await admin.from("profiles").update({ must_change_password: true, updated_at: new Date().toISOString() }).eq("id", userId);
  if (profileError) return NextResponse.json({ error: "Unable to prepare the forced password-change flag." }, { status: 500 });

  const { error: authError } = await admin.auth.admin.updateUserById(userId, { password: temporaryPassword });
  if (authError) {
    await admin.from("profiles").update({ must_change_password: target.must_change_password, updated_at: new Date().toISOString() }).eq("id", userId);
    return NextResponse.json({ error: "Unable to reset the account password." }, { status: 400 });
  }

  const { error: auditError } = await admin.from("admin_audit_events").insert({
    actor_user_id: actor.userId,
    action: "Reset account password",
    entity_type: "User",
    entity_id: userId,
    after_state: { email: target.email, forced_password_change: true, notification_sent: false },
  });
  if (auditError) return NextResponse.json({ error: "Password was reset, but the audit event could not be recorded." }, { status: 500 });

  return NextResponse.json({ ok: true, userId, forcedPasswordChange: true, notificationSent: false });
}
