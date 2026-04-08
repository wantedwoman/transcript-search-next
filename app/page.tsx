import ChatWindow from '@/components/ChatWindow';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WANTED Woman Transcript Search',
  description: 'Search through WANTED Woman transcript lessons to get grounded answers about dating, relationships, mindset, and confidence',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            WANTED Woman Transcript Search
          </h1>
          <p className="text-lg text-gray-600">
            Search through Coach Cass's transcript lessons for grounded answers about dating, relationships, mindset, and confidence
          </p>
        </div>
        
        <ChatWindow />
        
        <div className="mt-8 text-center text-sm text-gray-500">
          Powered by AI • Built with Next.js • Data from WANTED Woman transcript library
        </div>
      </div>
    </main>
  );
}