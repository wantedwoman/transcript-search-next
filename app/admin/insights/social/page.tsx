'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AggregateInsight {
  id: string;
  date: string;
  trending_topics: string[];
  common_questions: string[];
  recurring_pain_points: string[];
  content_hooks: string[];
  summary: string;
}

interface SocialData {
  aggregates: AggregateInsight[];
  stats: {
    totalUsers: number;
    totalConversations: number;
    totalInsights: number;
  };
}

export default function SocialInsightsPage() {
  const [data, setData] = useState<SocialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/admin/insights/social');
        if (!res.ok) throw new Error('Failed to fetch data');
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#171117] flex items-center justify-center text-white/50">
        Loading insights...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#171117] flex items-center justify-center text-red-400">
        {error || 'Failed to load data'}
      </div>
    );
  }

  const { aggregates, stats } = data;
  const latest = aggregates[0];

  return (
    <div className="min-h-screen bg-[#171117] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-[#ecbaba] hover:text-white transition-colors">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <h1 className="text-2xl font-bold italic text-[#FF7095]">Social Insights</h1>
          </div>
          <Link
            href="/admin/insights/carousels"
            className="px-4 py-2 rounded-lg bg-[#FF7095] hover:bg-[#FF7095]/80 text-white text-sm font-semibold transition-colors"
          >
            View Carousels
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-[#FF7095]">{stats.totalUsers}</div>
            <div className="text-sm text-white/50 mt-1">Active Users</div>
          </div>
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-[#FF7095]">{stats.totalConversations}</div>
            <div className="text-sm text-white/50 mt-1">Conversations</div>
          </div>
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <div className="text-3xl font-bold text-[#FF7095]">{stats.totalInsights}</div>
            <div className="text-sm text-white/50 mt-1">Insights Generated</div>
          </div>
        </div>

        {latest ? (
          <>
            {/* Latest Summary */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-[#FFD700]">auto_awesome</span>
                <h2 className="text-lg font-bold">Weekly Summary</h2>
                <span className="text-sm text-white/40 ml-auto">
                  {new Date(latest.date).toLocaleDateString()}
                </span>
              </div>
              <p className="text-white/80 leading-relaxed">{latest.summary}</p>
            </div>

            {/* Trending Topics */}
            {latest.trending_topics?.length > 0 && (
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-bold mb-4">🔥 Trending Topics</h2>
                <div className="flex flex-wrap gap-2">
                  {latest.trending_topics.map((topic, i) => (
                    <span
                      key={i}
                      className="px-4 py-2 rounded-full bg-[#4D1D57]/30 text-[#FF7095] text-sm font-semibold"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Common Questions */}
            {latest.common_questions?.length > 0 && (
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-bold mb-4">❓ Common Questions</h2>
                <div className="space-y-3">
                  {latest.common_questions.map((question, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5">
                      <span className="text-[#FFD700] font-bold text-sm mt-0.5">{i + 1}.</span>
                      <span className="text-white/80">{question}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recurring Pain Points */}
            {latest.recurring_pain_points?.length > 0 && (
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-bold mb-4">💔 Recurring Pain Points</h2>
                <div className="space-y-3">
                  {latest.recurring_pain_points.map((point, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span className="text-white/80">{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Hooks */}
            {latest.content_hooks?.length > 0 && (
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-bold mb-4">🎣 Content Hooks</h2>
                <div className="space-y-3">
                  {latest.content_hooks.map((hook, i) => (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5">
                      <span className="text-[#FFD700]">→</span>
                      <span className="text-white/80">{hook}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 text-white/50">
            No aggregate insights yet. Insights are generated daily from user conversations.
          </div>
        )}

        {/* Previous Days */}
        {aggregates.length > 1 && (
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-bold mb-4">Previous Days</h2>
            <div className="space-y-3">
              {aggregates.slice(1).map((agg) => (
                <div key={agg.id} className="py-3 border-b border-white/5">
                  <div className="text-sm text-white/50 mb-1">
                    {new Date(agg.date).toLocaleDateString()}
                  </div>
                  <p className="text-white/70 text-sm">{agg.summary}</p>
                  {agg.trending_topics?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {agg.trending_topics.slice(0, 5).map((topic) => (
                        <span
                          key={topic}
                          className="px-2 py-0.5 rounded-full bg-[#4D1D57]/20 text-[#FF7095] text-xs"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}