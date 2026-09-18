// ------------------------------------------------------------
// WPistic license server client (api.wpistic.com).
//
// The SAME public plugin endpoints the WordPress chatbotistic-widget
// plugin uses (see chatbotistic-widget/includes/class-license.php):
//
//   POST /api/v1/licenses/activate    { key, domain, installation_uuid, ... }
//   POST /api/v1/licenses/validate    { activation_token, ... }
//   POST /api/v1/licenses/deactivate  { activation_token, installation_uuid }
//
// Responses follow the platform contracts in
// wpistic-platform/packages/types/src/index.ts (LicenseActivationResponse /
// LicenseValidationResponse). This module keeps only the fields the
// CRM needs and never logs raw keys.
//
// Server-only — runs with no secrets beyond the public endpoints.
//
// Env:
//   WPISTIC_LICENSE_API_BASE — optional; defaults to https://api.wpistic.com
// ------------------------------------------------------------

import crypto from 'node:crypto'

const DEFAULT_BASE = 'https://api.wpistic.com'

export class LicenseServerError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'LicenseServerError'
    this.status = status
  }
}

/** The subset of the activation/validate response the CRM persists. */
export interface LicenseServerResult {
  valid: boolean
  status: string
  product: string | null
  plan: string | null
  expires_at: string | null
  entitlements: Record<string, boolean | number | string | string[]>
  activation_token: string | null
  check_after: number | null
  grace_period_days: number | null
}

function baseUrl(): string {
  return (process.env.WPISTIC_LICENSE_API_BASE || DEFAULT_BASE).replace(/\/+$/, '')
}

async function call(
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let res: Response
  try {
    res = await fetch(baseUrl() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
  } catch (err) {
    throw new LicenseServerError(
      `Could not reach the license server (${(err as Error).message}).`,
      502,
    )
  }

  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    // fall through — handled by status below
  }

  if (!res.ok) {
    const envelope = json.error as { message?: string; code?: string } | undefined
    throw new LicenseServerError(
      envelope?.message || `License server rejected the request (HTTP ${res.status}).`,
      res.status,
    )
  }
  return json
}

function mapResult(json: Record<string, unknown>): LicenseServerResult {
  return {
    valid: json.valid === true,
    status: typeof json.status === 'string' ? json.status : 'inactive',
    product: typeof json.product === 'string' ? json.product : null,
    plan: typeof json.plan === 'string' ? json.plan : null,
    expires_at: typeof json.expires_at === 'string' ? json.expires_at : null,
    entitlements:
      (json.entitlements as LicenseServerResult['entitlements']) ?? {},
    activation_token:
      typeof json.activation_token === 'string' ? json.activation_token : null,
    check_after: typeof json.check_after === 'number' ? json.check_after : null,
    grace_period_days:
      typeof json.grace_period_days === 'number' ? json.grace_period_days : null,
  }
}

export async function activateLicense(input: {
  key: string
  domain: string
  installationUuid: string
  siteUrl?: string
  productVersion?: string
}): Promise<LicenseServerResult> {
  const json = await call('/api/v1/licenses/activate', {
    key: input.key,
    domain: input.domain,
    installation_uuid: input.installationUuid,
    site_url: input.siteUrl,
    home_url: input.siteUrl,
    environment: 'production',
    product_version: input.productVersion,
  })
  return mapResult(json)
}

export async function validateLicense(input: {
  activationToken: string
  domain: string
  installationUuid: string
}): Promise<LicenseServerResult> {
  const json = await call('/api/v1/licenses/validate', {
    activation_token: input.activationToken,
    domain: input.domain,
    environment: 'production',
    installation_uuid: input.installationUuid,
  })
  return mapResult(json)
}

export async function deactivateLicense(input: {
  activationToken: string
  installationUuid: string
}): Promise<void> {
  await call('/api/v1/licenses/deactivate', {
    activation_token: input.activationToken,
    installation_uuid: input.installationUuid,
  })
}

// ---- Helpers ------------------------------------------------------------

/**
 * Deterministic UUID (RFC-4122 shaped, version nibble forced so the
 * license server's `.uuid()` schema accepts it) for a given org —
 * stable across re-activations so the license server sees ONE known
 * installation per workspace, not a new UUID every time.
 */
export function deterministicInstallationUuid(orgId: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`chatbotistic-crm:${orgId}`)
    .digest('hex')
  const h = hash.slice(0, 32)
  const bytes = h.match(/.{2}/g)!.map((x) => parseInt(x, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50 // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

/** Never store or echo a raw key — show `WPIST-****-****-3F7A` style. */
export function maskLicenseKey(key: string): string {
  const trimmed = key.trim()
  if (trimmed.length <= 8) return '****'
  return `${trimmed.slice(0, 4)}-****-****-${trimmed.slice(-4).toUpperCase()}`
}

/** Stable hash of the raw key (SHA-256 hex) so re-validate never needs the raw key. */
export function hashLicenseKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex')
}
