import { NextRequest, NextResponse } from "next/server"
import ytdl from "@nuclearplayer/ytdl-core"

// Platform detection
function detectPlatform(url: string): string {
    if (/(?:youtube\.com|youtu\.be)/i.test(url)) return "youtube"
    if (/tiktok\.com/i.test(url)) return "tiktok"
    if (/instagram\.com/i.test(url)) return "instagram"
    if (/(?:facebook\.com|fb\.watch)/i.test(url)) return "facebook"
    return "unknown"
}

// Extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
        /youtube\.com\/shorts\/([^&\n?#]+)/,
    ]
    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }
    return null
}

// YouTube analyzer - using oEmbed API (works on Vercel) with ytdl-core fallback
async function analyzeYouTube(url: string) {
    const videoId = extractYouTubeId(url)
    if (!videoId) {
        throw new Error("Invalid YouTube URL")
    }

    // Method 1: Try oEmbed API first (reliable on serverless)
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        const oembedResponse = await fetch(oembedUrl)

        if (oembedResponse.ok) {
            const oembedData = await oembedResponse.json()
            return {
                platform: "youtube",
                title: oembedData.title || "YouTube Video",
                thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                duration: 0, // oEmbed doesn't provide duration
                qualities: ["1080p", "720p", "480p", "360p"], // Default quality options
            }
        }
    } catch (oembedError) {
        console.log("oEmbed failed, trying ytdl-core:", oembedError)
    }

    // Method 2: Try ytdl-core as fallback (may not work on Vercel)
    try {
        const info = await ytdl.getInfo(url)
        const formats = ytdl.filterFormats(info.formats, "videoandaudio")

        const qualitySet = new Set<string>()
        formats.forEach((f) => {
            if (f.qualityLabel) {
                qualitySet.add(f.qualityLabel)
            }
        })

        const qualities = Array.from(qualitySet).sort((a, b) => {
            const numA = parseInt(a)
            const numB = parseInt(b)
            return numB - numA
        })

        return {
            platform: "youtube",
            title: info.videoDetails.title,
            thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1]?.url || "",
            duration: parseInt(info.videoDetails.lengthSeconds) || 0,
            qualities: qualities.length > 0 ? qualities : ["720p", "360p"],
        }
    } catch (ytdlError) {
        console.error("ytdl-core also failed:", ytdlError)
    }

    // Method 3: Last resort - return basic info with video ID
    return {
        platform: "youtube",
        title: "YouTube Video",
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration: 0,
        qualities: ["720p", "360p"],
    }
}

// TikTok analyzer (using public data extraction)
async function analyzeTikTok(url: string) {
    try {
        // Extract video ID from URL
        const videoIdMatch = url.match(/video\/(\d+)/) || url.match(/\/v\/(\d+)/)

        // For TikTok, we'll use a simpler approach - fetch the page and parse meta tags
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        })

        if (!response.ok) {
            throw new Error("Failed to fetch TikTok page")
        }

        const html = await response.text()

        // Parse title from og:title meta tag
        const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/)
        const title = titleMatch ? titleMatch[1] : "TikTok Video"

        // Parse thumbnail from og:image meta tag
        const thumbMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/)
        const thumbnail = thumbMatch ? thumbMatch[1] : ""

        // Try to find duration in the page data
        const durationMatch = html.match(/"duration":(\d+)/)
        const duration = durationMatch ? parseInt(durationMatch[1]) : 0

        return {
            platform: "tiktok",
            title: title.substring(0, 100),
            thumbnail,
            duration,
            qualities: ["HD", "SD"], // TikTok typically has HD and SD options
        }
    } catch (error) {
        console.error("TikTok analysis error:", error)
        throw new Error("Failed to analyze TikTok video. It may be private.")
    }
}

// Instagram analyzer
async function analyzeInstagram(url: string) {
    try {
        // Extract shortcode from URL
        const shortcodeMatch = url.match(/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/)
        if (!shortcodeMatch) {
            throw new Error("Invalid Instagram URL")
        }

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        })

        if (!response.ok) {
            throw new Error("Failed to fetch Instagram page")
        }

        const html = await response.text()

        // Parse meta tags
        const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/)
        const thumbMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/)

        return {
            platform: "instagram",
            title: titleMatch ? titleMatch[1].substring(0, 100) : "Instagram Video",
            thumbnail: thumbMatch ? thumbMatch[1] : "",
            duration: 0,
            qualities: ["HD", "SD"],
        }
    } catch (error) {
        console.error("Instagram analysis error:", error)
        throw new Error("Failed to analyze Instagram video. It may be private or require login.")
    }
}

// Facebook analyzer
async function analyzeFacebook(url: string) {
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        })

        if (!response.ok) {
            throw new Error("Failed to fetch Facebook page")
        }

        const html = await response.text()

        // Parse meta tags
        const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/)
        const thumbMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/)

        return {
            platform: "facebook",
            title: titleMatch ? titleMatch[1].substring(0, 100) : "Facebook Video",
            thumbnail: thumbMatch ? thumbMatch[1] : "",
            duration: 0,
            qualities: ["HD", "SD"],
        }
    } catch (error) {
        console.error("Facebook analysis error:", error)
        throw new Error("Failed to analyze Facebook video. It may be private.")
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { url } = body

        if (!url || typeof url !== "string") {
            return NextResponse.json(
                { message: "URL is required" },
                { status: 400 }
            )
        }

        const platform = detectPlatform(url)

        let result
        switch (platform) {
            case "youtube":
                result = await analyzeYouTube(url)
                break
            case "tiktok":
                result = await analyzeTikTok(url)
                break
            case "instagram":
                result = await analyzeInstagram(url)
                break
            case "facebook":
                result = await analyzeFacebook(url)
                break
            default:
                return NextResponse.json(
                    { message: "Unsupported platform. Use YouTube, TikTok, Instagram, or Facebook." },
                    { status: 400 }
                )
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error("Analysis error:", error)
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Analysis failed" },
            { status: 500 }
        )
    }
}
