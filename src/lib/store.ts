import { create } from 'zustand'

export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'unknown'

export interface VideoInfo {
    id: string
    url: string
    platform: Platform
    title: string
    thumbnail: string
    duration: number
    qualities: string[]
    selectedQuality: string
    status: 'pending' | 'analyzing' | 'ready' | 'downloading' | 'completed' | 'error'
    progress: number
    error?: string
}

interface DownloadStore {
    videos: VideoInfo[]
    addVideo: (url: string) => string
    updateVideo: (id: string, updates: Partial<VideoInfo>) => void
    removeVideo: (id: string) => void
    clearCompleted: () => void
}

export const useDownloadStore = create<DownloadStore>((set) => ({
    videos: [],

    addVideo: (url: string) => {
        const id = crypto.randomUUID()
        const platform = detectPlatform(url)

        set((state) => ({
            videos: [
                ...state.videos,
                {
                    id,
                    url,
                    platform,
                    title: '',
                    thumbnail: '',
                    duration: 0,
                    qualities: [],
                    selectedQuality: '720p',
                    status: 'pending',
                    progress: 0,
                },
            ],
        }))

        return id
    },

    updateVideo: (id: string, updates: Partial<VideoInfo>) => {
        set((state) => ({
            videos: state.videos.map((v) =>
                v.id === id ? { ...v, ...updates } : v
            ),
        }))
    },

    removeVideo: (id: string) => {
        set((state) => ({
            videos: state.videos.filter((v) => v.id !== id),
        }))
    },

    clearCompleted: () => {
        set((state) => ({
            videos: state.videos.filter((v) => v.status !== 'completed'),
        }))
    },
}))

export function detectPlatform(url: string): Platform {
    const patterns: Record<Platform, RegExp> = {
        youtube: /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)/i,
        tiktok: /(?:tiktok\.com\/@[\w.-]+\/video\/|vm\.tiktok\.com\/)/i,
        instagram: /(?:instagram\.com\/(?:p|reel|reels)\/)/i,
        facebook: /(?:facebook\.com\/.*\/videos\/|fb\.watch\/)/i,
        unknown: /.*/,
    }

    for (const [platform, regex] of Object.entries(patterns)) {
        if (platform !== 'unknown' && regex.test(url)) {
            return platform as Platform
        }
    }

    return 'unknown'
}

export function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function getPlatformColor(platform: Platform): string {
    const colors: Record<Platform, string> = {
        youtube: 'bg-red-500',
        tiktok: 'bg-black dark:bg-white dark:text-black',
        instagram: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500',
        facebook: 'bg-blue-600',
        unknown: 'bg-gray-500',
    }
    return colors[platform]
}
