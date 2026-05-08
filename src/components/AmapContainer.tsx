import { useEffect, useRef, useCallback } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'
import type { Bar } from '../types'
import { vibeHue } from '../types'

export interface MapCenter {
  lng: number
  lat: number
}

interface AmapContainerProps {
  bars: Bar[]
  center: MapCenter
  selectedId: string | null
  onSelectBar: (id: string) => void
}

/** 高德地图容器；未配置 `VITE_AMAP_KEY` 时由父级展示占位 UI */
export function AmapContainer({
  bars,
  center,
  selectedId,
  onSelectBar,
}: AmapContainerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const amapNSRef = useRef<any>(null)
  const markersRef = useRef<unknown[]>([])
  const onSelectRef = useRef(onSelectBar)
  onSelectRef.current = onSelectBar

  const redrawMarkers = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (AMap: any, map: any) => {
      for (const m of markersRef.current) {
        try {
          map.remove(m)
        } catch {
          /* ignore */
        }
      }
      markersRef.current = []
      for (const b of bars) {
        const color = vibeHue(b.dominantVibe)
        const marker = new AMap.Marker({
          position: [b.lng, b.lat],
          title: b.name,
          content: `<div style="
              width:22px;height:22px;border-radius:50%;
              background:${color};box-shadow:0 0 0 3px rgba(26,26,46,.55);
              border:2px solid #1a1a2e;"></div>`,
          offset: new AMap.Pixel(-11, -11),
        })
        marker.on('click', () => onSelectRef.current(b.id))
        map.add(marker)
        markersRef.current.push(marker)
      }
    },
    [bars],
  )

  useEffect(() => {
    const key = import.meta.env.VITE_AMAP_KEY
    if (!key || !hostRef.current) return

    let disposed = false

    AMapLoader.load({ key, version: '2.0' }).then((AMap) => {
      if (disposed || !hostRef.current) return
      amapNSRef.current = AMap
      const map = new AMap.Map(hostRef.current, {
        zoom: 12,
        center: [center.lng, center.lat],
        viewMode: '2D',
      })
      mapRef.current = map
      redrawMarkers(AMap, map)
    })

    return () => {
      disposed = true
      for (const m of markersRef.current) {
        try {
          mapRef.current?.remove(m)
        } catch {
          /* ignore */
        }
      }
      markersRef.current = []
      try {
        mapRef.current?.destroy()
      } catch {
        /* ignore */
      }
      mapRef.current = null
      amapNSRef.current = null
    }
  }, [center.lat, center.lng, redrawMarkers])

  useEffect(() => {
    const map = mapRef.current
    const AMap = amapNSRef.current
    if (!map || !AMap) return
    redrawMarkers(AMap, map)
  }, [bars, redrawMarkers])

  useEffect(() => {
    const map = mapRef.current as { panTo?: (lngLat: [number, number]) => void } | null
    if (!map?.panTo) return
    const b = bars.find((x) => x.id === selectedId)
    if (b) map.panTo([b.lng, b.lat])
  }, [bars, selectedId])

  return (
    <div
      ref={hostRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 280,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    />
  )
}
