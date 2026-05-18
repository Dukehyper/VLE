import NepaliDate from 'nepali-date-converter'

export const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
]

export const BS_MONTHS_SHORT = [
  'Bai', 'Jes', 'Ash', 'Shr', 'Bha', 'Asw',
  'Kar', 'Man', 'Pou', 'Mag', 'Fal', 'Cha',
]

interface BSParts { year: number; month: number; day: number }

function toD(date: Date | string): Date {
  if (typeof date === 'string') {
    // Avoid timezone shift: treat YYYY-MM-DD as local noon
    return date.includes('T') ? new Date(date) : new Date(date + 'T12:00:00')
  }
  return date
}

export function toBSParts(date: Date | string): BSParts {
  try {
    const nd = new NepaliDate(toD(date))
    return { year: nd.getYear(), month: nd.getMonth() + 1, day: nd.getDate() }
  } catch {
    const d = toD(date)
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
  }
}

/** "14 Baisakh 2083" */
export function formatBS(date: Date | string): string {
  const { year, month, day } = toBSParts(date)
  return `${day} ${BS_MONTHS[month - 1]} ${year}`
}

/** "Baisakh 2083" — for the 15th of a Gregorian month as a representative header */
export function bsMonthHeader(gregorianDate: Date): string {
  const mid = new Date(gregorianDate.getFullYear(), gregorianDate.getMonth(), 15)
  const { year, month } = toBSParts(mid)
  return `${BS_MONTHS[month - 1]} ${year}`
}

/** Given Gregorian month (1-12) + year, return "Baisakh 2083" style label */
export function bsMonthLabel(gregMonth: number, gregYear: number): string {
  const mid = new Date(gregYear, gregMonth - 1, 15)
  const { year, month } = toBSParts(mid)
  return `${BS_MONTHS[month - 1]} ${year}`
}

/** Gregorian Date for the 1st day of the BS month containing the given Gregorian date */
export function bsMonthStartGreg(date: Date): Date {
  const { year, month } = toBSParts(date)
  return new NepaliDate(year, month - 1, 1).toJsDate()
}

/** Gregorian Date for the LAST day of the BS month containing the given Gregorian date */
export function bsMonthEndGreg(date: Date): Date {
  const { year, month } = toBSParts(date)
  let ny = year, nm = month + 1
  if (nm > 12) { nm = 1; ny++ }
  const firstNext = new NepaliDate(ny, nm - 1, 1).toJsDate()
  return new Date(firstNext.getTime() - 86400000)
}

/** Gregorian Date in the BS month obtained by shifting `delta` BS months from `date`. Returns 15th of target BS month. */
export function bsMonthShiftGreg(date: Date, delta: number): Date {
  const { year, month } = toBSParts(date)
  let nm = month + delta, ny = year
  while (nm < 1) { nm += 12; ny-- }
  while (nm > 12) { nm -= 12; ny++ }
  return new NepaliDate(ny, nm - 1, 15).toJsDate()
}

/** Returns true if two Gregorian dates fall in the same BS month */
export function isSameBSMonth(a: Date, b: Date): boolean {
  const pa = toBSParts(a), pb = toBSParts(b)
  return pa.year === pb.year && pa.month === pb.month
}
