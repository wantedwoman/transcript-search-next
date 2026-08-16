import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coach Cass AI',
  description: 'Your digital confidante for love, dating, and relationships. Get insight, draft texts, audit dates, and prep with confidence.',
  openGraph: {
    title: 'Coach Cass AI',
    description: 'Your digital confidante for love, dating, and relationships.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Coach Cass AI',
    description: 'Your digital confidante for love, dating, and relationships.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#FF7095" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="text-on-surface selection:bg-primary/30 selection:text-primary overflow-x-hidden flex flex-col">
        {children}
      </body>
    </html>
  );
}
