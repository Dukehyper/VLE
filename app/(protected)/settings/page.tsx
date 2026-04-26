'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CURRENCY_SYMBOLS, DAYS_OF_WEEK } from '@/lib/utils'
import { ArrowLeft, Check } from 'lucide-react'

const CURRENCIES = [
  { code: 'GBP', label: 'GBP — British Pound (£)' },
  { code: 'USD', label: 'USD — US Dollar ($)' },
  { code: 'AUD', label: 'AUD — Australian Dollar (A$)' },
  { code: 'NPR', label: 'NPR — Nepali Rupee (रू)' },
]

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState('')
  const [currency, setCurrency] = useState('GBP')
  const [leaveAllowance, setLeaveAllowance] = useState('28')
  const [dayOff, setDayOff] = useState('Sunday')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isFirstTime, setIsFirstTime] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('settings')
        .select('*')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setDisplayName(data.display_name ?? '')
            setCurrency(data.currency)
            setLeaveAllowance(String(data.leave_allowance))
            setDayOff(data.day_off)
          } else {
            setIsFirstTime(true)
          }
        })
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!displayName.trim()) { setError('Please enter your name'); return }
    const allowance = parseInt(leaveAllowance)
    if (isNaN(allowance) || allowance < 0 || allowance > 365) { setError('Leave allowance must be 0–365'); return }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: upsertError } = await supabase
      .from('settings')
      .upsert({
        user_id: user.id,
        display_name: displayName.trim(),
        currency,
        leave_allowance: allowance,
        day_off: dayOff,
      }, { onConflict: 'user_id' })

    setLoading(false)
    if (upsertError) { setError(upsertError.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (isFirstTime) router.push('/dashboard')
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen px-5 pt-6 page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        {!isFirstTime && (
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold">{isFirstTime ? 'Set up your account' : 'Settings'}</h1>
          {isFirstTime && <p className="text-white/40 text-sm mt-0.5">Just a few things to get started</p>}
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* Name */}
        <div>
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 block">Your Name</label>
          <input
            className="input"
            type="text"
            placeholder="e.g. Alex"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            required
          />
        </div>

        {/* Currency */}
        <div>
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 block">Currency</label>
          <div className="grid grid-cols-2 gap-2">
            {CURRENCIES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => setCurrency(code)}
                className={`relative p-3.5 rounded-2xl text-left transition-all border ${
                  currency === code
                    ? 'border-primary bg-primary/20'
                    : 'border-white/08 bg-white/05'
                }`}
                style={{ borderColor: currency === code ? '#6C5DD3' : 'rgba(255,255,255,0.08)' }}
              >
                <div className="text-xl font-bold mb-0.5">{CURRENCY_SYMBOLS[code]}</div>
                <div className="text-xs text-white/50">{code}</div>
                {currency === code && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check size={11} strokeWidth={3} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Leave Allowance */}
        <div>
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 block">Annual Leave Allowance</label>
          <div className="flex items-center gap-3">
            <input
              className="input text-center text-2xl font-bold"
              type="number"
              min={0}
              max={365}
              value={leaveAllowance}
              onChange={e => setLeaveAllowance(e.target.value)}
              required
            />
            <span className="text-white/40 text-sm whitespace-nowrap">days / year</span>
          </div>
        </div>

        {/* Day Off */}
        <div>
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 block">Weekly Day Off</label>
          <div className="grid grid-cols-4 gap-2">
            {DAYS_OF_WEEK.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => setDayOff(day)}
                className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                  dayOff === day
                    ? 'border-primary bg-primary/20 text-white'
                    : 'border-white/08 bg-white/05 text-white/40'
                }`}
                style={{ borderColor: dayOff === day ? '#6C5DD3' : 'rgba(255,255,255,0.08)' }}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</div>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving…' : saved ? '✓ Saved' : isFirstTime ? 'Get started' : 'Save changes'}
        </button>
      </form>

      {!isFirstTime && (
        <div className="mt-8 pb-4">
          <button
            onClick={handleLogout}
            className="w-full py-3.5 rounded-2xl text-red-400 text-sm font-semibold transition-all"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
