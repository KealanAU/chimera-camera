import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'

import { ChimeraCameraError, createCameraViewHandle } from '../dist/index.js'
import { createMockCameraModule } from '../dist/mock.js'

// Executable mirror of docs/native-contract.md. Every framework binding drives
// the same imperative surface (createCameraViewHandle over Lynx SelectorQuery,
// or the mock), so pinning that surface here proves binding-neutral behavior
// without a device or a per-framework runtime. If the doc's params, result
// shapes, or error codes change, this fails.

/** Fake Lynx SelectorQuery bridge; `respond(call)` must call success/fail. */
function installFakeLynx(respond) {
  const calls = []
  globalThis.lynx = {
    createSelectorQuery() {
      return {
        select(selector) {
          return {
            invoke(options) {
              calls.push({ selector, ...options })
              return { select() {}, exec: () => respond(calls[calls.length - 1]) }
            },
          }
        },
      }
    },
  }
  return calls
}

afterEach(() => {
  delete globalThis.lynx
})

// method → [args to the handle method, params the bridge must receive].
const METHOD_PARAMS = [
  ['ping', [], {}],
  ['setZoom', [3], { value: 3 }],
  ['setTorch', ['on'], { mode: 'on' }],
  ['setExposureBias', [1.5], { bias: 1.5 }],
  ['focusAtPoint', [{ x: 0.25, y: 0.75 }], { x: 0.25, y: 0.75 }],
  ['capturePhoto', [{ quality: 0.5, includeBase64: true, maxDimension: 1024 }], { quality: 0.5, includeBase64: true, maxDimension: 1024 }],
  ['startRecording', [{ enableAudio: true, maxDurationMs: 5000, maxFileSizeBytes: 4_000_000 }], { enableAudio: true, maxDurationMs: 5000, maxFileSizeBytes: 4_000_000 }],
  ['stopRecording', [], {}],
]

for (const [method, args, params] of METHOD_PARAMS) {
  test(`camera-view ${method}() forwards the documented params`, async () => {
    const calls = installFakeLynx((call) => call.success(method === 'ping' ? { ok: true } : {}))
    await createCameraViewHandle('#camera')[method](...args)
    assert.equal(calls.at(-1).method, method)
    assert.deepEqual(calls.at(-1).params, params)
  })
}

test('capturePhoto returns the PhotoFile shape unchanged', async () => {
  const photo = { path: '/tmp/x.jpg', width: 16, height: 16, orientation: 'up', mime: 'image/jpeg' }
  installFakeLynx((call) => call.success(photo))
  assert.deepEqual(await createCameraViewHandle('#camera').capturePhoto(), photo)
})

test('stopRecording returns the VideoFile shape unchanged', async () => {
  const video = { path: '/tmp/x.mov', durationMs: 1200, sizeBytes: 4_000_000 }
  installFakeLynx((call) => call.success(video))
  assert.deepEqual(await createCameraViewHandle('#camera').stopRecording(), video)
})

// Every documented view-surface error code must reach JS as a ChimeraCameraError
// carrying that exact code (docs/native-contract.md "Error codes").
const VIEW_ERROR_CODES = [
  'capture/not-active',
  'capture/in-progress',
  'capture/failed',
  'capture/write-failed',
  'camera/unavailable',
  'camera/permission-denied',
  'camera/unsupported',
  'camera/native-error',
  'recording/in-progress',
  'recording/not-active',
  'recording/failed',
]

for (const code of VIEW_ERROR_CODES) {
  test(`view failure "${code}" surfaces as ChimeraCameraError.code`, async () => {
    installFakeLynx((call) => call.fail({ code, message: `${code} happened` }))
    await assert.rejects(createCameraViewHandle('#camera').capturePhoto(), (error) => {
      assert.ok(error instanceof ChimeraCameraError)
      assert.equal(error.code, code)
      return true
    })
  })
}

// The mock is a binding too: it must reject the shared recording error codes the
// native surface rejects, so app error handling is exercised without a device.
test('mock rejects audio recording without microphone permission, matching native', async () => {
  const camera = createMockCameraModule({ permissions: { camera: 'authorized', microphone: 'denied' } })
  await assert.rejects(camera.startRecording({ enableAudio: true }), (error) => {
    assert.ok(error instanceof ChimeraCameraError)
    assert.equal(error.code, 'camera/permission-denied')
    return true
  })
})

test('mock rejects a second startRecording with recording/in-progress, matching native', async () => {
  const camera = createMockCameraModule()
  await camera.startRecording()
  await assert.rejects(camera.startRecording(), (error) => {
    assert.ok(error instanceof ChimeraCameraError)
    assert.equal(error.code, 'recording/in-progress')
    return true
  })
})
