import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { themeInitScript } from '@/components/theme';
import { SITE_URL } from '@/lib/env';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'PokerPlan — Real-time planning poker for agile teams',
    template: '%s · PokerPlan',
  },
  description:
    'Estimate user stories together in real time. Free planning poker with no sign-up: share a link, vote, reveal, and agree.',
  applicationName: 'PokerPlan',
  authors: [{ name: 'Lalit Kumar Rajak', url: 'https://github.com/lalitkumarrajak' }],
  keywords: [
    'planning poker',
    'scrum poker',
    'agile estimation',
    'story points',
    'sprint planning',
  ],
  openGraph: {
    type: 'website',
    title: 'PokerPlan — Real-time planning poker',
    description: 'Share a link, vote, reveal, agree. No sign-up required.',
    siteName: 'PokerPlan',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f6fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b12' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
