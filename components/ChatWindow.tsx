import { useState, useEffect, useRef } from 'react';
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

export default function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add a welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-1',
          content: "Hi! I'm your WANTED Woman transcript search assistant. Ask me anything about dating, relationships, mindset, confidence, or lessons from the WANTED Woman library. I'll search through the transcript lessons to give you grounded answers based on Coach Cass's teachings.",
          isUser: false,
          timestamp: new Date()
        }
      ]);
    }
  }, [messages.length]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleUserMessage = async (input: string) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      content: input,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: input })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      const botMessage: ChatMessage = {
        id: `msg-${Date.now()}-bot`,
        content: data.answer,
        isUser: false,
        timestamp: new Date(),
        sources: data.sources
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (err: any) {
      setError(err.message || 'Failed to get response');
      // Remove the user message on error to avoid confusing state
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome-1',
        content: "Hi! I'm your WANTED Woman transcript search assistant. Ask me anything about dating, relationships, mindset, confidence, or lessons from the WANTED Woman library. I'll search through the transcript lessons to give you grounded answers based on Coach Cass's teachings.",
        isUser: false,
        timestamp: new Date()
      }
    ]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            content={message.content}
            isUser=message.isUser
            sources=message.sources
          />
        ))}
        {loading && (
          <div className="flex justify-center my-4">
            <div className="flex items-center space-x-3">
              <div className="h-3 w-3 animate-pulse rounded-full bg-primary"></div>
              <div className="h-3 w-3 animate-pulse rounded-full bg-primary"></div>
              <div className="h-3 w-3 animate-pulse rounded-full bg-primary"></div>
              <span className="text-sm text-gray-500">Thinking...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="text-sm text-red-500 text-center py-4">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <ChatInput 
        onSubmit={handleUserMessage}
        onClear={clearChat}
      />
    </div>
  );
}