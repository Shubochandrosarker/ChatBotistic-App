import { NextResponse } from 'next/server'
import { parseJsonBody } from '@/lib/api/parse-json-body'
import { requireTochatScope } from '@/lib/api/tochat-route'
import { operatorOwnedByOrg } from '@/lib/tochat/ownership'
import { scanFaqSource, type FaqSourceMode } from '@/lib/ai/faq-sources'

const modes = new Set<FaqSourceMode>(['sitemap', 'urls', 'text'])

export async function POST(request: Request) {
  try {
    const { scope, error } = await requireTochatScope()
    if (error) return error
    const { body, error: parseError } = await parseJsonBody(request)
    if (parseError) return parseError

    const operatorId = typeof body.operatorId === 'string' ? body.operatorId.trim() : ''
    const mode = typeof body.mode === 'string' ? body.mode as FaqSourceMode : null
    if (!operatorId || !mode || !modes.has(mode)) {
      return NextResponse.json({ error: 'operatorId and a valid source mode are required' }, { status: 400 })
    }
    if (!(await operatorOwnedByOrg(scope, operatorId))) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const result = await scanFaqSource({
      mode,
      sitemapUrl: typeof body.sitemapUrl === 'string' ? body.sitemapUrl : undefined,
      urls: Array.isArray(body.urls) && body.urls.every((url) => typeof url === 'string') ? body.urls as string[] : undefined,
      text: typeof body.text === 'string' ? body.text : undefined,
    })
    return NextResponse.json({ configured: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'FAQ scan failed'
    const status = /not configured|required|invalid|private|characters|found|allowed|fetch|response/i.test(message) ? 400 : 502
    console.error('[api/tochat/faq-groups/scan] failed:', message)
    return NextResponse.json({ error: message }, { status })
  }
}
