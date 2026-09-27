import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
