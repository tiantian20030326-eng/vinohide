import { useEffect, useState } from 'react'
import { useSession, ensureProfile } from './lib/supabaseClient'
import { AuthPage } from './components/AuthPage'
import { MapPage } from './pages/MapPage'
import { ChatsPage } from './pages/ChatsPage'
import { MePage } from './pages/MePage'
import './styles/theme.css'

type Tab = 'map' | 'chats' | 'me'

function readShell(): boolean {
  try {
    return JSON.parse(localStorage.getItem('vinohide-shell') ?? 'false') as boolean
  } catch {
    return false
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('map')
  const [shellMode, setShellMode] = useState(readShell)
  const { session, loading } = useSession()

  useEffect(() => {
    localStorage.setItem('vinohide-shell', JSON.stringify(shellMode))
  }, [shellMode])

  // 首次登录自动创建 profile
  useEffect(() => {
    if (session?.user?.id) {
      ensureProfile(session.user.id)
    }
  }, [session?.user?.id])

  // 暂未配置 Supabase：不做登录拦截
  const needAuth = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
  )

  if (needAuth && loading) {
    return <div className="app-root"><div className="loading">加载中...</div></div>
  }

  if (needAuth && !session) {
    return <AuthPage />
  }

  return (
    <div className="app-root">
      <main className="app-main">
        {tab === 'map' ? <MapPage shellMode={shellMode} userId={session?.user?.id} /> : null}
        {tab === 'chats' && session?.user?.id ? <ChatsPage userId={session.user.id} /> : null}
        {tab === 'me' ? (
          <MePage
            shellMode={shellMode}
            onShellMode={setShellMode}
            userId={session?.user?.id}
          />
        ) : null}
      </main>
      <nav className="tab-bar" aria-label="主导航">
        <button
          type="button"
          className={tab === 'map' ? 'active' : ''}
          onClick={() => setTab('map')}
        >
          地图
        </button>
        <button
          type="button"
          className={tab === 'chats' ? 'active' : ''}
          onClick={() => setTab('chats')}
        >
          聊天
        </button>
        <button
          type="button"
          className={tab === 'me' ? 'active' : ''}
          onClick={() => setTab('me')}
        >
          我的
        </button>
      </nav>
    </div>
  )
}
