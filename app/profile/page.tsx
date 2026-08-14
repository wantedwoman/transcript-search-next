'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import ReminderSetup from '../../components/ReminderSetup';

interface OnboardingData {
  age: string;
  profession: string;
  income_range: string;
  relationship_status: string;
  hobbies: string;
  love_struggles: string;
}

interface ReferralData {
  code: string;
  referralLink: string;
  pendingCount: number;
  releasedCount: number;
  paidCount: number;
}

const INCOME_OPTIONS = [
  { value: '', label: 'Select your income range' },
  { value: '$50k-75k', label: '$50k - $75k' },
  { value: '$75k-100k', label: '$75k - $100k' },
  { value: '$100k-150k', label: '$100k - $150k' },
  { value: '$150k+', label: '$150k+' },
];

const RELATIONSHIP_OPTIONS = [
  { value: '', label: 'Select your relationship status' },
  { value: 'single', label: 'Single' },
  { value: 'dating', label: 'Dating' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'married', label: 'Married' },
  { value: 'widowed', label: 'Widowed' },
];

export default function ProfilePage() {
  const supabase = createClient();

  const [userEmail, setUserEmail] = useState<string>('');
  const [userStatus, setUserStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [onboarding, setOnboarding] = useState<OnboardingData>({
    age: '',
    profession: '',
    income_range: '',
    relationship_status: '',
    hobbies: '',
    love_struggles: '',
  });

  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/';
        return;
      }

      setUserEmail(user.email || '');

      // Load user profile status
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('status')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        setUserStatus(profile.status);
      }

      // Load onboarding data
      const { data: onboardingData } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (onboardingData) {
        setOnboarding({
          age: onboardingData.age?.toString() || '',
          profession: onboardingData.profession || '',
          income_range: onboardingData.income_range || '',
          relationship_status: onboardingData.relationship_status || '',
          hobbies: onboardingData.hobbies || '',
          love_struggles: onboardingData.love_struggles || '',
        });
      }

      // Load referral code
      const { data: refCode } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', user.id)
        .single();

      if (refCode) {
        const baseUrl = window.location.origin;
        const referralLink = `${baseUrl}/auth/signup?ref=${refCode.code}`;

        // Load referral counts
        const { data: referrals } = await supabase
          .from('referrals')
          .select('status')
          .eq('referrer_user_id', user.id);

        const pendingCount = referrals?.filter(r => r.status === 'pending').length || 0;
        const releasedCount = referrals?.filter(r => r.status === 'released').length || 0;
        const paidCount = referrals?.filter(r => r.status === 'paid').length || 0;

        setReferral({
          code: refCode.code,
          referralLink,
          pendingCount,
          releasedCount,
          paidCount,
        });
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const payload = {
        user_id: user.id,
        age: onboarding.age ? parseInt(onboarding.age) : null,
        profession: onboarding.profession || null,
        income_range: onboarding.income_range || null,
        relationship_status: onboarding.relationship_status || null,
        hobbies: onboarding.hobbies || null,
        love_struggles: onboarding.love_struggles || null,
      };

      const { error } = await supabase
        .from('user_onboarding')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;

      setSuccessMessage('Profile saved!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setErrorMessage('Failed to save. Please try again.');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateReferralCode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Generate a short, readable code from user id + random
      const code = user.id.substring(0, 4) + Math.random().toString(36).substring(2, 6).toUpperCase();

      const { error } = await supabase
        .from('referral_codes')
        .insert({ user_id: user.id, code });

      if (error) throw error;

      // Reload to get the referral info
      await loadProfile();
    } catch (err) {
      console.error('Failed to generate referral code:', err);
      setErrorMessage('Failed to generate referral code.');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleCopyLink = async () => {
    if (!referral) return;
    try {
      await navigator.clipboard.writeText(referral.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text approach
      setCopied(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#171117] flex items-center justify-center">
        <div className="text-secondary/60 font-body animate-pulse">Loading your profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#171117] text-on-surface selection:bg-primary-container selection:text-primary flex flex-col">
      {/* Decorative Glow */}
      <div className="fixed top-1/3 right-1/3 w-[500px] h-[500px] bg-primary/25 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#171117] border-b border-outline-variant/10">
        <div className="flex justify-between items-center px-6 py-4 w-full">
          <div className="flex items-center gap-4">
            <Link href="/chat" className="p-2 active:scale-95 duration-200 transition-colors text-[#ecbaba] hover:text-primary">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <h1 className="text-2xl font-headline font-bold italic tracking-tighter text-primary">My Profile</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pt-24 pb-48 px-6 md:px-12 lg:px-24 max-w-2xl mx-auto w-full space-y-10 relative z-0">
        {/* User Info Card */}
        <div className="glass-panel-solid rounded-lg border border-outline-variant/20 p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl text-primary">person</span>
            </div>
            <div>
              <p className="text-lg font-body text-on-surface font-semibold">{userEmail}</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${userStatus === 'active' ? 'bg-tertiary shadow-[0_0_8px_#e9c349]' : 'bg-error'}`}></span>
                <span className="text-[10px] font-label font-semibold uppercase tracking-widest text-secondary/60">
                  {userStatus === 'active' ? 'Active' : userStatus || 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Onboarding Form */}
        <div className="space-y-6">
          <h2 className="text-xl font-headline font-bold text-primary">Tell me About You</h2>
          <p className="text-sm font-body text-secondary/60">The more I know, the better I can help.</p>

          {/* Age */}
          <div className="space-y-2">
            <label className="block text-sm font-label font-semibold uppercase tracking-widest text-secondary/80">Age</label>
            <input
              type="number"
              value={onboarding.age}
              onChange={(e) => setOnboarding(prev => ({ ...prev, age: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant/20 text-on-surface placeholder:text-secondary/30 font-body text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
              placeholder="Your age"
              min="18"
              max="120"
            />
          </div>

          {/* Profession */}
          <div className="space-y-2">
            <label className="block text-sm font-label font-semibold uppercase tracking-widest text-secondary/80">Profession</label>
            <input
              type="text"
              value={onboarding.profession}
              onChange={(e) => setOnboarding(prev => ({ ...prev, profession: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant/20 text-on-surface placeholder:text-secondary/30 font-body text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
              placeholder="What do you do?"
            />
          </div>

          {/* Relationship Status */}
          <div className="space-y-2">
            <label className="block text-sm font-label font-semibold uppercase tracking-widest text-secondary/80">Relationship Status</label>
            <select
              value={onboarding.relationship_status}
              onChange={(e) => setOnboarding(prev => ({ ...prev, relationship_status: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant/20 text-on-surface font-body text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all appearance-none"
            >
              {RELATIONSHIP_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-surface-container text-on-surface">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Income Range */}
          <div className="space-y-2">
            <label className="block text-sm font-label font-semibold uppercase tracking-widest text-secondary/80">Income Range</label>
            <select
              value={onboarding.income_range}
              onChange={(e) => setOnboarding(prev => ({ ...prev, income_range: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant/20 text-on-surface font-body text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all appearance-none"
            >
              {INCOME_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-surface-container text-on-surface">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Hobbies */}
          <div className="space-y-2">
            <label className="block text-sm font-label font-semibold uppercase tracking-widest text-secondary/80">Hobbies & Interests</label>
            <input
              type="text"
              value={onboarding.hobbies}
              onChange={(e) => setOnboarding(prev => ({ ...prev, hobbies: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant/20 text-on-surface placeholder:text-secondary/30 font-body text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
              placeholder="What do you enjoy?"
            />
          </div>

          {/* Love Struggles */}
          <div className="space-y-2">
            <label className="block text-sm font-label font-semibold uppercase tracking-widest text-secondary/80">Main Love Struggles</label>
            <textarea
              value={onboarding.love_struggles}
              onChange={(e) => setOnboarding(prev => ({ ...prev, love_struggles: e.target.value }))}
              rows={4}
              className="w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant/20 text-on-surface placeholder:text-secondary/30 font-body text-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all resize-none"
              placeholder="What are your biggest challenges in love and dating?"
            />
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-xl bg-primary text-on-primary font-label font-semibold uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#E11D69]"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>

          {successMessage && (
            <div className="text-center text-tertiary font-label font-semibold text-sm">{successMessage}</div>
          )}
          {errorMessage && (
            <div className="text-center text-error font-label font-semibold text-sm">{errorMessage}</div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-outline-variant/20 my-8"></div>

        {/* Check-In Reminders */}
        <ReminderSetup />

        {/* Divider */}
        <div className="border-t border-outline-variant/20 my-8"></div>

        {/* Referral Program */}
        <div className="space-y-6">
          <h2 className="text-xl font-headline font-bold text-primary">Share Coach Cass AI 💜</h2>
          <p className="text-sm font-body text-secondary/60">Share your link and earn when others join.</p>

          {referral ? (
            <div className="glass-panel-solid rounded-lg border border-outline-variant/20 p-6 space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/60">Your Referral Link</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-surface-container rounded-lg px-4 py-3 text-sm font-body text-on-surface truncate border border-outline-variant/20">
                    {referral.referralLink}
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="px-4 py-3 rounded-lg bg-primary/20 text-primary font-label font-semibold text-sm border border-primary/30 active:scale-95 transition-all hover:bg-primary/30"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="text-center p-3 rounded-lg bg-surface-container border border-outline-variant/20">
                  <p className="text-2xl font-headline font-bold text-tertiary">{referral.pendingCount}</p>
                  <p className="text-[10px] font-label font-semibold uppercase tracking-widest text-secondary/50 mt-1">Pending</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-surface-container border border-outline-variant/20">
                  <p className="text-2xl font-headline font-bold text-primary">{referral.releasedCount}</p>
                  <p className="text-[10px] font-label font-semibold uppercase tracking-widest text-secondary/50 mt-1">Released</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-surface-container border border-outline-variant/20">
                  <p className="text-2xl font-headline font-bold text-green-400">{referral.paidCount}</p>
                  <p className="text-[10px] font-label font-semibold uppercase tracking-widest text-secondary/50 mt-1">Paid</p>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={handleGenerateReferralCode}
              className="w-full py-4 rounded-xl bg-primary/20 text-primary font-label font-semibold uppercase tracking-widest text-sm border border-primary/30 active:scale-95 transition-all hover:bg-primary/30"
            >
              Generate My Referral Link
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-outline-variant/20 my-8"></div>

        {/* Reset Password */}
        <div className="space-y-4 pb-8">
          <h2 className="text-xl font-headline font-bold text-primary">Account</h2>
          <Link
            href="/auth/reset-password"
            className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-surface-container border border-outline-variant/20 text-on-surface font-body text-lg hover:border-primary/40 transition-all"
          >
            <span>Reset Password</span>
            <span className="material-symbols-outlined text-secondary/60">chevron_right</span>
          </Link>
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-[#171117] z-50 rounded-t-lg border-t border-[#4c4451]/30 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        <a className="flex flex-col items-center justify-center text-[#ecbaba] opacity-60 px-6 py-2 hover:opacity-100 transition-opacity active:scale-90 duration-300 ease-out" href="/chat">
          <span className="material-symbols-outlined text-2xl">chat_bubble</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Chat</span>
        </a>
        <a className="flex flex-col items-center justify-center text-[#ecbaba] opacity-60 px-6 py-2 hover:opacity-100 transition-opacity active:scale-90 duration-300 ease-out" href="/insights">
          <span className="material-symbols-outlined text-2xl">auto_awesome</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Insights</span>
        </a>
        <a className="flex flex-col items-center justify-center bg-primary text-white rounded-full px-6 py-2 active:scale-90 duration-300 ease-out" href="/profile">
          <span className="material-symbols-outlined text-2xl">person</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Profile</span>
        </a>
      </nav>
    </div>
  );
}