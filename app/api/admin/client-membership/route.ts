import { NextResponse } from "next/server";
import { authorizeAdminTaskPermission, requireSuperAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/read-all-pages";

export async function GET() {
  const authorization = await authorizeAdminTaskPermission("admin.client_users.view");
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); }
  catch { return NextResponse.json({ error: "Client access directory is not configured." }, { status: 503 }); }

  const [usersResult, rolesResult, clientsResult, membershipsResult] = await Promise.all([
    readAllPages((from, to) => admin.from("profiles").select("id,email,created_at").not("email", "is", null).order("id").range(from, to)),
    readAllPages((from, to) => admin.from("user_roles").select("user_id,is_active,roles(role_code)").eq("is_active", true).order("user_id").range(from, to)),
    readAllPages((from, to) => admin.from("client_accounts").select("id,client_code,legal_name,status").order("legal_name").range(from, to)),
    readAllPages((from, to) => admin.from("client_memberships").select("user_id,client_id,membership_status,is_primary,assigned_at").order("user_id").range(from, to)),
  ]);
  const error = usersResult.error ?? rolesResult.error ?? clientsResult.error ?? membershipsResult.error;
  if (error) return NextResponse.json({ error: "Unable to load the complete client access directory. Retry the request." }, { status: 500 });

  const clientUserIds = new Set((rolesResult.data ?? []).flatMap((row) => {
    const roles = Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : [];
    return row.is_active === true && roles.some((role) => role?.role_code === "client_user") ? [row.user_id] : [];
  }));
  const users = (usersResult.data ?? []).filter((user) => clientUserIds.has(user.id)).map((user) => ({ id: user.id, email: user.email, createdAt: user.created_at }));
  const visibleUserIds = new Set(users.map((user) => user.id));
  const memberships = (membershipsResult.data ?? []).filter((membership) => visibleUserIds.has(membership.user_id));
  return NextResponse.json({ users, clients: clientsResult.data ?? [], memberships, canResetPasswords: authorization.isSuperAdmin });
}

export async function POST(request: Request) {
  let body: { userId?: string; clientId?: string; membershipStatus?: string; legalName?: string; clientCode?: string | null };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  // CRM conversion also uses this endpoint to create a client record. Keep that
  // separate from employee-grantable membership management.
  if (body.legalName !== undefined) {
    const actor = await requireSuperAdmin();
    const legalName = body.legalName.trim();
    const clientCode = body.clientCode?.trim().toUpperCase() || null;
    if (!legalName) return NextResponse.json({ error: "Client legal name is required." }, { status: 400 });
    if (clientCode && !/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(clientCode)) return NextResponse.json({ error: "Client code may contain uppercase letters, numbers, and hyphens." }, { status: 400 });
    let admin: ReturnType<typeof createAdminClient>;
    try { admin = createAdminClient(); } catch { return NextResponse.json({ error: "Client provisioning is not configured." }, { status: 503 }); }
    if (clientCode) {
      const { data: existing, error: lookupError } = await admin.from("client_accounts").select("id").eq("client_code", clientCode).maybeSingle();
      if (lookupError) return NextResponse.json({ error: "Unable to verify the client code." }, { status: 500 });
      if (existing) return NextResponse.json({ error: "This client code is already in use." }, { status: 409 });
    }
    const { data: client, error } = await admin.from("client_accounts").insert({ client_code: clientCode, legal_name: legalName, status: "on_hold" }).select("id,client_code,legal_name,status").single();
    if (error) return NextResponse.json({ error: "Unable to save client profile." }, { status: 500 });
    return NextResponse.json({ client, createdBy: actor.userId }, { status: 201 });
  }

  const authorization = await authorizeAdminTaskPermission("admin.client_users.manage");
  if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  const userId = body.userId?.trim();
  const clientId = body.clientId?.trim();
  const membershipStatus = body.membershipStatus ?? "active";
  if (!userId || !clientId) return NextResponse.json({ error: "userId and clientId are required." }, { status: 400 });
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) return NextResponse.json({ error: "A valid user and client ID are required." }, { status: 400 });
  if (membershipStatus !== "active" && membershipStatus !== "suspended") return NextResponse.json({ error: "Membership status must be active or suspended." }, { status: 400 });

  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch { return NextResponse.json({ error: "Client access management is not configured." }, { status: 503 }); }
  const [{ data: userRoles, error: roleError }, { data: client, error: clientError }, { data: previous, error: previousError }] = await Promise.all([
    admin.from("user_roles").select("is_active,roles(role_code)").eq("user_id", userId).eq("is_active", true),
    admin.from("client_accounts").select("id,status").eq("id", clientId).maybeSingle(),
    admin.from("client_memberships").select("user_id,client_id,membership_status,is_primary,assigned_at,assigned_by").eq("user_id", userId).eq("client_id", clientId).maybeSingle(),
  ]);
  if (roleError || clientError || previousError) return NextResponse.json({ error: "Unable to verify the user, client, or previous membership." }, { status: 500 });
  const isClientUser = (userRoles ?? []).some((row) => {
    const roles = Array.isArray(row.roles) ? row.roles : row.roles ? [row.roles] : [];
    return row.is_active === true && roles.some((role) => role?.role_code === "client_user");
  });
  if (!isClientUser) return NextResponse.json({ error: "Only active client users can receive a client assignment." }, { status: 400 });
  if (!client) return NextResponse.json({ error: "Client account was not found." }, { status: 404 });
  if (client.status === "disabled" && membershipStatus === "active") return NextResponse.json({ error: "A disabled client cannot receive active user access." }, { status: 409 });

  const after = { user_id: userId, client_id: clientId, membership_status: membershipStatus, is_primary: previous?.is_primary ?? true, assigned_by: authorization.userId, assigned_at: new Date().toISOString() };
  const { error: writeError } = await admin.from("client_memberships").upsert(after, { onConflict: "user_id,client_id" });
  if (writeError) return NextResponse.json({ error: "Unable to save client assignment." }, { status: 500 });

  const audit = await admin.from("admin_audit_events").insert({
    actor_user_id: authorization.userId,
    action: previous ? (membershipStatus === "suspended" ? "Suspended client workspace membership" : "Updated client workspace membership") : "Assigned client workspace membership",
    entity_type: "Client membership",
    entity_id: `${userId}:${clientId}`,
    before_state: previous ? { client_id: clientId, membership_status: previous.membership_status, is_primary: previous.is_primary } : null,
    after_state: { client_id: clientId, membership_status: membershipStatus, is_primary: after.is_primary },
  });
  if (audit.error) {
    const rollback = previous
      ? await admin.from("client_memberships").upsert(previous, { onConflict: "user_id,client_id" })
      : await admin.from("client_memberships").delete().eq("user_id", userId).eq("client_id", clientId);
    return NextResponse.json({ error: rollback.error ? "Membership changed but audit recording and rollback both failed. Escalate this event immediately." : "Membership change was rolled back because its audit event could not be recorded." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, membership: { user_id: userId, client_id: clientId, membership_status: membershipStatus, is_primary: after.is_primary, assigned_at: after.assigned_at } });
}
