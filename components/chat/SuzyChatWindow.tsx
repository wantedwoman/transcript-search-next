'use client';

import { useEffect, useRef, useState } from 'react';

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

const welcomeMessage = "Hey Sis. What's on your mind today? I'm here.";

export default function SuzyChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
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

  const handleUserMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      content: inputValue.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/suzy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage.content }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.details || data?.error || `Server error: ${response.status}`);

      const botMessage: ChatMessage = {
        id: `msg-${Date.now()}-bot`,
        content: data.answer,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  const handlePromptClick = (promptText: string) => {
    setInputValue(promptText);
  };

  return (
    <div className="min-h-screen text-on-surface selection:bg-primary-container selection:text-primary flex flex-col relative bg-[#171117]">
      {/* Decorative Glow */}
      <div className="fixed top-1/3 right-1/3 w-[500px] h-[500px] bg-primary/25 rounded-full blur-3xl pointer-events-none"></div>

      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#171117] border-b border-outline-variant/10">
        <div className="flex justify-between items-center px-6 py-4 w-full">
          <div className="flex items-center gap-4">
            <button className="p-2 active:scale-95 duration-200 transition-colors text-[#ecbaba] hover:text-primary">
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
            <div className="flex flex-col">
              <h1 className="text-2xl font-headline font-bold italic tracking-tighter text-primary">Suzy AI</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_#e9c349]"></span>
                <span className="text-[10px] font-label font-semibold uppercase tracking-widest text-secondary/60">Online</span>
              </div>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full border border-outline-variant/20 flex items-center justify-center text-secondary/60 hover:text-primary active:scale-95 duration-200 cursor-pointer">
            <span className="material-symbols-outlined text-2xl">person</span>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 pt-24 pb-48 px-6 md:px-12 lg:px-24 max-w-5xl mx-auto w-full space-y-12 relative z-0">
        {/* Intro Section */}
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl md:text-5xl font-headline font-bold text-primary tracking-tight">Your digital confidante.</h2>
          <p className="text-secondary/70 font-body text-lg max-w-md mx-auto leading-relaxed">
            I&apos;m here to listen, support, and guide you through whatever is on your mind today.
          </p>
        </div>

        {/* Chat History Area */}
        <div className="space-y-8">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-end gap-4 max-w-[85%] md:max-w-[70%] ${message.isUser ? 'justify-end ml-auto' : 'justify-start'}`}
            >
              <div className={`flex flex-col gap-2 ${message.isUser ? 'items-end text-right' : ''}`}>
                <div
                  className={`message-shadow glass-panel-solid px-6 py-5 rounded-lg font-body text-lg leading-relaxed ${
                    message.isUser
                      ? 'bg-primary text-white rounded-tr-none border border-primary/20'
                      : 'bg-surface-container-high/60 text-on-surface rounded-tl-none border-tl-4 border-tertiary'
                  }`}
                >
                  <p>{message.content}</p>
                </div>
                <span className="text-[10px] font-label font-semibold uppercase tracking-widest text-secondary/40 px-2">
                  {message.isUser ? 'You' : 'Suzy'} • {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start items-end gap-4 max-w-[85%] md:max-w-[70%]">
              <div className="flex flex-col gap-2">
                <div className="glass-panel-solid bg-surface-container-high/60 text-on-surface px-6 py-5 rounded-lg rounded-tl-none message-shadow border-tl-4 border-tertiary">
                  <p className="font-body text-lg leading-relaxed text-secondary/60">Thinking...</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="text-error px-6 py-3 rounded-lg bg-error-container/10 border border-error/20 font-body text-sm">
                {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts */}
        <div className="flex flex-wrap gap-3 justify-center pt-8">
          {['Give me a dating tip', 'How should I respond to this?', 'Help me rephrase an email'].map((prompt) => (
            <button
              key={prompt}
              onClick={() => handlePromptClick(prompt)}
              className="bg-surface-container-low border border-outline-variant/20 hover:border-primary/40 px-5 py-3 rounded-full text-sm font-label font-semibold text-secondary transition-all active:scale-95"
            >
              {prompt}
            </button>
          ))}
        </div>
      </main>

      {/* Bottom Input Area (Fixed) */}
      <div className="fixed bottom-[100px] left-0 w-full px-6 md:px-12 lg:px-24 pointer-events-none z-40">
        <form onSubmit={handleUserMessage} className="max-w-5xl mx-auto pointer-events-auto">
          <div className="glass-panel-solid p-2 rounded-xl shadow-[0_-10px_40px_rgba(255,112,149,0.05)] flex items-center gap-3 border border-outline-variant/20">
            <button
              type="button"
              className="p-3 text-secondary/60 cursor-pointer hover:text-primary transition-colors flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-2xl">attach_file</span>
            </button>
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-secondary/30 font-body text-lg py-4 focus:outline-none"
              placeholder="Type your message..."
              type="text"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || loading}
              className="bg-primary text-on-primary w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-2xl group-hover:translate-x-0.5 transition-transform">send</span>
            </button>
          </div>
        </form>
      </div>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-[#171117] z-50 rounded-t-lg border-t border-[#4c4451]/30 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        {/* Chat Tab (Active) */}
        <a className="flex flex-col items-center justify-center bg-primary text-white rounded-full px-6 py-2 active:scale-90 duration-300 ease-out" href="#">
          <span className="material-symbols-outlined text-2xl">chat_bubble</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Chat</span>
        </a>
        {/* Insights Tab */}
        <a className="flex flex-col items-center justify-center text-[#ecbaba] opacity-60 px-6 py-2 hover:opacity-100 transition-opacity active:scale-90 duration-300 ease-out" href="#">
          <span className="material-symbols-outlined text-2xl">auto_awesome</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Insights</span>
        </a>
        {/* Profile Tab */}
        <a className="flex flex-col items-center justify-center text-[#ecbaba] opacity-60 px-6 py-2 hover:opacity-100 transition-opacity active:scale-90 duration-300 ease-out" href="#">
          <span className="material-symbols-outlined text-2xl">person</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Profile</span>
        </a>
      </nav>
    </div>
  );
}
