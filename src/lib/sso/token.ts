import crypto from 'node:crypto'

/**
 * SSO token minted by the WordPress side (Memberistic + Licenseistic).
 *
 * Wire format — two dot-separated, base64url parts:
 *
 *   <base64url(JSON payload)>.<base64url(HMAC-SHA256)>
 *
 * The HMAC is computed over the *encoded payload string* with the
 * shared secret (`SSO_SHARED_SECRET`, identical on both sides). This
 * is a deliberately small, dependency-free token — not a full JWT —
 * because the only claims are the ones below and the only consumer is
 * this app.
 *
 * Claims:
 *   - sub            stable WordPress identifier (user or site id).
 *                    Maps 1:1 to organizations.sso_subject.
 *   - email, name    provisioning details for the CRM user.
 *   - Memberistic asserts: plan, agent_limit, widget_limit,
 *     domain_limit, conversation_limit, white_label (from the plan's
 *     settings JSON — see the SaaS connector plugin module).
 *   - Licenseistic asserts: license_key, license_status,
 *     allowed_domains.
 *   - iat, exp       issued-at / expiry, unix seconds.
 */

export interface SsoClaims {
  sub: string
  email: string
  name?: string
  plan: string
  license_key?: string
  license_status?: 'active' | 'inactive' | 'expired' | 'suspended'
  agent_limit?: number
  widget_limit?: number
  domain_limit?: number
  /** Monthly conversation cap. 0 means unlimited. */
  conversation_limit?: number
  /** Whether the plan removes Chatbotistic/CRM branding. */
  white_label?: boolean
  allowed_domains?: string[]
  iat: number
  exp: number
}

export class SsoTokenError extends Error {}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Mint a token. Primarily for tests and the WordPress-side reference
 * implementation; the CRM itself only ever verifies.
 */
export function signSsoToken(
  claims: Omit<SsoClaims, 'iat' | 'exp'> & { iat?: number; exp?: number },
  secret: string,
  ttlSeconds = 300,
): string {
  const now = Math.floor(Date.now() / 1000)
  const full: SsoClaims = {
    ...claims,
    iat: claims.iat ?? now,
    exp: claims.exp ?? now + ttlSeconds,
  }
  const payload = b64urlEncode(Buffer.from(JSON.stringify(full), 'utf-8'))
  const sig = b64urlEncode(
    crypto.createHmac('sha256', secret).update(payload).digest(),
  )
  return `${payload}.${sig}`
}

/**
 * Verify a token and return its claims. Throws `SsoTokenError` on any
 * structural, signature, or freshness failure — callers should treat
 * every throw as "reject the login".
 */
export function verifySsoToken(
  token: string,
  secret: string,
  maxSkewSeconds = 300,
): SsoClaims {
  if (!secret) {
    throw new SsoTokenError('SSO_SHARED_SECRET is not configured')
  }

  const parts = token.split('.')
  if (parts.length !== 2) {
    throw new SsoTokenError('Malformed SSO token')
  }
  const [payloadPart, sigPart] = parts

  const expected = crypto
    .createHmac('sha256', secret)
    .update(payloadPart)
    .digest()
  const provided = b64urlDecode(sigPart)
  if (
    expected.length !== provided.length ||
    !crypto.timingSafeEqual(expected, provided)
  ) {
    throw new SsoTokenError('SSO token signature verification failed')
  }

  let claims: SsoClaims
  try {
    claims = JSON.parse(b64urlDecode(payloadPart).toString('utf-8'))
  } catch {
    throw new SsoTokenError('SSO token payload is not valid JSON')
  }

  if (!claims.sub || !claims.email) {
    throw new SsoTokenError('SSO token is missing required claims (sub, email)')
  }

  const now = Math.floor(Date.now() / 1000)
  if (typeof claims.exp === 'number' && now > claims.exp + maxSkewSeconds) {
    throw new SsoTokenError('SSO token has expired')
  }
  if (typeof claims.iat === 'number' && claims.iat > now + maxSkewSeconds) {
    throw new SsoTokenError('SSO token issued-at is in the future')
  }

  return claims
}
