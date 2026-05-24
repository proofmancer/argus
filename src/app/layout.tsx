import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Argus · Claude Code workspace',
  description:
    'Local desktop-class workspace for orchestrating Claude Code agents, pinning skills, and watching what they do.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-neutral-950 text-neutral-100 flex flex-col">
        <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
              <span className="tracking-tight">Argus</span>
              <span className="text-xs font-normal text-neutral-500">
                claude code workspace
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-xs text-neutral-400">
              <a
                href="https://github.com/anthropics/claude-code"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-neutral-200"
              >
                claude-code docs
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
