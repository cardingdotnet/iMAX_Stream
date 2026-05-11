import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

/**
 * Type system:
 *   --font-sans   → Inter         (UI, body, controls)
 *   --font-serif  → Fraunces      (headlines, masthead, brand)
 *   --font-arabic → Plex Sans Arabic (any [lang="ar"] text)
 */
const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const serif = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  weight: 'variable',
  axes: ['opsz', 'SOFT'],
  display: 'swap',
});

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-arabic',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EgMax — Music, beautifully streamed',
  description:
    'Build a playlist, share a stream URL anywhere — IMVU rooms, VLC, browsers, mobile.',
  applicationName: 'EgMax',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0B0B0E',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${arabic.variable}`}
    >
      <body className="bg-ink-900 text-cream-100 antialiased">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1A1A20',
              color: '#F5F1EA',
              border: '1px solid rgba(245, 241, 234, 0.10)',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 500,
              padding: '10px 14px',
              boxShadow: '0 8px 24px -8px rgba(0,0,0,0.6)',
            },
            success: {
              iconTheme: {
                primary: '#FF5E3A',
                secondary: '#F5F1EA',
              },
            },
            error: {
              iconTheme: {
                primary: '#F87171',
                secondary: '#F5F1EA',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
