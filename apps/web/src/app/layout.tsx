import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SessionProvider } from '@/components/session-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brücke One',
  description: 'Emergency coordination operations dashboard',
};

/** Defines the document structure and shared global styles for the dashboard. */
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body><SessionProvider>{children}</SessionProvider></body>
    </html>
  );
}
