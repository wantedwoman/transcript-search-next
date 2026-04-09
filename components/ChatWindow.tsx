'use client';

import { useEffect, useRef, useState } from 'react';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  sources?: Array<{
    lesson_title: string;
    course_name: string;
    module_name: string;
  }>;
}

const welcomeMessage = "Hey Sis. Ask me about dating, relationships, confidence, or mindset, and I’ll help you sort through it with grounded, clear guidance.";

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-1',
          content: welcomeMessage,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    }
  }, [messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleUserMessage = async (input: string) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      content: input,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.details || data?.error || `Server error: ${response.status}`);

      const botMessage: ChatMessage = {
        id: `msg-${Date.now()}-bot`,
        content: data.answer,
        isUser: false,
        timestamp: new Date(),
        sources: data.sources,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome-1',
        content: welcomeMessage,
        isUser: false,
        timestamp: new Date(),
      },
    ]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fef8fa_0%,#fff7fb_35%,#ffffff_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl flex-col overflow-hidden rounded-[28px] border border-[#f3d7e4] bg-white/95 shadow-[0_20px_70px_rgba(77,29,87,0.08)]">
        <div className="border-b border-[#f5d9e5] bg-[linear-gradient(135deg,#fff6fb_0%,#fef8fa_100%)] px-6 py-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b66a8d]">WANTED Woman AI</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#4d1d57] sm:text-4xl">Coach Cass Response Engine</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6f5467] sm:text-base">
            Real guidance for love, dating, confidence, and relationships, clear enough to skim and grounded enough to actually use.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          <div className="mx-auto max-w-3xl">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                content={message.content}
                isUser={message.isUser}
                sources={message.sources}
              />
            ))}
            {loading ? <p className="px-14 text-sm text-[#8d6f80]">Thinking...</p> : null}
            {error ? <p className="mt-3 px-14 text-sm text-red-500">{error}</p> : null}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <ChatInput onSubmit={handleUserMessage} onClear={clearChat} />
      </div>
    </div>
  );
}
