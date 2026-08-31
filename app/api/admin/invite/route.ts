import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const actor = await requireSuperAdmin()
  const body = await request.json() as { email?: string; name?: string; employeeCode?: string; department?: string; workspaceSlug?: string; roleCode?: string }
  if (!body.email || !body.name || !body.employeeCode || !body.roleCode) return NextResponse.json({ error: 'email, name, employeeCode, and roleCode are required' }, { status: 400 })
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: role, error: roleError } = await supabase.from('roles').select('id').eq('role_code', body.roleCode).eq('scope', 'employee').maybeSingle()
  if (roleError || !role) return NextResponse.json({ error: 'Invalid employee role' }, { status: 400 })
  const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.email, { data: { account_type: 'employee', full_name: body.name } })
  if (inviteError || !invitation.user) return NextResponse.json({ error: inviteError?.message ?? 'Invitation failed' }, { status: 400 })
  const { error: profileError } = await supabase.from('employee_profiles').insert({ user_id: invitation.user.id, employee_code: body.employeeCode, department: body.department ?? null, workspace_slug: body.workspaceSlug ?? null, employment_status: 'invited' })
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })
  const { error: roleInsertError } = await supabase.from('user_roles').insert({ user_id: invitation.user.id, role_id: role.id, assigned_by: actor.userId })
  if (roleInsertError) return NextResponse.json({ error: roleInsertError.message }, { status: 400 })
  return NextResponse.json({ userId: invitation.user.id }, { status: 201 })
}
