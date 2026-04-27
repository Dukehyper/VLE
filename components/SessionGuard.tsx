'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SessionGuard() {
  const router = useRouter()

  useEffect(() => {
    const remembered = localStorage.getItem('pulse_remember_me')
    const activeSession = sessionStorage.getItem('pulse_session')

    if (!remembered && !activeSession) {
      // Browser was closed and user didn't check "Remember Me"
      const supabase = createClient()
      supabase.auth.signOut().then(() => router.push('/login'))
      return
    }

    // Mark session as active for future navigations in this browser session
    if (!activeSession) {
      sessionStorage.setItem('pulse_session', '1')
    }
  }, [router])

  return null
}
