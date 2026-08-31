import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const [{ data: users, error: usersError }, { data: clients, error: clientsError }, { data: memberships, error: membershipsError }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("client_accounts").select("id,client_code,legal_name,status").order("legal_name"),
    admin.from("client_memberships").select("user_id,client_id,membership_status"),
  ]);
  if (usersError || clientsError || membershipsError) return NextResponse.json({ error: "Unable to load client access records." }, { status: 500 });
  return NextResponse.json({ users: users.users.filter((user) => Boolean(user.email)).map((user) => ({ id: user.id, email: user.email, createdAt: user.created_at })), clients, memberships });
}

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  const body = await request.json() as { userId?: string; clientId?: string; membershipStatus?: "active" | "suspended" };
  if (!body.userId || !body.clientId) return NextResponse.json({ error: "userId and clientId are required." }, { status: 400 });
  const admin = createAdminClient();
  const [{ data: userRole, error: roleError }, { data: client, error: clientError }] = await Promise.all([
    admin.from("user_roles").select("is_active,roles(role_code)").eq("user_id", body.userId).maybeSingle(),
    admin.from("client_accounts").select("id,status").eq("id", body.clientId).maybeSingle(),
  ]);
  const role = Array.isArray(userRole?.roles) ? userRole?.roles[0] : userRole?.roles;
  if (roleError || !userRole || userRole.is_active !== true || role?.role_code !== "client_user") return NextResponse.json({ error: "Only active client users can receive a client assignment." }, { status: 400 });
  if (clientError || !client) return NextResponse.json({ error: "Client account was not found." }, { status: 404 });
  const { error } = await admin.from("client_memberships").upsert({ user_id: body.userId, client_id: body.clientId, membership_status: body.membershipStatus ?? "active", is_primary: true, assigned_by: actor.userId, assigned_at: new Date().toISOString() }, { onConflict: "user_id,client_id" });
  if (error) return NextResponse.json({ error: "Unable to save client assignment." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
