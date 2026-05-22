import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  evaluateSmsPolicy,
  getConsent,
  isWithinQuietHours,
  type SmsMessageCategory,
} from '@/lib/sms/compliance'

const VALID_CATEGORIES: SmsMessageCategory[] = [
  'transactional',
  'support',
  'marketing',
]

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const contactIds = Array.isArray(body.contact_ids)
      ? (body.contact_ids as string[]).filter(Boolean)
      : []
    const messageCategoryRaw =
      body.message_category as SmsMessageCategory | undefined

    if (!VALID_CATEGORIES.includes(messageCategoryRaw as SmsMessageCategory)) {
      return NextResponse.json(
        {
          error:
            "message_category must be one of: transactional, support, marketing",
        },
        { status: 400 }
      )
    }
    const messageCategory = messageCategoryRaw as SmsMessageCategory
    if (contactIds.length === 0) {
      return NextResponse.json(
        { error: 'contact_ids is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    const { data: config, error: cfgError } = await supabase
      .from('whatsapp_config')
      .select('provider, sms_quiet_hours_start, sms_quiet_hours_end, sms_timezone')
      .eq('user_id', user.id)
      .maybeSingle()
    if (cfgError || !config) {
      return NextResponse.json(
        { error: 'SMS provider config not found' },
        { status: 400 }
      )
    }

    const { data: contacts, error: contactError } = await supabase
      .from('contacts')
      .select('id, phone, name')
      .eq('user_id', user.id)
      .in('id', contactIds)
    if (contactError) {
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    const contactMap = new Map((contacts ?? []).map((c) => [c.id, c]))
    const quietHours = isWithinQuietHours(config)
    const allowFflMarketing = process.env.ALLOW_FFL_MARKETING_SMS === 'true'

    const allowed: Array<{ contact_id: string; name: string | null; phone: string }> = []
    const blocked: Array<{
      contact_id: string
      name: string | null
      phone: string | null
      reasons: string[]
    }> = []

    for (const contactId of contactIds) {
      const c = contactMap.get(contactId)
      if (!c) {
        blocked.push({
          contact_id: contactId,
          name: null,
          phone: null,
          reasons: ['contact not found'],
        })
        continue
      }
      if (!c.phone) {
        blocked.push({
          contact_id: contactId,
          name: c.name ?? null,
          phone: null,
          reasons: ['missing phone number'],
        })
        continue
      }

      const consent = await getConsent(supabase, contactId)
      const policy = evaluateSmsPolicy({
        consent,
        messageCategory,
        provider: (config.provider ?? 'jasmin') as 'jasmin' | 'meta' | 'twilio',
        inQuietHours: quietHours,
        allowFflMarketing,
      })

      if (!policy.allowed) {
        blocked.push({
          contact_id: contactId,
          name: c.name ?? null,
          phone: c.phone,
          reasons: policy.reasons,
        })
      } else {
        allowed.push({
          contact_id: contactId,
          name: c.name ?? null,
          phone: c.phone,
        })
      }
    }

    const reasonBreakdown: Record<string, number> = {}
    for (const row of blocked) {
      for (const reason of row.reasons) {
        reasonBreakdown[reason] = (reasonBreakdown[reason] ?? 0) + 1
      }
    }

    return NextResponse.json({
      summary: {
        total: contactIds.length,
        allowed: allowed.length,
        blocked: blocked.length,
      },
      message_category: messageCategory,
      provider: config.provider ?? 'jasmin',
      quiet_hours_active: quietHours,
      reason_breakdown: reasonBreakdown,
      allowed_contacts: allowed,
      blocked_contacts: blocked,
    })
  } catch (error) {
    console.error('Error in SMS preflight POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
