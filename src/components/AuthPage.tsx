import { useState } from 'react'
import { getSupabase } from '../lib/supabaseClient'

export function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async () => {
    const sb = getSupabase()
    if (!sb) {
      setError('Supabase 未配置')
      return
    }
    setLoading(true)
    setError('')

    // 先尝试注册。若已注册则 signUp 返回 error，再走登录
    const { data: signUpData, error: signUpErr } = await sb.auth.signUp({
      email: email.trim(),
      password,
    })

    if (signUpErr) {
      // 已注册 → 走登录
      const { error: signInErr } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInErr) {
        setError(signInErr.message)
      }
    } else if (!signUpData.session) {
      // 注册成功但没 session（邮箱确认开启时会这样）
      setError('注册成功，但需要先在 Supabase 关掉邮箱确认。Dashboard → Authentication → Settings → 关闭 Confirm email')
    }
    // signUp 成功且有 session → 已自动登录
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>VinoHide · 隐醺</h1>
        <p style={{ color: 'var(--vh-muted)', marginBottom: 24 }}>
          匿名酒吧社交 · 无需邮箱验证
        </p>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid var(--vh-line)',
            background: 'var(--vh-bg)',
            color: 'var(--vh-text)',
            fontSize: 15,
            marginBottom: 10,
          }}
        />
        <input
          type="password"
          placeholder="设置登录密码（任意6位以上）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') login() }}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid var(--vh-line)',
            background: 'var(--vh-bg)',
            color: 'var(--vh-text)',
            fontSize: 15,
            marginBottom: 12,
          }}
        />
        <button
          type="button"
          className="primary-btn"
          onClick={login}
          disabled={!email.trim() || password.length < 6 || loading}
          style={{ width: '100%' }}
        >
          {loading ? '登录中...' : '登录 / 注册'}
        </button>
        {error ? (
          <p style={{ color: '#e88080', fontSize: 13, marginTop: 12 }}>{error}</p>
        ) : null}
        <p style={{ fontSize: 11, color: 'var(--vh-muted)', marginTop: 16, textAlign: 'center' }}>
          首次输入即注册 · 不验证邮箱
        </p>
      </div>
    </div>
  )
}
