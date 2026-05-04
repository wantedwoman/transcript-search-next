'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────

interface TopicFrequency {
  topic: string;
  count: number;
}

interface ToneTrendPoint {
  date: string;
  tone: string;
}

interface ProgressSummary {
  overallTone: string;
  toneDirection: 'improving' | 'declining' | 'stable';
  totalConversations: number;
  dominantTopics: string[];
  summaryText: string;
}

interface SuggestedNextStep {
  title: string;
  description: string;
  heartbeatUrl: string;
}

interface DashboardStats {
  topics: TopicFrequency[];
  toneTrend: ToneTrendPoint[];
  progress: ProgressSummary;
  suggestedNextSteps: SuggestedNextStep[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const TONE_META: Record<string, { label: string; color: string; emoji: string }> = {
  anxious: { label: 'Anxious', color: '#facc15', emoji: '😰' },
  confident: { label: 'Confident', color: '#4ade80', emoji: '💪' },
  confused: { label: 'Confused', color: '#c084fc', emoji: '🤔' },
  frustrated: { label: 'Frustrated', color: '#f87171', emoji: '😤' },
  hopeful: { label: 'Hopeful', color: '#e9c349', emoji: '✨' },
  neutral: { label: 'Neutral', color: '#ecbaba', emoji: '😊' },
  sad: { label: 'Sad', color: '#60a5fa', emoji: '💙' },
  empowered: { label: 'Empowered', color: '#ff7095', emoji: '🔥' },
};

const TONE_ORDER: Record<string, number> = {
  anxious: 0,
  sad: 1,
  confused: 2,
  frustrated: 3,
  neutral: 4,
  hopeful: 5,
  confident: 6,
  empowered: 7,
};

const DIRECTION_META: Record<string, { label: string; emoji: string; color: string }> = {
  improving: { label: 'Improving', emoji: '📈', color: 'text-green-400' },
  declining: { label: 'Needs Attention', emoji: '📉', color: 'text-yellow-400' },
  stable: { label: 'Steady', emoji: '➡️', color: 'text-secondary' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/suzy/dashboard');
        if (res.status === 401) {
          window.location.href = '/';
          return;
        }
        if (!res.ok) throw new Error('Failed to load dashboard');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#171117] flex items-center justify-center">
        <div className="text-secondary/60 font-body animate-pulse">Loading your dashboard...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-[#171117] text-on-surface flex flex-col items-center justify-center gap-4 px-6">
        <div className="text-6xl">💫</div>
        <h2 className="text-2xl font-headline font-bold text-primary">Something went wrong</h2>
        <p className="font-body text-secondary/60 text-center">{error || 'Could not load your dashboard.'}</p>
        <Link
          href="/chat"
          className="mt-4 px-8 py-4 rounded-xl bg-primary text-on-primary font-label font-semibold uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all hover:bg-[#E11D69]"
        >
          Back to Chat
        </Link>
      </div>
    );
  }

  const { topics, toneTrend, progress, suggestedNextSteps } = stats;
  const toneInfo = TONE_META[progress.overallTone] || TONE_META.neutral;
  const dirInfo = DIRECTION_META[progress.toneDirection] || DIRECTION_META.stable;

  // Calculate a simple SVG sparkline for tone trend
  const sparklinePoints = (() => {
    if (toneTrend.length < 2) return '';
    const maxVal = 7; // empowered
    const w = 300;
    const h = 60;
    const stepX = w / (toneTrend.length - 1);
    return toneTrend
      .map((pt, i) => {
        const x = i * stepX;
        const y = h - ((TONE_ORDER[pt.tone] ?? 4) / maxVal) * h;
        return `${x},${y}`;
      })
      .join(' ');
  })();

  return (
    <div className="min-h-screen bg-[#171117] text-on-surface flex flex-col relative">
      {/* Decorative Glow */}
      <div className="fixed top-1/3 right-1/3 w-[500px] h-[500px] bg-primary/25 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#171117] border-b border-outline-variant/10">
        <div className="flex justify-between items-center px-6 py-4 w-full">
          <div className="flex items-center gap-4">
            <Link href="/chat" className="p-2 active:scale-95 duration-200 transition-colors text-[#ecbaba] hover:text-primary">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <h1 className="text-2xl font-headline font-bold italic tracking-tighter text-primary">Love Life Dashboard</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pt-24 pb-48 px-6 md:px-12 lg:px-24 max-w-2xl mx-auto w-full space-y-8 relative z-0">
        {/* Progress Summary Card */}
        <div className="glass-panel-solid rounded-lg border border-outline-variant/20 p-6 space-y-3">
          <p className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/50">Your Journey</p>
          <div className="flex items-center gap-4">
            <span className="text-5xl">{toneInfo.emoji}</span>
            <div className="flex-1">
              <h2 className="text-2xl font-headline font-bold" style={{ color: toneInfo.color }}>{toneInfo.label}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-sm font-label font-semibold ${dirInfo.color}`}>
                  {dirInfo.emoji} {dirInfo.label}
                </span>
                <span className="text-xs font-label text-secondary/40">
                  • {progress.totalConversations} conversation{progress.totalConversations !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
          <p className="font-body text-secondary/70 text-sm leading-relaxed mt-2">{progress.summaryText}</p>
        </div>

        {/* Topics Breakdown */}
        {topics.length > 0 && (
          <div className="glass-panel-solid rounded-lg border border-outline-variant/20 p-6 space-y-4">
            <p className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/50">What You Talk About Most</p>
            <div className="space-y-3">
              {topics.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-body text-on-surface text-sm capitalize">{item.topic}</span>
                      <span className="text-[10px] font-label text-secondary/50">{item.count}×</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((item.count / (topics[0]?.count || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tone Trend */}
        {toneTrend.length >= 2 && (
          <div className="glass-panel-solid rounded-lg border border-outline-variant/20 p-6 space-y-4">
            <p className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/50">Your Energy Over Time</p>
            <div className="overflow-x-auto">
              <svg viewBox="0 0 300 70" className="w-full h-16" preserveAspectRatio="none">
                <polyline
                  points={sparklinePoints}
                  fill="none"
                  stroke="#ff7095"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Dots at each point */}
                {toneTrend.map((pt, i) => {
                  const maxVal = 7;
                  const w = 300;
                  const h = 60;
                  const stepX = toneTrend.length > 1 ? w / (toneTrend.length - 1) : 0;
                  const x = i * stepX;
                  const y = h - ((TONE_ORDER[pt.tone] ?? 4) / maxVal) * h;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="3.5"
                      fill="#ff7095"
                      stroke="#171117"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </svg>
            </div>
            <div className="flex justify-between text-[10px] font-label text-secondary/40 mt-1">
              {toneTrend.length <= 8 ? (
                toneTrend.map((pt, i) => (
                  <span key={i}>{new Date(pt.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                ))
              ) : (
                <>
                  <span>{new Date(toneTrend[0].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span>{new Date(toneTrend[toneTrend.length - 1].date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </>
              )}
            </div>
            {/* Tone legend */}
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(TONE_META).slice(0, 4).map(([key, meta]) => (
                <div key={key} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }}></span>
                  <span className="text-[10px] font-label text-secondary/50">{meta.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Next Steps */}
        {suggestedNextSteps.length > 0 && (
          <div className="glass-panel-solid rounded-lg border border-outline-variant/20 p-6 space-y-4">
            <p className="text-xs font-label font-semibold uppercase tracking-widest text-secondary/50">Suggested Next Steps</p>
            <div className="space-y-3">
              {suggestedNextSteps.map((step, i) => (
                <a
                  key={i}
                  href={step.heartbeatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg bg-surface-container/50 hover:bg-surface-container transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-label font-semibold text-primary group-hover:text-primary/80 transition-colors">
                        {step.title}
                      </h3>
                      <p className="font-body text-sm text-secondary/60 mt-1">{step.description}</p>
                    </div>
                    <span className="material-symbols-outlined text-secondary/40 group-hover:text-primary transition-colors ml-3">
                      arrow_outward
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Empty state for new users */}
        {progress.totalConversations === 0 && (
          <div className="text-center space-y-4 py-8">
            <div className="text-6xl">💫</div>
            <h2 className="text-xl font-headline font-bold text-primary">Start Your Journey</h2>
            <p className="font-body text-secondary/60">
              Chat with Suzy to begin tracking your love life insights and patterns.
            </p>
            <Link
              href="/chat"
              className="inline-block mt-4 px-8 py-4 rounded-xl bg-primary text-on-primary font-label font-semibold uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all hover:bg-[#E11D69]"
            >
              Start Chatting
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
        <a className="flex flex-col items-center justify-center bg-primary text-white rounded-full px-6 py-2 active:scale-90 duration-300 ease-out" href="/dashboard">
          <span className="material-symbols-outlined text-2xl">favorite</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Dashboard</span>
        </a>
        <a className="flex flex-col items-center justify-center text-[#ecbaba] opacity-60 px-6 py-2 hover:opacity-100 transition-opacity active:scale-90 duration-300 ease-out" href="/insights">
          <span className="material-symbols-outlined text-2xl">auto_awesome</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Insights</span>
        </a>
      </nav>
    </div>
  );
}