import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'WANTED Woman Transcript Search',
  description: 'Search through WANTED Woman transcript lessons to get grounded answers about dating, relationships, mindset, and confidence',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}