import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const workspaceSlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const reservedWorkspaceSlugs = new Set(['www', 'api', 'employee', 'client', 'admin', 'master', 'auth'])

function validWorkspaceSlug(slug: string | null | undefined) {
  return !slug || (workspaceSlugPattern.test(slug) && !reservedWorkspaceSlugs.has(slug))
}

export async function GET() {
  await requireSuperAdmin()
  const supabase = await createClient()
  const [{ data: employees, error: employeeError }, { data: profiles, error: profileError }, { data: assignments, error: roleError }] = await Promise.all([
    supabase.from('employee_profiles').select('user_id,employee_code,department,workspace_slug,employment_status,joined_at,last_active_at').order('employee_code'),
    supabase.from('profiles').select('id,email,display_name,phone,status,must_change_password'),
    supabase.from('user_roles').select('user_id,is_active,role:roles(id,role_code,name)'),
  ])
  if (employeeError || profileError || roleError) return NextResponse.json({ error: employeeError?.message ?? profileError?.message ?? roleError?.message ?? 'Unable to load employees' }, { status: 400 })
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
  const assignmentById = new Map((assignments ?? []).map((assignment) => [assignment.user_id, assignment]))
  return NextResponse.json({ employees: (employees ?? []).map((employee) => ({ ...employee, profile: profileById.get(employee.user_id) ?? null, assignment: assignmentById.get(employee.user_id) ?? null })) })
}

export async function POST(request: Request) {
  const actor = await requireSuperAdmin()
  const body = await request.json() as { email?: string; name?: string; phone?: string; employeeId?: string; employeeCode?: string; department?: string; workspaceSlug?: string; roleId?: string; roleCode?: string; temporaryPassword?: string }
  const email = body.email?.trim().toLowerCase()
  const name = body.name?.trim()
  const employeeCode = (body.employeeId ?? body.employeeCode)?.trim().toUpperCase()
  const workspaceSlug = body.workspaceSlug?.trim().toLowerCase()
  if (!email || !name || (!body.roleId && !body.roleCode) || !body.temporaryPassword) return NextResponse.json({ error: 'name, email, roleId, and temporaryPassword are required' }, { status: 400 })
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Enter a valid work email' }, { status: 400 })
  if (name.length < 3) return NextResponse.json({ error: 'Enter the employee\'s full name' }, { status: 400 })
  if (body.temporaryPassword.length < 8) return NextResponse.json({ error: 'Temporary password must be at least 8 characters' }, { status: 400 })
  if (employeeCode && !/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(employeeCode)) return NextResponse.json({ error: 'Employee ID may contain uppercase letters, numbers, and hyphens' }, { status: 400 })
  if (!validWorkspaceSlug(workspaceSlug)) return NextResponse.json({ error: 'Workspace slug must be 1-63 lowercase characters, numbers, or hyphens and cannot use a reserved host name' }, { status: 400 })
  let admin: ReturnType<typeof createAdminClient>
  try { admin = createAdminClient() } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server provisioning is not configured' }, { status: 503 })
  }
  const supabase = await createClient()
  const roleQuery = body.roleId
    ? supabase.from('roles').select('id').eq('id', body.roleId).eq('scope', 'employee').eq('is_system', false).maybeSingle()
    : supabase.from('roles').select('id').eq('role_code', body.roleCode as string).eq('scope', 'employee').eq('is_system', false).maybeSingle()
  const { data: role, error: roleError } = await roleQuery
  if (roleError || !role) return NextResponse.json({ error: 'Invalid employee role. Choose an active employee role.' }, { status: 400 })
  if (employeeCode) {
    const { data: existingEmployee } = await supabase.from('employee_profiles').select('user_id').eq('employee_code', employeeCode).maybeSingle()
    if (existingEmployee) return NextResponse.json({ error: 'This employee ID is already in use' }, { status: 409 })
  }
  const { data: existingProfile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
  if (existingProfile) return NextResponse.json({ error: 'An account with this work email already exists' }, { status: 409 })
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password: body.temporaryPassword, email_confirm: true, user_metadata: { account_type: 'employee', full_name: name } })
  if (createError || !created.user) return NextResponse.json({ error: createError?.message ?? 'Unable to create employee account' }, { status: 400 })
  const userId = created.user.id
  const { data: updatedProfile, error: profileError } = await admin.from('profiles').update({ must_change_password: true, phone: body.phone?.trim() || null, display_name: name, status: 'active' }).eq('id', userId).select('id').maybeSingle()
  const { data: generatedCode, error: codeError } = profileError || employeeCode ? { data: employeeCode, error: null } : await admin.rpc('generate_employee_code')
  const profileWriteError = profileError ?? (!updatedProfile ? { message: 'Employee profile was not created by the identity trigger.' } : null)
  const { error: employeeError } = profileWriteError || codeError ? { error: profileWriteError ?? codeError } : await admin.from('employee_profiles').insert({ user_id: userId, employee_code: generatedCode, department: body.department?.trim() || null, workspace_slug: workspaceSlug || null, employment_status: 'active' })
  const { error: roleInsertError } = profileError || employeeError ? { error: profileError ?? employeeError } : await admin.from('user_roles').upsert({ user_id: userId, role_id: role.id, is_active: true, assigned_by: actor.userId }, { onConflict: 'user_id' })
  if (profileWriteError || codeError || employeeError || roleInsertError) {
    // Keep the Auth identity for an explicit retry, but disable it until the
    // profile, employee row and role assignment are complete.
    await admin.from('profiles').update({ status: 'pending' }).eq('id', userId)
    return NextResponse.json({ error: profileWriteError?.message ?? codeError?.message ?? employeeError?.message ?? roleInsertError?.message ?? 'Unable to finish employee provisioning' }, { status: 400 })
  }
  const { data: canonicalEmployee } = await admin.from('employee_profiles').select('user_id,employee_code,employment_status').eq('user_id', userId).maybeSingle()
  const { data: canonicalRole } = await admin.from('user_roles').select('role_id,is_active').eq('user_id', userId).maybeSingle()
  if (!canonicalEmployee || !canonicalRole?.is_active) return NextResponse.json({ error: 'Employee provisioning could not be confirmed. The identity remains pending retry.' }, { status: 409 })
  const { error: auditError } = await admin.from('admin_audit_events').insert({ actor_user_id: actor.userId, action: 'Created employee', entity_type: 'Employee', entity_id: userId, after_state: { email, name, employeeCode: canonicalEmployee.employee_code, department: body.department ?? null, workspaceSlug: workspaceSlug ?? null, roleId: role.id } })
  if (auditError) {
    await admin.from('profiles').update({ status: 'pending' }).eq('id', userId)
    return NextResponse.json({ error: 'Employee was provisioned but its audit event could not be recorded; the identity remains pending retry.' }, { status: 409 })
  }
  return NextResponse.json({ employee: { userId: canonicalEmployee.user_id, employeeCode: canonicalEmployee.employee_code, email, name, status: canonicalEmployee.employment_status === 'active' ? 'Active' : 'Invited' } }, { status: 201 })
}

export async function PATCH(request: Request) {
  const actor = await requireSuperAdmin()
  const body = await request.json() as { userId?: string; email?: string; name?: string; phone?: string; employeeCode?: string; department?: string; workspaceSlug?: string; roleId?: string }
  const userId = body.userId?.trim()
  const name = body.name?.trim()
  const email = body.email?.trim().toLowerCase()
  if (!userId || !name || !email || !body.roleId) return NextResponse.json({ error: 'userId, name, email, and roleId are required' }, { status: 400 })
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Enter a valid work email' }, { status: 400 })
  const employeeCode = body.employeeCode?.trim().toUpperCase() || null
  const workspaceSlug = body.workspaceSlug?.trim().toLowerCase() || null
  if (employeeCode && !/^[A-Z0-9][A-Z0-9-]{2,31}$/.test(employeeCode)) return NextResponse.json({ error: 'Employee ID may contain uppercase letters, numbers, and hyphens' }, { status: 400 })
  if (!validWorkspaceSlug(workspaceSlug)) return NextResponse.json({ error: 'Workspace slug must be 1-63 lowercase characters, numbers, or hyphens and cannot use a reserved host name' }, { status: 400 })
  let admin: ReturnType<typeof createAdminClient>
  try { admin = createAdminClient() } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Server provisioning is not configured' }, { status: 503 }) }
  const supabase = await createClient()
  const { data: role, error: roleError } = await supabase.from('roles').select('id').eq('id', body.roleId).eq('scope', 'employee').eq('is_system', false).maybeSingle()
  if (roleError || !role) return NextResponse.json({ error: 'Invalid employee role. Choose an active employee role.' }, { status: 400 })
  const [{ error: authError }, { error: profileError }, { error: employeeError }, { error: roleWriteError }, { error: auditError }] = await Promise.all([
    admin.auth.admin.updateUserById(userId, { email, user_metadata: { account_type: 'employee', full_name: name } }),
    admin.from('profiles').update({ email, display_name: name, phone: body.phone?.trim() || null }).eq('id', userId),
    admin.from('employee_profiles').update({ employee_code: employeeCode, department: body.department?.trim() || null, workspace_slug: workspaceSlug }).eq('user_id', userId),
    admin.from('user_roles').upsert({ user_id: userId, role_id: role.id, is_active: true, assigned_by: actor.userId }, { onConflict: 'user_id' }),
    supabase.from('admin_audit_events').insert({ actor_user_id: actor.userId, action: 'Updated employee', entity_type: 'Employee', entity_id: userId, after_state: { email, name, department: body.department ?? null, workspaceSlug, roleId: body.roleId } }),
  ])
  if (authError || profileError || employeeError || roleWriteError || auditError) return NextResponse.json({ error: authError?.message ?? profileError?.message ?? employeeError?.message ?? roleWriteError?.message ?? auditError?.message ?? 'Unable to update employee' }, { status: 400 })
  return NextResponse.json({ ok: true, userId })
}
