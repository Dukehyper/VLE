'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSettings } from '@/components/SettingsContext'
import { formatDate } from '@/lib/utils'
import { format, eachDayOfInterval, parseISO } from 'date-fns'
import { Plus, X, Calendar } from 'lucide-react'

interface LeaveRecord {
  id: string
  date: string
  notes: string | null
}

export default function LeavePage() {
  const { leave_allowance } = useSettings()
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('attendance')
      .select('id, date, notes')
      .eq('user_id', user.id)
      .eq('status', 'leave')
      .order('date', { ascending: false })
    setLeaveRecords(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const taken = leaveRecords.length
  const remaining = Math.max(0, leave_allowance - taken)
  const pct = leave_allowance > 0 ? Math.min(100, (taken / leave_allowance) * 100) : 0

  async function addLeave(e: React.FormEvent) {
    e.preventDefault()
    if (endDate < startDate) { setError('End date must be after start date'); return }
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) })
    const rows = days.map(d => ({
      user_id: user.id,
      date: format(d, 'yyyy-MM-dd'),
      status: 'leave' as const,
      notes: notes || null,
    }))

    const { error: err } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'user_id,date' })

    setSaving(false)
    if (err) { setError(err.message); return }
    setShowAdd(false)
    setNotes('')
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
    setEndDate(format(new Date(), 'yyyy-MM-dd'))
    load()
  }

  async function deleteLeave(id: string) {
    const supabase = createClient()
    await supabase.from('attendance').delete().eq('id', id)
    load()
  }

  return (
    <div className="min-h-screen px-5 pt-6 page-enter">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Leave Tracker</h1>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold">{leave_allowance}</p>
          <p className="text-[11px] text-white/40 mt-0.5">Allowance</p>
        </div>
        <div className="card rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{taken}</p>
          <p className="text-[11px] text-white/40 mt-0.5">Taken</p>
        </div>
        <div className="card rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{remaining}</p>
          <p className="text-[11px] text-white/40 mt-0.5">Remaining</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card rounded-2xl p-5 mb-6">
        <div className="flex justify-between text-xs text-white/40 mb-3">
          <span>{taken} days used</span>
          <span>{remaining} days left</span>
        </div>
        <div className="progress-track h-3">
          <div
            className="h-3 rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: pct > 80 ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'linear-gradient(90deg, #6C5DD3, #A87EFF)',
            }}
          />
        </div>
        <p className="text-xs text-white/30 mt-2">{Math.round(pct)}% of annual allowance used</p>
      </div>

      {/* Add Leave Form */}
      {showAdd && (
        <div className="card rounded-2xl p-5 mb-5">
          <h3 className="text-sm font-semibold mb-4">Add Leave</h3>
          <form onSubmit={addLeave} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">From</label>
                <input className="input text-sm" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">To</label>
                <input className="input text-sm" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Notes (optional)</label>
              <input className="input text-sm" type="text" placeholder="e.g. Annual holiday" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Add Leave Days'}
            </button>
          </form>
        </div>
      )}

      {/* Leave list */}
      <h2 className="text-sm font-semibold text-white/50 mb-3">All Leave Dates</h2>
      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}
        </div>
      ) : leaveRecords.length === 0 ? (
        <div className="card rounded-2xl p-8 text-center">
          <Calendar size={28} className="text-white/20 mx-auto mb-2" />
          <p className="text-white/30 text-sm">No leave taken yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {leaveRecords.map(r => (
            <div key={r.id} className="card rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{formatDate(r.date)}</p>
                {r.notes && <p className="text-xs text-white/30 mt-0.5">{r.notes}</p>}
              </div>
              <button onClick={() => deleteLeave(r.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <X size={13} className="text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
