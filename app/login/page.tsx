'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Zap } from 'lucide-react'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setInfo('')
    if (mode === 'signup' && password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    const supabase = createClient()

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) { setError(error.message); return }
      // Remember Me: persist flag so session guard knows to keep them logged in
      if (rememberMe) {
        localStorage.setItem('pulse_remember_me', '1')
      } else {
        localStorage.removeItem('pulse_remember_me')
        sessionStorage.setItem('pulse_session', '1')
      }
      router.push('/dashboard')
      router.refresh()
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      setLoading(false)
      if (error) { setError(error.message); return }
      setInfo('Account created! Check your email to confirm, then sign in.')
      setMode('login')
    }
  }

  function switchMode(m: 'login' | 'signup') {
    setMode(m); setError(''); setInfo(''); setPassword(''); setConfirmPassword('')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 page-enter">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center">
          <Zap size={20} className="text-white" fill="white" />
        </div>
        <span className="text-2xl font-bold tracking-tight">Pulse</span>
      </div>

      <Link href="/onboarding" className="text-xs text-white/25 mb-8 hover:text-white/50 transition-colors">
        See what Pulse can do →
      </Link>

      <div className="w-full">
        {/* Mode switcher */}
        <div className="flex gap-1 p-1 rounded-2xl mb-6" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {(['login', 'signup'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === m ? 'bg-primary text-white' : 'text-white/40'}`}
            >
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-white/50 mb-1.5 block">Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="text-xs font-medium text-white/50 mb-1.5 block">Password</label>
            <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Confirm Password</label>
              <input className="input" type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
            </div>
          )}

          {/* Remember Me */}
          {mode === 'login' && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setRememberMe(v => !v)}
                className="w-5 h-5 rounded-md flex items-center justify-center transition-all flex-shrink-0"
                style={{
                  background: rememberMe ? '#6C5DD3' : 'rgba(255,255,255,0.08)',
                  border: `1.5px solid ${rememberMe ? '#6C5DD3' : 'rgba(255,255,255,0.15)'}`,
                }}
              >
                {rememberMe && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-sm text-white/50">Remember me</span>
            </label>
          )}

          {error && <div className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</div>}
          {info && <div className="text-green-400 text-sm bg-green-500/10 rounded-xl px-4 py-3">{info}</div>}

          <button type="submit" className="btn-primary mt-1" disabled={loading}>
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
