// prestart guard: `next start` needs a pre-built `.next/` with a build
// ID. Some deployment pipelines invoke `npm start` without running
// `npm run build` first; this script detects a missing build and runs
// it so the start phase never fails on an unbuilt tree.
//
// A build is heavy — on low-RAM shared hosting prefer building in CI
// and deploying the standalone output (see DEPLOY.md). This guard is a
// safety net, not the intended production path.

import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const buildId = join(root, '.next', 'BUILD_ID')

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

if (await exists(buildId)) {
  console.log('[ensure-build] .next/BUILD_ID present — skipping build.')
  process.exit(0)
}

console.warn(
  '[ensure-build] .next/BUILD_ID missing — running `npm run build` ' +
    'before start.',
)

const result = spawnSync('npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.status !== 0) {
  console.error('[ensure-build] build failed — aborting start.')
  process.exit(result.status ?? 1)
}

console.log('[ensure-build] build complete — proceeding to start.')
