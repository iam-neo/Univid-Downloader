import { UrlInput } from "@/components/url-input"
import { VideoQueue } from "@/components/video-card"
import { ThemeToggle } from "@/components/theme-toggle"
import { Download, Shield, Zap, Globe } from "lucide-react"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Download className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-xl">
              Uni<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">Vid</span>
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Zap className="h-4 w-4" />
            <span>TikTok videos without watermark!</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
            Download Videos from{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600">
              Any Platform
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Free, fast, and secure video downloader for YouTube, TikTok, Instagram, and Facebook.
            No registration required. Privacy-focused.
          </p>

          {/* URL Input */}
          <UrlInput />
        </div>
      </section>

      {/* Video Queue */}
      <section className="px-4 pb-16">
        <div className="container mx-auto">
          <VideoQueue />
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 border-t border-border/50">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Lightning Fast"
              description="Direct streaming downloads with no server storage. Optimized for all connection speeds."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Privacy First"
              description="No data stored, no tracking, no login required. Your downloads stay private."
            />
            <FeatureCard
              icon={<Globe className="h-6 w-6" />}
              title="Multi-Platform"
              description="YouTube, TikTok (no watermark!), Instagram, and Facebook. All in one place."
            />
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <footer className="py-8 px-4 border-t border-border/50 bg-muted/30">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p className="mb-2">
            <strong>Disclaimer:</strong> This tool is for personal, fair-use only.
            Please respect content creators and copyright laws.
          </p>
          <p>
            © {new Date().getFullYear()} UniVid Downloader. Not affiliated with YouTube, TikTok, Instagram, or Facebook.
          </p>
        </div>
      </footer>
    </main>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
