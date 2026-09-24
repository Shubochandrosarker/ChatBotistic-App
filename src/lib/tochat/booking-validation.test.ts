import { describe, it, expect } from 'vitest'
import { validateBookingConfigPayload, normalizeBookingConfigPayload } from './booking-validation'

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    duration: 30,
    timezone: 'Europe/Madrid',
    bookingTimes: [{ day: 'MON', availableFrom: '09:00', availableUntil: '17:00' }],
    ...overrides,
  }
}

describe('validateBookingConfigPayload', () => {
  it('accepts a well-formed payload', () => {
    expect(validateBookingConfigPayload(validPayload())).toBeNull()
  })

  it('rejects a missing or malformed startDate/endDate', () => {
    expect(validateBookingConfigPayload(validPayload({ startDate: '08/01/2026' }))).toMatch(/startDate/)
    expect(validateBookingConfigPayload(validPayload({ endDate: undefined }))).toMatch(/endDate/)
  })

  it('rejects an endDate before startDate', () => {
    const err = validateBookingConfigPayload(
      validPayload({ startDate: '2026-08-31', endDate: '2026-08-01' }),
    )
    expect(err).toMatch(/endDate.*startDate/)
  })

  it('accepts endDate equal to startDate', () => {
    expect(
      validateBookingConfigPayload(validPayload({ startDate: '2026-08-01', endDate: '2026-08-01' })),
    ).toBeNull()
  })

  it('rejects a non-positive duration', () => {
    expect(validateBookingConfigPayload(validPayload({ duration: 0 }))).toMatch(/duration/)
    expect(validateBookingConfigPayload(validPayload({ duration: -5 }))).toMatch(/duration/)
  })

  it('rejects a negative breakTime', () => {
    expect(validateBookingConfigPayload(validPayload({ breakTime: -1 }))).toMatch(/breakTime/)
  })

  it('rejects availablePlacePerSlot below 1', () => {
    expect(validateBookingConfigPayload(validPayload({ availablePlacePerSlot: 0 }))).toMatch(
      /availablePlacePerSlot/,
    )
  })

  it('rejects a negative allowedHourUntilBooking', () => {
    expect(validateBookingConfigPayload(validPayload({ allowedHourUntilBooking: -1 }))).toMatch(
      /allowedHourUntilBooking/,
    )
  })

  it('rejects a missing timezone', () => {
    expect(validateBookingConfigPayload(validPayload({ timezone: '  ' }))).toMatch(/timezone/)
  })

  it('rejects an empty bookingTimes array', () => {
    expect(validateBookingConfigPayload(validPayload({ bookingTimes: [] }))).toMatch(/bookingTimes/)
  })

  it('rejects a bookingTimes entry with an invalid weekday', () => {
    const err = validateBookingConfigPayload(
      validPayload({ bookingTimes: [{ day: 'FUNDAY', availableFrom: '09:00', availableUntil: '17:00' }] }),
    )
    expect(err).toMatch(/bookingTimes/)
  })

  it('rejects a bookingTimes entry with a malformed time string', () => {
    const err = validateBookingConfigPayload(
      validPayload({ bookingTimes: [{ day: 'MON', availableFrom: '9am', availableUntil: '17:00' }] }),
    )
    expect(err).toMatch(/bookingTimes/)
  })

  it('accepts HTML time inputs that include seconds', () => {
    expect(
      validateBookingConfigPayload(
        validPayload({ bookingTimes: [{ day: 'MON', availableFrom: '09:00:00', availableUntil: '17:00:00' }] }),
      ),
    ).toBeNull()
  })

  it('rejects a bookingTimes window that ends before (or when) it starts', () => {
    const err = validateBookingConfigPayload(
      validPayload({ bookingTimes: [{ day: 'MON', availableFrom: '17:00', availableUntil: '09:00' }] }),
    )
    expect(err).toMatch(/24-hour time/)

    const errEqual = validateBookingConfigPayload(
      validPayload({ bookingTimes: [{ day: 'MON', availableFrom: '09:00', availableUntil: '09:00' }] }),
    )
    expect(errEqual).toMatch(/must end after it starts/)
  })

  it('rejects blockingDays entries that are not ISO dates', () => {
    expect(validateBookingConfigPayload(validPayload({ blockingDays: ['08/01/2026'] }))).toMatch(
      /blockingDays/,
    )
  })

  it('accepts well-formed blockingDays', () => {
    expect(validateBookingConfigPayload(validPayload({ blockingDays: ['2026-08-05'] }))).toBeNull()
  })
})

describe('normalizeBookingConfigPayload', () => {
  it('fills in defaults for optional fields', () => {
    const normalized = normalizeBookingConfigPayload(validPayload())
    expect(normalized).toMatchObject({
      breakTime: 0,
      availablePlacePerSlot: 1,
      allowedHourUntilBooking: 0,
      sendReminder: true,
      sendReminder48: true,
      cancelBookingInReminder: true,
      blockingDays: [],
    })
  })

  it('preserves explicit false reminder flags instead of defaulting them to true', () => {
    const normalized = normalizeBookingConfigPayload(
      validPayload({ sendReminder: false, sendReminder48: false, cancelBookingInReminder: false }),
    )
    expect(normalized).toMatchObject({
      sendReminder: false,
      sendReminder48: false,
      cancelBookingInReminder: false,
    })
  })
})
