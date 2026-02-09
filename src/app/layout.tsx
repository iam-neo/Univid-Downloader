import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { ServiceWorkerRegister } from "@/components/sw-register"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "UniVid Downloader - Download Videos from YouTube, TikTok, Instagram & Facebook",
  description: "Free video downloader for YouTube, TikTok (no watermark), Instagram, and Facebook. Download videos in HD quality. Fast, secure, and privacy-focused.",
  keywords: ["video downloader", "youtube downloader", "tiktok no watermark", "instagram video download", "facebook video download"],
  authors: [{ name: "UniVid" }],
  openGraph: {
    title: "UniVid Downloader",
    description: "Download videos from YouTube, TikTok, Instagram & Facebook",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-right" />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}
