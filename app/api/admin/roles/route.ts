import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

type RolePayload = { name?: string; description?: string; permissionKeys?: string[]; roleId?: string; permissionKey?: string; enabled?: boolean };

function roleCode(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export async function GET() {
  await requireSuperAdmin();
  const supabase = await createClient();
  const [{ data: roles, error: rolesError }, { data: links, error: linksError }] = await Promise.all([
    supabase.from("roles").select("id,role_code,name,description,scope,is_system").in("scope", ["employee", "system"]).order("name"),
    supabase.from("role_permissions").select("role_id,permission_key"),
  ]);
  if (rolesError || linksError) return NextResponse.json({ error: rolesError?.message ?? linksError?.message }, { status: 400 });
  return NextResponse.json({ roles: roles ?? [], rolePermissions: links ?? [] });
}

export async function POST(request: Request) {
  await requireSuperAdmin();
  const body = await request.json() as RolePayload;
  const name = body.name?.trim();
  if (!name || name.length < 2) return NextResponse.json({ error: "Role name is required" }, { status: 400 });
  const supabase = await createClient();
  const code = roleCode(name);
  if (!code) return NextResponse.json({ error: "Role name must contain letters or numbers" }, { status: 400 });
  const { data: role, error } = await supabase.from("roles").insert({ role_code: code, name, description: body.description?.trim() || null, scope: "employee", is_system: false }).select("id,role_code,name,description,scope,is_system").single();
  if (error || !role) return NextResponse.json({ error: error?.code === "23505" ? "A role with this name already exists" : error?.message ?? "Unable to create role" }, { status: 400 });
  const keys = [...new Set(body.permissionKeys ?? [])];
  if (keys.length) {
    const { error: linkError } = await supabase.from("role_permissions").insert(keys.map((permission_key) => ({ role_id: role.id, permission_key })));
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 });
  }
  return NextResponse.json({ role }, { status: 201 });
}

export async function PATCH(request: Request) {
  await requireSuperAdmin();
  const body = await request.json() as RolePayload;
  const supabase = await createClient();
  if (body.roleId && body.name !== undefined) {
    const name = body.name.trim();
    if (name.length < 2) return NextResponse.json({ error: "Role name must contain at least 2 characters" }, { status: 400 });
    const { data: role, error } = await supabase.from("roles").update({ name }).eq("id", body.roleId).select("id,role_code,name,description,scope,is_system").single();
    if (error || !role) return NextResponse.json({ error: error?.code === "PGRST116" ? "Role was not found" : error?.message ?? "Unable to rename role" }, { status: error?.code === "PGRST116" ? 404 : 400 });
    return NextResponse.json({ role });
  }
  if (!body.roleId || !body.permissionKey || typeof body.enabled !== "boolean") return NextResponse.json({ error: "roleId, permissionKey, and enabled are required" }, { status: 400 });
  const result = body.enabled
    ? await supabase.from("role_permissions").upsert({ role_id: body.roleId, permission_key: body.permissionKey })
    : await supabase.from("role_permissions").delete().eq("role_id", body.roleId).eq("permission_key", body.permissionKey);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  await requireSuperAdmin();
  const body = await request.json() as { roleId?: string };
  if (!body.roleId) return NextResponse.json({ error: "roleId is required" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.from("roles").delete().eq("id", body.roleId);
  if (error) {
    if (error.code === "23503") return NextResponse.json({ error: "This role is assigned to one or more employees and cannot be deleted." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
