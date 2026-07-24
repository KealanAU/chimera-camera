// Regenerates the README artwork in images/ from the sources in this folder.
//
//   images/src/logo.svg     -> images/logo.webp
//   images/src/banner.html  -> images/banner-{light,dark}.webp
//
// WebP because these ship inside the npm tarball: the README has to render on
// npmjs.com, which cannot resolve relative paths back to a private GitHub repo,
// and PNG gradients at 2x cost roughly ten times as much.
//
// Usage: node images/src/render.mjs   (needs Chrome and cwebp — `brew install webp`)
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const path = (rel) => fileURLToPath(new URL(rel, import.meta.url))

const shots = [
  { src: 'banner.html', query: '?theme=light', out: 'banner-light', size: '1280,264' },
  { src: 'banner.html', query: '?theme=dark', out: 'banner-dark', size: '1280,264' },
  { src: 'logo.svg', query: '', out: 'logo', size: '252,320' },
]

for (const { src, query, out, size } of shots) {
  const png = path(`../${out}.png`)
  execFileSync(CHROME, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    `--window-size=${size}`,
    '--default-background-color=00000000',
    `--screenshot=${png}`,
    `file://${path(src)}${query}`,
  ])
  // -q 88 keeps the gradients band-free; alpha is preserved for the logo.
  execFileSync('cwebp', ['-q', '88', '-alpha_q', '100', '-quiet', png, '-o', path(`../${out}.webp`)])
  rmSync(png)
  console.log(`wrote images/${out}.webp`)
}
