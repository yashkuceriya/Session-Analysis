import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from './providers';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#e85d26',
};

export const metadata: Metadata = {
  title: {
    default: 'Session Analysis - AI-Powered Live Tutoring Analytics',
    template: '%s | Session Analysis',
  },
  description:
    'Real-time engagement analytics, AI coaching nudges, and shareable progress reports that make tutoring measurable.',
  keywords: ['tutoring', 'AI analytics', 'engagement', 'education', 'video tutoring', 'coaching'],
  authors: [{ name: 'Session Analysis' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Session Analysis',
    title: 'Session Analysis - AI-Powered Live Tutoring Analytics',
    description:
      'Real-time engagement analytics, AI coaching nudges, and shareable progress reports that make tutoring measurable.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Session Analysis - AI-Powered Live Tutoring Analytics',
    description:
      'Real-time engagement analytics, AI coaching nudges, and shareable progress reports that make tutoring measurable.',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: 'light' as const }}>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
