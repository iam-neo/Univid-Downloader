"use client"

import * as React from "react"
import Image from "next/image"
import { Download, Loader2, X, Youtube, Instagram, Facebook, Music2, AlertCircle, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useDownloadStore, formatDuration, type Platform, type VideoInfo } from "@/lib/store"
import { toast } from "sonner"

const platformIcons: Record<Platform, React.ReactNode> = {
    youtube: <Youtube className="h-4 w-4" />,
    tiktok: <Music2 className="h-4 w-4" />,
    instagram: <Instagram className="h-4 w-4" />,
    facebook: <Facebook className="h-4 w-4" />,
    unknown: null,
}

const platformColors: Record<Platform, string> = {
    youtube: "bg-red-500 hover:bg-red-600",
    tiktok: "bg-black hover:bg-gray-800",
    instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
    facebook: "bg-blue-600 hover:bg-blue-700",
    unknown: "bg-gray-500",
}

interface VideoCardProps {
    video: VideoInfo
}

export function VideoCard({ video }: VideoCardProps) {
    const { updateVideo, removeVideo } = useDownloadStore()
    const [isDownloading, setIsDownloading] = React.useState(false)

    const handleDownload = async () => {
        setIsDownloading(true)
        updateVideo(video.id, { status: "downloading", progress: 0 })

        try {
            const response = await fetch("/api/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: video.url,
                    quality: video.selectedQuality,
                    platform: video.platform,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.message || "Download failed")
            }

            // Get the filename from headers or generate one
            const contentDisposition = response.headers.get("content-disposition")
            let filename = `${video.title || "video"}.mp4`
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?(.+)"?/)
                if (match) filename = match[1]
            }

            // Stream download with progress
            const reader = response.body?.getReader()
            const contentLength = parseInt(response.headers.get("content-length") || "0")

            if (!reader) throw new Error("Failed to read response")

            const chunks: BlobPart[] = []
            let receivedLength = 0

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                chunks.push(value)
                receivedLength += value.length

                if (contentLength > 0) {
                    const progress = Math.round((receivedLength / contentLength) * 100)
                    updateVideo(video.id, { progress })
                }
            }

            // Create blob and download
            const blob = new Blob(chunks, { type: "video/mp4" })
            const url = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            updateVideo(video.id, { status: "completed", progress: 100 })
            toast.success("Download complete!")
        } catch (error) {
            updateVideo(video.id, {
                status: "error",
                error: error instanceof Error ? error.message : "Download failed",
            })
            toast.error(error instanceof Error ? error.message : "Download failed")
        } finally {
            setIsDownloading(false)
        }
    }

    const handleQualityChange = (quality: string) => {
        updateVideo(video.id, { selectedQuality: quality })
    }

    const isReady = video.status === "ready"
    const isDownloadingState = video.status === "downloading"
    const isCompleted = video.status === "completed"
    const isError = video.status === "error"
    const isAnalyzing = video.status === "analyzing"

    return (
        <Card className="group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
            {/* Remove button */}
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-background/80 backdrop-blur-sm"
                onClick={() => removeVideo(video.id)}
            >
                <X className="h-4 w-4" />
            </Button>

            <CardContent className="p-4">
                <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                        {video.thumbnail ? (
                            <Image
                                src={video.thumbnail}
                                alt={video.title || "Video thumbnail"}
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        )}

                        {/* Duration badge */}
                        {video.duration > 0 && (
                            <Badge className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5">
                                {formatDuration(video.duration)}
                            </Badge>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {/* Platform badge */}
                        <div className="flex items-center gap-2 mb-1">
                            <Badge className={`${platformColors[video.platform]} text-white text-xs`}>
                                {platformIcons[video.platform]}
                                <span className="ml-1 capitalize">{video.platform}</span>
                            </Badge>

                            {video.platform === "tiktok" && (
                                <Badge variant="outline" className="text-xs text-green-500 border-green-500">
                                    No Watermark
                                </Badge>
                            )}
                        </div>

                        {/* Title */}
                        <h3 className="font-medium text-sm leading-snug truncate mb-2">
                            {video.title || (isAnalyzing ? "Analyzing video..." : "Unknown video")}
                        </h3>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            {isReady && (
                                <>
                                    <Select
                                        value={video.selectedQuality}
                                        onValueChange={handleQualityChange}
                                    >
                                        <SelectTrigger className="w-24 h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {video.qualities.map((q) => (
                                                <SelectItem key={q} value={q} className="text-xs">
                                                    {q}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Button
                                        size="sm"
                                        className="h-8 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                                        onClick={handleDownload}
                                        disabled={isDownloading}
                                    >
                                        <Download className="h-3 w-3 mr-1" />
                                        Download
                                    </Button>
                                </>
                            )}

                            {isAnalyzing && (
                                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Fetching video info...</span>
                                </div>
                            )}

                            {isDownloadingState && (
                                <div className="flex-1">
                                    <Progress value={video.progress} className="h-2" />
                                    <span className="text-xs text-muted-foreground mt-1">
                                        {video.progress}% downloaded
                                    </span>
                                </div>
                            )}

                            {isCompleted && (
                                <div className="flex items-center gap-2 text-green-500 text-sm">
                                    <Check className="h-4 w-4" />
                                    <span>Downloaded</span>
                                </div>
                            )}

                            {isError && (
                                <div className="flex items-center gap-2 text-destructive text-sm">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>{video.error || "Error occurred"}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export function VideoQueue() {
    const { videos, clearCompleted } = useDownloadStore()
    const completedCount = videos.filter((v) => v.status === "completed").length

    if (videos.length === 0) {
        return null
    }

    return (
        <div className="w-full max-w-2xl mx-auto mt-8">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Download Queue</h2>
                {completedCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearCompleted}>
                        Clear completed
                    </Button>
                )}
            </div>

            <div className="space-y-3">
                {videos.map((video) => (
                    <VideoCard key={video.id} video={video} />
                ))}
            </div>
        </div>
    )
}
