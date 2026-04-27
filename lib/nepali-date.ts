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
