import { useState } from 'react';

interface ChatInputProps {
  onSubmit: (message: string) => Promise<void>;
  onClear?: () => void;
}

export default function ChatInput({ onSubmit, onClear }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!input.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(input);
      setInput('');
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about dating, relationships, mindset, or confidence..."
          className="flex-1 min-h-[80px] rounded-lg border border-gray-200 bg-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary text-sm"
          rows={2}
          maxRows={4}
          disabled={isSubmitting}
        />
        {!isSubmitting && (
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isSubmitting}
            className="ml-3 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex-shrink-0"
          >
            Send
          </button>
        )}
        {isSubmitting && (
          <button
            type="button"
            disabled
            className="ml-3 px-4 py-3 bg-gray-300 text-gray-500 rounded-lg flex-shrink-0"
          >
            Sending...
          </button>
        )}
      </div>
      
      {error && (
        <div className="text-sm text-red-500 flex items-center gap-2">
          <span role="img" aria-label="warning">⚠️</span>
          <span>{error}</span>
        </div>
      )}
      
      {onClear && !isSubmitting && (
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Clear chat
        </button>
      )}
    </div>
  );
}