'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/utils'
import { useDateFormat } from '@/lib/hooks/useDateFormat'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth } from 'date-fns'
import { X, Plus, ChevronLeft, ChevronRight, Clock, Edit2, Check } from 'lucide-react'

interface AttendanceRecord {
  id: string; date: string
  clocked_in_at: string | null; clocked_out_at: string | null
  status: 'working' | 'leave' | 'day_off'; notes: string | null
}

interface CalendarEvent {
  id: string; date: string; title: string; description: string | null; color: string
}

function hoursWorked(r: AttendanceRecord): number {
  if (!r.clocked_in_at) return 0
  const out = r.clocked_out_at ? new Date(r.clocked_out_at) : new Date()
  return Math.max(0, (out.getTime() - new Date(r.clocked_in_at).getTime()) / 3600000)
}

function fmtHours(h: number): string {
  const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60)
  return `${hrs}h ${mins}m`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const EVENT_COLORS = ['#6C5DD3', '#4ade80', '#f59e0b', '#f87171', '#60a5fa', '#e879f9']

export default function AttendancePage() {
  const { fmtDayNum, fmtCalHeader, fmtDate, isBS } = useDateFormat()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [today, setToday] = useState<AttendanceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMonth, setViewMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [timeEdited, setTimeEdited] = useState(false)

  // Today clock edit
  const [editingTodayClock, setEditingTodayClock] = useState(false)
  const [editInTime, setEditInTime] = useState('')
  const [editOutTime, setEditOutTime] = useState('')

  // Day panel add event
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDesc, setEventDesc] = useState('')
  const [eventColor, setEventColor] = useState('#6C5DD3')

  // Day panel clock edit
  const [showClockEdit, setShowClockEdit] = useState(false)
  const [clockInTime, setClockInTime] = useState('')
  const [clockOutTime, setClockOutTime] = useState('')

  const todayStr = todayISO()

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const mStart = format(startOfMonth(viewMonth), 'yyyy-MM-dd')
    const mEnd = format(endOfMonth(viewMonth), 'yyyy-MM-dd')

    const [attRes, evtRes] = await Promise.all([
      supabase.from('attendance').select('*').eq('user_id', user.id).gte('date', mStart).lte('date', mEnd),
      supabase.from('calendar_events').select('*').eq('user_id', user.id).gte('date', mStart).lte('date', mEnd),
    ])
    setRecords(attRes.data ?? [])
    setEvents(evtRes.data ?? [])
    setToday((attRes.data ?? []).find(r => r.date === todayStr) ?? null)
    setLoading(false)
  }, [viewMonth, todayStr])

  useEffect(() => { load() }, [load])

  async function clockToggle() {
    setActionLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const now = new Date().toISOString()
    if (!today?.clocked_in_at) {
      await supabase.from('attendance').upsert({ user_id: user.id, date: todayStr, clocked_in_at: now, status: 'working' }, { onConflict: 'user_id,date' })
    } else if (!today.clocked_out_at) {
      await supabase.from('attendance').update({ clocked_out_at: now }).eq('user_id', user.id).eq('date', todayStr)
    }
    setActionLoading(false); load()
  }

  async function saveEditedTodayTime() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const base = todayStr + 'T'
    const inISO = editInTime ? base + editInTime + ':00' : today?.clocked_in_at
    const outISO = editOutTime ? base + editOutTime + ':00' : today?.clocked_out_at
    await supabase.from('attendance').upsert({ user_id: user.id, date: todayStr, clocked_in_at: inISO, clocked_out_at: outISO, status: 'working' }, { onConflict: 'user_id,date' })
    setEditingTodayClock(false)
    setTimeEdited(true)
    load()
  }

  function openTodayEdit() {
    setEditInTime(today?.clocked_in_at ? format(new Date(today.clocked_in_at), 'HH:mm') : '')
    setEditOutTime(today?.clocked_out_at ? format(new Date(today.clocked_out_at), 'HH:mm') : '')
    setEditingTodayClock(true)
  }

  async function markStatus(date: string, status: 'leave' | 'day_off' | null) {
    setActionLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    if (status === null) {
      await supabase.from('attendance').delete().eq('user_id', user.id).eq('date', date)
    } else {
      await supabase.from('attendance').upsert({ user_id: user.id, date, status, clocked_in_at: null, clocked_out_at: null }, { onConflict: 'user_id,date' })
    }
    setActionLoading(false); load()
  }

  async function addEvent() {
    if (!eventTitle.trim() || !selectedDay) return
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    await supabase.from('calendar_events').insert({ user_id: user.id, date: selectedDay, title: eventTitle.trim(), description: eventDesc.trim() || null, color: eventColor })
    setEventTitle(''); setEventDesc(''); setShowAddEvent(false); load()
  }

  async function deleteEvent(id: string) {
    const supabase = createClient()
    await supabase.from('calendar_events').delete().eq('id', id)
    load()
  }

  async function saveDayClockEdit() {
    if (!selectedDay) return
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const base = selectedDay + 'T'
    await supabase.from('attendance').upsert({ user_id: user.id, date: selectedDay, clocked_in_at: clockInTime ? base + clockInTime + ':00' : null, clocked_out_at: clockOutTime ? base + clockOutTime + ':00' : null, status: 'working' }, { onConflict: 'user_id,date' })
    setShowClockEdit(false); load()
  }

  // Calendar
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd })

  function getRecord(ds: string) { return records.find(r => r.date === ds) }
  function getDayEvents(ds: string) { return events.filter(e => e.date === ds) }

  function dayBg(ds: string) {
    const rec = getRecord(ds)
    if (!rec) return 'transparent'
    if (rec.status === 'working' && rec.clocked_in_at) return 'rgba(74,222,128,0.12)'
    if (rec.status === 'leave') return 'rgba(248,113,113,0.12)'
    if (rec.status === 'day_off') return 'rgba(255,255,255,0.04)'
    return 'transparent'
  }

  function dayColor(ds: string) {
    const rec = getRecord(ds)
    if (!rec) return 'rgba(244,241,248,0.45)'
    if (rec.status === 'working' && rec.clocked_in_at) return '#4ade80'
    if (rec.status === 'leave') return '#f87171'
    if (rec.status === 'day_off') return 'rgba(244,241,248,0.2)'
    return 'rgba(244,241,248,0.45)'
  }

  const isClockedIn = today?.status === 'working' && !!today.clocked_in_at && !today.clocked_out_at
  const selectedRec = selectedDay ? getRecord(selectedDay) : null
  const selectedEvents = selectedDay ? getDayEvents(selectedDay) : []

  // Summary
  const wkStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const wkEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
  const wkRecords = records.filter(r => { const d = new Date(r.date); return d >= wkStart && d <= wkEnd })
  const wkHours = wkRecords.filter(r => r.status === 'working').reduce((s, r) => s + hoursWorked(r), 0)
  const wkDays = wkRecords.filter(r => r.status === 'working' && r.clocked_in_at).length
  const mHours = records.filter(r => r.status === 'working').reduce((s, r) => s + hoursWorked(r), 0)
  const mDays = records.filter(r => r.status === 'working' && r.clocked_in_at).length

  return (
    <div className="min-h-screen px-5 pt-6 page-enter">
      <h1 className="text-xl font-bold mb-5">Attendance</h1>

      {/* Today card */}
      <div className="card rounded-3xl p-5 mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider">{fmtDate(todayStr)}</p>
            <p className={`text-sm font-semibold mt-0.5 ${isClockedIn ? 'text-green-400' : today?.status === 'leave' ? 'text-red-400' : today?.status === 'day_off' ? 'text-white/30' : 'text-white/40'}`}>
              {isClockedIn ? `● Working · ${fmtHours(hoursWorked(today!))}` :
               today?.clocked_out_at ? `Done · ${fmtHours(hoursWorked(today))}` :
               today?.status === 'leave' ? 'On leave' :
               today?.status === 'day_off' ? 'Day off' : 'Not started'}
            </p>
            {/* Clock-in/out times */}
            {today?.clocked_in_at && (
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-white/40">
                  In: <span className="text-white/70 font-semibold">{fmtTime(today.clocked_in_at)}</span>
                </span>
                {today.clocked_out_at && (
                  <span className="text-xs text-white/40">
                    Out: <span className="text-white/70 font-semibold">{fmtTime(today.clocked_out_at)}</span>
                  </span>
                )}
                {timeEdited && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(168,126,255,0.15)', color: '#A87EFF' }}>Edited</span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {today?.clocked_in_at && (
              <button
                onClick={openTodayEdit}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(108,93,211,0.15)' }}
              >
                <Edit2 size={14} className="text-accent" />
              </button>
            )}
            <div className={`w-3 h-3 rounded-full ${isClockedIn ? 'bg-green-400' : 'bg-red-500'}`} style={{ boxShadow: isClockedIn ? '0 0 8px rgba(74,222,128,0.6)' : '0 0 8px rgba(239,68,68,0.5)' }} />
          </div>
        </div>

        {/* Edit today time */}
        {editingTodayClock && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(108,93,211,0.1)' }}>
            <p className="text-xs font-semibold text-white/50 mb-3">Edit clock times for today</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-[10px] text-white/30 block mb-1">Clock in</label>
                <input className="input text-sm" type="time" value={editInTime} onChange={e => setEditInTime(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-white/30 block mb-1">Clock out</label>
                <input className="input text-sm" type="time" value={editOutTime} onChange={e => setEditOutTime(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveEditedTodayTime} className="flex-1 py-2 rounded-xl text-xs font-bold bg-primary text-white flex items-center justify-center gap-1">
                <Check size={12} /> Save
              </button>
              <button onClick={() => setEditingTodayClock(false)} className="flex-1 py-2 rounded-xl text-xs font-semibold text-white/40" style={{ background: 'rgba(255,255,255,0.05)' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Clock button */}
        {(!today?.status || today.status === 'working') && !editingTodayClock && (
          <button
            onClick={clockToggle}
            disabled={actionLoading || !!today?.clocked_out_at}
            className={`w-full py-4 rounded-2xl font-bold transition-all active:scale-98 ${isClockedIn ? 'bg-red-500/80 text-white' : today?.clocked_out_at ? 'bg-white/07 text-white/30' : 'text-white'}`}
            style={!isClockedIn && !today?.clocked_out_at ? { background: 'linear-gradient(135deg,#4ade80,#16a34a)', boxShadow: '0 4px 20px rgba(74,222,128,0.25)' } : {}}
          >
            {actionLoading ? '…' : isClockedIn ? 'Clock Out' : today?.clocked_out_at ? 'Clocked out for today' : 'Clock In'}
          </button>
        )}

        {!isClockedIn && !today?.clocked_out_at && !editingTodayClock && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => markStatus(todayStr, today?.status === 'leave' ? null : 'leave')} className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all" style={{ background: today?.status === 'leave' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', color: today?.status === 'leave' ? '#f87171' : 'rgba(244,241,248,0.4)' }}>
              {today?.status === 'leave' ? '✓ Leave' : 'Mark Leave'}
            </button>
            <button onClick={() => markStatus(todayStr, today?.status === 'day_off' ? null : 'day_off')} className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all" style={{ background: today?.status === 'day_off' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)', color: today?.status === 'day_off' ? 'rgba(244,241,248,0.6)' : 'rgba(244,241,248,0.4)' }}>
              {today?.status === 'day_off' ? '✓ Day Off' : 'Mark Day Off'}
            </button>
          </div>
        )}
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-bold">{fmtCalHeader(viewMonth)}</span>
        <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Calendar */}
      <div className="card rounded-2xl p-4 mb-5">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAY_LABELS.map(l => <div key={l} className="text-center text-[10px] text-white/25 font-medium">{l}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calDays.map(d => {
            const ds = format(d, 'yyyy-MM-dd')
            const inMonth = isSameMonth(d, viewMonth)
            const isToday = ds === todayStr
            const dayEvts = getDayEvents(ds)
            const isSelected = ds === selectedDay
            const dayNum = fmtDayNum(d)
            return (
              <button
                key={ds}
                onClick={() => setSelectedDay(ds === selectedDay ? null : ds)}
                className="flex flex-col items-center py-1.5 rounded-xl transition-all"
                style={{
                  background: isSelected ? 'rgba(108,93,211,0.25)' : dayBg(ds),
                  border: isSelected ? '1px solid #6C5DD3' : isToday ? '1px solid rgba(108,93,211,0.4)' : '1px solid transparent',
                  opacity: inMonth ? 1 : 0.2,
                }}
              >
                <span className="text-xs font-semibold leading-none" style={{ color: isToday ? '#A87EFF' : dayColor(ds) }}>
                  {dayNum}
                </span>
                {dayEvts.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dayEvts.slice(0, 3).map(e => (
                      <div key={e.id} className="w-1 h-1 rounded-full" style={{ background: e.color }} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t justify-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {[{ color: '#4ade80', label: 'Worked' }, { color: '#f87171', label: 'Leave' }, { color: 'rgba(255,255,255,0.15)', label: 'Day Off' }, { color: '#6C5DD3', label: 'Event' }].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-white/30">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div className="card rounded-2xl p-5 mb-5" style={{ border: '1px solid rgba(108,93,211,0.3)' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold">{fmtDate(selectedDay)}</p>
              {selectedRec?.status === 'working' && selectedRec.clocked_in_at && (
                <p className="text-xs text-green-400 mt-0.5">{fmtHours(hoursWorked(selectedRec))} worked</p>
              )}
            </div>
            <button onClick={() => setSelectedDay(null)}><X size={16} className="text-white/40" /></button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Worked', value: 'working', active: selectedRec?.status === 'working' && !!selectedRec.clocked_in_at, color: 'rgba(74,222,128,0.15)' },
              { label: 'Leave', value: 'leave', active: selectedRec?.status === 'leave', color: 'rgba(248,113,113,0.15)' },
              { label: 'Day Off', value: 'day_off', active: selectedRec?.status === 'day_off', color: 'rgba(255,255,255,0.07)' },
            ].map(({ label, value, active, color }) => (
              <button key={value} onClick={() => {
                if (value === 'working') {
                  setClockInTime(selectedRec?.clocked_in_at ? format(new Date(selectedRec.clocked_in_at), 'HH:mm') : '09:00')
                  setClockOutTime(selectedRec?.clocked_out_at ? format(new Date(selectedRec.clocked_out_at), 'HH:mm') : '17:00')
                  setShowClockEdit(true)
                } else {
                  markStatus(selectedDay, active ? null : value as 'leave' | 'day_off')
                }
              }}
                className="py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: active ? color : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`, color: active ? '#F4F1F8' : 'rgba(244,241,248,0.35)' }}
              >
                {label}
              </button>
            ))}
          </div>

          {showClockEdit && (
            <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(108,93,211,0.1)' }}>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div><label className="text-[10px] text-white/30 block mb-1">Clock in</label><input className="input text-sm" type="time" value={clockInTime} onChange={e => setClockInTime(e.target.value)} /></div>
                <div><label className="text-[10px] text-white/30 block mb-1">Clock out</label><input className="input text-sm" type="time" value={clockOutTime} onChange={e => setClockOutTime(e.target.value)} /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveDayClockEdit} className="flex-1 py-2 rounded-xl text-xs font-bold bg-primary text-white">Save</button>
                <button onClick={() => setShowClockEdit(false)} className="flex-1 py-2 rounded-xl text-xs font-semibold text-white/40" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Events */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-white/40">Events</p>
              <button onClick={() => setShowAddEvent(v => !v)} className="w-6 h-6 rounded-lg bg-primary/30 flex items-center justify-center">
                <Plus size={12} className="text-accent" />
              </button>
            </div>
            {showAddEvent && (
              <div className="mb-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <input className="input text-sm mb-2" placeholder="Event title" value={eventTitle} onChange={e => setEventTitle(e.target.value)} />
                <input className="input text-sm mb-2" placeholder="Description (optional)" value={eventDesc} onChange={e => setEventDesc(e.target.value)} />
                <div className="flex gap-2 mb-3">
                  {EVENT_COLORS.map(c => <button key={c} type="button" onClick={() => setEventColor(c)} className="w-6 h-6 rounded-full" style={{ background: c, outline: eventColor === c ? '2px solid #fff' : 'none', outlineOffset: 2 }} />)}
                </div>
                <button onClick={addEvent} className="w-full py-2 rounded-xl text-xs font-bold bg-primary text-white">Add Event</button>
              </div>
            )}
            {selectedEvents.length === 0 && !showAddEvent && <p className="text-xs text-white/20 py-1">No events — tap + to add</p>}
            {selectedEvents.map(evt => (
              <div key={evt.id} className="flex items-center gap-2 py-2 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: evt.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{evt.title}</p>
                  {evt.description && <p className="text-[10px] text-white/30">{evt.description}</p>}
                </div>
                <button onClick={() => deleteEvent(evt.id)} className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <X size={10} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events list below calendar */}
      {events.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-white/50 mb-3 flex items-center gap-2">
            Events in {fmtCalHeader(viewMonth).split(' ')[0]}
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(108,93,211,0.2)', color: '#A87EFF' }}>{events.length}</span>
          </h2>
          <div className="flex flex-col gap-2">
            {[...events].sort((a, b) => a.date.localeCompare(b.date)).map(evt => (
              <div key={evt.id} className="card rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: evt.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{evt.title}</p>
                  <p className="text-xs text-white/30 mt-0.5">{fmtDate(evt.date)}</p>
                  {evt.description && <p className="text-xs text-white/40 truncate">{evt.description}</p>}
                </div>
                <button onClick={() => deleteEvent(evt.id)} className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <X size={12} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div className="card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-1"><Clock size={12} className="text-primary" /><p className="text-[10px] text-white/40 uppercase tracking-wider">This week</p></div>
          <p className="text-lg font-bold">{fmtHours(wkHours)}</p>
          <p className="text-xs text-white/30">{wkDays} days worked</p>
        </div>
        <div className="card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-1"><Clock size={12} className="text-accent" /><p className="text-[10px] text-white/40 uppercase tracking-wider">This month</p></div>
          <p className="text-lg font-bold">{fmtHours(mHours)}</p>
          <p className="text-xs text-white/30">{mDays} days worked</p>
        </div>
      </div>
    </div>
  )
}
