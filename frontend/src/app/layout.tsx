import type { Metadata } from 'next'
import { JetBrains_Mono, Montserrat } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Header } from '@/components/Header'

const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'CyOps Showcase',
  description: 'Community portfolio hub for CyOps competition submissions.',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${mono.variable}`}>
      <head>
        <link rel="dns-prefetch" href="https://platform.twitter.com" />
        <link rel="dns-prefetch" href="https://cdn.syndication.twimg.com" />
        <link rel="dns-prefetch" href="https://pbs.twimg.com" />
        <link rel="preconnect" href="https://platform.twitter.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.syndication.twimg.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://pbs.twimg.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <Script
          id="x-widgets"
          src="https://platform.twitter.com/widgets.js"
          strategy="afterInteractive"
          data-x-widgets="true"
        />
        <div className="pointer-events-none fixed inset-0 bg-grid bg-[size:44px_44px] opacity-40" />
        <div className="relative z-10">
          <Header />
          <main>{children}</main>
        </div>
      </body>
    </html>
  )
}
