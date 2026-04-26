'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CURRENCY_SYMBOLS } from '@/lib/utils'
import { ArrowLeft, Check, Camera, User } from 'lucide-react'
import Image from 'next/image'

const CURRENCIES = [
  { code: 'GBP', label: 'GBP', symbol: '£' },
  { code: 'USD', label: 'USD', symbol: '$' },
  { code: 'AUD', label: 'AUD', symbol: 'A$' },
  { code: 'NPR', label: 'NPR', symbol: 'रू' },
]

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState('')
  const [currency, setCurrency] = useState('GBP')
  const [leaveAllowance, setLeaveAllowance] = useState('28')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [isFirstTime, setIsFirstTime] = useState(false)
  const [userId, setUserId] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
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
            setAvatarUrl(data.avatar_url ?? null)
          } else {
            setIsFirstTime(true)
          }
        })
    })
  }, [])

  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!displayName.trim()) { setError('Please enter your name'); return }
    const allowance = parseInt(leaveAllowance)
    if (isNaN(allowance) || allowance < 0) { setError('Enter a valid allowance'); return }

    setLoading(true)
    const supabase = createClient()

    let finalAvatarUrl = avatarUrl

    // Upload avatar if changed
    if (avatarFile && userId) {
      const ext = avatarFile.name.split('.').pop()
      const path = `${userId}/avatar.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        finalAvatarUrl = urlData.publicUrl + `?t=${Date.now()}`
      }
    }

    const { error: upsertError } = await supabase.from('settings').upsert({
      user_id: userId,
      display_name: displayName.trim(),
      currency,
      leave_allowance: allowance,
      day_off: null,
      avatar_url: finalAvatarUrl,
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

  const displayAvatar = avatarPreview ?? avatarUrl

  return (
    <div className="min-h-screen px-5 pt-6 page-enter">
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

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative w-24 h-24 rounded-3xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.07)', border: '2px solid rgba(108,93,211,0.4)' }}
          >
            {displayAvatar ? (
              <Image src={displayAvatar} alt="Avatar" fill className="object-cover" />
            ) : (
              <User size={36} className="text-white/20 absolute inset-0 m-auto" />
            )}
            <div className="absolute inset-0 flex items-end justify-center pb-2" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }}>
              <Camera size={16} className="text-white/80" />
            </div>
          </button>
          <p className="text-xs text-white/30">Tap to change photo</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
        </div>

        {/* Name */}
        <div>
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">Your Name</label>
          <input className="input" type="text" placeholder="e.g. Alex" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
        </div>

        {/* Currency */}
        <div>
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">Currency</label>
          <div className="grid grid-cols-4 gap-2">
            {CURRENCIES.map(({ code, symbol }) => (
              <button
                key={code}
                type="button"
                onClick={() => setCurrency(code)}
                className="relative p-3 rounded-2xl text-center transition-all"
                style={{
                  background: currency === code ? 'rgba(108,93,211,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${currency === code ? '#6C5DD3' : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div className="text-lg font-bold">{symbol}</div>
                <div className="text-[10px] text-white/40 mt-0.5">{code}</div>
                {currency === code && (
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check size={9} strokeWidth={3} />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Leave Allowance */}
        <div>
          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 block">Annual Leave Allowance</label>
          <div className="flex items-center gap-3">
            <input
              className="input text-center text-2xl font-bold"
              type="number" min={0} max={365}
              value={leaveAllowance}
              onChange={e => setLeaveAllowance(e.target.value)}
              required
            />
            <span className="text-white/40 text-sm whitespace-nowrap">days / year</span>
          </div>
          <p className="text-xs text-white/25 mt-2">Day offs are now marked directly on the calendar</p>
        </div>

        {error && <div className="text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">{error}</div>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving…' : saved ? '✓ Saved' : isFirstTime ? 'Get started' : 'Save changes'}
        </button>
      </form>

      {!isFirstTime && (
        <div className="mt-8 pb-8">
          <button
            onClick={handleLogout}
            className="w-full py-3.5 rounded-2xl text-red-400 text-sm font-semibold"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
