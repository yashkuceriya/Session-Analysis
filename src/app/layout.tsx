import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'Session Analysis - AI-Powered Live Tutoring Insights',
  description: 'Real-time engagement analysis and coaching for video tutoring sessions',
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
