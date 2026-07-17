import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'

import {
  CAMERA_VIEW_TAG,
  ChimeraCameraError,
  createCameraViewHandle,
  invokeCameraViewMethod,
  isCameraViewBridgeAvailable,
} from '../dist/index.js'

/**
 * Fake of the Lynx SelectorQuery bridge. `respond` receives the invoke
 * options and must call success/fail; calls are recorded for assertions.
 */
function installFakeLynx(respond) {
  const calls = []
  globalThis.lynx = {
    createSelectorQuery() {
      return {
        select(selector) {
          return {
            invoke(options) {
              calls.push({ selector, ...options })
              return {
                select() {
                  throw new Error('not used in tests')
                },
                exec() {
                  respond(calls[calls.length - 1])
                },
              }
            },
          }
        },
        exec() {},
      }
    },
  }
  return calls
}

afterEach(() => {
  delete globalThis.lynx
})

test('camera-view tag name is stable', () => {
  assert.equal(CAMERA_VIEW_TAG, 'camera-view')
})

test('bridge availability reflects the lynx global', () => {
  assert.equal(isCameraViewBridgeAvailable(), false)
  installFakeLynx(() => {})
  assert.equal(isCameraViewBridgeAvailable(), true)
})

test('invoke rejects with an actionable error outside Lynx', async () => {
  await assert.rejects(invokeCameraViewMethod('#camera', 'ping'), /createSelectorQuery is not available/)
})

test('invoke resolves the success payload and passes method, params, selector', async () => {
  const calls = installFakeLynx((call) => call.success({ ok: true }))
  const result = await invokeCameraViewMethod('#camera', 'ping')
  assert.deepEqual(result, { ok: true })
  assert.equal(calls[0].selector, '#camera')
  assert.equal(calls[0].method, 'ping')
  assert.deepEqual(calls[0].params, {})
})

test('invoke normalizes fail payloads into Errors', async () => {
  installFakeLynx((call) => call.fail({ code: 4, data: 'method not found' }))
  await assert.rejects(invokeCameraViewMethod('#camera', 'capturePhoto'), /method not found/)

  installFakeLynx((call) => call.fail(undefined))
  await assert.rejects(invokeCameraViewMethod('#camera', 'ping'), /ping\(\) on "#camera" failed/)
})

test('invoke preserves native error codes as ChimeraCameraError, matching the module surface', async () => {
  installFakeLynx((call) => call.fail({ code: 'capture/not-active', message: 'camera-view is not active.' }))
  await assert.rejects(invokeCameraViewMethod('#camera', 'capturePhoto'), (error) => {
    assert.ok(error instanceof ChimeraCameraError)
    assert.equal(error.code, 'capture/not-active')
    return true
  })

  // Numeric Lynx transport codes are not contract codes; fall back to the shared generic.
  installFakeLynx((call) => call.fail({ code: 4, data: 'method not found' }))
  await assert.rejects(invokeCameraViewMethod('#camera', 'ping'), (error) => {
    assert.ok(error instanceof ChimeraCameraError)
    assert.equal(error.code, 'camera/native-error')
    return true
  })
})

test('handle.ping() round-trips through the fake bridge', async () => {
  installFakeLynx((call) => (call.method === 'ping' ? call.success({ ok: true }) : call.fail({ code: 4 })))
  const camera = createCameraViewHandle('#camera')
  assert.deepEqual(await camera.ping(), { ok: true })
})

test('handle methods send the expected params', async () => {
  const calls = installFakeLynx((call) => call.success({}))
  const camera = createCameraViewHandle('#camera')

  await camera.setZoom(2.5)
  await camera.setTorch('on')
  await camera.focusAtPoint({ x: 0.25, y: 0.75 })
  await camera.capturePhoto({ flash: 'auto' })

  assert.deepEqual(calls.map((call) => [call.method, call.params]), [
    ['setZoom', { value: 2.5 }],
    ['setTorch', { mode: 'on' }],
    ['focusAtPoint', { x: 0.25, y: 0.75 }],
    ['capturePhoto', { flash: 'auto' }],
  ])
})
