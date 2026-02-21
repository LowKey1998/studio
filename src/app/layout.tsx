import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { FacebookPixel } from '@/components/facebook-pixel';
import { ThemeProvider } from '@/components/theme-provider';
import { FCMManager } from '@/components/fcm-manager';
import { OfflineIndicator } from '@/components/offline-indicator';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: 'Edutrack360',
  description: 'A modern student management system.',
  manifest: '/manifest.json',
  themeColor: '#4c1d95',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Edutrack360',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-body antialiased`}>
        <ThemeProvider>
            {children}
            <Toaster />
            <FacebookPixel />
            <FCMManager />
            <OfflineIndicator />
        </ThemeProvider>
      </body>
    </html>
  );
}
