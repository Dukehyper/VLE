'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useSettings } from '@/components/SettingsContext'
import { formatMoney, formatDate, MONTHS } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Plus, Trash2, ChevronRight, PiggyBank, X } from 'lucide-react'
import { format } from 'date-fns'

type Tab = 'overview' | 'income' | 'expenses' | 'pots'

interface Income {
  id: string; month: number; year: number
  salary_amount: number; home_visits_amount: number
}
interface Expense {
  id: string; amount: number; description: string; source: string; date: string
}
interface Pot {
  id: string; name: string; target_amount: number; current_amount: number
}
interface PotTx {
  id: string; amount: number; source: string; type: string; date: string
}

function FinanceInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const { currency } = useSettings()
  const [tab, setTab] = useState<Tab>((sp.get('tab') as Tab) ?? 'overview')
  const [incomes, setIncomes] = useState<Income[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [pots, setPots] = useState<Pot[]>([])
  const [loading, setLoading] = useState(true)

  // income form
  const [incMonth, setIncMonth] = useState(new Date().getMonth() + 1)
  const [incYear, setIncYear] = useState(new Date().getFullYear())
  const [salary, setSalary] = useState('')
  const [homeVisits, setHomeVisits] = useState('')
  const [incSaving, setIncSaving] = useState(false)

  // expense form
  const [expAmount, setExpAmount] = useState('')
  const [expDesc, setExpDesc] = useState('')
  const [expSource, setExpSource] = useState<'salary'|'home_visits'>('salary')
  const [expDate, setExpDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [expSaving, setExpSaving] = useState(false)
  const [expFilter, setExpFilter] = useState<'all'|'salary'|'home_visits'>('all')

  // pot forms
  const [potName, setPotName] = useState('')
  const [potTarget, setPotTarget] = useState('')
  const [potSaving, setPotSaving] = useState(false)
  const [selectedPot, setSelectedPot] = useState<Pot | null>(null)
  const [potTxs, setPotTxs] = useState<PotTx[]>([])
  const [txAmount, setTxAmount] = useState('')
  const [txType, setTxType] = useState<'deposit'|'withdrawal'>('deposit')
  const [txSource, setTxSource] = useState<'salary'|'home_visits'>('salary')
  const [txSaving, setTxSaving] = useState(false)
  const [showPotForm, setShowPotForm] = useState(false)
  const [showIncForm, setShowIncForm] = useState(false)
  const [showExpForm, setShowExpForm] = useState(false)

  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [i, e, p] = await Promise.all([
      supabase.from('income_entries').select('*').eq('user_id', user.id).order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('saving_pots').select('*').eq('user_id', user.id).order('created_at'),
    ])
    setIncomes(i.data ?? [])
    setExpenses(e.data ?? [])
    setPots(p.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function loadPotTxs(potId: string) {
    const supabase = createClient()
    const { data } = await supabase.from('pot_transactions').select('*').eq('pot_id', potId).order('date', { ascending: false })
    setPotTxs(data ?? [])
  }

  // Summary
  const totalSalary = incomes.reduce((s, i) => s + Number(i.salary_amount), 0)
  const totalHV = incomes.reduce((s, i) => s + Number(i.home_visits_amount), 0)
  const totalExpSalary = expenses.filter(e => e.source === 'salary').reduce((s, e) => s + Number(e.amount), 0)
  const totalExpHV = expenses.filter(e => e.source === 'home_visits').reduce((s, e) => s + Number(e.amount), 0)
  const totalPots = pots.reduce((s, p) => s + Number(p.current_amount), 0)
  const totalBalance = totalSalary + totalHV - expenses.reduce((s, e) => s + Number(e.amount), 0) - totalPots
  const salaryBalance = totalSalary - totalExpSalary - pots.reduce((s, p) => s + Number(p.current_amount), 0) / 2
  const hvBalance = totalHV - totalExpHV

  // Chart: last 6 months
  const now = new Date()
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i)
    const m = d.getMonth() + 1, y = d.getFullYear()
    const inc = incomes.find(e => e.month === m && e.year === y)
    return {
      name: MONTHS[m - 1].slice(0, 3),
      Salary: Number(inc?.salary_amount ?? 0),
      'Home Visits': Number(inc?.home_visits_amount ?? 0),
    }
  })

  async function saveIncome(e: React.FormEvent) {
    e.preventDefault(); setError('')
    setIncSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: err } = await supabase.from('income_entries').upsert({
      user_id: user.id, month: incMonth, year: incYear,
      salary_amount: parseFloat(salary) || 0,
      home_visits_amount: parseFloat(homeVisits) || 0,
    }, { onConflict: 'user_id,month,year' })
    setIncSaving(false)
    if (err) { setError(err.message); return }
    setSalary(''); setHomeVisits(''); setShowIncForm(false); load()
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!expAmount || !expDesc) { setError('Fill all fields'); return }
    setExpSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: err } = await supabase.from('expenses').insert({
      user_id: user.id, amount: parseFloat(expAmount), description: expDesc,
      source: expSource, date: expDate,
    })
    setExpSaving(false)
    if (err) { setError(err.message); return }
    setExpAmount(''); setExpDesc(''); setShowExpForm(false); load()
  }

  async function deleteExpense(id: string) {
    const supabase = createClient()
    await supabase.from('expenses').delete().eq('id', id)
    load()
  }

  async function savePot(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!potName || !potTarget) { setError('Fill all fields'); return }
    setPotSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('saving_pots').insert({
      user_id: user.id, name: potName, target_amount: parseFloat(potTarget), current_amount: 0,
    })
    setPotSaving(false)
    setPotName(''); setPotTarget(''); setShowPotForm(false); load()
  }

  async function potTransaction(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!selectedPot || !txAmount) return
    setTxSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const amt = parseFloat(txAmount)

    const newAmt = txType === 'deposit'
      ? Number(selectedPot.current_amount) + amt
      : Math.max(0, Number(selectedPot.current_amount) - amt)

    await supabase.from('pot_transactions').insert({
      pot_id: selectedPot.id, user_id: user.id, amount: amt,
      source: txSource, type: txType, date: format(new Date(), 'yyyy-MM-dd'),
    })

    await supabase.from('saving_pots').update({ current_amount: newAmt }).eq('id', selectedPot.id)

    // Withdrawal = also an expense
    if (txType === 'withdrawal') {
      await supabase.from('expenses').insert({
        user_id: user.id, amount: amt,
        description: `Withdrawal from pot: ${selectedPot.name}`,
        source: txSource, date: format(new Date(), 'yyyy-MM-dd'),
      })
    }

    setTxSaving(false)
    setTxAmount(''); setSelectedPot(null)
    load()
  }

  const filteredExpenses = expFilter === 'all' ? expenses : expenses.filter(e => e.source === expFilter)

  // Group expenses by month
  const expByMonth: Record<string, Expense[]> = {}
  filteredExpenses.forEach(e => {
    const key = e.date.slice(0, 7)
    if (!expByMonth[key]) expByMonth[key] = []
    expByMonth[key].push(e)
  })

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'income', label: 'Income' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'pots', label: 'Pots' },
  ]

  return (
    <div className="min-h-screen px-5 pt-6 page-enter">
      <h1 className="text-xl font-bold mb-5">Finance</h1>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setError('') }} className={`tab-btn whitespace-nowrap ${tab === t.id ? 'active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

      {/* ─── OVERVIEW ─── */}
      {tab === 'overview' && (
        <div>
          <div className="card rounded-3xl p-5 mb-4" style={{ background: 'linear-gradient(135deg, #3d2a7d, #6C5DD3)', boxShadow: '0 8px 32px rgba(108,93,211,0.3)' }}>
            <p className="text-white/60 text-xs uppercase tracking-wider mb-1">Total Balance</p>
            <p className="text-3xl font-black">{formatMoney(totalBalance, currency)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="card rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Salary balance</p>
              <p className="text-lg font-bold">{formatMoney(Math.max(0, totalSalary - totalExpSalary), currency)}</p>
              <p className="text-xs text-white/25 mt-0.5">After expenses</p>
            </div>
            <div className="card rounded-2xl p-4">
              <p className="text-xs text-white/40 mb-1">Home Visits</p>
              <p className="text-lg font-bold">{formatMoney(Math.max(0, totalHV - totalExpHV), currency)}</p>
              <p className="text-xs text-accent font-semibold mt-0.5">{formatMoney(totalHV, currency)} total</p>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-white/50 mb-3">Last 6 months</h3>
          <div className="card rounded-2xl p-4 mb-4" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill: 'rgba(244,241,248,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#1e0842', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                  formatter={(val: number) => formatMoney(val, currency)}
                />
                <Bar dataKey="Salary" fill="#6C5DD3" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Home Visits" fill="#A87EFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ─── INCOME ─── */}
      {tab === 'income' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-xs text-white/40">All-time home visits</p>
              <p className="text-2xl font-bold text-accent">{formatMoney(totalHV, currency)}</p>
            </div>
            <button onClick={() => setShowIncForm(v => !v)} className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Plus size={18} />
            </button>
          </div>

          {showIncForm && (
            <div className="card rounded-2xl p-4 mb-4">
              <h3 className="text-sm font-semibold mb-3">Add Monthly Income</h3>
              <form onSubmit={saveIncome} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Month</label>
                    <select className="input text-sm" value={incMonth} onChange={e => setIncMonth(+e.target.value)}>
                      {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Year</label>
                    <input className="input text-sm" type="number" value={incYear} onChange={e => setIncYear(+e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Salary</label>
                  <input className="input text-sm" type="number" step="0.01" placeholder="0.00" value={salary} onChange={e => setSalary(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Home Visits</label>
                  <input className="input text-sm" type="number" step="0.01" placeholder="0.00" value={homeVisits} onChange={e => setHomeVisits(e.target.value)} />
                </div>
                <button className="btn-primary" disabled={incSaving}>{incSaving ? 'Saving…' : 'Save'}</button>
              </form>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)
            ) : incomes.length === 0 ? (
              <div className="card rounded-2xl p-8 text-center">
                <p className="text-white/30 text-sm">No income entries yet</p>
              </div>
            ) : (
              incomes.map(inc => (
                <div key={inc.id} className="card rounded-2xl px-4 py-3">
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-semibold">{MONTHS[inc.month - 1]} {inc.year}</p>
                    <p className="text-sm font-bold text-green-400">{formatMoney(Number(inc.salary_amount) + Number(inc.home_visits_amount), currency)}</p>
                  </div>
                  <div className="flex gap-4 mt-1">
                    <span className="text-xs text-white/30">Salary: <span className="text-white/50">{formatMoney(inc.salary_amount, currency)}</span></span>
                    <span className="text-xs text-white/30">HV: <span className="text-accent">{formatMoney(inc.home_visits_amount, currency)}</span></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── EXPENSES ─── */}
      {tab === 'expenses' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-1">
              {(['all', 'salary', 'home_visits'] as const).map(f => (
                <button key={f} onClick={() => setExpFilter(f)} className={`tab-btn ${expFilter === f ? 'active' : ''} text-xs`}>
                  {f === 'all' ? 'All' : f === 'salary' ? 'Salary' : 'HV'}
                </button>
              ))}
            </div>
            <button onClick={() => setShowExpForm(v => !v)} className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Plus size={18} />
            </button>
          </div>

          {showExpForm && (
            <div className="card rounded-2xl p-4 mb-4">
              <h3 className="text-sm font-semibold mb-3">Add Expense</h3>
              <form onSubmit={saveExpense} className="flex flex-col gap-3">
                <input className="input text-sm" type="number" step="0.01" placeholder="Amount" value={expAmount} onChange={e => setExpAmount(e.target.value)} required />
                <input className="input text-sm" type="text" placeholder="Description" value={expDesc} onChange={e => setExpDesc(e.target.value)} required />
                <div className="grid grid-cols-2 gap-2">
                  <select className="input text-sm" value={expSource} onChange={e => setExpSource(e.target.value as 'salary'|'home_visits')}>
                    <option value="salary">Salary</option>
                    <option value="home_visits">Home Visits</option>
                  </select>
                  <input className="input text-sm" type="date" value={expDate} onChange={e => setExpDate(e.target.value)} required />
                </div>
                <button className="btn-primary" disabled={expSaving}>{expSaving ? 'Saving…' : 'Add Expense'}</button>
              </form>
            </div>
          )}

          {Object.keys(expByMonth).sort((a, b) => b.localeCompare(a)).map(month => {
            const [y, m] = month.split('-').map(Number)
            const total = expByMonth[month].reduce((s, e) => s + Number(e.amount), 0)
            return (
              <div key={month} className="mb-4">
                <div className="flex justify-between text-xs text-white/40 mb-2">
                  <span className="font-semibold">{MONTHS[m - 1]} {y}</span>
                  <span className="text-red-400">-{formatMoney(total, currency)}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {expByMonth[month].map(exp => (
                    <div key={exp.id} className="card rounded-2xl px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">{exp.description}</p>
                        <p className="text-xs text-white/30 mt-0.5">{formatDate(exp.date)} · {exp.source === 'salary' ? 'Salary' : 'Home Visits'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-red-400 text-sm font-semibold">-{formatMoney(exp.amount, currency)}</span>
                        <button onClick={() => deleteExpense(exp.id)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                          <Trash2 size={12} className="text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {filteredExpenses.length === 0 && !loading && (
            <div className="card rounded-2xl p-8 text-center">
              <p className="text-white/30 text-sm">No expenses yet</p>
            </div>
          )}
        </div>
      )}

      {/* ─── POTS ─── */}
      {tab === 'pots' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={() => setShowPotForm(v => !v)} className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Plus size={18} />
            </button>
          </div>

          {showPotForm && (
            <div className="card rounded-2xl p-4 mb-4">
              <h3 className="text-sm font-semibold mb-3">New Saving Pot</h3>
              <form onSubmit={savePot} className="flex flex-col gap-3">
                <input className="input text-sm" placeholder="Pot name (e.g. Holiday)" value={potName} onChange={e => setPotName(e.target.value)} required />
                <input className="input text-sm" type="number" step="0.01" placeholder="Target amount" value={potTarget} onChange={e => setPotTarget(e.target.value)} required />
                <button className="btn-primary" disabled={potSaving}>{potSaving ? 'Creating…' : 'Create Pot'}</button>
              </form>
            </div>
          )}

          {/* Pot transaction modal */}
          {selectedPot && (
            <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
              <div className="w-full max-w-mobile rounded-t-3xl p-5 pb-10" style={{ background: '#230550' }}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold">{selectedPot.name}</h3>
                  <button onClick={() => setSelectedPot(null)}><X size={18} /></button>
                </div>
                <p className="text-xs text-white/40 mb-4">
                  {formatMoney(selectedPot.current_amount, currency)} saved / {formatMoney(selectedPot.target_amount, currency)} goal
                </p>
                <form onSubmit={potTransaction} className="flex flex-col gap-3 mb-5">
                  <div className="flex gap-2">
                    {(['deposit', 'withdrawal'] as const).map(t => (
                      <button key={t} type="button" onClick={() => setTxType(t)} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${txType === t ? (t === 'deposit' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400') : 'bg-white/05 text-white/30'}`}>
                        {t === 'deposit' ? '+ Deposit' : '- Withdraw'}
                      </button>
                    ))}
                  </div>
                  <input className="input text-sm" type="number" step="0.01" placeholder="Amount" value={txAmount} onChange={e => setTxAmount(e.target.value)} required />
                  <select className="input text-sm" value={txSource} onChange={e => setTxSource(e.target.value as 'salary'|'home_visits')}>
                    <option value="salary">From Salary</option>
                    <option value="home_visits">From Home Visits</option>
                  </select>
                  <button className="btn-primary" disabled={txSaving}>{txSaving ? 'Processing…' : txType === 'deposit' ? 'Deposit' : 'Withdraw'}</button>
                </form>

                {/* Transaction history */}
                <h4 className="text-xs font-semibold text-white/40 mb-2">History</h4>
                <div className="flex flex-col gap-2 overflow-y-auto max-h-48">
                  {potTxs.map(tx => (
                    <div key={tx.id} className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <div>
                        <span className={`text-xs font-semibold ${tx.type === 'deposit' ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.type === 'deposit' ? '+' : '-'}{formatMoney(tx.amount, currency)}
                        </span>
                        <p className="text-xs text-white/30">{formatDate(tx.date)} · {tx.source === 'salary' ? 'Salary' : 'HV'}</p>
                      </div>
                    </div>
                  ))}
                  {potTxs.length === 0 && <p className="text-xs text-white/20 py-2">No transactions yet</p>}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {loading ? (
              [...Array(2)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)
            ) : pots.length === 0 ? (
              <div className="card rounded-2xl p-8 text-center">
                <PiggyBank size={28} className="text-white/20 mx-auto mb-2" />
                <p className="text-white/30 text-sm">No saving pots yet</p>
              </div>
            ) : (
              pots.map(pot => {
                const pct = pot.target_amount > 0 ? Math.min(100, (Number(pot.current_amount) / Number(pot.target_amount)) * 100) : 0
                return (
                  <button
                    key={pot.id}
                    className="card rounded-2xl p-4 text-left w-full"
                    onClick={() => { setSelectedPot(pot); loadPotTxs(pot.id) }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold">{pot.name}</p>
                        <p className="text-xs text-white/40 mt-0.5">{formatMoney(pot.current_amount, currency)} of {formatMoney(pot.target_amount, currency)}</p>
                      </div>
                      <span className="text-sm font-bold text-accent">{Math.round(pct)}%</span>
                    </div>
                    <div className="progress-track h-2">
                      <div className="progress-fill h-2" style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function FinancePage() {
  return (
    <Suspense>
      <FinanceInner />
    </Suspense>
  )
}
