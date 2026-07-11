import { NextResponse } from 'next/server'

/**
 * Parse a request body as JSON, returning a ready-to-return 400
 * NextResponse on failure instead of letting `request.json()` throw
 * into a route's generic catch block (which maps every unexpected
 * error to a 500 — a malformed body isn't a server error).
 */
export async function parseJsonBody(
  request: Request,
): Promise<{ body: Record<string, unknown>; error: null } | { body: null; error: NextResponse }> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { body: null, error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { body: null, error: NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 }) }
  }
  return { body: body as Record<string, unknown>, error: null }
}
