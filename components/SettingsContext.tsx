'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CURRENCY_SYMBOLS } from '@/lib/utils'

interface Settings {
  currency: string
  currencySymbol: string
  leave_allowance: number
  day_off: string
  display_name: string | null
}

const defaultSettings: Settings = {
  currency: 'GBP',
  currencySymbol: '£',
  leave_allowance: 20,
  day_off: 'Sunday',
  display_name: null,
}

const SettingsContext = createContext<Settings>(defaultSettings)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('settings')
        .select('*')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setSettings({
              currency: data.currency,
              currencySymbol: CURRENCY_SYMBOLS[data.currency] ?? '£',
              leave_allowance: data.leave_allowance,
              day_off: data.day_off,
              display_name: data.display_name,
            })
          }
        })
    })
  }, [])

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

export const useSettings = () => useContext(SettingsContext)
