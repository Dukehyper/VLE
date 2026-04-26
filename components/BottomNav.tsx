'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Clock, Wallet, UserPlus, Bookmark } from 'lucide-react'

const tabs = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/attendance', icon: Clock, label: 'Clock' },
  { href: '/finance', icon: Wallet, label: 'Finance' },
  { href: '/patients', icon: UserPlus, label: 'Patients' },
  { href: '/content', icon: Bookmark, label: 'Saved' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile z-50"
      style={{ background: 'rgba(25,3,54,0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center justify-around px-2 py-3 safe-bottom">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 flex-1"
            >
              <div className={`flex items-center justify-center w-12 h-8 rounded-full transition-all duration-200 ${active ? 'bg-primary' : ''}`}>
                <Icon
                  size={20}
                  strokeWidth={active ? 2.5 : 1.8}
                  className={active ? 'text-white' : 'text-white/40'}
                />
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-accent' : 'text-white/30'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
