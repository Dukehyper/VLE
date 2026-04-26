'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth } from 'date-fns'
import { X, Plus, ChevronLeft, ChevronRight, Clock } from 'lucide-react'

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

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const EVENT_COLORS = ['#6C5DD3', '#4ade80', '#f59e0b', '#f87171', '#60a5fa', '#e879f9']

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [today, setToday] = useState<AttendanceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMonth, setViewMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Add event form
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDesc, setEventDesc] = useState('')
  const [eventColor, setEventColor] = useState('#6C5DD3')

  // Edit clocked time modal
  const [showClockEdit, setShowClockEdit] = useState(false)
  const [clockInTime, setClockInTime] = useState('')
  const [clockOutTime, setClockOutTime] = useState('')

  const todayStr = todayISO()

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const now = new Date().toISOString()
    if (!today?.clocked_in_at) {
      await supabase.from('attendance').upsert({ user_id: user.id, date: todayStr, clocked_in_at: now, status: 'working' }, { onConflict: 'user_id,date' })
    } else if (!today.clocked_out_at) {
      await supabase.from('attendance').update({ clocked_out_at: now }).eq('user_id', user.id).eq('date', todayStr)
    }
    setActionLoading(false); load()
  }

  async function markStatus(date: string, status: 'leave' | 'day_off' | null) {
    setActionLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
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
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('calendar_events').insert({ user_id: user.id, date: selectedDay, title: eventTitle.trim(), description: eventDesc.trim() || null, color: eventColor })
    setEventTitle(''); setEventDesc(''); setShowAddEvent(false); load()
  }

  async function deleteEvent(id: string) {
    const supabase = createClient()
    await supabase.from('calendar_events').delete().eq('id', id)
    load()
  }

  async function saveClockEdit() {
    if (!selectedDay) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const base = selectedDay + 'T'
    const inISO = clockInTime ? base + clockInTime + ':00.000Z' : null
    const outISO = clockOutTime ? base + clockOutTime + ':00.000Z' : null
    await supabase.from('attendance').upsert({ user_id: user.id, date: selectedDay, clocked_in_at: inISO, clocked_out_at: outISO, status: 'working' }, { onConflict: 'user_id,date' })
    setShowClockEdit(false); load()
  }

  // Calendar
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd })
  const firstDow = (monthStart.getDay() + 6) % 7

  function getRecord(ds: string) { return records.find(r => r.date === ds) }
  function getDayEvents(ds: string) { return events.filter(e => e.date === ds) }

  function dayBg(ds: string): string {
    const rec = getRecord(ds)
    if (!rec) return 'transparent'
    if (rec.status === 'working' && rec.clocked_in_at) return 'rgba(74,222,128,0.12)'
    if (rec.status === 'leave') return 'rgba(248,113,113,0.12)'
    if (rec.status === 'day_off') return 'rgba(255,255,255,0.04)'
    return 'transparent'
  }

  function dayTextColor(ds: string): string {
    const rec = getRecord(ds)
    if (!rec) return 'rgba(244,241,248,0.5)'
    if (rec.status === 'working' && rec.clocked_in_at) return '#4ade80'
    if (rec.status === 'leave') return '#f87171'
    if (rec.status === 'day_off') return 'rgba(244,241,248,0.25)'
    return 'rgba(244,241,248,0.5)'
  }

  const selectedRec = selectedDay ? getRecord(selectedDay) : null
  const selectedEvents = selectedDay ? getDayEvents(selectedDay) : []
  const isClockedIn = today?.status === 'working' && !!today.clocked_in_at && !today.clocked_out_at

  // Week summary
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

      {/* Today clock card */}
      <div className="card rounded-3xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider">{format(new Date(), 'EEEE, d MMM')}</p>
            <p className={`text-sm font-semibold mt-0.5 ${isClockedIn ? 'text-green-400' : today?.status === 'leave' ? 'text-red-400' : today?.status === 'day_off' ? 'text-white/30' : 'text-white/40'}`}>
              {isClockedIn ? `● Working · ${fmtHours(hoursWorked(today!))}` :
               today?.clocked_out_at ? `Done · ${fmtHours(hoursWorked(today))}` :
               today?.status === 'leave' ? 'On leave' :
               today?.status === 'day_off' ? 'Day off' : 'Not started'}
            </p>
          </div>
          <div className={`w-3 h-3 rounded-full ${isClockedIn ? 'bg-green-400' : 'bg-red-500'}`} style={{ boxShadow: isClockedIn ? '0 0 8px rgba(74,222,128,0.6)' : '0 0 8px rgba(239,68,68,0.5)' }} />
        </div>

        {!today?.status || today.status === 'working' ? (
          <button
            onClick={clockToggle}
            disabled={actionLoading || (!!today?.clocked_out_at)}
            className={`w-full py-4 rounded-2xl font-bold transition-all active:scale-98 ${
              isClockedIn ? 'bg-red-500/80 text-white' :
              today?.clocked_out_at ? 'bg-white/07 text-white/30' : 'text-white'
            }`}
            style={!isClockedIn && !today?.clocked_out_at ? { background: 'linear-gradient(135deg,#4ade80,#16a34a)', boxShadow: '0 4px 20px rgba(74,222,128,0.25)' } : {}}
          >
            {actionLoading ? '…' : isClockedIn ? 'Clock Out' : today?.clocked_out_at ? 'Clocked out for today' : 'Clock In'}
          </button>
        ) : null}

        {!isClockedIn && !today?.clocked_out_at && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => markStatus(todayStr, today?.status === 'leave' ? null : 'leave')} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${today?.status === 'leave' ? 'text-red-300' : 'text-white/40'}`} style={{ background: today?.status === 'leave' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)' }}>
              {today?.status === 'leave' ? '✓ Leave' : 'Mark Leave'}
            </button>
            <button onClick={() => markStatus(todayStr, today?.status === 'day_off' ? null : 'day_off')} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${today?.status === 'day_off' ? 'text-white/60' : 'text-white/40'}`} style={{ background: 'rgba(255,255,255,0.05)' }}>
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
        <span className="text-sm font-bold">{format(viewMonth, 'MMMM yyyy')}</span>
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
            return (
              <button
                key={ds}
                onClick={() => setSelectedDay(ds === selectedDay ? null : ds)}
                className="flex flex-col items-center py-1.5 rounded-xl transition-all"
                style={{
                  background: isSelected ? 'rgba(108,93,211,0.25)' : dayBg(ds),
                  border: isSelected ? '1px solid #6C5DD3' : isToday ? '1px solid rgba(108,93,211,0.4)' : '1px solid transparent',
                  opacity: inMonth ? 1 : 0.25,
                }}
              >
                <span className="text-xs font-semibold" style={{ color: isToday ? '#A87EFF' : dayTextColor(ds) }}>
                  {format(d, 'd')}
                </span>
                {/* Event dots */}
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

        {/* Legend */}
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
              <p className="text-sm font-bold">{format(new Date(selectedDay + 'T12:00:00'), 'EEEE, d MMMM yyyy')}</p>
              {selectedRec?.status === 'working' && selectedRec.clocked_in_at && (
                <p className="text-xs text-green-400 mt-0.5">{fmtHours(hoursWorked(selectedRec))} worked</p>
              )}
            </div>
            <button onClick={() => setSelectedDay(null)}><X size={16} className="text-white/40" /></button>
          </div>

          {/* Attendance actions */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Worked', value: 'working', color: 'rgba(74,222,128,0.15)', active: selectedRec?.status === 'working' && !!selectedRec.clocked_in_at },
              { label: 'Leave', value: 'leave', color: 'rgba(248,113,113,0.15)', active: selectedRec?.status === 'leave' },
              { label: 'Day Off', value: 'day_off', color: 'rgba(255,255,255,0.07)', active: selectedRec?.status === 'day_off' },
            ].map(({ label, value, color, active }) => (
              <button
                key={value}
                onClick={() => {
                  if (value === 'working') { setShowClockEdit(true); setClockInTime(selectedRec?.clocked_in_at ? format(new Date(selectedRec.clocked_in_at), 'HH:mm') : '09:00'); setClockOutTime(selectedRec?.clocked_out_at ? format(new Date(selectedRec.clocked_out_at), 'HH:mm') : '17:00') }
                  else markStatus(selectedDay, active ? null : value as 'leave' | 'day_off')
                }}
                className="py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: active ? color : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`, color: active ? '#F4F1F8' : 'rgba(244,241,248,0.35)' }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Clock edit inline */}
          {showClockEdit && (
            <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(108,93,211,0.1)' }}>
              <p className="text-xs font-semibold text-white/50 mb-3">Set clock times</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[10px] text-white/30 block mb-1">Clock in</label>
                  <input className="input text-sm" type="time" value={clockInTime} onChange={e => setClockInTime(e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-white/30 block mb-1">Clock out</label>
                  <input className="input text-sm" type="time" value={clockOutTime} onChange={e => setClockOutTime(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveClockEdit} className="flex-1 py-2 rounded-xl text-xs font-bold bg-primary text-white">Save</button>
                <button onClick={() => setShowClockEdit(false)} className="flex-1 py-2 rounded-xl text-xs font-semibold text-white/40" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Events for this day */}
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
                  {EVENT_COLORS.map(c => (
                    <button key={c} onClick={() => setEventColor(c)} className="w-6 h-6 rounded-full transition-all" style={{ background: c, outline: eventColor === c ? `2px solid #fff` : 'none', outlineOffset: 2 }} />
                  ))}
                </div>
                <button onClick={addEvent} className="w-full py-2 rounded-xl text-xs font-bold bg-primary text-white">Add Event</button>
              </div>
            )}

            {selectedEvents.length === 0 && !showAddEvent && (
              <p className="text-xs text-white/20 py-1">No events — tap + to add one</p>
            )}
            {selectedEvents.map(evt => (
              <div key={evt.id} className="flex items-center gap-2 py-2 border-b last:border-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: evt.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{evt.title}</p>
                  {evt.description && <p className="text-[10px] text-white/30 truncate">{evt.description}</p>}
                </div>
                <button onClick={() => deleteEvent(evt.id)} className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <X size={10} className="text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div className="card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={12} className="text-primary" />
            <p className="text-[10px] text-white/40 uppercase tracking-wider">This week</p>
          </div>
          <p className="text-lg font-bold">{fmtHours(wkHours)}</p>
          <p className="text-xs text-white/30">{wkDays} days worked</p>
        </div>
        <div className="card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={12} className="text-accent" />
            <p className="text-[10px] text-white/40 uppercase tracking-wider">This month</p>
          </div>
          <p className="text-lg font-bold">{fmtHours(mHours)}</p>
          <p className="text-xs text-white/30">{mDays} days worked</p>
        </div>
      </div>
    </div>
  )
}
