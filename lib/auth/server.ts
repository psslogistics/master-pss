import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function requireSuperAdmin() {
  const supabase = await createClient(); const claimsResult = await supabase.auth.getClaims(); const userId = claimsResult.data?.claims?.sub;
  if (!userId) redirect('/login');
  const { data, error: profileError } = await supabase.from('profiles').select('id,email,display_name,status,must_change_password').eq('id', userId).maybeSingle();
  if (profileError) redirect('/login?error=database');
  const { data: assignments, error: assignmentError } = await supabase.from('user_roles').select('role_id,is_active').eq('user_id', userId);
  if (assignmentError) redirect('/login?error=database');
  const activeRoleIds = (assignments ?? []).filter((assignment) => assignment.is_active === true).map((assignment) => assignment.role_id);
  const { data: roles, error: roleError } = activeRoleIds.length ? await supabase.from('roles').select('id,role_code,scope').in('id', activeRoleIds) : { data: [], error: null };
  if (roleError) redirect('/login?error=database');
  if (!data || data.status !== 'active' || !(roles ?? []).some((role) => role.role_code === 'super_admin')) redirect('/login');
  if (data.must_change_password === true) redirect('/reset-password?required=1');
  return { userId, profile: data, roles };
}
