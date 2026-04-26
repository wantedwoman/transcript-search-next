'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CarouselSlide {
  slide_number: number;
  headline: string;
  body: string;
  type: 'hook' | 'insight' | 'tip' | 'cta';
}

interface Carousel {
  id: string;
  title: string;
  slides: CarouselSlide[];
  status: string;
  created_at: string;
}

export default function CarouselsPage() {
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCarousel, setExpandedCarousel] = useState<string | null>(null);

  useEffect(() => {
    fetchCarousels();
  }, []);

  async function fetchCarousels() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/insights/carousels');
      if (!res.ok) throw new Error('Failed to fetch carousels');
      const data = await res.json();
      setCarousels(data.carousels || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function generateNewCarousels() {
    try {
      setGenerating(true);
      setError(null);
      const res = await fetch('/api/admin/insights/carousels', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate carousels');
      }
      // Refresh the list
      await fetchCarousels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  }

  const slideTypeColors: Record<string, string> = {
    hook: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    insight: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    tip: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    cta: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  return (
    <div className="min-h-screen bg-[#171117] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/insights/social" className="text-[#ecbaba] hover:text-white transition-colors">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </Link>
            <h1 className="text-2xl font-bold italic text-[#FF7095]">IG Carousels</h1>
          </div>
          <button
            onClick={generateNewCarousels}
            disabled={generating}
            className="px-4 py-2 rounded-lg bg-[#FF7095] hover:bg-[#FF7095]/80 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">
              {generating ? 'hourglass_empty' : 'auto_awesome'}
            </span>
            {generating ? 'Generating...' : 'Generate New'}
          </button>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="max-w-6xl mx-auto px-6 mt-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {loading ? (
          <div className="text-center py-16 text-white/50">Loading carousels...</div>
        ) : carousels.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-6xl text-white/20 mb-4 block">photo_library</span>
            <p className="text-white/50 text-lg">No carousels yet.</p>
            <p className="text-white/30 text-sm mt-2">
              Click &quot;Generate New&quot; to create carousels from user insights.
            </p>
          </div>
        ) : (
          carousels.map((carousel) => (
            <div
              key={carousel.id}
              className="bg-white/5 rounded-xl border border-white/10 overflow-hidden"
            >
              {/* Carousel Header */}
              <div
                className="flex items-center justify-between p-6 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() =>
                  setExpandedCarousel(
                    expandedCarousel === carousel.id ? null : carousel.id
                  )
                }
              >
                <div>
                  <h3 className="text-lg font-bold text-white">{carousel.title}</h3>
                  <p className="text-sm text-white/40 mt-1">
                    {new Date(carousel.created_at).toLocaleDateString()} · {carousel.slides.length} slides · {carousel.status}
                  </p>
                </div>
                <span className="material-symbols-outlined text-white/30">
                  {expandedCarousel === carousel.id ? 'expand_less' : 'expand_more'}
                </span>
              </div>

              {/* Expanded Slides */}
              {expandedCarousel === carousel.id && (
                <div className="px-6 pb-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {carousel.slides.map((slide) => (
                      <div
                        key={slide.slide_number}
                        className={`rounded-xl border p-5 ${slideTypeColors[slide.type] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold uppercase tracking-wider">
                            {slide.type}
                          </span>
                          <span className="text-xs opacity-50">{slide.slide_number}/5</span>
                        </div>
                        <h4 className="font-bold text-sm mb-2">{slide.headline}</h4>
                        <p className="text-xs opacity-80 leading-relaxed">{slide.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-xs text-white/30">
                      1080×1080px · Brand colors: #FF7095 · #4D1D57 · #FFD700
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}