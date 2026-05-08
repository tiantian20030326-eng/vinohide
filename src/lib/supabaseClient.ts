import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'
import { useEffect, useState, useCallback } from 'react'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (!client) client = createClient(url, key)
  return client
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = getSupabase()
    if (!sb) {
      setLoading(false)
      return
    }
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = useCallback(async () => {
    const sb = getSupabase()
    if (sb) await sb.auth.signOut()
  }, [])

  return { session, loading, signOut }
}

export async function ensureProfile(userId: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const { data } = await sb
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (data) return
  const adjectives = ['夜行', '隐', '暗', '月', '雾', '星', '暮', '影', '静', '朦胧']
  const animals = ['狐', '猫', '狼', '鹿', '鹰', '鲸', '蝶', '熊', '兔', '鹤']
  const a = adjectives[Math.floor(Math.random() * adjectives.length)]
  const b = animals[Math.floor(Math.random() * animals.length)]
  const code = Math.random().toString(36).slice(2, 5).toUpperCase()
  const handle = `${a}${b}#${code}`
  await sb.from('profiles').insert({ user_id: userId, display_handle: handle })
}
