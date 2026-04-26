import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pulse',
  description: 'Your personal dashboard',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#190336',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-foreground min-h-screen">
        {/* Mobile shell */}
        <div className="flex justify-center min-h-screen" style={{ background: '#0d011e' }}>
          <div className="relative w-full max-w-mobile bg-bg min-h-screen">
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
