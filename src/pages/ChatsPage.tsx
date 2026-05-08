import { useCallback, useEffect, useState } from 'react'
import { getSupabase } from '../lib/supabaseClient'
import { ChatRoom } from '../components/ChatRoom'

interface ConvRow {
  conversation_id: string
  conv_type: 'direct' | 'group'
  title: string | null
  bar_id: string | null
  other_user_id: string | null
  other_handle: string | null
  other_tier: string | null
  last_message: string | null
  last_message_at: string | null
  unread_count: number
}

const TIER_ICON: Record<string, string> = { silver: '🥈', gold: '🥇', diamond: '💎' }

interface ChatsPageProps {
  userId: string
}

function timeAgo(ts: string | null): string {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min}分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}小时前`
  return `${Math.floor(hr / 24)}天前`
}

export function ChatsPage({ userId }: ChatsPageProps) {
  const [convs, setConvs] = useState<ConvRow[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeTitle, setActiveTitle] = useState('')
  const [activeSubtitle, setActiveSubtitle] = useState('')
  const [loading, setLoading] = useState(true)
  const sb = getSupabase()

  const loadConvs = useCallback(async () => {
    if (!sb) return
    setLoading(true)
    const { data } = await sb.rpc('get_my_conversations')
    if (data) setConvs(data as ConvRow[])
    setLoading(false)
  }, [sb])

  useEffect(() => { loadConvs() }, [loadConvs])

  useEffect(() => {
    if (!sb) return
    const ch = sb.channel('conv-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => { loadConvs() })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, loadConvs])

  const openConv = (c: ConvRow) => {
    setActiveConvId(c.conversation_id)
    setActiveTitle(c.conv_type === 'group' ? (c.title ?? '群聊') : (c.other_handle ?? '匿名用户'))
    const tierIcon = c.other_tier && TIER_ICON[c.other_tier] ? TIER_ICON[c.other_tier] : ''
    setActiveSubtitle(c.conv_type === 'direct' ? `${tierIcon} 匿名私聊` : '酒吧群聊')
  }

  if (activeConvId) {
    const activeConv = convs.find((c) => c.conversation_id === activeConvId)
    return (
      <ChatRoom
        conversationId={activeConvId}
        userId={userId}
        title={activeTitle}
        subtitle={activeSubtitle}
        barId={activeConv?.bar_id ?? undefined}
        onBack={() => { setActiveConvId(null); loadConvs() }}
        onStartDM={(convId, title, sub) => {
          setActiveConvId(convId)
          setActiveTitle(title)
          setActiveSubtitle(sub)
        }}
      />
    )
  }

  return (
    <div>
      <div className="hero-title">匿名聊天</div>
      <div className="hero-sub">酒吧群聊 · 灵魂私聊</div>

      {!sb ? (
        <div className="chats-empty">配置 Supabase 后启用聊天</div>
      ) : loading ? (
        <div className="chats-empty">加载中...</div>
      ) : convs.length === 0 ? (
        <div className="chats-empty">
          <div className="chat-empty-icon">🫧</div>
          <p>还没有对话</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            在地图上选择酒吧，点击「我今天要去」后自动加入群聊
          </p>
        </div>
      ) : (
        <div className="conv-list">
          {convs.map((c) => (
            <div key={c.conversation_id} className="conv-row" onClick={() => openConv(c)}>
              <div className="conv-avatar">
                {c.conv_type === 'group' ? '🍸' : '🫧'}
              </div>
              <div className="conv-info">
                <div className="conv-name">
                  {c.conv_type === 'group'
                    ? (c.title ?? '酒吧群聊')
                    : (c.other_handle ?? '匿名用户')}
                  {c.unread_count > 0 ? (
                    <span className="conv-badge">{c.unread_count}</span>
                  ) : null}
                </div>
                <div className="conv-last">{c.last_message ?? '暂无消息'}</div>
              </div>
              <div className="conv-meta">{c.last_message_at ? timeAgo(c.last_message_at) : ''}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
