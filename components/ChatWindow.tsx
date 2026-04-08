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
    chunk_index: number;
    text: string;
  }>;
}

const welcomeMessage = "Hi! I'm your WANTED Woman transcript search assistant. Ask me anything about dating, relationships, mindset, confidence, or Coach Cass's lessons, and I'll answer from the transcript library.";

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
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col bg-white">
      <div className="border-b border-gray-200 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900">WANTED Woman Transcript Search</h1>
        <p className="mt-1 text-sm text-gray-500">Grounded answers from your transcript library, powered by Supabase embeddings.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            content={message.content}
            isUser={message.isUser}
            sources={message.sources}
          />
        ))}
        {loading ? <p className="text-sm text-gray-500">Thinking...</p> : null}
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSubmit={handleUserMessage} onClear={clearChat} />
    </div>
  );
}
