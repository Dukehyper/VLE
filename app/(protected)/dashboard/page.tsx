'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSettings } from '@/components/SettingsContext'
import { formatMoney, getGreeting, formatDate, todayISO } from '@/lib/utils'
import { Settings, Plus, TrendingUp, TrendingDown, Clock, Wallet, ChevronRight } from 'lucide-react'

interface DashSummary {
  totalSalary: number
  totalHomeVisits: number
  totalExpenses: number
  totalPotDeposits: number
}

interface Expense {
  id: string
  amount: number
  description: string
  source: string
  date: string
}

interface Pot {
  id: string
  name: string
  target_amount: number
  current_amount: number
}

export default function DashboardPage() {
  const { currencySymbol, currency, display_name } = useSettings()
  const [summary, setSummary] = useState<DashSummary>({ totalSalary: 0, totalHomeVisits: 0, totalExpenses: 0, totalPotDeposits: 0 })
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])
  const [pots, setPots] = useState<Pot[]>([])
  const [loading, setLoading] = useState(true)
  const [clockedIn, setClockedIn] = useState(false)
  const [clockLoading, setClockLoading] = useState(false)
  const router = useRouter()

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [incomeRes, expensesRes, potsRes, todayAttRes] = await Promise.all([
      supabase.from('income_entries').select('salary_amount, home_visits_amount').eq('user_id', user.id),
      supabase.from('expenses').select('id, amount, description, source, date').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('saving_pots').select('*').eq('user_id', user.id),
      supabase.from('attendance').select('clocked_in_at, clocked_out_at').eq('user_id', user.id).eq('date', todayISO()).single(),
    ])

    const totalSalary = (incomeRes.data ?? []).reduce((s, r) => s + Number(r.salary_amount), 0)
    const totalHomeVisits = (incomeRes.data ?? []).reduce((s, r) => s + Number(r.home_visits_amount), 0)
    const totalExpenses = (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)

    // pot deposits only (not withdrawals) — stored in saving_pots.current_amount
    const totalPotDeposits = (potsRes.data ?? []).reduce((s, r) => s + Number(r.current_amount), 0)

    setSummary({ totalSalary, totalHomeVisits, totalExpenses, totalPotDeposits })
    setRecentExpenses((expensesRes.data ?? []).slice(0, 5))
    setPots(potsRes.data ?? [])

    if (todayAttRes.data) {
      setClockedIn(!!todayAttRes.data.clocked_in_at && !todayAttRes.data.clocked_out_at)
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalBalance = summary.totalSalary + summary.totalHomeVisits - summary.totalExpenses - summary.totalPotDeposits

  async function handleClockToggle() {
    setClockLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const today = todayISO()
    const now = new Date().toISOString()

    if (!clockedIn) {
      await supabase.from('attendance').upsert({
        user_id: user.id, date: today, clocked_in_at: now, status: 'working'
      }, { onConflict: 'user_id,date' })
      setClockedIn(true)
    } else {
      await supabase.from('attendance').update({ clocked_out_at: now }).eq('user_id', user.id).eq('date', today)
      setClockedIn(false)
    }
    setClockLoading(false)
  }

  const skel = (w: string, h = 'h-4') => <div className={`skeleton ${w} ${h}`} />

  return (
    <div className="min-h-screen px-5 pt-6 page-enter">
      {/* Top row */}
      <div className="flex items-start justify-between mb-6">
        <div>
          {loading ? skel('w-36', 'h-5') : (
            <p className="text-white/50 text-sm">{getGreeting()},</p>
          )}
          {loading ? <div className="mt-1">{skel('w-24', 'h-7')}</div> : (
            <h1 className="text-2xl font-bold">{display_name ?? 'there'}</h1>
          )}
        </div>
        <Link href="/settings" className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <Settings size={18} className="text-white/60" />
        </Link>
      </div>

      {/* Total Balance Card */}
      <div
        className="rounded-3xl p-6 mb-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #3d2a7d 0%, #6C5DD3 50%, #A87EFF 100%)',
          boxShadow: '0 8px 32px rgba(108,93,211,0.35)',
        }}
      >
        <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 70% 30%, #fff 0%, transparent 60%)' }} />
        <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-2">Total Balance</p>
        {loading ? (
          <div className="skeleton w-48 h-10 mb-3" />
        ) : (
          <p className="text-4xl font-black mb-3 tracking-tight">
            {totalBalance < 0 ? '-' : ''}{formatMoney(totalBalance, currency)}
          </p>
        )}
        <div className="flex gap-4 text-sm">
          <span className="text-white/60">In: <span className="text-white font-semibold">{loading ? '…' : formatMoney(summary.totalSalary + summary.totalHomeVisits, currency)}</span></span>
          <span className="text-white/60">Out: <span className="text-white font-semibold">{loading ? '…' : formatMoney(summary.totalExpenses + summary.totalPotDeposits, currency)}</span></span>
        </div>
      </div>

      {/* Sub cards */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="card p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-green-400" />
            <span className="text-xs text-white/40 font-medium">Salary</span>
          </div>
          {loading ? skel('w-full', 'h-6') : (
            <p className="text-lg font-bold">{formatMoney(summary.totalSalary, currency)}</p>
          )}
        </div>
        <div className="card p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-accent" />
            <span className="text-xs text-white/40 font-medium">Home Visits</span>
          </div>
          {loading ? skel('w-full', 'h-6') : (
            <p className="text-lg font-bold">{formatMoney(summary.totalHomeVisits, currency)}</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <Link href="/finance?tab=income" className="card rounded-2xl p-3 flex flex-col items-center gap-1.5 active:opacity-70 transition-opacity">
          <div className="w-9 h-9 rounded-xl bg-primary/30 flex items-center justify-center">
            <Plus size={16} className="text-accent" />
          </div>
          <span className="text-xs text-white/50 font-medium">Income</span>
        </Link>
        <Link href="/finance?tab=expenses" className="card rounded-2xl p-3 flex flex-col items-center gap-1.5 active:opacity-70 transition-opacity">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center">
            <TrendingDown size={16} className="text-red-400" />
          </div>
          <span className="text-xs text-white/50 font-medium">Expense</span>
        </Link>
        <button
          onClick={handleClockToggle}
          disabled={clockLoading}
          className="card rounded-2xl p-3 flex flex-col items-center gap-1.5 active:opacity-70 transition-opacity"
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${clockedIn ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
            <Clock size={16} className={clockedIn ? 'text-red-400' : 'text-green-400'} />
          </div>
          <span className="text-xs text-white/50 font-medium">{clockedIn ? 'Clock Out' : 'Clock In'}</span>
        </button>
      </div>

      {/* Recent Expenses */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white/70">Recent Expenses</h2>
          <Link href="/finance?tab=expenses" className="text-xs text-accent font-medium flex items-center gap-0.5">
            See all <ChevronRight size={12} />
          </Link>
        </div>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 w-full rounded-2xl" />)}
          </div>
        ) : recentExpenses.length === 0 ? (
          <div className="card rounded-2xl p-5 text-center">
            <Wallet size={24} className="text-white/20 mx-auto mb-2" />
            <p className="text-white/30 text-sm">No expenses yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentExpenses.map(exp => (
              <div key={exp.id} className="card rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{exp.description}</p>
                  <p className="text-xs text-white/30 mt-0.5">{formatDate(exp.date)} · {exp.source === 'salary' ? 'Salary' : 'Home Visits'}</p>
                </div>
                <span className="text-red-400 font-semibold text-sm">-{formatMoney(exp.amount, currency)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saving Pots */}
      {pots.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white/70">Saving Pots</h2>
            <Link href="/finance?tab=pots" className="text-xs text-accent font-medium flex items-center gap-0.5">
              Manage <ChevronRight size={12} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5">
            {pots.map(pot => {
              const pct = Math.min(100, pot.target_amount > 0 ? (pot.current_amount / pot.target_amount) * 100 : 0)
              return (
                <Link key={pot.id} href="/finance?tab=pots" className="card rounded-2xl p-4 min-w-[160px] flex-shrink-0">
                  <p className="text-sm font-semibold mb-1 truncate">{pot.name}</p>
                  <p className="text-xs text-white/40 mb-3">{Math.round(pct)}% saved</p>
                  <div className="progress-track h-1.5">
                    <div className="progress-fill h-1.5" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-white/50 mt-2">
                    {formatMoney(pot.current_amount, currency)} <span className="text-white/25">/ {formatMoney(pot.target_amount, currency)}</span>
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
