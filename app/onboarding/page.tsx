'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Wallet, Calendar, Zap, ChevronRight, UserPlus, Bookmark } from 'lucide-react'

const slides = [
  {
    icon: Zap,
    iconBg: 'from-[#6C5DD3] to-[#A87EFF]',
    glow: 'rgba(108,93,211,0.4)',
    tag: 'Welcome to Pulse',
    title: 'Your personal\ncommand centre',
    subtitle: 'Everything you need — time, money, patients and more — beautifully organised in one place.',
  },
  {
    icon: Wallet,
    iconBg: 'from-[#059669] to-[#34d399]',
    glow: 'rgba(5,150,105,0.35)',
    tag: 'Finance Tracker',
    title: 'Know exactly\nwhere you stand',
    subtitle: 'Track salary and home-visit income separately. Log expenses, grow saving pots, and see your real balance.',
  },
  {
    icon: Calendar,
    iconBg: 'from-[#d97706] to-[#fbbf24]',
    glow: 'rgba(217,119,6,0.35)',
    tag: 'Attendance',
    title: 'Never miss\na single day',
    subtitle: 'Clock in with one tap. Mark leave or days off right on the calendar. Add personal events too.',
  },
  {
    icon: UserPlus,
    iconBg: 'from-[#db2777] to-[#f472b6]',
    glow: 'rgba(219,39,119,0.35)',
    tag: 'All Features',
    title: 'Built around\nyour work life',
    subtitle: 'Patient counts, saved content with categories, progress rings, monthly reports — all in your pocket.',
  },
]

export default function OnboardingPage() {
  const [current, setCurrent] = useState(0)
  const router = useRouter()
  const slide = slides[current]
  const Icon = slide.icon
  const isLast = current === slides.length - 1

  function next() {
    if (isLast) {
      localStorage.setItem('pulse_onboarded', '1')
      router.push('/login')
    } else {
      setCurrent(c => c + 1)
    }
  }

  function skip() {
    localStorage.setItem('pulse_onboarded', '1')
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: '#190336' }}>
      {/* Animated background blobs */}
      <div
        className="absolute rounded-full blur-3xl opacity-30 transition-all duration-700"
        style={{
          width: 280, height: 280,
          background: `radial-gradient(circle, ${slide.glow}, transparent)`,
          top: '15%', left: '50%', transform: 'translateX(-50%)',
        }}
      />

      {/* Skip */}
      {!isLast && (
        <button
          onClick={skip}
          className="absolute top-12 right-5 text-xs text-white/30 font-medium z-10"
        >
          Skip
        </button>
      )}

      {/* Content */}
      <div className="flex flex-col items-center justify-center flex-1 px-8 pt-16 pb-10 text-center">

        {/* Icon bubble */}
        <div
          key={current}
          className="w-28 h-28 rounded-3xl flex items-center justify-center mb-8 shadow-2xl"
          style={{
            background: `linear-gradient(135deg, ${slide.iconBg.replace('from-[', '').replace('] to-[', ', ').replace(']', '')})`,
            boxShadow: `0 20px 60px ${slide.glow}`,
            animation: 'fadeUp 0.4s ease-out',
          }}
        >
          <Icon size={52} className="text-white" strokeWidth={1.5} />
        </div>

        {/* Tag */}
        <div
          className="px-3 py-1 rounded-full text-xs font-semibold mb-4"
          style={{ background: 'rgba(168,126,255,0.15)', color: '#A87EFF' }}
        >
          {slide.tag}
        </div>

        {/* Title */}
        <h1
          key={`t${current}`}
          className="text-3xl font-black leading-tight mb-4"
          style={{ animation: 'fadeUp 0.4s ease-out 0.05s both', whiteSpace: 'pre-line' }}
        >
          {slide.title}
        </h1>

        {/* Subtitle */}
        <p
          key={`s${current}`}
          className="text-white/50 text-base leading-relaxed max-w-xs"
          style={{ animation: 'fadeUp 0.4s ease-out 0.1s both' }}
        >
          {slide.subtitle}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="px-6 pb-12 flex flex-col gap-5 items-center">
        {/* Dots */}
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                background: i === current ? '#6C5DD3' : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>

        {/* CTA button */}
        <button
          onClick={next}
          className="w-full max-w-sm py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-98"
          style={{
            background: 'linear-gradient(135deg, #6C5DD3, #A87EFF)',
            boxShadow: '0 8px 32px rgba(108,93,211,0.4)',
          }}
        >
          {isLast ? 'Get started' : 'Continue'}
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
