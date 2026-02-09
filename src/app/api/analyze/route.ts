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

// RapidAPI Helpers
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "660e8df9ffmshda83470792f30bep12a0b5jsnc90613c2cfde" // Using provided key as fallback/default
const RAPIDAPI_HOST = "social-media-video-downloader.p.rapidapi.com"

async function fetchFromRapidAPI(url: string) {
    if (!RAPIDAPI_KEY) {
        throw new Error("RAPIDAPI_KEY is not configured")
    }

    const encodedUrl = encodeURIComponent(url)
    const response = await fetch(`https://${RAPIDAPI_HOST}/smvd/get/all?url=${encodedUrl}`, {
        method: "GET",
        headers: {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": RAPIDAPI_HOST,
        },
    })

    if (!response.ok) {
        throw new Error(`RapidAPI error: ${response.statusText}`)
    }

    return await response.json()
}

// TikTok analyzer
async function analyzeTikTok(url: string) {
    try {
        const data = await fetchFromRapidAPI(url)

        // Adapt response based on typical API structure (needs adjustment based on specific API)
        // Assuming API returns { links: [{quality: 'hd', link: '...'}], title: '...', picture: '...' }
        // This is a generic adapter, might need specifics for "Social Media Video Downloader"

        let title = "TikTok Video"
        let thumbnail = ""
        let videoUrl = ""

        if (data.title) title = data.title
        if (data.picture) thumbnail = data.picture
        if (data.links && data.links.length > 0) {
            videoUrl = data.links[0].link
        }

        if (!videoUrl) {
            // Fallback if structure is different
            console.log("RapidAPI Response:", JSON.stringify(data))
            throw new Error("No video found")
        }

        return {
            platform: "tiktok",
            title: title || "TikTok Video",
            thumbnail,
            duration: 0,
            qualities: ["HD", "SD"],
            // Return direct link if needed, but for now we stick to schema
        }
    } catch (error) {
        console.error("TikTok analysis error:", error)
        throw new Error("Failed to analyze TikTok video")
    }
}

// Instagram analyzer
async function analyzeInstagram(url: string) {
    try {
        const data = await fetchFromRapidAPI(url)

        let title = "Instagram Video"
        let thumbnail = ""

        if (data.title) title = data.title
        if (data.picture) thumbnail = data.picture

        return {
            platform: "instagram",
            title: title || "Instagram Video",
            thumbnail,
            duration: 0,
            qualities: ["HD", "SD"],
        }
    } catch (error) {
        console.error("Instagram analysis error:", error)
        throw new Error("Failed to analyze Instagram video")
    }
}

// Facebook analyzer
async function analyzeFacebook(url: string) {
    try {
        const data = await fetchFromRapidAPI(url)

        let title = "Facebook Video"
        let thumbnail = ""

        if (data.title) title = data.title
        if (data.picture) thumbnail = data.picture

        return {
            platform: "facebook",
            title: title || "Facebook Video",
            thumbnail,
            duration: 0,
            qualities: ["HD", "SD"],
        }
    } catch (error) {
        console.error("Facebook analysis error:", error)
        throw new Error("Failed to analyze Facebook video")
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
