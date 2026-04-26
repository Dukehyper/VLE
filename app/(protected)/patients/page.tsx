'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayISO, formatDate } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { Plus, Minus, UserPlus } from 'lucide-react'

interface Visit {
  id: string
  date: string
  count: number
  notes: string | null
}

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function PatientsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [today, setToday] = useState<Visit | null>(null)
  const [loading, setLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [viewMonth, setViewMonth] = useState(new Date())
  const [view, setView] = useState<'calendar' | 'list'>('calendar')

  const todayStr = todayISO()

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const monthStart = format(startOfMonth(viewMonth), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(viewMonth), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('patient_visits')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false })

    setVisits(data ?? [])
    const t = (data ?? []).find(v => v.date === todayStr)
    setToday(t ?? null)
    if (t) setNoteText(t.notes ?? '')
    setLoading(false)
  }, [viewMonth, todayStr])

  useEffect(() => { load() }, [load])

  async function adjust(delta: number) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const newCount = Math.max(0, (today?.count ?? 0) + delta)
    await supabase.from('patient_visits').upsert({
      user_id: user.id, date: todayStr, count: newCount, notes: today?.notes ?? null,
    }, { onConflict: 'user_id,date' })
    load()
  }

  async function saveNote() {
    if (!today) return
    setNoteSaving(true)
    const supabase = createClient()
    await supabase.from('patient_visits').update({ notes: noteText || null }).eq('id', today.id)
    setNoteSaving(false)
    load()
  }

  const monthTotal = visits.reduce((s, v) => s + v.count, 0)

  // Calendar
  const calDays = eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) })
  const firstDow = (startOfMonth(viewMonth).getDay() + 6) % 7

  function countForDay(ds: string): number {
    return visits.find(v => v.date === ds)?.count ?? 0
  }

  return (
    <div className="min-h-screen px-5 pt-6 page-enter">
      <h1 className="text-xl font-bold mb-5">Patient Tracker</h1>

      {/* Today counter */}
      <div className="card rounded-3xl p-6 mb-5">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-4">{format(new Date(), 'EEEE, d MMM')}</p>
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => adjust(-1)}
            disabled={!today || today.count === 0}
            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <Minus size={22} className="text-red-400" />
          </button>

          <div className="text-center">
            <p className="text-6xl font-black tabular-nums">{today?.count ?? 0}</p>
            <p className="text-xs text-white/30 mt-1">today</p>
          </div>

          <button
            onClick={() => adjust(1)}
            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95"
            style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            <Plus size={22} className="text-green-400" />
          </button>
        </div>

        {/* Note */}
        <div className="mt-5">
          <input
            className="input text-sm"
            placeholder="Add a note for today…"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onBlur={saveNote}
          />
        </div>
      </div>

      {/* Monthly total */}
      <div className="card rounded-2xl p-4 mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/40">This month's total</p>
          <p className="text-2xl font-bold">{monthTotal} <span className="text-sm font-normal text-white/30">patients</span></p>
        </div>
        <UserPlus size={24} className="text-accent" />
      </div>

      {/* View toggle */}
      <div className="flex gap-2 mb-4">
        {(['calendar', 'list'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`tab-btn ${view === v ? 'active' : ''}`}>
            {v === 'calendar' ? 'Calendar' : 'List'}
          </button>
        ))}
      </div>

      {view === 'calendar' ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>‹</button>
            <span className="text-sm font-semibold">{format(viewMonth, 'MMMM yyyy')}</span>
            <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map(l => <div key={l} className="text-center text-[10px] text-white/30">{l}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {[...Array(firstDow)].map((_, i) => <div key={`e${i}`} />)}
            {calDays.map(d => {
              const ds = format(d, 'yyyy-MM-dd')
              const count = countForDay(ds)
              const isToday = ds === todayStr
              const intensity = Math.min(1, count / 10)
              return (
                <div
                  key={ds}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg ${isToday ? 'ring-1 ring-primary' : ''}`}
                  style={{ background: count > 0 ? `rgba(168,126,255,${0.15 + intensity * 0.4})` : 'transparent' }}
                >
                  <span className="text-[10px] text-white/40">{format(d, 'd')}</span>
                  {count > 0 && <span className="text-[9px] font-bold text-accent">{count}</span>}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {loading ? (
            [...Array(4)].map((_, i) => <div key={i} className="skeleton h-14 rounded-2xl" />)
          ) : visits.length === 0 ? (
            <div className="card rounded-2xl p-8 text-center">
              <UserPlus size={28} className="text-white/20 mx-auto mb-2" />
              <p className="text-white/30 text-sm">No visits recorded this month</p>
            </div>
          ) : (
            [...visits].sort((a, b) => b.date.localeCompare(a.date)).map(v => (
              <div key={v.id} className="card rounded-2xl px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium">{formatDate(v.date)}</p>
                  {v.notes && <p className="text-xs text-white/30 mt-0.5">{v.notes}</p>}
                </div>
                <span className="text-xl font-bold text-accent">{v.count}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
