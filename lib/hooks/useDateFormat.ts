'use client'
import { useSettings } from '@/components/SettingsContext'
import { formatDate } from '@/lib/utils'
import {
  formatBS, bsMonthHeader, bsMonthLabel, toBSParts,
  bsMonthStartGreg, bsMonthEndGreg, bsMonthShiftGreg, isSameBSMonth,
  BS_MONTHS, BS_MONTHS_SHORT,
} from '@/lib/nepali-date'
import { MONTHS } from '@/lib/utils'
import { format, startOfMonth, endOfMonth, isSameMonth as gregIsSameMonth } from 'date-fns'

export function useDateFormat() {
  const { currency } = useSettings()
  const isBS = currency === 'NPR'

  return {
    isBS,

    /** Format a date string/Date for display — BS or Gregorian */
    fmtDate: (date: Date | string): string =>
      isBS ? formatBS(date) : formatDate(typeof date === 'string' ? date : format(date, 'yyyy-MM-dd')),

    /** Day number to show in calendar grid cell */
    fmtDayNum: (date: Date): number =>
      isBS ? toBSParts(date).day : date.getDate(),

    /** Calendar month/year header e.g. "Baisakh 2083" or "April 2026" */
    fmtCalHeader: (date: Date): string =>
      isBS ? bsMonthHeader(date) : format(date, 'MMMM yyyy'),

    /** Month label for income/finance e.g. "Baisakh 2083" or "April 2026" */
    fmtIncomeMonth: (month: number, year: number): string =>
      isBS ? bsMonthLabel(month, year) : `${MONTHS[month - 1]} ${year}`,

    /** Short month name for chart axis */
    fmtMonthShort: (month: number, year: number): string => {
      if (!isBS) return MONTHS[month - 1].slice(0, 3)
      return bsMonthLabel(month, year).split(' ')[0].slice(0, 3)
    },

    /** Gregorian Date for the first day of the current month (BS or Gregorian) */
    monthStart: (date: Date): Date =>
      isBS ? bsMonthStartGreg(date) : startOfMonth(date),

    /** Gregorian Date for the last day of the current month (BS or Gregorian) */
    monthEnd: (date: Date): Date =>
      isBS ? bsMonthEndGreg(date) : endOfMonth(date),

    /** Shift by N months (BS or Gregorian) — returns a Date inside the new month */
    monthShift: (date: Date, delta: number): Date =>
      isBS ? bsMonthShiftGreg(date, delta) : new Date(date.getFullYear(), date.getMonth() + delta, 15),

    /** Are two Gregorian dates in the same display month (BS or Gregorian)? */
    isSameDisplayMonth: (a: Date, b: Date): boolean =>
      isBS ? isSameBSMonth(a, b) : gregIsSameMonth(a, b),
  }
}
