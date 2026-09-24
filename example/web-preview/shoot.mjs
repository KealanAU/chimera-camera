// Drives dist/index.html through the main flows and screenshots each state into
// dist/shots/. Uses the preinstalled Chromium (override with CHROMIUM_PATH).
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, 'dist/shots')
await mkdir(out, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 480, height: 940 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(pathToFileURL(path.join(here, 'dist/index.html')).href)
await page.waitForTimeout(600)

const box = await page.locator('#phone').boundingBox()
const at = (x, y) => [box.x + x, box.y + y]
const tap = (x, y) => page.mouse.click(...at(x, y))
const wait = (ms) => page.waitForTimeout(ms)
const shot = (name) => page.locator('.device').screenshot({ path: path.join(out, `${name}.png`) })

await shot('1-photo')

// Tap to focus, drag up to brighten; shot while the finger is still down.
await page.mouse.move(...at(250, 330))
await page.mouse.down()
await wait(350)
await page.mouse.move(...at(250, 290), { steps: 6 })
await wait(200)
await shot('2-focus-exposure')
await page.mouse.up()
await wait(1700)

// Flash → status pill; tap the 3× stop.
await tap(38, 76)
await wait(100)
await tap(246, 594)
await wait(350)
await shot('3-flash-zoom')
await wait(1500)

// Long-press the zoom pill, then drag along the arc.
await page.mouse.move(...at(195, 594))
await page.mouse.down()
await wait(450)
await page.mouse.move(...at(160, 575), { steps: 8 })
await wait(300)
await shot('4-zoom-dial')
await page.mouse.up()
await tap(195, 300) // tap the scrim to close
await wait(300)

// Video mode, then record.
await tap(111, 662)
await wait(500)
await shot('5-video')
await tap(195, 740)
await wait(2300)
await shot('6-recording')
await tap(195, 740)
await wait(400)

// Photo: capture, then review.
await tap(279, 662)
await wait(500)
await tap(195, 740)
await wait(700)
await shot('7-captured')
await tap(56, 740)
await wait(400)
await shot('8-review')

await browser.close()
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`screenshots in ${path.relative(process.cwd(), out)}/`)
