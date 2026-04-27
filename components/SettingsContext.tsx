'use client'
import { createContext, useContext, ReactNode } from 'react'
import { CURRENCY_SYMBOLS } from '@/lib/utils'

interface Settings {
  currency: string
  currencySymbol: string
  leave_allowance: number
  display_name: string | null
  avatar_url: string | null
}

const defaultSettings: Settings = {
  currency: 'GBP',
  currencySymbol: '£',
  leave_allowance: 20,
  display_name: null,
  avatar_url: null,
}

const SettingsContext = createContext<Settings>(defaultSettings)

interface SettingsRow {
  currency: string
  leave_allowance: number
  display_name: string | null
  avatar_url: string | null
}

export function SettingsProvider({ children, initialSettings }: { children: ReactNode; initialSettings?: SettingsRow | null }) {
  const value: Settings = initialSettings
    ? {
        currency: initialSettings.currency,
        currencySymbol: CURRENCY_SYMBOLS[initialSettings.currency] ?? '£',
        leave_allowance: initialSettings.leave_allowance,
        display_name: initialSettings.display_name,
        avatar_url: initialSettings.avatar_url ?? null,
      }
    : defaultSettings

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export const useSettings = () => useContext(SettingsContext)
