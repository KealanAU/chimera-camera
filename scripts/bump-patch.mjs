// Bumps the patch version everywhere it is written. Patch is the only bump this
// repo does before 1.0.0 — see the "Releasing" section of docs/publishing.md.
// 1.0.0 is a deliberate hand edit (and means deleting the guard in
// tests/version-sync.test.js).
//
// Usage: pnpm run bump
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const pkgUrl = new URL('package.json', root)
const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8'))

const [major, minor, patch] = pkg.version.split('-')[0].split('.').map(Number)
if ([major, minor, patch].some(Number.isNaN)) {
  throw new Error(`cannot parse version "${pkg.version}"`)
}
const next = `${major}.${minor}.${patch + 1}`

// Every file that repeats the version. tests/version-sync.test.js fails if one drifts.
const sites = [
  ['package.json', `"version": "${pkg.version}"`, `"version": "${next}"`],
  ['src/native.ts', `'${pkg.version}'`, `'${next}'`],
  ['ios/ChimeraCameraModule.swift', `"${pkg.version}"`, `"${next}"`],
  ['android/src/main/java/com/kealanau/chimeracamera/ChimeraCameraModule.kt', `"${pkg.version}"`, `"${next}"`],
]

for (const [file, from, to] of sites) {
  const url = new URL(file, root)
  const before = readFileSync(url, 'utf8')
  if (!before.includes(from)) throw new Error(`${file} does not contain ${from}`)
  writeFileSync(url, before.replace(from, to))
}

console.log(`${pkg.version} -> ${next}`)
console.log('Now update CHANGELOG.md, commit, and run the Release workflow.')
