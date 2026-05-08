import { getSupabase } from '../lib/supabaseClient'
import type { Bar, MenuItem, VibeTag } from '../types'
import { VIBE_OPTIONS, vibeHue } from '../types'

interface BarSheetProps {
  bar: Bar
  planned: boolean
  selectedVibe: VibeTag | null
  /** 该酒吧时区下的「今天」YYYY-MM-DD，与 visit_plans / drink_intents 一致 */
  calendarDate: string
  /** 当前用户今日在该店已选意向的 menu_item_id */
  myIntentMenuIds: Set<string>
  userId?: string
  onClose: () => void
  onVibeChange: (v: VibeTag) => void
  onTogglePlan: (next: boolean, vibe: VibeTag | null) => Promise<void>
  /** 酒品意向写入后由父级刷新 RPC 统计与 myIntent 集合 */
  onAfterDrinkIntentChange?: () => Promise<void>
}

export function BarSheet({
  bar,
  planned,
  selectedVibe,
  calendarDate,
  myIntentMenuIds,
  userId,
  onClose,
  onTogglePlan,
  onVibeChange,
  onAfterDrinkIntentChange,
}: BarSheetProps) {
  const noiseLabel =
    bar.noiseLevel === 'quiet'
      ? '🟢 安静'
      : bar.noiseLevel === 'medium'
        ? '🟡 适中'
        : bar.noiseLevel === 'loud'
          ? '🔴 热闹'
          : '噪音指数待录入'

  const handleDrinkTap = async (m: MenuItem) => {
    if (!userId) {
      window.alert('请先登录后再表达酒品意向')
      return
    }
    const sb = getSupabase()
    if (!sb) return

    const { data: existing } = await sb
      .from('drink_intents')
      .select('id')
      .eq('user_id', userId)
      .eq('menu_item_id', m.id)
      .eq('intent_date', calendarDate)
      .is('cancelled_at', null)
      .maybeSingle()

    if (existing) {
      const { error } = await sb
        .from('drink_intents')
        .update({ cancelled_at: new Date().toISOString() })
        .eq('id', (existing as { id: string }).id)
      if (error) {
        window.alert(`取消意向失败：${error.message}`)
        return
      }
    } else {
      const { error } = await sb.from('drink_intents').insert({
        user_id: userId,
        bar_id: bar.id,
        menu_item_id: m.id,
        intent_date: calendarDate,
      })
      if (error) {
        window.alert(`保存意向失败：${error.message}`)
        return
      }
    }
    await onAfterDrinkIntentChange?.()
  }

  return (
    <>
      <div className="sheet-backdrop" role="presentation" onClick={onClose} />
      <aside className="sheet" aria-label="酒吧详情">
        <div className="sheet-handle" />
        <h2>{bar.name}</h2>
        <p className="sheet-meta">
          {bar.city} · {bar.address}
        </p>
        <div className="tag-row">
          <span className="tag">{noiseLabel}</span>
          {bar.hasNaDrinks ? <span className="tag">☕ 无酒精友好</span> : null}
          {bar.tonightPlaylist ? (
            <span className="tag">📋 今晚：{bar.tonightPlaylist}</span>
          ) : null}
          <span className="tag">📅 店历今日 {calendarDate}</span>
        </div>
        <div className="stat-row">
          <div className="stat-pill">
            今日计划到店
            <strong>{bar.planCountToday}</strong>
          </div>
          <div
            className="stat-pill"
            style={{
              borderColor: vibeHue(bar.dominantVibe),
              boxShadow: `0 0 0 1px ${vibeHue(bar.dominantVibe)}33`,
            }}
          >
            氛围光谱
            <strong style={{ color: vibeHue(bar.dominantVibe) }}>
              {bar.dominantVibe === 'alone'
                ? '偏安静'
                : bar.dominantVibe === 'social'
                  ? '偏社交'
                  : bar.dominantVibe === 'celebrate'
                    ? '庆祝向'
                    : bar.dominantVibe === 'tasting'
                      ? '品鉴向'
                      : '—'}
            </strong>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--vh-muted)', margin: '0 0 8px' }}>
          选择今晚意图（场景光谱）
        </p>
        <div className="vibe-grid">
          {VIBE_OPTIONS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`vibe-btn ${selectedVibe === v.id ? 'selected' : ''}`}
              onClick={() => onVibeChange(v.id)}
            >
              {v.emoji} {v.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            if (!planned && !selectedVibe) {
              window.alert('请先选择一个意图标签')
              return
            }
            void onTogglePlan(!planned, selectedVibe)
          }}
        >
          {planned ? '取消今日计划' : '我今天要去'}
        </button>
        <button type="button" className="ghost-btn" onClick={onClose}>
          关闭
        </button>

        <h3 style={{ margin: '18px 0 8px', fontSize: 15 }}>酒单 · 共感沙盘</h3>
        <p style={{ fontSize: 12, color: 'var(--vh-muted)', margin: '0 0 8px' }}>
          点击单品切换「今日意向」；已选行会标注「我的」。
        </p>
        <ul className="menu-list">
          {bar.menu.map((m) => (
            <li
              key={m.id}
              className={`menu-row ${(m.intentCount ?? 0) >= 8 ? 'ripple-hot' : ''}`}
              onClick={() => void handleDrinkTap(m)}
              style={{ cursor: userId ? 'pointer' : 'default' }}
            >
              <div>
                <div className="name">
                  {m.name}
                  {myIntentMenuIds.has(m.id) ? (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        color: 'var(--vh-accent-2)',
                      }}
                    >
                      我的
                    </span>
                  ) : null}
                </div>
                <div className="sub">
                  ¥{m.priceCny}
                  {m.description ? ` · ${m.description}` : ''}
                </div>
              </div>
              <div className="intent">
                今日意向 {m.intentCount ?? 0} 人
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </>
  )
}
