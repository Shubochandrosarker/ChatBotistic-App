import { describe, it, expect } from 'vitest'
import { classifyKeyword, isWithinQuietHours } from './compliance'

describe('classifyKeyword', () => {
  it('recognizes opt-out keywords regardless of case', () => {
    expect(classifyKeyword('STOP')).toBe('stop')
    expect(classifyKeyword('stop')).toBe('stop')
    expect(classifyKeyword('  Unsubscribe ')).toBe('stop')
    expect(classifyKeyword('CANCEL')).toBe('stop')
  })

  it('keys off the first word only', () => {
    expect(classifyKeyword('STOP please')).toBe('stop')
    expect(classifyKeyword('start now')).toBe('start')
    expect(classifyKeyword('please do not stop')).toBeNull()
  })

  it('recognizes start and help keywords', () => {
    expect(classifyKeyword('START')).toBe('start')
    expect(classifyKeyword('YES')).toBe('start')
    expect(classifyKeyword('HELP')).toBe('help')
    expect(classifyKeyword('info')).toBe('help')
  })

  it('returns null for ordinary messages and empty input', () => {
    expect(classifyKeyword('hello there')).toBeNull()
    expect(classifyKeyword('')).toBeNull()
    expect(classifyKeyword('   ')).toBeNull()
  })
})

describe('isWithinQuietHours', () => {
  const at = (hourUtc: number) =>
    new Date(`2026-01-01T${String(hourUtc).padStart(2, '0')}:00:00Z`)

  it('is disabled when start or end is null', () => {
    expect(
      isWithinQuietHours({ sms_quiet_hours_start: null, sms_quiet_hours_end: 8 })
    ).toBe(false)
    expect(
      isWithinQuietHours({ sms_quiet_hours_start: 21, sms_quiet_hours_end: null })
    ).toBe(false)
  })

  it('handles a same-day window', () => {
    const cfg = {
      sms_quiet_hours_start: 9,
      sms_quiet_hours_end: 17,
      sms_timezone: 'UTC',
    }
    expect(isWithinQuietHours(cfg, at(12))).toBe(true)
    expect(isWithinQuietHours(cfg, at(8))).toBe(false)
    expect(isWithinQuietHours(cfg, at(17))).toBe(false)
  })

  it('handles a window that wraps past midnight', () => {
    const cfg = {
      sms_quiet_hours_start: 21,
      sms_quiet_hours_end: 8,
      sms_timezone: 'UTC',
    }
    expect(isWithinQuietHours(cfg, at(22))).toBe(true)
    expect(isWithinQuietHours(cfg, at(3))).toBe(true)
    expect(isWithinQuietHours(cfg, at(12))).toBe(false)
  })
})
