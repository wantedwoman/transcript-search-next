'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface UserProfile {
  user_id: string;
  email: string;
  status: string;
  created_at: string;
  last_active: string;
}

interface Insight {
  id: string;
  date: string;
  topics: string[];
  tone: string;
  key_questions: string[];
  coaching_suggestions: string[];
  summary: string;
  created_at: string;
}

interface ClientData {
  profile: UserProfile;
  insights: Insight[];
  stats: {
    conversationCount: number;
    insightCount: number;
    trendingTopics: { topic: string; count: number }[];
    toneDistribution: { tone: string; count: number }[];
    recentSuggestions: string[];
  };
}

export default function ClientInsightPage() {
  const params = useParams();
  const userId = params.userId as string;
  const [data, setData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch(`/api/admin/insights/${userId}`);
        if (!res.ok) throw new Error('Failed to fetch insights');
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#171117] flex items-center justify-center text-white/50">
        Loading client data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#171117] flex items-center justify-center text-red-400">
        {error || 'Failed to load client data'}
      </div>
    );
  }

  const { profile, insights, stats } = data;

  const toneColors: Record<string, string> = {
    anxious: 'bg-yellow-500/20 text-yellow-400',
    confident: 'bg-green-500/20 text-green-400',
    confused: 'bg-orange-500/20 text-orange-400',
    frustrated: 'bg-red-500/20 text-red-400',
    hopeful: 'bg-blue-500/20 text-blue-400',
    neutral: 'bg-gray-500/20 text-gray-400',
    sad: 'bg-purple-500/20 text-purple-400',
    empowered: 'bg-pink-500/20 text-pink-400',
  };

  return (
    <div className="min-h-screen bg-[#171117] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/users" className="text-[#ecbaba] hover:text-white transition-colors">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-2xl font-bold italic text-[#FF7095]">{profile.email}</h1>
              <p className="text-sm text-white/50">
                Joined {new Date(profile.created_at).toLocaleDateString()} · Last active {new Date(profile.last_active).toLocaleDateString()}
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              profile.status === 'active'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {profile.status}
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-xl p-5 border border-white/10">
            <div className="text-2xl font-bold">{stats.conversationCount}</div>
            <div className="text-sm text-white/50">Conversations</div>
          </div>
          <div className="bg-white/5 rounded-xl p-5 border border-white/10">
            <div className="text-2xl font-bold">{stats.insightCount}</div>
            <div className="text-sm text-white/50">Insights</div>
          </div>
          <div className="bg-white/5 rounded-xl p-5 border border-white/10">
            <div className="text-2xl font-bold">{stats.trendingTopics.length}</div>
            <div className="text-sm text-white/50">Topics</div>
          </div>
          <div className="bg-white/5 rounded-xl p-5 border border-white/10">
            <div className="text-2xl font-bold">{stats.toneDistribution.length}</div>
            <div className="text-sm text-white/50">Tone Range</div>
          </div>
        </div>

        {/* Trending Topics */}
        {stats.trendingTopics.length > 0 && (
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-bold mb-4">Trending Topics</h2>
            <div className="space-y-2">
              {stats.trendingTopics.map(({ topic, count }) => (
                <div key={topic} className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-white/80">{topic}</span>
                  <span className="text-[#FF7095] font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tone Distribution */}
        {stats.toneDistribution.length > 0 && (
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-bold mb-4">Emotional Tone Distribution</h2>
            <div className="flex flex-wrap gap-2">
              {stats.toneDistribution.map(({ tone, count }) => (
                <span
                  key={tone}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    toneColors[tone] || 'bg-gray-500/20 text-gray-400'
                  }`}
                >
                  {tone} <span className="opacity-70">({count})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Suggestions */}
        {stats.recentSuggestions.length > 0 && (
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-bold mb-4">Coaching Suggestions</h2>
            <ul className="space-y-2">
              {stats.recentSuggestions.map((suggestion, i) => (
                <li key={i} className="flex items-start gap-3 py-2 border-b border-white/5">
                  <span className="text-[#FF7095] mt-0.5">•</span>
                  <span className="text-white/80">{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recent Insights */}
        {insights.length > 0 && (
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-bold mb-4">Recent Sessions</h2>
            <div className="space-y-4">
              {insights.slice(0, 10).map((insight) => (
                <div key={insight.id} className="border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm text-white/50">
                      {new Date(insight.created_at).toLocaleDateString()}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        toneColors[insight.tone] || 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {insight.tone}
                    </span>
                  </div>
                  {insight.summary && (
                    <p className="text-white/70 text-sm mb-2">{insight.summary}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {insight.topics.map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 rounded-full bg-[#4D1D57]/30 text-[#FF7095] text-xs"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {insights.length === 0 && stats.conversationCount === 0 && (
          <div className="text-center py-12 text-white/50">
            No conversations yet for this user.
          </div>
        )}
      </div>
    </div>
  );
}