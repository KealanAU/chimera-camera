import assert from 'node:assert/strict'
import test from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The root package must stay framework-neutral: React, Vue, and Svelte
// consumers all drive the same core, so no UI runtime may leak into what ships
// (dist). Framework glue, when it exists, lives in separate optional entry
// points — never the core. Examples under example/ may import frameworks.
const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const FRAMEWORK_IMPORT = /\bfrom\s+['"](react|preact|solid-js|vue|svelte|@lynx-js\/react)\b/

test('the published root package imports no UI framework runtime', () => {
  const offenders = []
  for (const file of readdirSync(distDir)) {
    if (!file.endsWith('.js') && !file.endsWith('.d.ts')) continue
    if (FRAMEWORK_IMPORT.test(readFileSync(join(distDir, file), 'utf8'))) offenders.push(file)
  }
  assert.deepEqual(offenders, [], `framework runtime imports leaked into dist: ${offenders.join(', ')}`)
})
