'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSettings } from '@/components/SettingsContext'
import { formatMoney, getGreeting, todayISO } from '@/lib/utils'
import { useDateFormat } from '@/lib/hooks/useDateFormat'
import { Settings, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Clock, Wallet, UserPlus } from 'lucide-react'
import Image from 'next/image'
import { format } from 'date-fns'

interface MonthData {
  income: number
  expenses: number
  daysWorked: number
  patients: number
  salaryIncome: number
  hvIncome: number
}

interface Expense {
  id: string; amount: number; description: string; source: string; date: string
}

interface Pot {
  id: string; name: string; target_amount: number; current_amount: number
}

export default function DashboardPage() {
  const { currencySymbol, currency, display_name, avatar_url } = useSettings()
  const { fmtDate, fmtCalHeader, fmtIncomeMonth, monthStart, monthEnd, monthShift, isSameDisplayMonth } = useDateFormat()
  const [clockedIn, setClockedIn] = useState(false)
  const [clockLoading, setClockLoading] = useState(false)
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])
  const [pots, setPots] = useState<Pot[]>([])
  const [allTimeBalance, setAllTimeBalance] = useState(0)
  const [monthData, setMonthData] = useState<MonthData>({ income: 0, expenses: 0, daysWorked: 0, patients: 0, salaryIncome: 0, hvIncome: 0 })
  const [viewMonth, setViewMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const mStartDate = monthStart(viewMonth)
    const mEndDate = monthEnd(viewMonth)
    const mStart = format(mStartDate, 'yyyy-MM-dd')
    const mEnd = format(mEndDate, 'yyyy-MM-dd')
    const vm = viewMonth

    const [allIncome, allExpenses, allPots, mIncome, mExpenses, mAttendance, mPatients, todayAtt] = await Promise.all([
      supabase.from('income_entries').select('salary_amount, home_visits_amount').eq('user_id', user.id),
      supabase.from('expenses').select('id, amount, description, source, date').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('saving_pots').select('*').eq('user_id', user.id),
      supabase.from('income_entries').select('salary_amount, home_visits_amount').eq('user_id', user.id).eq('month', vm.getMonth() + 1).eq('year', vm.getFullYear()),
      supabase.from('expenses').select('amount').eq('user_id', user.id).gte('date', mStart).lte('date', mEnd),
      supabase.from('attendance').select('status, clocked_in_at, clocked_out_at').eq('user_id', user.id).gte('date', mStart).lte('date', mEnd),
      supabase.from('patient_visits').select('count').eq('user_id', user.id).gte('date', mStart).lte('date', mEnd),
      supabase.from('attendance').select('clocked_in_at, clocked_out_at, status').eq('user_id', user.id).eq('date', todayISO()).single(),
    ])

    const totalSalary = (allIncome.data ?? []).reduce((s, r) => s + Number(r.salary_amount), 0)
    const totalHV = (allIncome.data ?? []).reduce((s, r) => s + Number(r.home_visits_amount), 0)
    const totalExp = (allExpenses.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const totalPots = (allPots.data ?? []).reduce((s, r) => s + Number(r.current_amount), 0)

    setAllTimeBalance(totalSalary + totalHV - totalExp - totalPots)
    setRecentExpenses((allExpenses.data ?? []).slice(0, 5))
    setPots(allPots.data ?? [])

    const mSalary = (mIncome.data ?? []).reduce((s, r) => s + Number(r.salary_amount), 0)
    const mHV = (mIncome.data ?? []).reduce((s, r) => s + Number(r.home_visits_amount), 0)
    const mExp = (mExpenses.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const daysWorked = (mAttendance.data ?? []).filter(r => r.status === 'working' && r.clocked_in_at).length
    const totalPatients = (mPatients.data ?? []).reduce((s, r) => s + r.count, 0)

    setMonthData({ income: mSalary + mHV, expenses: mExp, daysWorked, patients: totalPatients, salaryIncome: mSalary, hvIncome: mHV })

    if (todayAtt.data) {
      setClockedIn(todayAtt.data.status === 'working' && !!todayAtt.data.clocked_in_at && !todayAtt.data.clocked_out_at)
    } else {
      setClockedIn(false)
    }
    setLoading(false)
  }, [viewMonth])

  useEffect(() => { load() }, [load])

  async function handleClockToggle() {
    setClockLoading(true)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return
    const today = todayISO()
    const now = new Date().toISOString()
    if (!clockedIn) {
      await supabase.from('attendance').upsert({ user_id: user.id, date: today, clocked_in_at: now, status: 'working' }, { onConflict: 'user_id,date' })
    } else {
      await supabase.from('attendance').update({ clocked_out_at: now }).eq('user_id', user.id).eq('date', today)
    }
    setClockLoading(false)
    load()
  }

  const isCurrentMonth = isSameDisplayMonth(viewMonth, new Date())
  const net = monthData.income - monthData.expenses
  const skel = (w: string, h = 'h-4') => <div className={`skeleton ${w} ${h}`} />

  return (
    <div className="min-h-screen px-5 pt-6 page-enter">

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center" style={{ background: 'rgba(108,93,211,0.2)' }}>
              {avatar_url ? (
                <Image src={avatar_url} alt="avatar" fill className="object-cover" />
              ) : (
                <span className="text-lg font-bold text-accent">{display_name?.[0]?.toUpperCase() ?? '?'}</span>
              )}
            </div>
            {/* Signal dot */}
            <div
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 transition-colors duration-300"
              style={{
                background: clockedIn ? '#4ade80' : '#ef4444',
                borderColor: '#190336',
                boxShadow: clockedIn ? '0 0 6px rgba(74,222,128,0.6)' : '0 0 6px rgba(239,68,68,0.6)',
              }}
            />
          </div>
          <div>
            {loading ? skel('w-28', 'h-4') : <p className="text-white/50 text-xs">{getGreeting()}</p>}
            {loading ? <div className="mt-1">{skel('w-20', 'h-6')}</div> : (
              <h1 className="text-lg font-bold leading-tight">{display_name ?? 'there'}</h1>
            )}
          </div>
        </div>
        <Link href="/settings" className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <Settings size={18} className="text-white/50" />
        </Link>
      </div>

      {/* All-time balance card */}
      <div
        className="rounded-3xl p-5 mb-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2d1b6b 0%, #6C5DD3 60%, #A87EFF 100%)', boxShadow: '0 8px 32px rgba(108,93,211,0.4)' }}
      >
        <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 75% 20%, #fff, transparent 60%)' }} />
        <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Total Balance</p>
        {loading ? <div className="skeleton w-44 h-9 mb-3" /> : (
          <p className="text-3xl font-black mb-2">{allTimeBalance < 0 ? '-' : ''}{formatMoney(Math.abs(allTimeBalance), currency)}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-white/50 text-xs">All-time net</span>
          <button
            onClick={handleClockToggle}
            disabled={clockLoading}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${clockedIn ? 'bg-red-500/30 text-red-300' : 'bg-green-500/30 text-green-300'}`}
          >
            <Clock size={11} />
            {clockLoading ? '…' : clockedIn ? 'Clock Out' : 'Clock In'}
          </button>
        </div>
      </div>

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white/60">Monthly Overview</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMonth(m => monthShift(m, -1))} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold min-w-[80px] text-center">
            {fmtCalHeader(viewMonth)}
          </span>
          <button
            onClick={() => setViewMonth(m => monthShift(m, 1))}
            disabled={isCurrentMonth}
            className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.07)' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Monthly stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={13} className="text-green-400" />
            <span className="text-xs text-white/40">Income</span>
          </div>
          {loading ? skel('w-full', 'h-6') : <p className="text-xl font-bold text-green-400">{formatMoney(monthData.income, currency)}</p>}
          <p className="text-[10px] text-white/25 mt-0.5">
            {loading ? '' : `${formatMoney(monthData.salaryIncome, currency)} + ${formatMoney(monthData.hvIncome, currency)}`}
          </p>
        </div>
        <div className="card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown size={13} className="text-red-400" />
            <span className="text-xs text-white/40">Expenses</span>
          </div>
          {loading ? skel('w-full', 'h-6') : <p className="text-xl font-bold text-red-400">{formatMoney(monthData.expenses, currency)}</p>}
          <p className={`text-[10px] mt-0.5 font-semibold ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {loading ? '' : `Net: ${net >= 0 ? '+' : '-'}${formatMoney(Math.abs(net), currency)}`}
          </p>
        </div>
        <div className="card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock size={13} className="text-primary" />
            <span className="text-xs text-white/40">Days worked</span>
          </div>
          {loading ? skel('w-16', 'h-6') : <p className="text-xl font-bold">{monthData.daysWorked}</p>}
        </div>
        <div className="card rounded-2xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <UserPlus size={13} className="text-accent" />
            <span className="text-xs text-white/40">Patients</span>
          </div>
          {loading ? skel('w-16', 'h-6') : <p className="text-xl font-bold text-accent">{monthData.patients}</p>}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white/60">Recent Expenses</h2>
          <Link href="/finance?tab=expenses" className="text-xs text-accent font-medium">See all</Link>
        </div>
        {loading ? (
          <div className="flex flex-col gap-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}</div>
        ) : recentExpenses.length === 0 ? (
          <div className="card rounded-2xl p-5 text-center">
            <Wallet size={22} className="text-white/20 mx-auto mb-2" />
            <p className="text-white/30 text-sm">No expenses yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentExpenses.map(exp => (
              <div key={exp.id} className="card rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{exp.description}</p>
                  <p className="text-xs text-white/30 mt-0.5">{fmtDate(exp.date)}</p>
                </div>
                <span className="text-red-400 font-semibold text-sm">-{formatMoney(exp.amount, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-white/60 mb-3">Insights</h2>
        {loading ? (
          <div className="skeleton h-28 rounded-2xl" />
        ) : (
          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(108,93,211,0.08)', border: '1px solid rgba(108,93,211,0.18)' }}
          >
            {/* Month headline */}
            <p className="text-xs text-white/40 mb-3 font-medium">
              {fmtIncomeMonth(viewMonth.getMonth() + 1, viewMonth.getFullYear())}
            </p>
            {monthData.income === 0 && monthData.expenses === 0 ? (
              <p className="text-sm text-white/30">No data for this month yet.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {/* Earning line */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">You earned</span>
                  <span className="text-sm font-bold text-green-400">{formatMoney(monthData.income, currency)}</span>
                </div>
                {/* Spending line */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">You spent</span>
                  <span className="text-sm font-bold text-red-400">{formatMoney(monthData.expenses, currency)}</span>
                </div>
                {/* Divider */}
                <div className="h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                {/* Net */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {net >= 0 ? '💚 You saved' : '🔴 You overspent by'}
                  </span>
                  <span className={`text-sm font-black ${net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatMoney(Math.abs(net), currency)}
                  </span>
                </div>
                {/* Savings rate */}
                {monthData.income > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-white/30 mb-1">
                      <span>Savings rate</span>
                      <span>{Math.max(0, Math.round((net / monthData.income) * 100))}%</span>
                    </div>
                    <div className="progress-track h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(0, Math.min(100, (net / monthData.income) * 100))}%`,
                          background: net >= 0 ? 'linear-gradient(90deg,#4ade80,#16a34a)' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                )}
                {/* Extra stats */}
                <div className="flex gap-4 pt-1">
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold">{monthData.daysWorked}</p>
                    <p className="text-[10px] text-white/30">days worked</p>
                  </div>
                  <div className="w-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold text-accent">{monthData.patients}</p>
                    <p className="text-[10px] text-white/30">patients</p>
                  </div>
                  <div className="w-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                  <div className="text-center flex-1">
                    <p className="text-lg font-bold">{formatMoney(monthData.hvIncome, currency)}</p>
                    <p className="text-[10px] text-white/30">home visits</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Saving Pots */}
      {pots.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/60">Saving Pots</h2>
            <Link href="/finance?tab=pots" className="text-xs text-accent font-medium">Manage</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5">
            {pots.map(pot => {
              const pct = Math.min(100, pot.target_amount > 0 ? (pot.current_amount / pot.target_amount) * 100 : 0)
              return (
                <Link key={pot.id} href="/finance?tab=pots" className="card rounded-2xl p-4 min-w-[150px] flex-shrink-0">
                  <p className="text-sm font-semibold truncate mb-0.5">{pot.name}</p>
                  <p className="text-xs text-white/30 mb-3">{Math.round(pct)}%</p>
                  <div className="progress-track h-1.5">
                    <div className="progress-fill h-1.5" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-white/40 mt-2">{formatMoney(pot.current_amount, currency)}</p>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
