import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AdminTaskPermission = 'admin.client_users.view' | 'admin.client_users.manage'

export async function authorizeAdminTaskPermission(permission: AdminTaskPermission) {
  const supabase = await createClient()
  const claimsResult = await supabase.auth.getClaims()
  const userId = claimsResult.data?.claims?.sub
  if (!userId) return { ok: false as const, status: 401, error: 'Sign-in is required.' }
  const [{ data: profile, error: profileError }, { data: context, error: contextError }, { data: granted, error: permissionError }] = await Promise.all([
    supabase.from('profiles').select('id,status,must_change_password').eq('id', userId).maybeSingle(),
    supabase.rpc('get_auth_context'),
    supabase.rpc('has_permission', { required_permission: permission }),
  ])
  if (profileError || contextError || permissionError) return { ok: false as const, status: 503, error: 'Access authorization is temporarily unavailable.' }
  if (!profile || profile.status !== 'active' || profile.must_change_password === true || context?.audience !== 'employee') return { ok: false as const, status: 403, error: 'This employee account is not authorized for this action.' }
  if (granted !== true) return { ok: false as const, status: 403, error: 'You do not have permission to perform this action.' }
  return { ok: true as const, userId, isSuperAdmin: (context.roles ?? []).some((role: { role_code?: string }) => role.role_code === 'super_admin') }
}

export async function requireSuperAdmin() {
  const supabase = await createClient(); const claimsResult = await supabase.auth.getClaims(); const userId = claimsResult.data?.claims?.sub;
  if (!userId) redirect('/login');
  const [{ data, error: profileError }, { data: context, error: contextError }] = await Promise.all([
    supabase.from('profiles').select('id,email,display_name,status,must_change_password').eq('id', userId).maybeSingle(),
    supabase.rpc('get_auth_context'),
  ]);
  if (profileError || contextError || !context?.user_id) redirect('/login?error=database');
  const roles = (context.roles ?? []) as Array<{ role_code?: string; scope?: string }>;
  if (!data || data.status !== 'active' || !(roles ?? []).some((role) => role.role_code === 'super_admin')) redirect('/login');
  if (data.must_change_password === true) redirect('/reset-password?required=1');
  return { userId, profile: data, roles };
}
