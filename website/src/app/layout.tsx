import { Analytics } from '@vercel/analytics/next'
import { RootProvider } from 'fumadocs-ui/provider/next'
import type { Metadata, Viewport } from 'next'
import './global.css'
import { Geist, Geist_Mono } from 'next/font/google'
import { siteConfig } from '@/lib/site-config'
import { getSiteStructuredData, serializeJsonLd } from '@/lib/structured-data'

const geist = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
})

const mono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const viewport: Viewport = {
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: siteConfig.metadataBase,
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  openGraph: {
    siteName: siteConfig.name,
  },
  appleWebApp: {
    title: siteConfig.name,
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
}

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is serialized with `<` escaping in `serializeJsonLd`.
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(getSiteStructuredData()),
          }}
        />
      </head>
      {/* suppressHydrationWarning: browser extensions (ColorZilla et al.) inject
          attributes on <body> before hydration */}
      <body className="flex flex-col min-h-dvh" suppressHydrationWarning>
        {/* Displacement filter for the liquid-glass nav: the map's green
            channel bends the backdrop near the capsule's top/bottom edges
            (128 = no shift). Chromium-only; others get the CSS fallback. */}
        <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute' }}>
          <filter
            id="liquid-glass"
            x="-5%"
            y="-20%"
            width="110%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href="data:image/svg+xml;utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%20preserveAspectRatio='none'%3E%3ClinearGradient%20id='g'%20x1='0'%20y1='0'%20x2='0'%20y2='1'%3E%3Cstop%20offset='0'%20stop-color='%2380ff00'/%3E%3Cstop%20offset='0.18'%20stop-color='%23808000'/%3E%3Cstop%20offset='0.82'%20stop-color='%23808000'/%3E%3Cstop%20offset='1'%20stop-color='%23800000'/%3E%3C/linearGradient%3E%3Crect%20width='100'%20height='100'%20fill='url(%23g)'/%3E%3C/svg%3E"
              preserveAspectRatio="none"
              result="map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale="30"
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feGaussianBlur stdDeviation="3" />
            <feColorMatrix type="saturate" values="1.7" />
          </filter>
        </svg>
        <RootProvider>{children}</RootProvider>
        <Analytics />
      </body>
    </html>
  )
}
