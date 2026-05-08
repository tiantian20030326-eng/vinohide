import { useCallback, useEffect, useState } from 'react'
import { getSupabase, useSession } from '../lib/supabaseClient'
import type { MembershipTier } from '../types'

interface MePageProps {
  shellMode: boolean
  onShellMode: (v: boolean) => void
  userId?: string
}

function readLs<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function MePage({ shellMode, onShellMode, userId }: MePageProps) {
  const [handle, setHandle] = useState(() => readLs('vinohide-handle', '夜行狐#8K2'))
  const [isOwner, setIsOwner] = useState(() => readLs('vinohide-is-owner', false))
  const [showCrown, setShowCrown] = useState(() => readLs('vinohide-show-crown', true))
  const [tier, setTier] = useState<MembershipTier>(() => readLs('vinohide-tier', 'free'))
  const [saving, setSaving] = useState(false)
  const { signOut } = useSession()

  const sb = getSupabase()
  const supabaseConfigured = Boolean(sb)

  // 从 Supabase 拉取真实 profile
  useEffect(() => {
    if (!sb || !userId) return
    sb.from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        const p = data as Record<string, unknown>
        setHandle((p.display_handle as string) ?? handle)
        setIsOwner((p.is_owner as boolean) ?? false)
        setShowCrown((p.show_owner_badge as boolean) ?? true)
        setTier((p.membership_tier as MembershipTier) ?? 'free')
        onShellMode((p.shell_mode as boolean) ?? false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb, userId])

  const saveProfile = useCallback(
    async (field: string, value: unknown) => {
      if (!sb || !userId) return
      setSaving(true)
      await sb
        .from('profiles')
        .update({ [field]: value })
        .eq('user_id', userId)
      setSaving(false)
    },
    [sb, userId],
  )

  return (
    <div>
      <div className="hero-title">我的</div>
      <div className="hero-sub">
        {userId ? '匿名身份 · 龟壳 · 老板皇冠' : '本地演示（登录后同步 Supabase）'}
      </div>

      <div className="me-card">
        <h3>匿名展示名</h3>
        <div className="row">
          <input
            type="text"
            value={handle}
            onChange={(e) => {
              const v = e.target.value
              setHandle(v)
              if (userId) void saveProfile('display_handle', v)
            }}
            aria-label="匿名展示名"
          />
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--vh-muted)' }}>
          {userId ? '自动保存至云端' : '登录后由服务端生成；此处仅本地演示'}
        </p>
      </div>

      <div className="me-card">
        <h3 className="crown-inline">
          {((isOwner && showCrown) || tier === 'gold' || tier === 'diamond') && (
            <span aria-hidden>👑</span>
          )}
          身份与会员
        </h3>
        <div className="row">
          <span>酒吧老板</span>
          <button
            type="button"
            className={isOwner ? 'switch on' : 'switch'}
            aria-pressed={isOwner}
            onClick={() => {
              const next = !isOwner
              setIsOwner(next)
              if (userId) void saveProfile('is_owner', next)
            }}
          />
        </div>
        <div className="row">
          <span>显示老板皇冠</span>
          <button
            type="button"
            className={showCrown ? 'switch on' : 'switch'}
            aria-pressed={showCrown}
            onClick={() => {
              const next = !showCrown
              setShowCrown(next)
              if (userId) void saveProfile('show_owner_badge', next)
            }}
            disabled={!isOwner}
          />
        </div>
        <div className="row">
          <span>会员层级</span>
          <select
            value={tier}
            onChange={(e) => {
              const v = e.target.value as MembershipTier
              setTier(v)
              if (userId) void saveProfile('membership_tier', v)
            }}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid var(--vh-line)',
              background: '#12121c',
              color: 'var(--vh-text)',
            }}
          >
            <option value="free">Lv.1 夜幕旅人</option>
            <option value="silver">Lv.2 白银品鉴家</option>
            <option value="gold">Lv.3 黄金酿造者</option>
            <option value="diamond">Lv.4 钻石藏家</option>
          </select>
        </div>
      </div>

      <div className="me-card">
        <h3>龟壳模式（蓝图 2.1）</h3>
        <div className="row">
          <span>极致隐身</span>
          <button
            type="button"
            className={shellMode ? 'switch on' : 'switch'}
            aria-pressed={shellMode}
            onClick={() => {
              const next = !shellMode
              onShellMode(next)
              if (userId) void saveProfile('shell_mode', next)
            }}
          />
        </div>
      </div>

      <div className="me-card">
        <h3>后端状态</h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--vh-muted)' }}>
          Supabase：{supabaseConfigured ? `已连接 · ${userId ? '已登录' : '未登录'}` : '未配置（仅前端演示）'}
          {saving ? ' · 保存中...' : ''}
        </p>
      </div>

      {userId ? (
        <button type="button" className="ghost-btn" onClick={signOut} style={{ marginTop: 16 }}>
          退出登录
        </button>
      ) : null}
    </div>
  )
}
