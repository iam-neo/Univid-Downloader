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

// RapidAPI Helpers
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "660e8df9ffmshda83470792f30bep12a0b5jsnc90613c2cfde"
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

async function streamVideo(videoUrl: string, filename: string): Promise<Response> {
    const videoResponse = await fetch(videoUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    })

    if (!videoResponse.ok) {
        throw new Error("Failed to download video stream")
    }

    return new Response(videoResponse.body, {
        headers: {
            "Content-Type": "video/mp4",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": videoResponse.headers.get("content-length") || "",
        },
    })
}

// YouTube downloader
async function downloadYouTube(url: string, quality: string): Promise<Response> {
    try {
        const info = await ytdl.getInfo(url)

        // Find best matching format
        const formats = ytdl.filterFormats(info.formats, "videoandaudio")
        let selectedFormat = formats.find((f) => f.qualityLabel === quality)

        if (!selectedFormat) {
            // Fallback to best available
            selectedFormat = formats[0]
        }

        if (!selectedFormat) {
            throw new Error("No suitable format found")
        }

        const videoStream = ytdl(url, { format: selectedFormat })

        // Convert Node.js readable stream to web ReadableStream
        const webStream = new ReadableStream({
            async start(controller) {
                videoStream.on("data", (chunk: Buffer) => {
                    controller.enqueue(new Uint8Array(chunk))
                })
                videoStream.on("end", () => {
                    controller.close()
                })
                videoStream.on("error", (err: Error) => {
                    controller.error(err)
                })
            },
        })

        const filename = `${info.videoDetails.title.replace(/[^\w\s-]/g, "").substring(0, 50)}.mp4`

        return new Response(webStream, {
            headers: {
                "Content-Type": "video/mp4",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Transfer-Encoding": "chunked",
            },
        })
    } catch (error) {
        console.error("YouTube download error:", error)
        throw new Error("YouTube download is currently unavailable on this server. YouTube blocks requests from cloud servers. Please try TikTok, Instagram, or Facebook videos instead.")
    }
}

// TikTok downloader
async function downloadTikTok(url: string): Promise<Response> {
    try {
        const data = await fetchFromRapidAPI(url)
        let videoUrl = ""

        if (data.links && data.links.length > 0) {
            videoUrl = data.links[0].link
        }

        if (!videoUrl) {
            throw new Error("No video link found from RapidAPI")
        }

        return await streamVideo(videoUrl, "tiktok_video.mp4")
    } catch (error) {
        console.error("TikTok download error:", error)
        throw new Error("Failed to download TikTok video via RapidAPI")
    }
}

// Instagram downloader
async function downloadInstagram(url: string): Promise<Response> {
    try {
        // For Instagram, sometimes RapidAPI returns multiple links (carousel), we take the first video
        const data = await fetchFromRapidAPI(url)
        let videoUrl = ""

        if (data.links && data.links.length > 0) {
            videoUrl = data.links[0].link
        }

        if (!videoUrl) {
            throw new Error("No video link found from RapidAPI")
        }

        return await streamVideo(videoUrl, "instagram_video.mp4")
    } catch (error) {
        console.error("Instagram download error:", error)
        throw new Error("Failed to download Instagram video via RapidAPI")
    }
}

// Facebook downloader
async function downloadFacebook(url: string): Promise<Response> {
    try {
        const data = await fetchFromRapidAPI(url)
        let videoUrl = ""

        if (data.links && data.links.length > 0) {
            // Prefer HD if available
            const hdLink = data.links.find((l: any) => l.quality === "hd")
            videoUrl = hdLink ? hdLink.link : data.links[0].link
        }

        if (!videoUrl) {
            throw new Error("No video link found from RapidAPI")
        }

        return await streamVideo(videoUrl, "facebook_video.mp4")
    } catch (error) {
        console.error("Facebook download error:", error)
        throw new Error("Failed to download Facebook video via RapidAPI")
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { url, quality = "720p" } = body

        if (!url || typeof url !== "string") {
            return NextResponse.json(
                { message: "URL is required" },
                { status: 400 }
            )
        }

        const platform = detectPlatform(url)

        let response
        switch (platform) {
            case "youtube":
                response = await downloadYouTube(url, quality)
                break
            case "tiktok":
                response = await downloadTikTok(url)
                break
            case "instagram":
                response = await downloadInstagram(url)
                break
            case "facebook":
                response = await downloadFacebook(url)
                break
            default:
                return NextResponse.json(
                    { message: "Unsupported platform" },
                    { status: 400 }
                )
        }

        return response
    } catch (error) {
        console.error("Download error:", error)
        return NextResponse.json(
            { message: error instanceof Error ? error.message : "Download failed" },
            { status: 500 }
        )
    }
}
