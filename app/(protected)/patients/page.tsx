'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayISO, formatDate } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns'
import { Plus, Minus, UserPlus, Edit2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useDateFormat } from '@/lib/hooks/useDateFormat'

interface Visit {
  id: string; date: string; count: number; notes: string | null
}

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function PatientsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMonth, setViewMonth] = useState(new Date())
  const [view, setView] = useState<'calendar' | 'list'>('list')

  // Entry form for any date
  const [entryDate, setEntryDate] = useState(todayISO())
  const [entryCount, setEntryCount] = useState(0)
  const [entryNote, setEntryNote] = useState('')
  const [entrySaving, setEntrySaving] = useState(false)

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCount, setEditCount] = useState(0)
  const [editNote, setEditNote] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const todayStr = todayISO()
  const { fmtDate, fmtDayNum, fmtCalHeader } = useDateFormat()

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const mStart = format(startOfMonth(viewMonth), 'yyyy-MM-dd')
    const mEnd = format(endOfMonth(viewMonth), 'yyyy-MM-dd')
    const { data } = await supabase.from('patient_visits').select('*').eq('user_id', user.id).gte('date', mStart).lte('date', mEnd).order('date', { ascending: false })
    setVisits(data ?? [])
    setLoading(false)
  }, [viewMonth])

  useEffect(() => { load() }, [load])

  // Pre-fill form with today's existing entry
  useEffect(() => {
    const existing = visits.find(v => v.date === entryDate)
    if (existing) {
      setEntryCount(existing.count)
      setEntryNote(existing.notes ?? '')
    } else {
      setEntryCount(0)
      setEntryNote('')
    }
  }, [entryDate, visits])

  async function saveEntry() {
    setEntrySaving(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    await supabase.from('patient_visits').upsert({ user_id: user.id, date: entryDate, count: entryCount, notes: entryNote.trim() || null }, { onConflict: 'user_id,date' })
    setEntrySaving(false)
    load()
  }

  function startEdit(v: Visit) {
    setEditingId(v.id)
    setEditCount(v.count)
    setEditNote(v.notes ?? '')
  }

  async function saveEdit(v: Visit) {
    setEditSaving(true)
    const supabase = createClient()
    await supabase.from('patient_visits').update({ count: editCount, notes: editNote.trim() || null }).eq('id', v.id)
    setEditSaving(false)
    setEditingId(null)
    load()
  }

  async function deleteVisit(id: string) {
    const supabase = createClient()
    await supabase.from('patient_visits').delete().eq('id', id)
    load()
  }

  const monthTotal = visits.reduce((s, v) => s + v.count, 0)
  const isCurrentMonth = viewMonth.getMonth() === new Date().getMonth() && viewMonth.getFullYear() === new Date().getFullYear()

  // Calendar
  const calDays = eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) })
  const firstDow = (startOfMonth(viewMonth).getDay() + 6) % 7
  function countForDay(ds: string) { return visits.find(v => v.date === ds)?.count ?? 0 }

  return (
    <div className="min-h-screen px-5 pt-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">Patients</h1>
        <div className="card rounded-2xl px-4 py-2 flex items-center gap-2">
          <UserPlus size={14} className="text-accent" />
          <span className="text-sm font-bold text-accent">{monthTotal}</span>
          <span className="text-xs text-white/30">this month</span>
        </div>
      </div>

      {/* Entry form */}
      <div className="card rounded-2xl p-5 mb-5" style={{ border: '1px solid rgba(108,93,211,0.2)' }}>
        <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Log Visit</p>

        <div className="mb-4">
          <label className="text-xs text-white/40 mb-1.5 block">Date</label>
          <input className="input text-sm" type="date" value={entryDate} max={todayStr} onChange={e => setEntryDate(e.target.value)} />
        </div>

        <div className="mb-4">
          <label className="text-xs text-white/40 mb-3 block">Number of Patients</label>
          <div className="flex items-center gap-4 justify-center">
            <button
              onClick={() => setEntryCount(c => Math.max(0, c - 1))}
              className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <Minus size={20} className="text-red-400" />
            </button>
            <input
              type="number"
              min={0}
              value={entryCount}
              onChange={e => setEntryCount(Math.max(0, parseInt(e.target.value) || 0))}
              className="text-5xl font-black text-center bg-transparent outline-none w-24 tabular-nums"
            />
            <button
              onClick={() => setEntryCount(c => c + 1)}
              className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95"
              style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.2)' }}
            >
              <Plus size={20} className="text-green-400" />
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-white/40 mb-1.5 block">Notes (optional)</label>
          <textarea className="input text-sm resize-none" rows={2} placeholder="Any notes for this session…" value={entryNote} onChange={e => setEntryNote(e.target.value)} />
        </div>

        <button onClick={saveEntry} className="btn-primary" disabled={entrySaving}>
          {entrySaving ? 'Saving…' : visits.find(v => v.date === entryDate) ? 'Update Entry' : 'Save Entry'}
        </button>
      </div>

      {/* View toggle + month nav */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {(['list', 'calendar'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`tab-btn ${view === v ? 'active' : ''}`}>
              {v === 'list' ? 'List' : 'Calendar'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs font-semibold">{fmtCalHeader(viewMonth)}</span>
          <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} disabled={isCurrentMonth} className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="card rounded-2xl p-4 mb-4">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map(l => <div key={l} className="text-center text-[10px] text-white/25">{l}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {[...Array(firstDow)].map((_, i) => <div key={`e${i}`} />)}
            {calDays.map(d => {
              const ds = format(d, 'yyyy-MM-dd')
              const count = countForDay(ds)
              const isToday = ds === todayStr
              const intensity = Math.min(1, count / 10)
              return (
                <button
                  key={ds}
                  onClick={() => setEntryDate(ds)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-all`}
                  style={{
                    background: count > 0 ? `rgba(168,126,255,${0.12 + intensity * 0.35})` : 'transparent',
                    border: entryDate === ds ? '1px solid #6C5DD3' : isToday ? '1px solid rgba(108,93,211,0.3)' : '1px solid transparent',
                  }}
                >
                  <span className="text-[10px] text-white/40">{fmtDayNum(d)}</span>
                  {count > 0 && <span className="text-[9px] font-bold text-accent leading-none">{count}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {loading ? (
            [...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)
          ) : visits.length === 0 ? (
            <div className="card rounded-2xl p-8 text-center">
              <UserPlus size={28} className="text-white/20 mx-auto mb-2" />
              <p className="text-white/30 text-sm">No entries this month</p>
            </div>
          ) : (
            [...visits].sort((a, b) => b.date.localeCompare(a.date)).map(v => (
              <div key={v.id} className="card rounded-2xl px-4 py-3">
                {editingId === v.id ? (
                  /* Edit mode */
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs text-white/40 flex-shrink-0">{fmtDate(v.date)}</span>
                      <input type="number" min={0} value={editCount} onChange={e => setEditCount(parseInt(e.target.value) || 0)} className="input text-sm w-20 text-center font-bold" />
                    </div>
                    <input className="input text-sm mb-2" placeholder="Notes…" value={editNote} onChange={e => setEditNote(e.target.value)} />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(v)} disabled={editSaving} className="flex-1 py-2 rounded-xl text-xs font-bold bg-primary text-white flex items-center justify-center gap-1">
                        <Check size={12} /> {editSaving ? '…' : 'Save'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="flex-1 py-2 rounded-xl text-xs font-semibold text-white/40" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{fmtDate(v.date)}</p>
                      {v.notes && <p className="text-xs text-white/30 mt-0.5">{v.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-black text-accent">{v.count}</span>
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(v)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(108,93,211,0.15)' }}>
                          <Edit2 size={12} className="text-accent" />
                        </button>
                        <button onClick={() => deleteVisit(v.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                          <X size={12} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
