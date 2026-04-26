'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { Plus, Bookmark, Trash2, ExternalLink, X } from 'lucide-react'
import Image from 'next/image'

interface ContentItem {
  id: string
  url: string
  notes: string | null
  thumbnail_url: string | null
  created_at: string
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') }
  catch { return url }
}

async function fetchYouTubeThumbnail(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
    if (!res.ok) return null
    const data = await res.json()
    return data.thumbnail_url ?? null
  } catch {
    return null
  }
}

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [swipeId, setSwipeId] = useState<string | null>(null)
  const touchStart = useRef<number>(0)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('content_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!url.trim()) { setError('Enter a URL'); return }
    let validUrl = url.trim()
    if (!validUrl.startsWith('http')) validUrl = 'https://' + validUrl

    setSaving(true)
    const thumbnail = await fetchYouTubeThumbnail(validUrl)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: err } = await supabase.from('content_items').insert({
      user_id: user.id,
      url: validUrl,
      notes: notes.trim() || null,
      thumbnail_url: thumbnail,
    })

    setSaving(false)
    if (err) { setError(err.message); return }
    setUrl(''); setNotes(''); setShowAdd(false); load()
  }

  async function deleteItem(id: string) {
    const supabase = createClient()
    await supabase.from('content_items').delete().eq('id', id)
    setSwipeId(null)
    load()
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStart.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent, id: string) {
    const delta = touchStart.current - e.changedTouches[0].clientX
    if (delta > 60) setSwipeId(id)
    else if (delta < -20) setSwipeId(null)
  }

  return (
    <div className="min-h-screen pt-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-5 mb-5">
        <h1 className="text-xl font-bold">Saved Content</h1>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center"
        >
          {showAdd ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mx-5 card rounded-2xl p-4 mb-5">
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <input
              className="input text-sm"
              placeholder="Paste URL here…"
              value={url}
              onChange={e => setUrl(e.target.value)}
              type="url"
              autoFocus
            />
            <input
              className="input text-sm"
              placeholder="Notes (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col gap-3 px-5">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card rounded-2xl p-10 text-center mx-5">
          <Bookmark size={32} className="text-white/20 mx-auto mb-3" />
          <p className="text-white/30 text-sm">Nothing saved yet</p>
          <p className="text-white/20 text-xs mt-1">Paste any URL to save it</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5">
          {items.map(item => (
            <div
              key={item.id}
              className="relative overflow-hidden rounded-2xl"
              onTouchStart={handleTouchStart}
              onTouchEnd={e => handleTouchEnd(e, item.id)}
            >
              {/* Delete reveal */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 z-10"
                style={{ background: 'rgba(239,68,68,0.15)', width: swipeId === item.id ? '100%' : '0', transition: 'width 0.2s' }}>
                {swipeId === item.id && (
                  <button onClick={() => deleteItem(item.id)} className="ml-auto">
                    <Trash2 size={20} className="text-red-400" />
                  </button>
                )}
              </div>

              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card rounded-2xl flex gap-3 p-3 relative z-20"
                style={{ transform: swipeId === item.id ? 'translateX(-70px)' : 'translateX(0)', transition: 'transform 0.2s' }}
                onClick={swipeId === item.id ? e => e.preventDefault() : undefined}
              >
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  {item.thumbnail_url ? (
                    <Image src={item.thumbnail_url} alt="" width={64} height={64} className="object-cover w-full h-full" />
                  ) : (
                    <ExternalLink size={20} className="text-white/20" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-accent font-medium truncate">{getDomain(item.url)}</p>
                  {item.notes && <p className="text-sm font-medium mt-0.5 line-clamp-2">{item.notes}</p>}
                  <p className="text-xs text-white/25 mt-1">{format(new Date(item.created_at), 'd MMM yyyy')}</p>
                </div>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
