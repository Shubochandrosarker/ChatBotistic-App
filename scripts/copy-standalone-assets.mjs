// Post-build step for `output: "standalone"` deployments (Hostinger
// hPanel, any bare Node host).
//
// Next emits `.next/standalone/server.js` but, by design, leaves out
// `public/` and `.next/static/` — it assumes a CDN serves them. On
// Hostinger's hPanel Node.js app there is no CDN in front of the
// process, so the standalone server has to serve those itself. Next
// only picks them up if they sit at `.next/standalone/public` and
// `.next/standalone/.next/static`, so copy them there.
//
// Idempotent and safe to run repeatedly. If standalone output is not
// enabled it warns and exits 0 rather than failing the build.

import { cp, access } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const standalone = join(root, '.next', 'standalone')

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

if (!(await exists(standalone))) {
  console.warn(
    '[copy-standalone-assets] .next/standalone not found — skipping.\n' +
      '  Enable it with `output: "standalone"` in next.config.ts.',
  )
  process.exit(0)
}

const jobs = [
  { from: join(root, 'public'), to: join(standalone, 'public') },
  {
    from: join(root, '.next', 'static'),
    to: join(standalone, '.next', 'static'),
  },
]

for (const { from, to } of jobs) {
  if (!(await exists(from))) {
    console.warn(`[copy-standalone-assets] ${from} not found — skipping.`)
    continue
  }
  await cp(from, to, { recursive: true })
  console.log(`[copy-standalone-assets] copied ${from} -> ${to}`)
}

console.log('[copy-standalone-assets] done — .next/standalone is deployable.')
