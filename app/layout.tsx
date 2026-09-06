import type { Metadata } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import './globals.css';

const display = Cormorant_Garamond({ variable: '--font-display', subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'] });
const body = Manrope({ variable: '--font-body', subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://nathaniel-morgan-rsvp.podium1racin-1044.chatgpt.site'),
  title: 'RSVP | Nathaniel & Morgan',
  description: 'Kindly respond to Nathaniel and Morgan’s wedding invitation for August 21, 2027 in Montréal.',
  openGraph: {
    title: 'Nathaniel & Morgan — Wedding RSVP',
    description: 'Kindly respond for August 21, 2027 in Montréal.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Nathaniel and Morgan — August 21, 2027 in Montréal' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nathaniel & Morgan — Wedding RSVP',
    description: 'Kindly respond for August 21, 2027 in Montréal.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${display.variable} ${body.variable} antialiased`}>{children}</body></html>;
}
