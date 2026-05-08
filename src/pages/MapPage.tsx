import { useCallback, useEffect, useMemo, useState } from 'react'
import { MOCK_BARS } from '../data/mockBars'
import type { VibeTag } from '../types'
import { AmapContainer } from '../components/AmapContainer'
import { BarSheet } from '../components/BarSheet'
import { getSupabase } from '../lib/supabaseClient'
import {
  menuRowsToItems,
  nearbyRowToBar,
  type MenuStatRow,
  type NearbyRpcRow,
} from '../lib/barsFromRpc'
import { calendarDateInTimeZone } from '../lib/calendarDate'
import type { Bar } from '../types'

interface MapPageProps {
  shellMode: boolean
  userId?: string
}

export function MapPage({ shellMode, userId }: MapPageProps) {
  const [center, setCenter] = useState({ lng: 121.4737, lat: 31.2304 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [plans, setPlans] = useState<
    Record<string, { planned: boolean; vibe: VibeTag | null }>
  >({})
  const [myIntentIds, setMyIntentIds] = useState<Set<string>>(new Set())

  const supabase = getSupabase()
  const useRemote = Boolean(supabase)
  const [bars, setBars] = useState<Bar[]>(useRemote ? [] : MOCK_BARS)
  const [remoteWarn, setRemoteWarn] = useState<string | null>(null)
  const [chatStatus, setChatStatus] = useState<string | null>(null)
  const [loadingNearby, setLoadingNearby] = useState(useRemote)

  const hasAmapKey = Boolean(import.meta.env.VITE_AMAP_KEY)

  const locate = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCenter({ lng: p.coords.longitude, lat: p.coords.latitude })
      },
      () => {
        /* 拒绝定位则保持默认上海 */
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [])

  const fetchNearby = useCallback(async () => {
    if (!supabase) {
      setBars(MOCK_BARS)
      setRemoteWarn(null)
      return
    }
    setLoadingNearby(true)
    setRemoteWarn(null)
    const { data, error } = await supabase.rpc('get_nearby_bars', {
      p_lng: center.lng,
      p_lat: center.lat,
      p_radius_m: 50000,
    })
    setLoadingNearby(false)
    if (error) {
      setRemoteWarn(`无法加载远端酒吧：${error.message}（已回退本地演示数据）`)
      setBars(MOCK_BARS)
      return
    }
    const rows = (data ?? []) as NearbyRpcRow[]
    if (rows.length === 0) {
      setRemoteWarn(
        '附近暂无酒吧数据：请在 Supabase 执行 seed（supabase/seed.sql）或插入 bars 表。',
      )
      setBars([])
      return
    }
    setBars(rows.map((r) => nearbyRowToBar(r, [])))
  }, [supabase, center.lng, center.lat])

  useEffect(() => {
    void fetchNearby()
  }, [fetchNearby])

  const refreshMenuStats = useCallback(async () => {
    if (!supabase || !selectedId) return
    const { data, error } = await supabase.rpc('get_bar_menu_with_stats', {
      p_bar_id: selectedId,
    })
    if (error) {
      setRemoteWarn((w) => w ?? `酒单加载失败：${error.message}`)
      return
    }
    const menu = menuRowsToItems((data ?? []) as MenuStatRow[])
    setBars((prev) =>
      prev.map((b) => (b.id === selectedId ? { ...b, menu } : b)),
    )
  }, [supabase, selectedId])

  useEffect(() => {
    void refreshMenuStats()
  }, [refreshMenuStats])

  const refreshMyIntents = useCallback(async () => {
    if (!supabase || !userId || !selectedId) {
      setMyIntentIds(new Set())
      return
    }
    const bar = bars.find((b) => b.id === selectedId)
    if (!bar) return
    const intentDate = calendarDateInTimeZone(bar.timezone)
    const { data } = await supabase
      .from('drink_intents')
      .select('menu_item_id')
      .eq('user_id', userId)
      .eq('bar_id', selectedId)
      .eq('intent_date', intentDate)
      .is('cancelled_at', null)
    setMyIntentIds(
      new Set(
        (data ?? []).map((r: { menu_item_id: string }) => r.menu_item_id),
      ),
    )
  }, [supabase, userId, selectedId, bars])

  useEffect(() => {
    void refreshMyIntents()
  }, [refreshMyIntents])

  // 登录用户：按各酒吧当地「今天」合并 visit_plans
  useEffect(() => {
    if (!supabase || !userId) return
    let cancelled = false
    supabase
      .from('visit_plans')
      .select('bar_id, vibe, plan_date')
      .eq('user_id', userId)
      .is('cancelled_at', null)
      .then(({ data }) => {
        if (cancelled || !data?.length) return
        const map: Record<string, { planned: boolean; vibe: VibeTag | null }> =
          {}
        for (const r of data as Array<{
          bar_id: string
          vibe: VibeTag | null
          plan_date: string
        }>) {
          const bar = bars.find((b) => b.id === r.bar_id)
          if (!bar) continue
          const localToday = calendarDateInTimeZone(bar.timezone)
          if (r.plan_date !== localToday) continue
          map[r.bar_id] = { planned: true, vibe: r.vibe }
        }
        setPlans(map)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, userId, bars])

  const selectedBar = useMemo(
    () => bars.find((b) => b.id === selectedId) ?? null,
    [bars, selectedId],
  )

  const planDateForSelected = useMemo(() => {
    if (!selectedBar) return null
    return calendarDateInTimeZone(selectedBar.timezone)
  }, [selectedBar])

  const plan = selectedId ? plans[selectedId] : undefined

  return (
    <div>
      <div className="hero-title">VinoHide · 隐醺</div>
      <div className="hero-sub">夜色地图 · 匿名共感 · 龟壳友好</div>

      {useRemote ? (
        <p style={{ fontSize: 12, color: 'var(--vh-muted)', margin: '0 0 8px' }}>
          数据：Supabase RPC（get_nearby_bars / get_bar_menu_with_stats）
          {loadingNearby ? ' · 加载中…' : ''}
        </p>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--vh-muted)', margin: '0 0 8px' }}>
          数据：本地 mockBars.ts（配置 VITE_SUPABASE_URL / ANON_KEY 后走 RPC）
        </p>
      )}

      {remoteWarn ? (
        <div
          className="shell-banner"
          style={{
            background: 'rgba(232, 162, 60, 0.12)',
            borderColor: 'rgba(232, 162, 60, 0.45)',
            color: '#f0d9b8',
          }}
        >
          {remoteWarn}
        </div>
      ) : null}

      {chatStatus ? (
        <div className="shell-banner" style={{
          background: 'rgba(100, 180, 166, 0.15)',
          borderColor: 'rgba(100, 180, 166, 0.5)',
          color: '#b8e0d6',
        }}>
          {chatStatus}
        </div>
      ) : null}

      {shellMode ? (
        <div className="shell-banner">
          龟壳模式已开启：他人不会在热力与群人数中感知你的存在；私聊入口将对他人关闭（蓝图
          2.1，接 Supabase 后由 RLS/RPC 强制执行）。
        </div>
      ) : null}

      <div style={{ height: 'min(52dvh, 420px)', marginBottom: 12 }}>
        {hasAmapKey ? (
          <AmapContainer
            bars={bars}
            center={center}
            selectedId={selectedId}
            onSelectBar={setSelectedId}
          />
        ) : (
          <div className="map-fallback">
            <h2>地图占位</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--vh-muted)' }}>
              在 <code style={{ color: 'var(--vh-accent-2)' }}>.env</code> 中配置{' '}
              <code>VITE_AMAP_KEY</code> 后加载高德 Web 地图与氛围色 Marker。
            </p>
            {useRemote && bars.length === 0 && !loadingNearby ? (
              <p style={{ fontSize: 13, color: 'var(--vh-muted)' }}>
                当前无可用酒吧点位，请检查数据库 seed / 查询半径。
              </p>
            ) : null}
            <div className="bar-chip-row">
              {bars.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`bar-chip ${selectedId === b.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(b.id)}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button type="button" className="primary-btn" onClick={locate}>
        定位到我附近
      </button>

      {selectedBar && planDateForSelected ? (
        <BarSheet
          bar={selectedBar}
          planned={plan?.planned ?? false}
          selectedVibe={plan?.vibe ?? null}
          userId={userId}
          calendarDate={planDateForSelected}
          myIntentMenuIds={myIntentIds}
          onClose={() => setSelectedId(null)}
          onVibeChange={(v) => {
            setPlans((prev) => ({
              ...prev,
              [selectedBar.id]: {
                planned: prev[selectedBar.id]?.planned ?? false,
                vibe: v,
              },
            }))
            if (supabase && userId && plan?.planned) {
              const planDate = calendarDateInTimeZone(selectedBar.timezone)
              void supabase
                .from('visit_plans')
                .upsert(
                  {
                    user_id: userId,
                    bar_id: selectedBar.id,
                    plan_date: planDate,
                    vibe: v,
                    cancelled_at: null,
                  },
                  { onConflict: 'user_id,bar_id,plan_date' },
                )
                .then(() => fetchNearby())
            }
          }}
          onTogglePlan={async (next, vibe) => {
            if (!supabase || !userId) {
              setPlans((prev) => ({
                ...prev,
                [selectedBar.id]: { planned: next, vibe: next ? vibe : null },
              }))
              return
            }
            const planDate = calendarDateInTimeZone(selectedBar.timezone)
            if (next) {
              const { error } = await supabase.from('visit_plans').upsert(
                {
                  user_id: userId,
                  bar_id: selectedBar.id,
                  plan_date: planDate,
                  vibe: vibe ?? null,
                  cancelled_at: null,
                },
                { onConflict: 'user_id,bar_id,plan_date' },
              )
              if (error) {
                window.alert(`保存失败：${error.message}`)
                return
              }
              setPlans((prev) => ({
                ...prev,
                [selectedBar.id]: { planned: true, vibe },
              }))
              // 自动加入酒吧群聊
              setChatStatus('正在加入群聊...')
              const { data: chatId, error: chatErr } = await supabase.rpc('get_or_create_bar_chat', {
                p_bar_id: selectedBar.id,
              })
              if (chatErr) {
                setChatStatus(`创建群聊失败：${chatErr.message}`)
              } else if (chatId) {
                const { error: joinErr } = await supabase.rpc('join_bar_chat', { p_conversation_id: chatId as string })
                if (joinErr) {
                  setChatStatus(`加入群聊失败：${joinErr.message}`)
                } else {
                  setChatStatus('已加入酒吧群聊！切到聊天Tab查看')
                }
              } else {
                setChatStatus('群聊ID为空，请检查RPC')
              }
            } else {
              const { error } = await supabase
                .from('visit_plans')
                .update({ cancelled_at: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('bar_id', selectedBar.id)
                .eq('plan_date', planDate)
                .is('cancelled_at', null)
              if (error) {
                window.alert(`取消失败：${error.message}`)
                return
              }
              setPlans((prev) => ({
                ...prev,
                [selectedBar.id]: { planned: false, vibe: null },
              }))
            }
            await fetchNearby()
          }}
          onAfterDrinkIntentChange={async () => {
            await refreshMenuStats()
            await refreshMyIntents()
          }}
        />
      ) : null}
    </div>
  )
}
