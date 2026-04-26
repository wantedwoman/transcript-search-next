import { redirect } from 'next/navigation';
import { createServerSupabaseClient, getAuthenticatedUser } from '@/lib/supabase/server';
import Link from 'next/link';

export const metadata = {
  title: 'Admin Dashboard - Suzy AI',
};

export default async function AdminPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect('/');
  }

  // Admin check — only specific emails can access
  const adminEmails = ['coach@wantedwoman.com', 'inspiremany@gmail.com'];
  if (!adminEmails.includes(user.email?.toLowerCase() || '')) {
    redirect('/chat');
  }

  const supabase = await createServerSupabaseClient();

  // Get user stats
  const { count: totalUsers } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true });

  const { count: activeUsers } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const { count: revokedUsers } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'revoked');

  const { count: pendingUsers } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  return (
    <div className="min-h-screen bg-[#171117] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/chat" className="text-[#ecbaba] hover:text-white transition-colors">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <h1 className="text-2xl font-bold italic text-[#FF7095]">Suzy Admin</h1>
          </div>
          <div className="text-sm text-white/50">{user.email}</div>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-white">{totalUsers ?? 0}</div>
            <div className="text-sm text-white/50 mt-1">Total Users</div>
          </div>
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-green-400">{activeUsers ?? 0}</div>
            <div className="text-sm text-white/50 mt-1">Active</div>
          </div>
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-red-400">{revokedUsers ?? 0}</div>
            <div className="text-sm text-white/50 mt-1">Revoked</div>
          </div>
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-yellow-400">{pendingUsers ?? 0}</div>
            <div className="text-sm text-white/50 mt-1">Pending</div>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/admin/users"
            className="bg-white/5 hover:bg-white/10 rounded-xl p-8 border border-white/10 transition-colors group"
          >
            <div className="flex items-center gap-4 mb-3">
              <span className="material-symbols-outlined text-3xl text-[#FF7095]">group</span>
              <h2 className="text-xl font-bold">User Management</h2>
            </div>
            <p className="text-white/60 text-sm">
              View all users, revoke access, or restore accounts.
            </p>
          </Link>

          <Link
            href="/admin/insights/social"
            className="bg-white/5 hover:bg-white/10 rounded-xl p-8 border border-white/10 transition-colors group"
          >
            <div className="flex items-center gap-4 mb-3">
              <span className="material-symbols-outlined text-3xl text-[#FF7095]">auto_awesome</span>
              <h2 className="text-xl font-bold">Insights & Social</h2>
            </div>
            <p className="text-white/60 text-sm">
              View coaching insights, trending topics, and social media content.
            </p>
          </Link>

          <Link
            href="/admin/insights/carousels"
            className="bg-white/5 hover:bg-white/10 rounded-xl p-8 border border-white/10 transition-colors group"
          >
            <div className="flex items-center gap-4 mb-3">
              <span className="material-symbols-outlined text-3xl text-[#FF7095]">photo_library</span>
              <h2 className="text-xl font-bold">IG Carousels</h2>
            </div>
            <p className="text-white/60 text-sm">
              Preview and download auto-generated Instagram carousel content.
            </p>
          </Link>

          <div className="bg-white/5 rounded-xl p-8 border border-white/10 opacity-50">
            <div className="flex items-center gap-4 mb-3">
              <span className="material-symbols-outlined text-3xl text-white/30">settings</span>
              <h2 className="text-xl font-bold text-white/30">Webhook Events</h2>
            </div>
            <p className="text-white/30 text-sm">Coming soon — GHL webhook event log.</p>
          </div>
        </div>
      </div>
    </div>
  );
}