'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const slides = [
  {
    id: 'welcome',
    headline: 'Welcome to Coach Cass AI',
    description: 'Your personal Digital Confidante. Always in your pocket. Always on your side.',
    icon: (
      <svg className="w-24 h-24 text-[#FF7095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    accent: 'from-[#FF7095] to-[#E11D69]',
  },
  {
    id: 'advice',
    headline: 'Relationship Advice',
    description: 'Get real-time coaching on dating, relationships, and everything in between. No judgment, just guidance.',
    icon: (
      <svg className="w-24 h-24 text-[#FF7095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    accent: 'from-[#FF7095] to-[#F8A4D8]',
  },
  {
    id: 'texting',
    headline: 'Text Message Help',
    description: "Stuck on what to say? Not sure how to respond? I'll help you craft the perfect message every time.",
    icon: (
      <svg className="w-24 h-24 text-[#FF7095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    accent: 'from-[#F8A4D8] to-[#FF7095]',
  },
  {
    id: 'prep',
    headline: 'Date Prep & Photo Feedback',
    description: "Get ready for your date with personalized prep. Upload photos for honest, helpful feedback on your look.",
    icon: (
      <svg className="w-24 h-24 text-[#FF7095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    accent: 'from-[#E11D69] to-[#FF7095]',
  },
  {
    id: 'safe',
    headline: 'Safe Space',
    description: "A judgment-free zone for your real questions. Bring what you're actually going through. The awkward text. The confusing date. The situation you can't tell your friends about.",
    icon: (
      <svg className="w-24 h-24 text-[#FF7095]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    accent: 'from-[#FF7095] to-[#F8A4D8]',
  },
];

export default function OnboardingCarousel() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);
  const router = useRouter();

  const slide = slides[current];
  const isLast = current === slides.length - 1;

  const goNext = () => {
    if (isLast) {
      // Mark onboarding as complete
      localStorage.setItem('coachcass_onboarding_complete', 'true');
      router.push('/chat');
    } else {
      setDirection(1);
      setCurrent((c) => c + 1);
    }
  };

  const goSkip = () => {
    localStorage.setItem('coachcass_onboarding_complete', 'true');
    router.push('/chat');
  };

  const goToSlide = (index: number) => {
    setDirection(index > current ? 1 : -1);
    setCurrent(index);
  };

  // Animate on mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#1a0a1e] via-[#2D0A31] to-[#1a0a1e]">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FF7095]/8 rounded-full blur-[150px]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-12">
        <div
          className={`w-full max-w-md transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Slide content */}
          <div className="text-center mb-8">
            {/* Icon */}
            <div className="flex justify-center mb-8">
              <div
                className={`w-32 h-32 rounded-3xl bg-gradient-to-br ${slide.accent} bg-opacity-10 flex items-center justify-center shadow-2xl shadow-[#FF7095]/20`}
                style={{ background: `linear-gradient(135deg, rgba(255,112,149,0.15), rgba(225,29,105,0.1))` }}
              >
                {slide.icon}
              </div>
            </div>

            {/* Headline */}
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
              {slide.headline}
            </h2>

            {/* Description */}
            <p className="text-lg text-[#F8A4D8]/80 leading-relaxed max-w-sm mx-auto">
              {slide.description}
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-3 mb-10">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                className={`transition-all duration-300 rounded-full ${
                  i === current
                    ? 'w-8 h-2.5 bg-[#FF7095]'
                    : 'w-2.5 h-2.5 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <button
              onClick={goNext}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#FF7095] to-[#E11D69] text-white font-bold text-lg shadow-lg shadow-[#FF7095]/30 hover:shadow-[#FF7095]/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              {isLast ? 'Get Started 💜' : 'Next'}
            </button>

            {!isLast && (
              <button
                onClick={goSkip}
                className="w-full py-3 text-white/50 hover:text-white/80 font-medium text-sm transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>

          {/* Brand footer */}
          <div className="mt-12 text-center">
            <p className="text-xs text-white/20">
              Part of the WANTED Woman ecosystem
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
