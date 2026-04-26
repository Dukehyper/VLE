'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Zap } from 'lucide-react'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setInfo('')

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match'); return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters'); return
    }

    setLoading(true)
    const supabase = createClient()

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) { setError(error.message); return }
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
      {/* Logo */}
      <div className="flex items-center gap-2 mb-10">
        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center">
          <Zap size={20} className="text-white" fill="white" />
        </div>
        <span className="text-2xl font-bold tracking-tight">Pulse</span>
      </div>

      <div className="w-full">
        {/* Mode switcher */}
        <div className="flex gap-1 p-1 rounded-2xl mb-8" style={{ background: 'rgba(255,255,255,0.05)' }}>
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
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-white/50 mb-1.5 block">Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-medium text-white/50 mb-1.5 block">Confirm Password</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</div>
          )}
          {info && (
            <div className="text-green-400 text-sm bg-green-500/10 rounded-xl px-4 py-3">{info}</div>
          )}

          <button type="submit" className="btn-primary mt-1" disabled={loading}>
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
