'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { Plus, Bookmark, Trash2, ExternalLink, X, Utensils, MapPin, Mountain, Shirt, LayoutGrid, FileText } from 'lucide-react'
import Image from 'next/image'

interface ContentItem {
  id: string
  url: string | null
  title: string | null
  notes: string | null
  thumbnail_url: string | null
  category: string
  created_at: string
}

const CATEGORIES = [
  { id: 'all', label: 'All', icon: LayoutGrid, color: '#6C5DD3' },
  { id: 'food', label: 'Food', icon: Utensils, color: '#f59e0b' },
  { id: 'places', label: 'Places', icon: MapPin, color: '#34d399' },
  { id: 'treks', label: 'Treks', icon: Mountain, color: '#60a5fa' },
  { id: 'clothes', label: 'Clothes', icon: Shirt, color: '#e879f9' },
]

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

async function fetchYouTubeThumbnail(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
    if (!res.ok) return null
    const data = await res.json()
    return data.thumbnail_url ?? null
  } catch { return null }
}

export default function ContentPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [category, setCategory] = useState('food')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [swipeId, setSwipeId] = useState<string | null>(null)
  const touchStart = useRef<number>(0)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('content_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setError('')
    const hasContent = title.trim() || notes.trim() || url.trim()
    if (!hasContent) { setError('Add a title, note, or URL'); return }

    let validUrl: string | null = url.trim() || null
    if (validUrl && !validUrl.startsWith('http')) validUrl = 'https://' + validUrl

    setSaving(true)
    const thumbnail = validUrl ? await fetchYouTubeThumbnail(validUrl) : null
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: err } = await supabase.from('content_items').insert({
      user_id: user.id,
      url: validUrl,
      title: title.trim() || null,
      notes: notes.trim() || null,
      thumbnail_url: thumbnail,
      category,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setTitle(''); setUrl(''); setNotes(''); setCategory('food'); setShowAdd(false); load()
  }

  async function deleteItem(id: string) {
    const supabase = createClient()
    await supabase.from('content_items').delete().eq('id', id)
    setSwipeId(null); load()
  }

  function handleTouchStart(e: React.TouchEvent) { touchStart.current = e.touches[0].clientX }
  function handleTouchEnd(e: React.TouchEvent, id: string) {
    const delta = touchStart.current - e.changedTouches[0].clientX
    if (delta > 60) setSwipeId(id)
    else if (delta < -20) setSwipeId(null)
  }

  const filtered = activeCategory === 'all' ? items : items.filter(i => i.category === activeCategory)
  const getCatInfo = (id: string) => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[0]

  const counts: Record<string, number> = {}
  items.forEach(i => { counts[i.category] = (counts[i.category] ?? 0) + 1 })

  return (
    <div className="min-h-screen pt-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-5 mb-5">
        <h1 className="text-xl font-bold">Saved</h1>
        <button onClick={() => setShowAdd(v => !v)} className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
          {showAdd ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="mx-5 card rounded-2xl p-4 mb-4">
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <input
              className="input text-sm"
              placeholder="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
            <input
              className="input text-sm"
              placeholder="URL (optional)"
              value={url}
              onChange={e => setUrl(e.target.value)}
              type="url"
              inputMode="url"
            />
            <textarea
              className="input text-sm resize-none"
              placeholder="Notes (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
            {/* Category picker */}
            <div>
              <label className="text-xs text-white/40 mb-2 block">Category</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.filter(c => c.id !== 'all').map(cat => {
                  const CatIcon = cat.icon
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: category === cat.id ? `${cat.color}25` : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${category === cat.id ? cat.color : 'rgba(255,255,255,0.08)'}`,
                        color: category === cat.id ? cat.color : 'rgba(244,241,248,0.4)',
                      }}
                    >
                      <CatIcon size={11} />
                      {cat.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </form>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 px-5 mb-4 no-scrollbar">
        {CATEGORIES.map(cat => {
          const CatIcon = cat.icon
          const count = cat.id === 'all' ? items.length : (counts[cat.id] ?? 0)
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                background: activeCategory === cat.id ? `${cat.color}20` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${activeCategory === cat.id ? cat.color : 'rgba(255,255,255,0.06)'}`,
                color: activeCategory === cat.id ? cat.color : 'rgba(244,241,248,0.35)',
              }}
            >
              <CatIcon size={12} />
              {cat.label}
              {count > 0 && <span className="ml-0.5 opacity-60">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex flex-col gap-3 px-5">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card rounded-2xl p-10 text-center mx-5">
          <Bookmark size={32} className="text-white/20 mx-auto mb-3" />
          <p className="text-white/30 text-sm">Nothing saved {activeCategory !== 'all' ? `in ${getCatInfo(activeCategory).label}` : 'yet'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-5">
          {filtered.map(item => {
            const catInfo = getCatInfo(item.category)
            const CatIcon = catInfo.icon
            const displayTitle = item.title || (item.url ? getDomain(item.url) : item.notes ?? '')
            const hasUrl = !!item.url

            const CardContent = (
              <div
                className="card rounded-2xl flex gap-3 p-3 relative z-20 transition-transform"
                style={{ transform: swipeId === item.id ? 'translateX(-70px)' : 'translateX(0)', transition: 'transform 0.2s' }}
              >
                {/* Thumbnail / Icon */}
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: `${catInfo.color}15` }}>
                  {item.thumbnail_url ? (
                    <Image src={item.thumbnail_url} alt="" width={64} height={64} className="object-cover w-full h-full" />
                  ) : hasUrl ? (
                    <CatIcon size={22} style={{ color: catInfo.color }} />
                  ) : (
                    <FileText size={22} style={{ color: catInfo.color }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-medium truncate" style={{ color: catInfo.color }}>
                      {hasUrl ? getDomain(item.url!) : displayTitle}
                    </p>
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: `${catInfo.color}15` }}>
                      <CatIcon size={9} style={{ color: catInfo.color }} />
                      <span className="text-[9px] font-semibold" style={{ color: catInfo.color }}>{catInfo.label}</span>
                    </div>
                  </div>
                  {item.title && hasUrl && (
                    <p className="text-sm font-medium line-clamp-1 leading-tight">{item.title}</p>
                  )}
                  {item.notes && (
                    <p className="text-sm font-medium line-clamp-2 leading-tight text-white/70">{item.notes}</p>
                  )}
                  <p className="text-[10px] text-white/25 mt-1">{format(new Date(item.created_at), 'd MMM yyyy')}</p>
                </div>

                {hasUrl ? (
                  <ExternalLink size={13} className="text-white/20 flex-shrink-0 mt-0.5" />
                ) : (
                  <FileText size={13} className="text-white/15 flex-shrink-0 mt-0.5" />
                )}
              </div>
            )

            return (
              <div
                key={item.id}
                className="relative overflow-hidden rounded-2xl"
                onTouchStart={handleTouchStart}
                onTouchEnd={e => handleTouchEnd(e, item.id)}
              >
                {/* Delete reveal */}
                {swipeId === item.id && (
                  <div className="absolute inset-0 flex items-center justify-end pr-4 z-10 rounded-2xl" style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <button onClick={() => deleteItem(item.id)}>
                      <Trash2 size={20} className="text-red-400" />
                    </button>
                  </div>
                )}

                {hasUrl ? (
                  <a
                    href={item.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={swipeId === item.id ? e => e.preventDefault() : undefined}
                  >
                    {CardContent}
                  </a>
                ) : (
                  <div onClick={swipeId === item.id ? undefined : undefined}>
                    {CardContent}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
