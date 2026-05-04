'use client';

import { useState, useEffect } from 'react';
import { SuzyMood, MOOD_LABELS, MOOD_EMOJI, DEFAULT_MOOD } from '@/lib/mood/mood-prompts';

const MOODS: SuzyMood[] = ['hypeme', 'soft-place', 'real-talk', 'strategy'];

const MOOD_COLORS: Record<SuzyMood, { bg: string; text: string; border: string; activeBg: string; activeText: string; activeBorder: string }> = {
  hypeme: {
    bg: 'bg-transparent',
    text: 'text-[#ff6b6b]',
    border: 'border-[#ff6b6b]/30',
    activeBg: 'bg-[#ff6b6b]/20',
    activeText: 'text-[#ff6b6b]',
    activeBorder: 'border-[#ff6b6b]',
  },
  'soft-place': {
    bg: 'bg-transparent',
    text: 'text-[#c084fc]',
    border: 'border-[#c084fc]/30',
    activeBg: 'bg-[#c084fc]/20',
    activeText: 'text-[#c084fc]',
    activeBorder: 'border-[#c084fc]',
  },
  'real-talk': {
    bg: 'bg-transparent',
    text: 'text-[#fbbf24]',
    border: 'border-[#fbbf24]/30',
    activeBg: 'bg-[#fbbf24]/20',
    activeText: 'text-[#fbbf24]',
    activeBorder: 'border-[#fbbf24]',
  },
  strategy: {
    bg: 'bg-transparent',
    text: 'text-[#34d399]',
    border: 'border-[#34d399]/30',
    activeBg: 'bg-[#34d399]/20',
    activeText: 'text-[#34d399]',
    activeBorder: 'border-[#34d399]',
  },
};

interface MoodSelectorProps {
  selectedMood: SuzyMood;
  onMoodChange: (mood: SuzyMood) => void;
}

export default function MoodSelector({ selectedMood, onMoodChange }: MoodSelectorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {MOODS.map((mood) => {
        const isActive = mood === selectedMood;
        const colors = MOOD_COLORS[mood];
        return (
          <button
            key={mood}
            onClick={() => onMoodChange(mood)}
            className={`
              px-3 py-1 rounded-full text-[11px] font-label font-semibold uppercase tracking-wider
              border transition-all active:scale-95 duration-200
              ${isActive
                ? `${colors.activeBg} ${colors.activeText} ${colors.activeBorder}`
                : `${colors.bg} ${colors.text} ${colors.border} opacity-60 hover:opacity-100`
              }
            `}
            title={MOOD_LABELS[mood]}
          >
            <span className="mr-1">{MOOD_EMOJI[mood]}</span>
            {MOOD_LABELS[mood]}
          </button>
        );
      })}
    </div>
  );
}