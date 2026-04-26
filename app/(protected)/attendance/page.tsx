'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSettings } from '@/components/SettingsContext'
import { todayISO } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, getHours, getMinutes } from 'date-fns'

interface AttendanceRecord {
  id: string
  date: string
  clocked_in_at: string | null
  clocked_out_at: string | null
  status: 'working' | 'leave' | 'day_off'
  notes: string | null
}

function hoursWorked(record: AttendanceRecord): number {
  if (!record.clocked_in_at) return 0
  const out = record.clocked_out_at ? new Date(record.clocked_out_at) : new Date()
  const inp = new Date(record.clocked_in_at)
  return Math.max(0, (out.getTime() - inp.getTime()) / 3600000)
}

function fmtHours(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return `${hrs}h ${mins}m`
}

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function AttendancePage() {
  const { day_off } = useSettings()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [today, setToday] = useState<AttendanceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [viewMonth, setViewMonth] = useState(new Date())
  const [view, setView] = useState<'week' | 'month'>('week')

  const todayStr = todayISO()

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const monthStart = format(startOfMonth(viewMonth), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(viewMonth), 'yyyy-MM-dd')

    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false })

    setRecords(data ?? [])
    setToday((data ?? []).find(r => r.date === todayStr) ?? null)
    setLoading(false)
  }, [viewMonth, todayStr])

  useEffect(() => { load() }, [load])

  // Refresh clock every minute for live hours
  useEffect(() => {
    const t = setInterval(() => setRecords(r => [...r]), 60000)
    return () => clearInterval(t)
  }, [])

  async function clockToggle() {
    setActionLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const now = new Date().toISOString()

    if (!today || !today.clocked_in_at) {
      await supabase.from('attendance').upsert({
        user_id: user.id, date: todayStr, clocked_in_at: now, status: 'working'
      }, { onConflict: 'user_id,date' })
    } else if (!today.clocked_out_at) {
      await supabase.from('attendance').update({ clocked_out_at: now }).eq('user_id', user.id).eq('date', todayStr)
    }
    setActionLoading(false)
    load()
  }

  async function markDay(status: 'leave' | 'day_off') {
    setActionLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('attendance').upsert({
      user_id: user.id, date: todayStr, status, clocked_in_at: null, clocked_out_at: null
    }, { onConflict: 'user_id,date' })
    setActionLoading(false)
    load()
  }

  const isClockedIn = today?.status === 'working' && !!today.clocked_in_at && !today.clocked_out_at
  const isClockedOut = today?.status === 'working' && !!today.clocked_out_at
  const isLeave = today?.status === 'leave'
  const isDayOff = today?.status === 'day_off'

  const todayHours = today ? hoursWorked(today) : 0

  // Week strip (Mon–Sun of current week)
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  function dotColor(date: Date): string | null {
    const ds = format(date, 'yyyy-MM-dd')
    const rec = records.find(r => r.date === ds)
    if (!rec) return null
    if (rec.status === 'working') return '#4ade80'
    if (rec.status === 'leave') return '#f87171'
    if (rec.status === 'day_off') return '#f8717160'
    return null
  }

  // Weekly summary
  const weekRecords = records.filter(r => {
    const d = new Date(r.date)
    return d >= weekStart && d <= weekEnd
  })
  const weekHours = weekRecords.filter(r => r.status === 'working').reduce((s, r) => s + hoursWorked(r), 0)
  const weekDaysWorked = weekRecords.filter(r => r.status === 'working' && r.clocked_in_at).length

  // Monthly summary
  const monthHours = records.filter(r => r.status === 'working').reduce((s, r) => s + hoursWorked(r), 0)
  const monthDaysWorked = records.filter(r => r.status === 'working' && r.clocked_in_at).length

  // Calendar grid
  const calDays = eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) })
  const firstDow = (startOfMonth(viewMonth).getDay() + 6) % 7 // Mon=0

  return (
    <div className="min-h-screen px-5 pt-6 page-enter">
      <h1 className="text-xl font-bold mb-6">Attendance</h1>

      {/* Clock In/Out */}
      <div className="card rounded-3xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-white/40 font-medium uppercase tracking-wider">{format(new Date(), 'EEEE, d MMM yyyy')}</p>
            {isClockedIn && (
              <p className="text-sm text-green-400 font-semibold mt-0.5">● {fmtHours(todayHours)} worked</p>
            )}
            {isClockedOut && (
              <p className="text-sm text-white/50 mt-0.5">Done · {fmtHours(todayHours)}</p>
            )}
            {isLeave && <p className="text-sm text-red-400 mt-0.5">On leave today</p>}
            {isDayOff && <p className="text-sm text-white/40 mt-0.5">Day off</p>}
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isClockedIn ? 'bg-green-500/20 text-green-400' :
            isClockedOut ? 'bg-white/10 text-white/40' :
            isLeave ? 'bg-red-500/20 text-red-400' :
            isDayOff ? 'bg-white/10 text-white/30' :
            'bg-white/10 text-white/30'
          }`}>
            {isClockedIn ? 'Working' : isClockedOut ? 'Done' : isLeave ? 'Leave' : isDayOff ? 'Day Off' : 'Not started'}
          </div>
        </div>

        {/* Main button */}
        {!isLeave && !isDayOff && (
          <button
            onClick={clockToggle}
            disabled={actionLoading || isClockedOut}
            className={`w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-98 ${
              isClockedIn
                ? 'bg-red-500/90 text-white'
                : isClockedOut
                ? 'bg-white/10 text-white/30 cursor-default'
                : 'text-white'
            }`}
            style={!isClockedIn && !isClockedOut ? {
              background: 'linear-gradient(135deg, #4ade80, #16a34a)',
              boxShadow: '0 4px 20px rgba(74,222,128,0.3)',
            } : {}}
          >
            {actionLoading ? '…' : isClockedIn ? 'Clock Out' : isClockedOut ? 'Already clocked out' : 'Clock In'}
          </button>
        )}

        {/* Mark buttons */}
        {!isClockedIn && !isClockedOut && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => markDay('leave')}
              disabled={actionLoading || isLeave}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${isLeave ? 'bg-red-500/20 text-red-300' : 'bg-white/06 text-white/40'}`}
              style={{ background: isLeave ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)' }}
            >
              {isLeave ? 'Leave marked' : 'Mark Leave'}
            </button>
            <button
              onClick={() => markDay('day_off')}
              disabled={actionLoading || isDayOff}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${isDayOff ? 'bg-white/10 text-white/40' : 'bg-white/06 text-white/40'}`}
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              {isDayOff ? 'Day off set' : 'Mark Day Off'}
            </button>
          </div>
        )}
      </div>

      {/* Week Strip */}
      <div className="card rounded-2xl p-4 mb-5">
        <div className="flex justify-between">
          {weekDays.map((d, i) => {
            const isToday = format(d, 'yyyy-MM-dd') === todayStr
            const dot = dotColor(d)
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] text-white/30 font-medium">{DAY_LABELS[i]}</span>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${isToday ? 'bg-primary text-white' : 'text-white/50'}`}>
                  {format(d, 'd')}
                </div>
                <div className={`w-1.5 h-1.5 rounded-full`} style={{ background: dot ?? 'rgba(255,255,255,0.1)' }} />
              </div>
            )
          })}
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 mb-4">
        {(['week', 'month'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`tab-btn ${view === v ? 'active' : ''}`}>
            {v === 'week' ? 'This Week' : 'Month View'}
          </button>
        ))}
      </div>

      {view === 'week' ? (
        /* Weekly summary */
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="card rounded-2xl p-4">
            <p className="text-xs text-white/40 mb-1">Hours this week</p>
            <p className="text-2xl font-bold">{fmtHours(weekHours)}</p>
          </div>
          <div className="card rounded-2xl p-4">
            <p className="text-xs text-white/40 mb-1">Days worked</p>
            <p className="text-2xl font-bold">{weekDaysWorked}<span className="text-sm text-white/30 font-normal"> / 5</span></p>
          </div>
        </div>
      ) : (
        /* Monthly calendar */
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
              ‹
            </button>
            <span className="text-sm font-semibold">{format(viewMonth, 'MMMM yyyy')}</span>
            <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map(l => <div key={l} className="text-center text-[10px] text-white/30 font-medium">{l}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 mb-5">
            {[...Array(firstDow)].map((_, i) => <div key={`e${i}`} />)}
            {calDays.map(d => {
              const ds = format(d, 'yyyy-MM-dd')
              const rec = records.find(r => r.date === ds)
              const isToday = ds === todayStr
              let bg = 'transparent'
              let textCls = 'text-white/30'
              if (rec?.status === 'working' && rec.clocked_in_at) { bg = 'rgba(74,222,128,0.15)'; textCls = 'text-green-400' }
              if (rec?.status === 'leave') { bg = 'rgba(248,113,113,0.15)'; textCls = 'text-red-400' }
              if (rec?.status === 'day_off') { bg = 'rgba(248,113,113,0.07)'; textCls = 'text-white/20' }
              return (
                <div
                  key={ds}
                  className={`aspect-square flex items-center justify-center rounded-lg text-xs font-semibold ${textCls} ${isToday ? 'ring-1 ring-primary' : ''}`}
                  style={{ background: bg }}
                >
                  {format(d, 'd')}
                </div>
              )
            })}
          </div>

          {/* Monthly summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Hours this month</p>
              <p className="text-2xl font-bold">{fmtHours(monthHours)}</p>
            </div>
            <div className="card rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Days worked</p>
              <p className="text-2xl font-bold">{monthDaysWorked}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
