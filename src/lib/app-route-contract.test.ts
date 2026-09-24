// Route-contract regression gates for the two live 404s found in the
// 2026-09-24 audit: the pricing Free CTA pointing at a nonexistent
// /register, and published landing pages 404ing because the /land
// proxy was missing from the rewrite list. Component-test
// infrastructure doesn't exist in this repo, so these read the source
// directly — cheap, and they fail the exact day someone reintroduces
// either bug.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

describe('pricing → signup conversion path', () => {
  const pricing = readRepoFile('src/app/(marketing)/pricing/page.tsx')

  it('points the Free plan CTA at the real signup route', () => {
    expect(pricing).toContain('href="/signup?plan=free"')
  })

  it('never links to the nonexistent /register page', () => {
    expect(pricing).not.toMatch(/href=["']\/register["']/)
  })
})

describe('published landing pages', () => {
  const config = readRepoFile('next.config.ts')

  it('does not proxy /land/:path* to the provider (native slug route owns it)', () => {
    expect(config).not.toMatch(/source:\s*'\/land\/:path\*'/)
  })

  it('permanently redirects legacy /register links to signup', () => {
    expect(config).toMatch(/source:\s*'\/register'/)
    expect(config).toMatch(/destination:\s*'\/signup\?plan=free'/)
  })

  it('serves the provider landing redirect target as a real public page', () => {
    // The provider answers /land/{slug} with a redirect to
    // /whatsapp-business-directory/{uuid} on this host — that target
    // must exist as a branded page, not a 404.
    const page = readRepoFile('src/app/whatsapp-business-directory/[uuid]/page.tsx')
    expect(page).toContain('notFound()')
    expect(page).toContain('/install-widget/bundle.js?key=')
    // Only the env-only public scope may back the public page.
    expect(page).toContain('publicReadScope')
  })

  it('keeps robots noindex for the dashboard but allows landing pages', () => {
    const robots = readRepoFile('src/app/robots.ts')
    expect(robots).toContain("disallow: '/'")
    expect(robots).toContain("'/whatsapp-business-directory/'")
  })
})
