import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zugcafé',
  description: 'Connect with people nearby — trains, cafés, parks',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Zugcafé' },
}

export const viewport: Viewport = {
  themeColor: '#0d0d0d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{__html:`
          if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}
        `}} />
      </body>
    </html>
  )
}
