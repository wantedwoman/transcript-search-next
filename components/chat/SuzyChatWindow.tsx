'use client';

import { useEffect, useRef, useState } from 'react';
import ChatInput from '../ChatInput';
import MessageBubble from '../MessageBubble';

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

const welcomeMessage = "Hello dear. I've been thinking about our last conversation. How are you feeling today? Remember, this is a safe space for everything you're carrying.";

export default function SuzyChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
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
    setLoading(true);

    try {
      const response = await fetch('/api/suzy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input }),
      });

      const data = await response.json();
      
      const botMessage: ChatMessage = {
        id: `msg-${Date.now()}-bot`,
        content: data.answer,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#171117] text-[#ecdfe8] font-body flex flex-col">
      <header className="fixed top-0 w-full z-50 bg-gradient-to-b from-[#171117] to-transparent">
        <div className="flex justify-between items-center px-6 py-4 w-full">
            <h1 className="text-2xl font-headline font-bold italic tracking-tighter text-[#ffade1]">Suzy AI</h1>
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto px-6 max-w-5xl mx-auto w-full py-8">
        <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl md:text-5xl font-headline font-bold text-[#ffade1] tracking-tight">Your digital confidante.</h2>
        </div>
        
        <div className="space-y-8">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              content={message.content}
              isUser={message.isUser}
            />
          ))}
          {loading && <p className="text-[#ecbaba]/40 px-6">Suzy is thinking...</p>}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <div className="fixed bottom-[100px] left-0 w-full px-6 md:px-12 lg:px-24 pointer-events-none">
        <div className="max-w-5xl mx-auto pointer-events-auto">
            <ChatInput onSubmit={handleUserMessage} />
        </div>
      </div>
    </div>
  );
}
