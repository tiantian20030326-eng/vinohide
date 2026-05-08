import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from '../lib/supabaseClient'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Message {
  id: string
  sender_id: string
  body: string
  created_at: string
}

interface MemberRow {
  user_id: string
  display_handle: string
  membership_tier: string
  vibe: string | null
}

interface ChatRoomProps {
  conversationId: string
  userId: string
  title: string
  subtitle?: string
  barId?: string
  onBack: () => void
  onStartDM?: (convId: string, title: string, subtitle: string) => void
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '刚刚'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}小时前`
  return `${Math.floor(hr / 24)}天前`
}

const USER_COLORS = [
  '#c9b6ff', '#f0b8a0', '#a0d2c0', '#b8c8f0',
  '#f0c8d8', '#c8d8a0', '#d0b8e8', '#a0d0e0',
]

function userColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}

const VIBE_EMOJI: Record<string, string> = {
  alone: '👻', social: '⚡', celebrate: '🎉', tasting: '🍷',
}
const VIBE_LABEL: Record<string, string> = {
  alone: '独自放空', social: '想认识新朋友', celebrate: '庆祝大事', tasting: '只为这杯酒',
}
const TIER_ICON: Record<string, string> = { silver: '🥈', gold: '🥇', diamond: '💎' }

export function ChatRoom({ conversationId, userId, title, subtitle, barId, onBack, onStartDM }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const sb = getSupabase()

  useEffect(() => {
    if (!sb) return
    sb.from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setMessages(data as Message[]) })
  }, [sb, conversationId])

  useEffect(() => {
    if (!sb) return
    const ch = sb
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message])
      })
      .subscribe()
    channelRef.current = ch
    return () => { sb.removeChannel(ch) }
  }, [sb, conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async () => {
    if (!sb || !text.trim()) return
    const { error } = await sb.from('messages').insert({
      conversation_id: conversationId, sender_id: userId, body: text.trim(),
    })
    if (!error) setText('')
  }, [sb, text, conversationId, userId])

  const loadMembers = useCallback(async () => {
    if (!sb || !barId) return
    setLoadingMembers(true)
    setShowMembers(true)
    const { data } = await sb.rpc('get_bar_chat_members', { p_bar_id: barId })
    if (data) setMembers(data as MemberRow[])
    setLoadingMembers(false)
  }, [sb, barId])

  const startDM = async (targetUserId: string, handle: string) => {
    if (!sb) return
    const { data, error } = await sb.rpc('create_direct_chat', { p_target_user_id: targetUserId })
    if (error) { window.alert(`发起失败：${error.message}`); return }
    if (onStartDM && data) {
      setShowMembers(false)
      onStartDM(data as string, handle, '匿名私聊')
    }
  }

  return (
    <div className="chat-room">
      <div className="chat-header">
        <button type="button" className="chat-back" onClick={showMembers ? () => setShowMembers(false) : onBack}>
          ←
        </button>
        {showMembers ? (
          <div className="chat-header-info">
            <div className="chat-header-title">今晚同好</div>
            <div className="chat-header-sub">{title}</div>
          </div>
        ) : (
          <div className="chat-header-info">
            <div className="chat-header-title">{title}</div>
            {subtitle ? <div className="chat-header-sub">{subtitle}</div> : null}
          </div>
        )}
        {barId && !showMembers ? (
          <button type="button" className="chat-members-btn" onClick={loadMembers}>
            👥
          </button>
        ) : null}
      </div>

      {showMembers ? (
        <div className="chat-members-panel">
          {loadingMembers ? (
            <div className="chats-empty">加载中...</div>
          ) : members.length === 0 ? (
            <div className="chats-empty">
              <div className="chat-empty-icon">🫧</div>
              <p>今晚暂无其他同好</p>
            </div>
          ) : (
            members.map((m) => (
              <div key={m.user_id} className="member-card" onClick={() => startDM(m.user_id, m.display_handle)}>
                <div className="member-avatar">
                  {m.vibe ? VIBE_EMOJI[m.vibe] ?? '🍸' : '🍸'}
                </div>
                <div className="member-info">
                  <div className="member-name">
                    {m.display_handle}
                    {m.membership_tier && TIER_ICON[m.membership_tier] ? ` ${TIER_ICON[m.membership_tier]}` : ''}
                  </div>
                  <div className="member-vibe">
                    {m.vibe ? VIBE_EMOJI[m.vibe] + ' ' + (VIBE_LABEL[m.vibe] ?? m.vibe) : '未设置意图'}
                  </div>
                </div>
                <span className="member-arrow">私聊 →</span>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <div className="chat-empty-icon">🫧</div>
                <p>还没有消息，打破沉默吧</p>
              </div>
            ) : (
              messages.map((m, i) => {
                const mine = m.sender_id === userId
                const showTime = i === 0 ||
                  new Date(m.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 300000
                return (
                  <div key={m.id}>
                    {showTime ? <div className="chat-time">{timeAgo(m.created_at)}</div> : null}
                    <div className={`chat-bubble-row ${mine ? 'mine' : 'theirs'}`}>
                      {!mine ? (
                        <div className="chat-avatar" style={{ background: userColor(m.sender_id) }}>
                          {m.sender_id.slice(0, 2).toUpperCase()}
                        </div>
                      ) : null}
                      <div className={`chat-bubble ${mine ? 'mine' : 'theirs'}`}>{m.body}</div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <input type="text" className="chat-input" placeholder="说点什么..."
              value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send() }} />
            <button type="button" className="chat-send" onClick={send} disabled={!text.trim()}>
              发送
            </button>
          </div>
        </>
      )}
    </div>
  )
}
