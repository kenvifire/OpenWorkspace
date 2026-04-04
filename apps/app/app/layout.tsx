import type { Metadata } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import './globals.css';

const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['400', '600', '700', '800'] });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });

export const metadata: Metadata = {
  title: 'OpenWorkspace',
  description: 'The workspace for human and AI agent collaboration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${syne.variable} ${dmSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
