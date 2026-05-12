'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type ConversationMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  userId: string;
  email: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  previewQuestion: string;
  previewAnswer: string;
  messageCount: number;
  tone: string | null;
  topics: string[];
  summary: string | null;
  messages: ConversationMessage[];
};

type Stats = {
  totalConversations: number;
  totalMessages: number;
  totalInsights: number;
  activeUsers: number;
};

const toneClasses: Record<string, string> = {
  anxious: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  confident: 'bg-green-500/15 text-green-300 border-green-500/20',
  confused: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
  frustrated: 'bg-red-500/15 text-red-300 border-red-500/20',
  hopeful: 'bg-sky-500/15 text-sky-300 border-sky-500/20',
  neutral: 'bg-white/10 text-white/70 border-white/10',
  sad: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  empowered: 'bg-pink-500/15 text-pink-300 border-pink-500/20',
};

export default function AdminConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week'>('all');
  const [toneFilter, setToneFilter] = useState('all');

  async function loadConversations() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/conversations');
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data = await res.json();
      const nextConversations = data.conversations || [];
      setConversations(nextConversations);
      setStats(data.stats || null);
      setSelectedId((current) => current && nextConversations.some((c: Conversation) => c.id === current)
        ? current
        : nextConversations[0]?.id || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  const filteredConversations = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    return conversations.filter((conversation) => {
      const haystack = [
        conversation.email,
        conversation.previewQuestion,
        conversation.previewAnswer,
        conversation.summary || '',
        conversation.topics.join(' '),
      ].join(' ').toLowerCase();

      const matchesSearch = haystack.includes(search.toLowerCase());
      const toneMatches = toneFilter === 'all' || (conversation.tone || 'none') === toneFilter;

      const conversationTime = new Date(conversation.lastMessageAt || conversation.createdAt).getTime();
      const dateMatches =
        dateFilter === 'all' ||
        (dateFilter === 'today' && conversationTime >= todayStart) ||
        (dateFilter === 'week' && conversationTime >= weekStart);

      return matchesSearch && toneMatches && dateMatches;
    });
  }, [conversations, dateFilter, search, toneFilter]);

  const selectedConversation = filteredConversations.find((conversation) => conversation.id === selectedId)
    || filteredConversations[0]
    || null;

  useEffect(() => {
    if (!selectedConversation && filteredConversations[0]) {
      setSelectedId(filteredConversations[0].id);
    }
  }, [filteredConversations, selectedConversation]);

  const toneOptions = useMemo(() => {
    const tones = new Set(conversations.map((conversation) => conversation.tone).filter(Boolean) as string[]);
    return ['all', ...Array.from(tones)];
  }, [conversations]);

  return (
    <div className="min-h-screen bg-[#171117] text-white">
      <header className="border-b border-white/10 px-6 py-4 sticky top-0 z-20 bg-[#171117]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/admin" className="text-[#ecbaba] hover:text-white transition-colors shrink-0">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold italic text-[#FF7095] truncate">Client Conversations</h1>
              <p className="text-sm text-white/45 truncate">One place to review client questions, Suzy replies, and insight summaries.</p>
            </div>
          </div>
          <button
            onClick={loadConversations}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors shrink-0"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <div className="text-3xl font-bold text-[#FF7095]">{stats.totalConversations}</div>
              <div className="text-sm text-white/50 mt-1">Total Conversations</div>
            </div>
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <div className="text-3xl font-bold text-white">{stats.totalMessages}</div>
              <div className="text-sm text-white/50 mt-1">Messages Saved</div>
            </div>
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <div className="text-3xl font-bold text-white">{stats.totalInsights}</div>
              <div className="text-sm text-white/50 mt-1">Insights Generated</div>
            </div>
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <div className="text-3xl font-bold text-white">{stats.activeUsers}</div>
              <div className="text-sm text-white/50 mt-1">Active Users</div>
            </div>
          </div>
        )}

        <div className="bg-white/5 rounded-2xl border border-white/10 p-4 md:p-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email, question, response, or topic..."
                className="w-full bg-black/20 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF7095]/50"
              />
            </div>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | 'week')}
              className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF7095]/50"
            >
              <option value="all">All dates</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
            </select>

            <select
              value={toneFilter}
              onChange={(e) => setToneFilter(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FF7095]/50"
            >
              {toneOptions.map((tone) => (
                <option key={tone} value={tone}>
                  {tone === 'all' ? 'All tones' : tone}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-white/50">Loading conversations...</div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-16 text-white/50">No conversations match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6 items-start">
            <section className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden xl:sticky xl:top-28">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="font-semibold">Conversation List</h2>
                <span className="text-xs text-white/40">{filteredConversations.length} shown</span>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {filteredConversations.map((conversation) => {
                  const active = selectedConversation?.id === conversation.id;
                  const toneClass = toneClasses[conversation.tone || 'neutral'] || toneClasses.neutral;
                  return (
                    <button
                      key={conversation.id}
                      onClick={() => setSelectedId(conversation.id)}
                      className={`w-full text-left px-5 py-4 border-b border-white/5 transition-colors ${active ? 'bg-[#FF7095]/10' : 'hover:bg-white/5'}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">{conversation.email}</div>
                          <div className="text-xs text-white/40 mt-1">
                            {new Date(conversation.lastMessageAt || conversation.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold capitalize ${toneClass}`}>
                          {conversation.tone || 'no tone'}
                        </span>
                      </div>

                      <p className="text-sm text-white/85 line-clamp-2 mb-2">{conversation.previewQuestion}</p>
                      <p className="text-xs text-white/45 line-clamp-2">{conversation.previewAnswer}</p>

                      <div className="flex items-center justify-between mt-3 gap-3">
                        <div className="flex flex-wrap gap-1.5">
                          {conversation.topics.slice(0, 2).map((topic) => (
                            <span key={topic} className="px-2 py-0.5 rounded-full bg-white/5 text-[#ecbaba] text-[11px]">
                              {topic}
                            </span>
                          ))}
                        </div>
                        <span className="text-[11px] text-white/35">{conversation.messageCount} msgs</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
              {selectedConversation ? (
                <>
                  <div className="px-6 py-5 border-b border-white/10 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-xl font-bold text-[#FF7095]">{selectedConversation.email}</h2>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${selectedConversation.status === 'active' ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>
                          {selectedConversation.status}
                        </span>
                      </div>
                      <div className="text-sm text-white/45 mt-2">
                        Conversation started {new Date(selectedConversation.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedConversation.tone && (
                        <span className={`px-3 py-1.5 rounded-full border text-xs font-semibold capitalize ${toneClasses[selectedConversation.tone] || toneClasses.neutral}`}>
                          {selectedConversation.tone}
                        </span>
                      )}
                      <Link
                        href={`/admin/insights/${selectedConversation.userId}`}
                        className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs font-semibold transition-colors"
                      >
                        Open Client Insights
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_320px] gap-0">
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                      {selectedConversation.messages.map((message) => {
                        const isUser = message.role === 'user';
                        return (
                          <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${isUser ? 'bg-[#FF7095] text-white' : 'bg-black/20 text-white/85 border border-white/10'}`}>
                              <div className="text-[11px] uppercase tracking-wider opacity-70 mb-2 font-semibold">
                                {isUser ? 'Client' : 'Suzy'}
                              </div>
                              <div className="text-sm leading-6 whitespace-pre-wrap">{message.content}</div>
                              <div className="text-[11px] opacity-60 mt-3">
                                {new Date(message.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <aside className="border-t 2xl:border-t-0 2xl:border-l border-white/10 p-6 bg-black/10 space-y-5">
                      <div>
                        <h3 className="text-sm uppercase tracking-widest text-white/40 font-semibold mb-3">Insight Summary</h3>
                        {selectedConversation.summary ? (
                          <p className="text-sm text-white/80 leading-6">{selectedConversation.summary}</p>
                        ) : (
                          <p className="text-sm text-white/45">No insight summary generated for this conversation yet.</p>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm uppercase tracking-widest text-white/40 font-semibold mb-3">Topics</h3>
                        {selectedConversation.topics.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedConversation.topics.map((topic) => (
                              <span key={topic} className="px-3 py-1 rounded-full bg-[#4D1D57]/30 text-[#FF7095] text-xs font-semibold">
                                {topic}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-white/45">No topics extracted yet.</p>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm uppercase tracking-widest text-white/40 font-semibold mb-3">Quick Facts</h3>
                        <div className="space-y-2 text-sm text-white/70">
                          <div className="flex justify-between gap-4">
                            <span>Messages</span>
                            <span>{selectedConversation.messageCount}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span>Last activity</span>
                            <span className="text-right">{new Date(selectedConversation.lastMessageAt || selectedConversation.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </aside>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-white/45">Select a conversation to view the thread.</div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
