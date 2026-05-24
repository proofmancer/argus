import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import Link from 'next/link'
import { ArgusMark } from '@/components/ArgusMark'
import './globals.css'


// Stack Sans Notch is the brand display + UI typeface. Variable font
// covers the full 200..700 weight range from one file, so we register
// it once and let Tailwind / CSS pick the weight per element.
const stackSans = localFont({
  src: './fonts/StackSansNotch-VariableFont_wght.ttf',
  variable: '--font-stack-sans',
  display: 'swap',
  weight: '200 700',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'argus · claude code workspace',
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
      className={`${stackSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-neutral-950 text-neutral-100 flex flex-col">
        <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-semibold lowercase"
            >
              <ArgusMark className="h-5 w-5 text-amber-500" />
              <span className="text-xl leading-none tracking-tight">
                argus
              </span>
            </Link>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
