'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Insight {
  id: string;
  date: string;
  topics: string[];
  tone: string;
  key_questions: string[];
  coaching_suggestions: string[];
  summary: string;
}

// Configurable CTAs - update these URLs to point to the right landing pages
const CTA_LINKS = {
  joinNetwork: process.env.NEXT_PUBLIC_CTA_JOIN_NETWORK || 'https://wantedwoman.com/real-love-network',
  bookCall: process.env.NEXT_PUBLIC_CTA_BOOK_CALL || 'https://wantedwoman.com/book-a-call',
};

const TONE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  anxious: { label: 'Anxious', color: 'text-yellow-400', emoji: '😰' },
  confident: { label: 'Confident', color: 'text-green-400', emoji: '💪' },
  confused: { label: 'Confused', color: 'text-purple-400', emoji: '🤔' },
  frustrated: { label: 'Frustrated', color: 'text-red-400', emoji: '😤' },
  hopeful: { label: 'Hopeful', color: 'text-tertiary', emoji: '✨' },
  neutral: { label: 'Neutral', color: 'text-secondary', emoji: '😊' },
  sad: { label: 'Sad', color: 'text-blue-400', emoji: '💙' },
  empowered: { label: 'Empowered', color: 'text-primary', emoji: '🔥' },
};

export default function InsightsPage() {
  const supabase = createClient();

  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasConversations, setHasConversations] = useState(true);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/';
        return;
      }

      // Check if user has any conversations
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (!conversations || conversations.length === 0) {
        setHasConversations(false);
        setLoading(false);
        return;
      }

      // Load insights
      const { data: insightData } = await supabase
        .from('user_insights')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(20);

      if (insightData && insightData.length > 0) {
        setInsights(insightData as Insight[]);
      }
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setLoading(false);
    }
  };

  // Aggregate topic frequencies across all insights
  const getTopTopics = (): { topic: string; count: number }[] => {
    const topicCounts: Record<string, number> = {};
    insights.forEach(insight => {
      insight.topics?.forEach(topic => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });
    });
    return Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };

  // Get the most common tone
  const getDominantTone = (): string => {
    if (insights.length === 0) return 'neutral';
    const toneCounts: Record<string, number> = {};
    insights.forEach(insight => {
      if (insight.tone) {
        toneCounts[insight.tone] = (toneCounts[insight.tone] || 0) + 1;
      }
    });
    return Object.entries(toneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
  };

  // Collect unique coaching suggestions
  const getGrowthAreas = (): string[] => {
    const suggestions = new Set<string>();
    insights.forEach(insight => {
      insight.coaching_suggestions?.forEach(s => suggestions.add(s));
    });
    return Array.from(suggestions).slice(0, 4);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#171117] flex items-center justify-center">
        <div className="text-secondary/60 font-body animate-pulse">Loading your insights...</div>
      </div>
    );
  }

  // No conversations yet
  if (!hasConversations) {
    return (
      <div className="min-h-screen bg-[#171117] text-on-surface flex flex-col">
        <div className="fixed top-1/3 right-1/3 w-[500px] h-[500px] bg-primary/25 rounded-full blur-3xl pointer-events-none"></div>

        <header className="fixed top-0 w-full z-50 bg-[#171117] border-b border-outline-variant/10">
          <div className="flex justify-between items-center px-6 py-4 w-full">
            <div className="flex items-center gap-4">
              <Link href="/chat" className="p-2 active:scale-95 duration-200 transition-colors text-[#ecbaba] hover:text-primary">
                <span className="material-symbols-outlined text-2xl">arrow_back</span>
              </Link>
              <h1 className="text-2xl font-headline font-bold italic tracking-tighter text-primary">Insights</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 pt-24 pb-48 px-6 md:px-12 lg:px-24 max-w-2xl mx-auto w-full flex flex-col items-center justify-center space-y-6 relative z-0">
          <div className="text-8xl">💫</div>
          <h2 className="text-2xl font-headline font-bold text-primary text-center">Chat first</h2>
          <p className="text-lg font-body text-secondary/60 text-center max-w-md">
            Come back here after a few conversations to see your personal insights and growth patterns.
          </p>
          <Link
            href="/chat"
            className="mt-4 px-8 py-4 rounded-xl bg-primary text-on-primary font-label font-semibold uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all hover:bg-[#E11D69]"
          >
            Start Chatting
          </Link>
        </main>

        <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-[#171117] z-50 rounded-t-lg border-t border-[#4c4451]/30 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
          <a className="flex flex-col items-center justify-center text-[#ecbaba] opacity-60 px-6 py-2 hover:opacity-100 transition-opacity active:scale-90 duration-300 ease-out" href="/chat">
            <span className="material-symbols-outlined text-2xl">chat_bubble</span>
            <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Chat</span>
          </a>
          <a className="flex flex-col items-center justify-center bg-primary text-white rounded-full px-6 py-2 active:scale-90 duration-300 ease-out" href="/insights">
            <span className="material-symbols-outlined text-2xl">auto_awesome</span>
            <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Insights</span>
          </a>
          <a className="flex flex-col items-center justify-center text-[#ecbaba] opacity-60 px-6 py-2 hover:opacity-100 transition-opacity active:scale-90 duration-300 ease-out" href="/profile">
            <span className="material-symbols-outlined text-2xl">person</span>
            <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Profile</span>
          </a>
        </nav>
      </div>
    );
  }

  const topTopics = getTopTopics();
  const dominantTone = getDominantTone();
  const growthAreas = getGrowthAreas();
  const toneInfo = TONE_LABELS[dominantTone] || TONE_LABELS.neutral;

  return (
    <div className="min-h-screen bg-[#171117] text-on-surface flex flex-col">
      {/* Decorative Glow */}
      <div className="fixed top-1/3 right-1/3 w-[500px] h-[500px] bg-primary/25 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#171117] border-b border-outline-variant/10">
        <div className="flex justify-between items-center px-6 py-4 w-full">
          <div className="flex items-center gap-4">
            <Link href="/chat" className="p-2 active:scale-95 duration-200 transition-colors text-[#ecbaba] hover:text-primary">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <h1 className="text-2xl font-headline font-bold italic tracking-tighter text-primary">Insights</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pt-24 pb-48 px-6 md:px-12 lg:px-24 max-w-2xl mx-auto w-full space-y-8 relative z-0">
        {/* Tone Card */}
        <div className="glass-panel-solid rounded-lg border border-outline-variant/20 p-6">
          <p className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/50 mb-2">Your Overall Energy</p>
          <div className="flex items-center gap-4">
            <span className="text-5xl">{toneInfo.emoji}</span>
            <div>
              <h2 className={`text-2xl font-headline font-bold ${toneInfo.color}`}>{toneInfo.label}</h2>
              <p className="text-sm font-body text-secondary/60 mt-1">
                Based on {insights.length} conversation{insights.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Topics Card */}
        {topTopics.length > 0 && (
          <div className="glass-panel-solid rounded-lg border border-outline-variant/20 p-6 space-y-4">
            <p className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/50">What You Talk About Most</p>
            <div className="space-y-3">
              {topTopics.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-body text-on-surface text-sm capitalize">{item.topic}</span>
                      <span className="text-[10px] font-label text-secondary/50">{item.count}×</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((item.count / (topTopics[0]?.count || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <a
              href={CTA_LINKS.joinNetwork}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 rounded-lg bg-primary text-on-primary text-center font-label font-semibold uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all hover:bg-[#E11D69] mt-2"
            >
              Join The Real Love Network
            </a>
          </div>
        )}

        {/* Growth Areas Card */}
        {growthAreas.length > 0 && (
          <div className="glass-panel-solid rounded-lg border border-outline-variant/20 p-6 space-y-4">
            <p className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/50">Growth Areas</p>
            <div className="space-y-3">
              {growthAreas.map((suggestion, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface-container/50">
                  <span className="text-primary text-lg mt-0.5">✦</span>
                  <p className="font-body text-sm text-on-surface">{suggestion}</p>
                </div>
              ))}
            </div>
            <a
              href={CTA_LINKS.bookCall}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 rounded-lg bg-tertiary/20 text-tertiary text-center font-label font-semibold uppercase tracking-widest text-sm border border-tertiary/30 active:scale-95 transition-all hover:bg-tertiary/30 mt-2"
            >
              Book a Breakthrough Call
            </a>
          </div>
        )}

        {/* Recent Insights */}
        {insights.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/50">Recent Conversations</p>
            {insights.slice(0, 5).map((insight) => {
              const toneDetail = TONE_LABELS[insight.tone] || TONE_LABELS.neutral;
              return (
                <div key={insight.id} className="glass-panel-solid rounded-lg border border-outline-variant/20 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-label text-secondary/50 uppercase tracking-widest">
                      {new Date(insight.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className={`text-xs font-label font-semibold ${toneDetail.color}`}>
                      {toneDetail.emoji} {toneDetail.label}
                    </span>
                  </div>
                  {insight.summary && (
                    <p className="font-body text-sm text-on-surface">{insight.summary}</p>
                  )}
                  {insight.topics && insight.topics.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {insight.topics.map((topic, i) => (
                        <span key={i} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-label font-semibold border border-primary/20">
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* No insights yet (but has conversations) */}
        {insights.length === 0 && hasConversations && (
          <div className="text-center space-y-4 py-8">
            <div className="text-6xl">🔮</div>
            <h2 className="text-xl font-headline font-bold text-primary">Insights Are Brewing</h2>
            <p className="font-body text-secondary/60">
              Chat a bit more and your personalized insights will start appearing here.
            </p>
            <Link
              href="/chat"
              className="inline-block mt-4 px-8 py-4 rounded-xl bg-primary text-on-primary font-label font-semibold uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all hover:bg-[#E11D69]"
            >
              Continue Chatting
            </Link>
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-[#171117] z-50 rounded-t-lg border-t border-[#4c4451]/30 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        <a className="flex flex-col items-center justify-center text-[#ecbaba] opacity-60 px-6 py-2 hover:opacity-100 transition-opacity active:scale-90 duration-300 ease-out" href="/chat">
          <span className="material-symbols-outlined text-2xl">chat_bubble</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Chat</span>
        </a>
        <a className="flex flex-col items-center justify-center bg-primary text-white rounded-full px-6 py-2 active:scale-90 duration-300 ease-out" href="/insights">
          <span className="material-symbols-outlined text-2xl">auto_awesome</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Insights</span>
        </a>
        <a className="flex flex-col items-center justify-center text-[#ecbaba] opacity-60 px-6 py-2 hover:opacity-100 transition-opacity active:scale-90 duration-300 ease-out" href="/profile">
          <span className="material-symbols-outlined text-2xl">person</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Profile</span>
        </a>
      </nav>
    </div>
  );
}