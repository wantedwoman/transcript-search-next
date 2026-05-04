'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import PatternBanner from './PatternBanner';
import PatternDrawer from './PatternDrawer';
import DatePrepModal from './DatePrepModal';
import MoodSelector from './MoodSelector';
import { SuzyMood, DEFAULT_MOOD, MOOD_LABELS, MOOD_EMOJI } from '@/lib/mood/mood-prompts';
import DraftComposer from './DraftComposer';
import DateAuditModal from './DateAuditModal';
import PhotoFeedbackModal from './PhotoFeedbackModal';
import CourseSuggestion from './CourseSuggestion';
import { UserPattern } from '@/lib/pattern-detection/types';

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  mood?: SuzyMood;
  courseSuggestion?: { name: string; url: string; confidence: number } | null;
}

const welcomeMessage = "Hey Sis. What's on your mind today? I'm here.";

export default function SuzyChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [selectedMood, setSelectedMood] = useState<SuzyMood>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('suzy-mood');
      if (saved && saved in MOOD_LABELS) return saved as SuzyMood;
    }
    return DEFAULT_MOOD;
  });
  // Pattern Catcher state
  const [latestPattern, setLatestPattern] = useState<UserPattern | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [patternDrawerOpen, setPatternDrawerOpen] = useState(false);
  const [datePrepOpen, setDatePrepOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [dateAuditOpen, setDateAuditOpen] = useState(false);
  const [photoFeedbackOpen, setPhotoFeedbackOpen] = useState(false);
  
  // Ref to the start of the latest bot message
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch latest unread pattern on mount
  useEffect(() => {
    async function fetchPattern() {
      try {
        const res = await fetch('/api/suzy/patterns');
        if (res.ok) {
          const data = await res.json();
          if (data.pattern) setLatestPattern(data.pattern);
        }
      } catch (e) {
        // Silently ignore
      }
    }
    fetchPattern();
  }, []);

  const handlePatternDismiss = useCallback(async () => {
    if (!latestPattern) return;
    try {
      await fetch('/api/suzy/patterns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patternId: latestPattern.id, action: 'dismiss' }),
      });
    } catch (e) {
      // Silently ignore
    }
    setLatestPattern(null);
  }, [latestPattern]);

  const handleDrawerDismiss = useCallback(async (patternId: string) => {
    try {
      await fetch('/api/suzy/patterns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patternId, action: 'dismiss' }),
      });
    } catch (e) {
      // Silently ignore
    }
    setLatestPattern(null);
    setPatternDrawerOpen(false);
  }, []);

  // Load chat history — prefer sessionStorage for instant restore, fallback to server
  const [historyLoaded, setHistoryLoaded] = useState(false);
  
  useEffect(() => {
    if (historyLoaded) return;
    
    // Try sessionStorage first
    const saved = sessionStorage.getItem('suzy-chat-messages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          setMessages(parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })));
          setHistoryLoaded(true);
          return;
        }
      } catch (e) {}
    }
    
    // Fallback: fetch from server (but don't override welcome message)
    async function loadFromServer() {
      try {
        const res = await fetch('/api/suzy/chat');
        if (!res.ok) { setHistoryLoaded(true); return; }
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          const history = [
            { id: 'welcome-1', content: welcomeMessage, isUser: false, timestamp: new Date() },
            ...data.messages.map((m: any) => ({
              id: m.id, content: m.content, isUser: m.isUser, timestamp: new Date(m.timestamp),
            })),
          ];
          setMessages(history);
          sessionStorage.setItem('suzy-chat-messages', JSON.stringify(history));
        }
      } catch (e) {}
      setHistoryLoaded(true);
    }
    
    // Show welcome message immediately while loading
    setMessages([{ id: 'welcome-1', content: welcomeMessage, isUser: false, timestamp: new Date() }]);
    loadFromServer();
  }, [historyLoaded]);
  
  // Persist messages to sessionStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('suzy-chat-messages', JSON.stringify(messages));
    }
  }, [messages]);

  // Scroll to the TOP of the new message when it arrives
  useEffect(() => {
    if (!loading && messages.length > 1 && !messages[messages.length - 1].isUser) {
      // Small delay to ensure DOM has updated with the full message
      setTimeout(() => {
        latestMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
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
    
    // Scroll to user message immediately
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 50);

    try {
      const response = await fetch('/api/suzy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage.content, mode: selectedMood }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.details || data?.error || `Server error: ${response.status}`);

      const botMessage: ChatMessage = {
        id: `msg-${Date.now()}-bot`,
        content: data.answer,
        isUser: false,
        timestamp: new Date(),
        mood: selectedMood,
        courseSuggestion: data.courseSuggestion || null,
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

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Show user message indicating an image was selected
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      content: `[Uploaded image: ${file.name}]`,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('query', 'Analyze my dating profile screenshot. Give me honest feedback on what works, what doesn\'t, and what I should change to attract higher quality matches.');
      formData.append('mode', selectedMood);

      const response = await fetch('/api/suzy/chat', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.details || data?.error || `Server error: ${response.status}`);

      const botMessage: ChatMessage = {
        id: `msg-${Date.now()}-bot`,
        content: data.answer,
        isUser: false,
        timestamp: new Date(),
        mood: selectedMood,
        courseSuggestion: data.courseSuggestion || null,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze image');
    } finally {
      setLoading(false);
    }
    
    // Reset file input so the same file can be selected again
    e.target.value = '';
  };

  return (
    <div className="min-h-screen text-on-surface selection:bg-primary-container selection:text-primary flex flex-col relative bg-[#171117]">
      {/* Decorative Glow */}
      <div className="fixed top-1/3 right-1/3 w-[500px] h-[500px] bg-primary/25 rounded-full blur-3xl pointer-events-none"></div>

      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#171117] border-b border-outline-variant/10">
        <div className="flex justify-between items-center px-6 py-4 w-full">
          <div className="flex items-center gap-4">
            <button onClick={() => setDrawerOpen(true)} className="p-2 active:scale-95 duration-200 transition-colors text-[#ecbaba] hover:text-primary">
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-headline font-bold italic tracking-tighter text-primary">Suzy AI</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_#e9c349]"></span>
                  <span className="text-[10px] font-label font-semibold uppercase tracking-widest text-secondary/60">Online</span>
                </div>
                <MoodSelector selectedMood={selectedMood} onMoodChange={(mood) => {
                  setSelectedMood(mood);
                  localStorage.setItem('suzy-mood', mood);
                }} />
              </div>
            </div>
          </div>
          <Link href="/profile" className="w-10 h-10 rounded-full border border-outline-variant/20 flex items-center justify-center text-secondary/60 hover:text-primary active:scale-95 duration-200 cursor-pointer">
            <span className="material-symbols-outlined text-2xl">person</span>
          </Link>
        </div>
      </header>

      {/* Drawer Menu */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity" onClick={() => setDrawerOpen(false)} />
          <div className="fixed top-0 left-0 h-full w-72 z-50 bg-[#171117] border-r border-outline-variant/20 shadow-2xl pt-20 px-6 animate-in slide-in-from-left duration-300">
            <button onClick={() => setDrawerOpen(false)} className="absolute top-6 right-6 text-secondary/60 hover:text-primary">
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex flex-col gap-2 mt-8">
              <Link href="/chat" onClick={() => setDrawerOpen(false)} className="flex items-center gap-4 px-4 py-4 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface hover:text-primary">
                <span className="material-symbols-outlined">chat_bubble</span>
                <span className="font-label font-semibold text-lg">Chat</span>
              </Link>
              <Link href="/insights" onClick={() => setDrawerOpen(false)} className="flex items-center gap-4 px-4 py-4 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface hover:text-primary">
                <span className="material-symbols-outlined">auto_awesome</span>
                <span className="font-label font-semibold text-lg">Insights</span>
              </Link>
              <Link href="/profile" onClick={() => setDrawerOpen(false)} className="flex items-center gap-4 px-4 py-4 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface hover:text-primary">
                <span className="material-symbols-outlined">person</span>
                <span className="font-label font-semibold text-lg">Profile</span>
              </Link>
              <Link href="/dashboard" onClick={() => setDrawerOpen(false)} className="flex items-center gap-4 px-4 py-4 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface hover:text-primary">
                <span className="material-symbols-outlined">monitoring</span>
                <span className="font-label font-semibold text-lg">Love Dashboard</span>
              </Link>
              <Link href="/vault" onClick={() => setDrawerOpen(false)} className="flex items-center gap-4 px-4 py-4 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface hover:text-primary">
                <span className="material-symbols-outlined">lock</span>
                <span className="font-label font-semibold text-lg">My Vault</span>
              </Link>
              <div className="border-t border-outline-variant/20 my-4" />
              <button onClick={() => { sessionStorage.clear(); window.location.href = '/'; }} className="flex items-center gap-4 px-4 py-4 rounded-lg hover:bg-surface-container-low transition-colors text-error/80 hover:text-error w-full text-left">
                <span className="material-symbols-outlined">logout</span>
                <span className="font-label font-semibold text-lg">Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}

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
          {messages.map((message, index) => {
            const isLatestBotMessage = !message.isUser && index === messages.length - 1;
            return (
              <div
                key={message.id}
                ref={isLatestBotMessage ? latestMessageRef : null}
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
                    <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</p>
                  </div>
                  <div className="flex items-center gap-2 px-2">
                    <span className="text-[10px] font-label font-semibold uppercase tracking-widest text-secondary/40">
                      {message.isUser ? 'You' : 'Suzy'} • {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {!message.isUser && message.mood && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] bg-white/10 border border-white/10">
                          {MOOD_EMOJI[message.mood]} {MOOD_LABELS[message.mood]}
                        </span>
                      )}
                    </span>
                    {!message.isUser && (
                      <button
                        onClick={async () => {
                          try {
                            await fetch('/api/suzy/vault', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ content: message.content }),
                            });
                            alert('Saved to Vault!');
                          } catch {}
                        }}
                        className="text-[10px] text-secondary/40 hover:text-primary transition-colors font-label font-semibold uppercase tracking-widest"
                      >
                        Save to Vault
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start items-end gap-4 max-w-[85%] md:max-w-[70%]">
              <div className="flex flex-col gap-2">
                <div className="glass-panel-solid bg-surface-container-high/60 text-on-surface px-6 py-5 rounded-lg rounded-tl-none message-shadow border-tl-4 border-tertiary">
                  <div className="flex gap-2 items-center">
                    <span className="w-2 h-2 rounded-full bg-tertiary/60 animate-bounce" style={{animationDelay:'0ms'}}></span>
                    <span className="w-2 h-2 rounded-full bg-tertiary/60 animate-bounce" style={{animationDelay:'150ms'}}></span>
                    <span className="w-2 h-2 rounded-full bg-tertiary/60 animate-bounce" style={{animationDelay:'300ms'}}></span>
                  </div>
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

      {/* Pattern Catcher Banner */}
      {latestPattern && (
        <div className="fixed bottom-[170px] left-0 w-full px-6 md:px-12 lg:px-24 z-40 pointer-events-auto">
          <div className="max-w-5xl mx-auto">
            <PatternBanner
              topic={latestPattern.topics_observed[0] || 'your patterns'}
              onShowMe={() => setPatternDrawerOpen(true)}
              onDismiss={handlePatternDismiss}
            />
          </div>
        </div>
      )}

      {/* Bottom Input Area (Fixed) */}
      <div className="fixed bottom-[100px] left-0 w-full px-6 md:px-12 lg:px-24 pointer-events-none z-40">
        <form onSubmit={handleUserMessage} className="max-w-5xl mx-auto pointer-events-auto">
          <div className="glass-panel-solid p-2 rounded-xl shadow-[0_-10px_40px_rgba(255,112,149,0.05)] flex items-center gap-3 border border-outline-variant/20">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*" 
            />
            <button
              type="button"
              onClick={handleAttachmentClick}
              className="p-3 text-secondary/60 cursor-pointer hover:text-primary transition-colors flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-2xl">attach_file</span>
            </button>
            <button
              type="button"
              onClick={() => setDatePrepOpen(true)}
              className="p-3 text-secondary/60 cursor-pointer hover:text-primary transition-colors flex items-center justify-center"
              title="Date Prep"
            >
              <span className="material-symbols-outlined text-2xl">favorite</span>
            </button>
            <button
              type="button"
              onClick={() => setDraftOpen(true)}
              className="p-3 text-secondary/60 cursor-pointer hover:text-primary transition-colors flex items-center justify-center"
              title="Love Letter"
            >
              <span className="material-symbols-outlined text-2xl">edit_note</span>
            </button>
            <button
              type="button"
              onClick={() => setDateAuditOpen(true)}
              className="p-3 text-secondary/60 cursor-pointer hover:text-primary transition-colors flex items-center justify-center"
              title="Date Audit"
            >
              <span className="material-symbols-outlined text-2xl">search</span>
            </button>
            <button
              type="button"
              onClick={() => setPhotoFeedbackOpen(true)}
              className="p-3 text-secondary/60 cursor-pointer hover:text-primary transition-colors flex items-center justify-center"
              title="Photo Feedback"
            >
              <span className="material-symbols-outlined text-2xl">photo_camera</span>
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

      {/* Pattern Drawer */}
      {latestPattern && (
        <PatternDrawer
          pattern={latestPattern}
          open={patternDrawerOpen}
          onClose={() => setPatternDrawerOpen(false)}
          onDismiss={handleDrawerDismiss}
        />
      )}

      {/* Feature Modals */}
      <DatePrepModal open={datePrepOpen} onClose={() => setDatePrepOpen(false)} />
      <DraftComposer onClose={() => setDraftOpen(false)} />
      <DateAuditModal isOpen={dateAuditOpen} onClose={() => setDateAuditOpen(false)} />
      <PhotoFeedbackModal isOpen={photoFeedbackOpen} onClose={() => setPhotoFeedbackOpen(false)} onFeedbackReceived={() => {}} />

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center px-4 pb-6 pt-3 bg-[#171117] z-50 rounded-t-lg border-t border-[#4c4451]/30 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        {/* Chat Tab (Active) */}
        <Link href="/chat" prefetch={true} className="flex flex-col items-center justify-center bg-primary text-white rounded-full px-6 py-2 active:scale-90 duration-300 ease-out">
          <span className="material-symbols-outlined text-2xl">chat_bubble</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Chat</span>
        </Link>
        {/* Insights Tab */}
        <Link href="/insights" prefetch={true} className="flex flex-col items-center justify-center text-[#ecbaba] opacity-60 px-6 py-2 hover:opacity-100 transition-opacity active:scale-90 duration-300 ease-out">
          <span className="material-symbols-outlined text-2xl">auto_awesome</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Insights</span>
        </Link>
        {/* Profile Tab */}
        <Link href="/profile" prefetch={true} className="flex flex-col items-center justify-center text-[#ecbaba] opacity-60 px-6 py-2 hover:opacity-100 transition-opacity active:scale-90 duration-300 ease-out">
          <span className="material-symbols-outlined text-2xl">person</span>
          <span className="font-label text-[11px] font-semibold uppercase tracking-widest mt-1">Profile</span>
        </Link>
      </nav>
    </div>
  );
}