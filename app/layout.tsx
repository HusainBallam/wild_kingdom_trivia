import type { Metadata, Viewport } from 'next';
import { Bungee, Patrick_Hand, Special_Elite } from 'next/font/google';
import './globals.css';

const display = Bungee({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

const body = Patrick_Hand({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

const stamp = Special_Elite({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-stamp',
});

export const metadata: Metadata = {
  title: 'Wild Kingdom Trivia',
  description: 'Test your animal kingdom knowledge with 10 timed questions.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${stamp.variable}`}>
      <body>{children}</body>
    </html>
  );
}
