'use client';

import { useState } from 'react';

interface ChatInputProps {
  onSubmit: (message: string) => Promise<void>;
  onClear?: () => void;
}

export default function ChatInput({ onSubmit, onClear }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setError(null);
    if (!input.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(input.trim());
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-[#f1d9e5] bg-[#fffafc] px-5 py-4 sm:px-8 sm:py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="chat-input" className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#9d7188]">
            Ask Coach Cass
          </label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about dating, relationships, mindset, or confidence..."
            className="min-h-[108px] w-full rounded-[20px] border border-[#ebd4e0] bg-white px-4 py-3 text-sm text-[#382933] outline-none transition focus:border-[#ff7095] focus:ring-4 focus:ring-[#ffd7e3]"
            disabled={isSubmitting}
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isSubmitting}
          className="rounded-[18px] bg-[#ff7095] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(255,112,149,0.22)] transition hover:bg-[#f96189] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        {error ? <p className="text-sm text-red-500">{error}</p> : <p className="text-xs text-[#9d7188]">Keep it real. Ask what you actually need clarity on.</p>}
        {onClear ? (
          <button type="button" onClick={onClear} className="text-xs font-medium text-[#8a667c] hover:text-[#4d1d57]">
            Clear chat
          </button>
        ) : null}
      </div>
    </form>
  );
}
