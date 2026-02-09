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

// TikTok downloader (watermark-free)
async function downloadTikTok(url: string): Promise<Response> {
    try {
        // Fetch the TikTok page to extract video data
        const pageResponse = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            },
        })

        if (!pageResponse.ok) {
            throw new Error("Failed to fetch TikTok page")
        }

        const html = await pageResponse.text()

        // Try to find the video URL in different formats
        // Method 1: Look for playAddr in the page data (no watermark)
        let videoUrl = null

        // Try SIGI_STATE pattern (newer TikTok pages)
        const sigiMatch = html.match(/<script id="SIGI_STATE"[^>]*>([^<]+)<\/script>/)
        if (sigiMatch) {
            try {
                const data = JSON.parse(sigiMatch[1])
                const itemModule = data?.ItemModule
                if (itemModule) {
                    const videoData = Object.values(itemModule)[0] as Record<string, unknown>
                    const video = videoData?.video as Record<string, string>
                    if (video?.playAddr) {
                        videoUrl = video.playAddr
                    } else if (video?.downloadAddr) {
                        videoUrl = video.downloadAddr
                    }
                }
            } catch {
                // Continue to next method
            }
        }

        // Method 2: Look for __UNIVERSAL_DATA_FOR_REHYDRATION__ pattern
        if (!videoUrl) {
            const universalMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/)
            if (universalMatch) {
                try {
                    const data = JSON.parse(universalMatch[1])
                    const defaultScope = data?.__DEFAULT_SCOPE__
                    const itemInfo = defaultScope?.["webapp.video-detail"]?.itemInfo?.itemStruct
                    if (itemInfo?.video?.playAddr) {
                        videoUrl = itemInfo.video.playAddr
                    } else if (itemInfo?.video?.bitrateInfo?.[0]?.PlayAddr?.UrlList?.[0]) {
                        videoUrl = itemInfo.video.bitrateInfo[0].PlayAddr.UrlList[0]
                    }
                } catch {
                    // Continue to fallback
                }
            }
        }

        // Method 3: Regex fallback for video URL in page
        if (!videoUrl) {
            const urlMatch = html.match(/"playAddr":"([^"]+)"/) || html.match(/"downloadAddr":"([^"]+)"/)
            if (urlMatch) {
                videoUrl = urlMatch[1].replace(/\\u002F/g, "/").replace(/\\/g, "")
            }
        }

        // Method 4: og:video meta tag (may have watermark)
        if (!videoUrl) {
            const ogVideoMatch = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]*)"/)
            if (ogVideoMatch) {
                videoUrl = ogVideoMatch[1]
            }
        }

        if (!videoUrl) {
            throw new Error("Could not extract video URL. The video may be private or TikTok blocked access.")
        }

        // Decode URL if needed
        videoUrl = decodeURIComponent(videoUrl)

        // Download the video
        const videoResponse = await fetch(videoUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.tiktok.com/",
            },
        })

        if (!videoResponse.ok) {
            throw new Error("Failed to download video from TikTok")
        }

        return new Response(videoResponse.body, {
            headers: {
                "Content-Type": "video/mp4",
                "Content-Disposition": `attachment; filename="tiktok_video.mp4"`,
                "Content-Length": videoResponse.headers.get("content-length") || "",
            },
        })
    } catch (error) {
        console.error("TikTok download error:", error)
        throw new Error("Failed to download TikTok video. It may be private or region-locked.")
    }
}

// Instagram downloader
async function downloadInstagram(url: string): Promise<Response> {
    try {
        const pageResponse = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        })

        if (!pageResponse.ok) {
            throw new Error("Failed to fetch Instagram page")
        }

        const html = await pageResponse.text()

        // Try to find video URL in og:video meta tag
        let videoUrl = null
        const ogVideoMatch = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]*)"/)
        if (ogVideoMatch) {
            videoUrl = ogVideoMatch[1]
        }

        // Try content_url pattern
        if (!videoUrl) {
            const contentMatch = html.match(/"contentUrl":"([^"]+)"/)
            if (contentMatch) {
                videoUrl = contentMatch[1].replace(/\\u0026/g, "&")
            }
        }

        // Try video_url pattern
        if (!videoUrl) {
            const videoMatch = html.match(/"video_url":"([^"]+)"/)
            if (videoMatch) {
                videoUrl = videoMatch[1].replace(/\\u0026/g, "&")
            }
        }

        if (!videoUrl) {
            throw new Error("Could not extract video URL. Instagram videos often require login.")
        }

        const videoResponse = await fetch(videoUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.instagram.com/",
            },
        })

        if (!videoResponse.ok) {
            throw new Error("Failed to download video from Instagram")
        }

        return new Response(videoResponse.body, {
            headers: {
                "Content-Type": "video/mp4",
                "Content-Disposition": `attachment; filename="instagram_video.mp4"`,
                "Content-Length": videoResponse.headers.get("content-length") || "",
            },
        })
    } catch (error) {
        console.error("Instagram download error:", error)
        throw new Error("Failed to download Instagram video. It may require login or be private.")
    }
}

// Facebook downloader
async function downloadFacebook(url: string): Promise<Response> {
    try {
        const pageResponse = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        })

        if (!pageResponse.ok) {
            throw new Error("Failed to fetch Facebook page")
        }

        const html = await pageResponse.text()

        // Try to find video URL - Facebook encodes these
        let videoUrl = null

        // Try HD first
        const hdMatch = html.match(/hd_src:"([^"]+)"/) || html.match(/"hd_src":"([^"]+)"/)
        if (hdMatch) {
            videoUrl = hdMatch[1].replace(/\\/g, "")
        }

        // Fallback to SD
        if (!videoUrl) {
            const sdMatch = html.match(/sd_src:"([^"]+)"/) || html.match(/"sd_src":"([^"]+)"/)
            if (sdMatch) {
                videoUrl = sdMatch[1].replace(/\\/g, "")
            }
        }

        // Try og:video
        if (!videoUrl) {
            const ogMatch = html.match(/<meta[^>]*property="og:video"[^>]*content="([^"]*)"/)
            if (ogMatch) {
                videoUrl = ogMatch[1]
            }
        }

        if (!videoUrl) {
            throw new Error("Could not extract video URL. Facebook videos may require login.")
        }

        const videoResponse = await fetch(videoUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.facebook.com/",
            },
        })

        if (!videoResponse.ok) {
            throw new Error("Failed to download video from Facebook")
        }

        return new Response(videoResponse.body, {
            headers: {
                "Content-Type": "video/mp4",
                "Content-Disposition": `attachment; filename="facebook_video.mp4"`,
                "Content-Length": videoResponse.headers.get("content-length") || "",
            },
        })
    } catch (error) {
        console.error("Facebook download error:", error)
        throw new Error("Failed to download Facebook video. It may require login or be private.")
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
