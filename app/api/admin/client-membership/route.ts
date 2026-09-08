import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const [{ data: users, error: usersError }, { data: clients, error: clientsError }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabase.from("profiles").select("id,email,created_at").not("email", "is", null),
    supabase.from("client_accounts").select("id,client_code,legal_name,status").order("legal_name"),
    supabase.from("client_memberships").select("user_id,client_id,membership_status"),
  ]);
  if (usersError || clientsError || membershipsError) return NextResponse.json({ error: "Unable to load client access records." }, { status: 500 });
  return NextResponse.json({ users: (users ?? []).map((user) => ({ id: user.id, email: user.email, createdAt: user.created_at })), clients, memberships });
}

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  const body = await request.json() as { userId?: string; clientId?: string; membershipStatus?: "active" | "suspended"; legalName?: string; clientCode?: string | null };
  const admin = await createClient();
  if (body.legalName !== undefined) {
    const legalName = body.legalName.trim();
    const clientCode = body.clientCode?.trim().toUpperCase() || null;
    if (!legalName) return NextResponse.json({ error: "Client legal name is required." }, { status: 400 });
    if (clientCode && !/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(clientCode)) return NextResponse.json({ error: "Client code may contain uppercase letters, numbers, and hyphens." }, { status: 400 });
    if (clientCode) {
      const { data: existing } = await admin.from("client_accounts").select("id").eq("client_code", clientCode).maybeSingle();
      if (existing) return NextResponse.json({ error: "This client code is already in use." }, { status: 409 });
    }
    const { data: client, error } = await admin.from("client_accounts").insert({ client_code: clientCode, legal_name: legalName, status: "on_hold" }).select("id,client_code,legal_name,status").single();
    if (error) return NextResponse.json({ error: "Unable to save client profile." }, { status: 500 });
    return NextResponse.json({ client }, { status: 201 });
  }
  if (!body.userId || !body.clientId) return NextResponse.json({ error: "userId and clientId are required." }, { status: 400 });
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
