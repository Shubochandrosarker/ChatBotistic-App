import type { TochatBookingTime, TochatWeekday } from './client'

const WEEKDAYS: TochatWeekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validBookingTimes(value: unknown): value is TochatBookingTime[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((t) => {
      const row = t as Partial<TochatBookingTime>
      return (
        row &&
        typeof row === 'object' &&
        WEEKDAYS.includes(row.day as TochatWeekday) &&
        typeof row.availableFrom === 'string' &&
        TIME_RE.test(row.availableFrom) &&
        typeof row.availableUntil === 'string' &&
        TIME_RE.test(row.availableUntil)
      )
    })
  )
}

/** Validates the fields a booking config create/update body must have in common. Returns an error message, or null when valid. */
export function validateBookingConfigPayload(payload: Record<string, unknown>): string | null {
  if (typeof payload.startDate !== 'string' || !DATE_RE.test(payload.startDate)) {
    return '`startDate` must be an ISO date (YYYY-MM-DD)'
  }
  if (typeof payload.endDate !== 'string' || !DATE_RE.test(payload.endDate)) {
    return '`endDate` must be an ISO date (YYYY-MM-DD)'
  }
  if (typeof payload.duration !== 'number' || payload.duration <= 0) {
    return '`duration` must be a positive number of minutes'
  }
  if (typeof payload.timezone !== 'string' || !payload.timezone.trim()) {
    return '`timezone` is required, e.g. "Europe/Madrid"'
  }
  if (!validBookingTimes(payload.bookingTimes)) {
    return 'At least one valid `bookingTimes` entry ({ day, availableFrom, availableUntil }) is required'
  }
  if (payload.blockingDays != null) {
    if (
      !Array.isArray(payload.blockingDays) ||
      !payload.blockingDays.every((d) => typeof d === 'string' && DATE_RE.test(d))
    ) {
      return '`blockingDays` must be an array of ISO dates (YYYY-MM-DD)'
    }
  }
  return null
}

/** Normalizes the optional-with-defaults fields shared by create and update. */
export function normalizeBookingConfigPayload(payload: Record<string, unknown>) {
  return {
    startDate: payload.startDate,
    endDate: payload.endDate,
    duration: payload.duration,
    breakTime: typeof payload.breakTime === 'number' ? payload.breakTime : 0,
    availablePlacePerSlot:
      typeof payload.availablePlacePerSlot === 'number' ? payload.availablePlacePerSlot : 1,
    allowedHourUntilBooking:
      typeof payload.allowedHourUntilBooking === 'number' ? payload.allowedHourUntilBooking : 0,
    bookingTimes: payload.bookingTimes,
    timezone: payload.timezone,
    sendReminder: payload.sendReminder !== false,
    sendReminder48: payload.sendReminder48 !== false,
    cancelBookingInReminder: payload.cancelBookingInReminder !== false,
    blockingDays: Array.isArray(payload.blockingDays) ? payload.blockingDays : [],
  }
}
