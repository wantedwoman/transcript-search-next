import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import LoginScreen from '@/components/LoginScreen';

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If user is authenticated, check profile status and redirect
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('status')
      .eq('user_id', user.id)
      .single();

    if (profile && profile.status === 'active') {
      redirect('/chat');
    }
    // If revoked or no profile, fall through to login screen
    // (middleware already handles the redirect for revoked users)
  }

  // Not authenticated or revoked — show login screen
  return <LoginScreen />;
}