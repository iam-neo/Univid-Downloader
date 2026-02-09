"use client"

import * as React from "react"
import { Clipboard, Loader2, Plus, Youtube, Instagram, Facebook, Music2, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { detectPlatform, useDownloadStore, type Platform } from "@/lib/store"
import { toast } from "sonner"

const platformIcons: Record<Platform, React.ReactNode> = {
    youtube: <Youtube className="h-5 w-5 text-red-500" />,
    tiktok: <Music2 className="h-5 w-5" />,
    instagram: <Instagram className="h-5 w-5 text-pink-500" />,
    facebook: <Facebook className="h-5 w-5 text-blue-500" />,
    unknown: <HelpCircle className="h-5 w-5 text-gray-400" />,
}

export function UrlInput() {
    const [url, setUrl] = React.useState("")
    const [isAnalyzing, setIsAnalyzing] = React.useState(false)
    const { videos, addVideo, updateVideo } = useDownloadStore()

    const currentPlatform = url.trim() ? detectPlatform(url) : null
    const maxVideos = 5

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText()
            setUrl(text)
        } catch {
            toast.error("Could not read clipboard")
        }
    }

    const handleAnalyze = async () => {
        if (!url.trim()) {
            toast.error("Please enter a URL")
            return
        }

        if (currentPlatform === "unknown") {
            toast.error("Unsupported platform. Use YouTube, TikTok, Instagram, or Facebook.")
            return
        }

        if (videos.length >= maxVideos) {
            toast.error(`Maximum ${maxVideos} videos in queue`)
            return
        }

        // Check for duplicates
        if (videos.some((v) => v.url === url)) {
            toast.error("This URL is already in the queue")
            return
        }

        setIsAnalyzing(true)
        const videoId = addVideo(url)

        try {
            updateVideo(videoId, { status: "analyzing" })

            const response = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || "Failed to analyze video")
            }

            const data = await response.json()

            updateVideo(videoId, {
                title: data.title,
                thumbnail: data.thumbnail,
                duration: data.duration,
                qualities: data.qualities,
                selectedQuality: data.qualities.includes("720p") ? "720p" : data.qualities[0],
                status: "ready",
            })

            setUrl("")
            toast.success("Video added to queue!")
        } catch (error) {
            updateVideo(videoId, {
                status: "error",
                error: error instanceof Error ? error.message : "Analysis failed",
            })
            toast.error(error instanceof Error ? error.message : "Failed to analyze video")
        } finally {
            setIsAnalyzing(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !isAnalyzing) {
            handleAnalyze()
        }
    }

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div className="relative flex items-center gap-2 p-2 bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl">
                {/* Platform indicator */}
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/50">
                    {currentPlatform ? platformIcons[currentPlatform] : (
                        <span className="text-muted-foreground text-sm">🔗</span>
                    )}
                </div>

                {/* Input field */}
                <Input
                    type="url"
                    placeholder="Paste video URL here..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-muted-foreground/60"
                    disabled={isAnalyzing}
                />

                {/* Paste button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={handlePaste}
                    disabled={isAnalyzing}
                >
                    <Clipboard className="h-4 w-4" />
                </Button>

                {/* Analyze button */}
                <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !url.trim()}
                    className="h-10 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-300"
                >
                    {isAnalyzing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Plus className="h-4 w-4 mr-1" />
                    )}
                    {isAnalyzing ? "Analyzing..." : "Analyze"}
                </Button>
            </div>

            {/* Queue counter */}
            <div className="mt-3 text-center text-sm text-muted-foreground">
                {videos.length > 0 ? (
                    <span>{videos.length} / {maxVideos} videos in queue</span>
                ) : (
                    <span>Supports YouTube, TikTok, Instagram, Facebook</span>
                )}
            </div>
        </div>
    )
}
