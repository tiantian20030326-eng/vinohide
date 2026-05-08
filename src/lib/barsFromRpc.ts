import type { Bar, MenuItem, NoiseLevel, VibeTag } from '../types'

/** `get_nearby_bars` 单行 */
export type NearbyRpcRow = {
  id: string
  name: string
  address: string
  city: string
  lng: number
  lat: number
  timezone: string
  noise_level: string | null
  has_na_drinks: boolean
  tonight_playlist: string | null
  floor_plan_url: string | null
  distance_m: number
  plan_count_today: number
  dominant_vibe: string | null
}

/** `get_bar_menu_with_stats` 单行 */
export type MenuStatRow = {
  menu_item_id: string
  name: string
  description: string | null
  price_cny: string | number
  sort_order: number
  intent_count: number
}

export function nearbyRowToBar(row: NearbyRpcRow, menu: MenuItem[]): Bar {
  const nl = row.noise_level as NoiseLevel | null
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    lng: row.lng,
    lat: row.lat,
    timezone: row.timezone,
    noiseLevel: nl ?? undefined,
    hasNaDrinks: row.has_na_drinks,
    tonightPlaylist: row.tonight_playlist ?? undefined,
    floorPlanUrl: row.floor_plan_url ?? undefined,
    menu,
    planCountToday: Number(row.plan_count_today),
    dominantVibe: (row.dominant_vibe as VibeTag | null) ?? undefined,
  }
}

export function menuRowsToItems(rows: MenuStatRow[]): MenuItem[] {
  return rows.map((r) => ({
    id: r.menu_item_id,
    name: r.name,
    priceCny: Number(r.price_cny),
    description: r.description ?? undefined,
    intentCount: Number(r.intent_count),
  }))
}
