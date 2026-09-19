import { NextResponse } from 'next/server'
import { verifyPluginToken } from '@/lib/plugin/session'
import { resolveTochatScope } from '@/lib/tochat/org-config'
import { widgets, resourceId } from '@/lib/tochat/client'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { tochatTagForOrg } from '@/lib/tochat/org-config'

/**
 * GET /api/plugin/widgets  (Bearer plugin token from /api/plugin/session)
 *
 * The widget catalog for the license's org — the plugin's admin
 * "pick your widget" dropdown. Mirrors the shape the plugin's
 * License::refresh_widget_list() expects:
 *
 *   { ok: true, widgets: [ { id, name, key } ] }
 *
 * The key is the widget's public embed key (same one the CRM's
 * install-snippet uses), never an internal secret.
 */
export async function GET(request: Request) {
  const auth = verifyPluginToken(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null)
  if (!auth) {
    return NextResponse.json({ error: 'Invalid or expired plugin session' }, { status: 401 })
  }

  const admin = supabaseAdmin()
  const scope = await resolveTochatScope(admin, auth.orgId)
  if (!scope) {
    // No white-label account connected for this org — plugin shows
    // the "connect from your dashboard" empty state.
    return NextResponse.json({ ok: true, configured: false, widgets: [] })
  }

  try {
    const list = await widgets.list(scope)
    const tag = await tochatTagForOrg(admin, auth.orgId)
    return NextResponse.json({
      ok: true,
      configured: true,
      widgets: (list as Record<string, unknown>[]).map((w) => {
        const id = resourceId(w)
        return {
          id,
          name: String(w.name ?? 'Widget'),
          // Widget key: the tochat platform exposes the embed key as
          // `key` (or widgetKey) on the widget resource.
          key: String(w.key ?? w.widgetKey ?? id),
          active: w.active !== false,
        }
      }),
      user_client: tag,
      install_base: process.env.NEXT_PUBLIC_SITE_URL || 'https://app.chatbotistic.com',
    })
  } catch (err) {
    console.error('[api/plugin/widgets] failed:', err)
    return NextResponse.json({ error: 'Failed to load widgets' }, { status: 502 })
  }
}

export const dynamic = 'force-dynamic'
