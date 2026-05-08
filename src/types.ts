export type VibeTag = 'alone' | 'social' | 'celebrate' | 'tasting'

export type NoiseLevel = 'quiet' | 'medium' | 'loud'

export type MembershipTier = 'free' | 'silver' | 'gold' | 'diamond'

export interface MenuItem {
  id: string
  name: string
  priceCny: number
  description?: string
  /** 今日意向人数（MVP 可来自 mock 或 RPC） */
  intentCount?: number
}

export interface Bar {
  id: string
  name: string
  address: string
  city: string
  lng: number
  lat: number
  timezone: string
  noiseLevel?: NoiseLevel
  hasNaDrinks: boolean
  tonightPlaylist?: string
  floorPlanUrl?: string
  menu: MenuItem[]
  /** 今日计划到店人数（mock / RPC） */
  planCountToday: number
  /** 该店当前匿名氛围聚合（mock：用于 Marker 色调） */
  dominantVibe?: VibeTag
}

export const VIBE_OPTIONS: { id: VibeTag; label: string; emoji: string }[] = [
  { id: 'alone', emoji: '👻', label: '独自放空' },
  { id: 'social', emoji: '⚡', label: '想认识新朋友' },
  { id: 'celebrate', emoji: '🎉', label: '庆祝大事' },
  { id: 'tasting', emoji: '🍷', label: '只为这杯酒' },
]

export function vibeHue(v: VibeTag | undefined): string {
  if (!v) return '#6c6c8a'
  switch (v) {
    case 'alone':
      return '#4a90d9'
    case 'social':
      return '#e8a23c'
    case 'celebrate':
      return '#c94ce8'
    case 'tasting':
      return '#64b5a6'
    default:
      return '#8264a0'
  }
}
