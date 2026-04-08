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
    <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-4">
      <div className="flex gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about dating, relationships, mindset, or confidence..."
          className="min-h-[88px] flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-pink-500"
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={!input.trim() || isSubmitting}
          className="rounded-lg bg-pink-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between">
        {error ? <p className="text-sm text-red-500">{error}</p> : <span />}
        {onClear ? (
          <button type="button" onClick={onClear} className="text-xs text-gray-500 hover:text-gray-700">
            Clear chat
          </button>
        ) : null}
      </div>
    </form>
  );
}
