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
  const [{ data: roles, error: rolesError }, { data: links, error: linksError }, { data: permissions, error: permissionsError }] = await Promise.all([
    supabase.from("roles").select("id,role_code,name,description,scope,is_system").in("scope", ["employee", "system"]).order("name"),
    supabase.from("role_permissions").select("role_id,permission_key"),
    supabase.from("permissions").select("permission_key,label,description,permission_group,panel,resource,action,route,assignable_to_employee").eq("panel", "admin").eq("assignable_to_employee", true).order("permission_group").order("label"),
  ]);
  if (rolesError || linksError || permissionsError) return NextResponse.json({ error: rolesError?.message ?? linksError?.message ?? permissionsError?.message }, { status: 400 });
  return NextResponse.json({ roles: roles ?? [], rolePermissions: links ?? [], permissions: permissions ?? [] });
}

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  const body = await request.json() as RolePayload;
  const name = body.name?.trim();
  if (!name || name.length < 2) return NextResponse.json({ error: "Role name is required" }, { status: 400 });
  const supabase = await createClient();
  const keys = [...new Set(body.permissionKeys ?? [])];
  if (keys.length) {
    const { data: valid } = await supabase.from("permissions").select("permission_key").in("permission_key", keys).eq("panel", "admin").eq("assignable_to_employee", true);
    if ((valid ?? []).length !== keys.length) return NextResponse.json({ error: "One or more permissions are not assignable Admin permissions." }, { status: 400 });
  }
  const code = roleCode(name);
  if (!code) return NextResponse.json({ error: "Role name must contain letters or numbers" }, { status: 400 });
  const { data: role, error } = await supabase.from("roles").insert({ role_code: code, name, description: body.description?.trim() || null, scope: "employee", is_system: false }).select("id,role_code,name,description,scope,is_system").single();
  if (error || !role) return NextResponse.json({ error: error?.code === "23505" ? "A role with this name already exists" : error?.message ?? "Unable to create role" }, { status: 400 });
  if (keys.length) {
    const { error: linkError } = await supabase.from("role_permissions").insert(keys.map((permission_key) => ({ role_id: role.id, permission_key })));
    if (linkError) { await supabase.from("roles").delete().eq("id", role.id); return NextResponse.json({ error: linkError.message }, { status: 400 }); }
  }
  const { error: auditError } = await supabase.from("admin_audit_events").insert({ actor_user_id: actor.userId, action: "Created role", entity_type: "Role", entity_id: role.id, after_state: { role_code: role.role_code, name: role.name, permissionKeys: keys } });
  if (auditError) { await supabase.from("roles").delete().eq("id", role.id); return NextResponse.json({ error: "Role creation was rolled back because its audit event could not be recorded." }, { status: 500 }); }
  return NextResponse.json({ role }, { status: 201 });
}

export async function PATCH(request: Request) {
  const actor = await requireSuperAdmin();
  const body = await request.json() as RolePayload;
  const supabase = await createClient();
  if (body.roleId && body.name !== undefined) {
    const name = body.name.trim();
    if (name.length < 2) return NextResponse.json({ error: "Role name must contain at least 2 characters" }, { status: 400 });
    const { data: previous } = await supabase.from("roles").select("id,role_code,name,description,scope,is_system").eq("id", body.roleId).maybeSingle();
    const { data: role, error } = await supabase.from("roles").update({ name }).eq("id", body.roleId).select("id,role_code,name,description,scope,is_system").single();
    if (error || !role) return NextResponse.json({ error: error?.code === "PGRST116" ? "Role was not found" : error?.message ?? "Unable to rename role" }, { status: error?.code === "PGRST116" ? 404 : 400 });
    const { error: auditError } = await supabase.from("admin_audit_events").insert({ actor_user_id: actor.userId, action: "Renamed role", entity_type: "Role", entity_id: role.id, before_state: { name: previous?.name ?? null }, after_state: { name: role.name } });
    if (auditError) { if (previous) await supabase.from("roles").update({ name: previous.name }).eq("id", role.id); return NextResponse.json({ error: "Role rename was rolled back because its audit event could not be recorded." }, { status: 500 }); }
    return NextResponse.json({ role });
  }
  if (!body.roleId || !body.permissionKey || typeof body.enabled !== "boolean") return NextResponse.json({ error: "roleId, permissionKey, and enabled are required" }, { status: 400 });
  const { data: role } = await supabase.from("roles").select("id,scope,is_system").eq("id", body.roleId).maybeSingle();
  if (!role || role.scope !== "employee" || role.is_system) return NextResponse.json({ error: "Only non-system employee roles can receive Admin permissions." }, { status: 400 });
  const { data: permission } = await supabase.from("permissions").select("permission_key").eq("permission_key", body.permissionKey).eq("panel", "admin").eq("assignable_to_employee", true).maybeSingle();
  if (!permission) return NextResponse.json({ error: "This is not an assignable Admin permission." }, { status: 400 });
  const { data: previousLink } = await supabase.from("role_permissions").select("role_id,permission_key").eq("role_id", body.roleId).eq("permission_key", body.permissionKey).maybeSingle();
  const result = body.enabled
    ? await supabase.from("role_permissions").upsert({ role_id: body.roleId, permission_key: body.permissionKey })
    : await supabase.from("role_permissions").delete().eq("role_id", body.roleId).eq("permission_key", body.permissionKey);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  const { error: auditError } = await supabase.from("admin_audit_events").insert({ actor_user_id: actor.userId, action: body.enabled ? "Granted role permission" : "Removed role permission", entity_type: "Role", entity_id: body.roleId, before_state: { permissionKey: previousLink?.permission_key ?? null }, after_state: { permissionKey: body.enabled ? body.permissionKey : null } });
  if (auditError) {
    if (previousLink) await supabase.from("role_permissions").upsert(previousLink);
    else await supabase.from("role_permissions").delete().eq("role_id", body.roleId).eq("permission_key", body.permissionKey);
    return NextResponse.json({ error: "Permission change was rolled back because its audit event could not be recorded." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const actor = await requireSuperAdmin();
  const body = await request.json() as { roleId?: string };
  if (!body.roleId) return NextResponse.json({ error: "roleId is required" }, { status: 400 });
  const supabase = await createClient();
  const [{ data: role }, { data: links }] = await Promise.all([
    supabase.from("roles").select("id,role_code,name,description,scope,is_system").eq("id", body.roleId).maybeSingle(),
    supabase.from("role_permissions").select("role_id,permission_key").eq("role_id", body.roleId),
  ]);
  if (!role) return NextResponse.json({ error: "Role was not found" }, { status: 404 });
  if (role.is_system) return NextResponse.json({ error: "System roles cannot be deleted." }, { status: 400 });
  const { error } = await supabase.from("roles").delete().eq("id", body.roleId);
  if (error) {
    if (error.code === "23503") return NextResponse.json({ error: "This role is assigned to one or more employees and cannot be deleted." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const { error: auditError } = await supabase.from("admin_audit_events").insert({ actor_user_id: actor.userId, action: "Deleted role", entity_type: "Role", entity_id: body.roleId, before_state: { role, permissionKeys: (links ?? []).map((link) => link.permission_key) } });
  if (auditError) {
    await supabase.from("roles").insert(role);
    if (links?.length) await supabase.from("role_permissions").insert(links);
    return NextResponse.json({ error: "Role deletion was rolled back because its audit event could not be recorded." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
