import assert from 'node:assert/strict'
import test from 'node:test'

import { createNativeCameraAdapter } from '../dist/index.js'

test('resolves callback-style native results', async () => {
  const adapter = createNativeCameraAdapter({
    getPermissions: (callback) => callback({ camera: 'authorized', microphone: 'denied' }),
  })
  assert.deepEqual(await adapter.getPermissions(), { camera: 'authorized', microphone: 'denied' })
})

test('resolves promise-style native results', async () => {
  const adapter = createNativeCameraAdapter({
    requestCameraPermission: () => Promise.resolve('authorized'),
  })
  assert.equal(await adapter.requestCameraPermission(), 'authorized')
})

test('normalizes string native errors', async () => {
  const adapter = createNativeCameraAdapter({
    getAvailableCameraDevices: (callback) => callback({ error: 'boom' }),
  })
  await assert.rejects(adapter.getAvailableCameraDevices(), /boom/)
})

test('normalizes coded native errors, preferring message over code', async () => {
  const withMessage = createNativeCameraAdapter({
    capturePhoto: (_options, callback) => callback({ error: { code: 'capture/cancelled', message: 'Capture cancelled.' } }),
  })
  await assert.rejects(withMessage.capturePhoto(), /Capture cancelled\./)

  const codeOnly = createNativeCameraAdapter({
    capturePhoto: (_options, callback) => callback({ error: { code: 'camera/unavailable' } }),
  })
  await assert.rejects(codeOnly.capturePhoto(), /camera\/unavailable/)
})

test('soft-degrades when individual native methods are missing', async () => {
  const adapter = createNativeCameraAdapter({})
  assert.deepEqual(await adapter.getPermissions(), { camera: 'not-determined', microphone: 'not-determined' })
  assert.equal(await adapter.requestCameraPermission(), 'not-determined')
  assert.equal(await adapter.requestMicrophonePermission(), 'not-determined')
  assert.deepEqual(await adapter.getAvailableCameraDevices(), [])
  assert.equal(await adapter.getDefaultCamera('back'), null)
})

test('capturePhoto prefers the modern native method and applies defaults', async () => {
  let received = null
  let legacyCalled = false
  const adapter = createNativeCameraAdapter({
    capturePhoto: (options, callback) => {
      received = options
      callback({ path: 'file:///photo.jpg', width: 100, height: 200 })
    },
    capture: () => {
      legacyCalled = true
    },
  })
  const photo = await adapter.capturePhoto()
  assert.equal(photo.path, 'file:///photo.jpg')
  assert.equal(legacyCalled, false)
  assert.deepEqual(received, { flash: 'off', enableShutterSound: true, quality: 0.9, facing: 'back' })
})

test('capturePhoto passes quality and facing through, clamped to 0..1', async () => {
  let received = null
  const adapter = createNativeCameraAdapter({
    capturePhoto: (options, callback) => {
      received = options
      callback({ path: 'file:///photo.jpg' })
    },
  })
  await adapter.capturePhoto({ quality: 1.7, facing: 'front' })
  assert.equal(received.quality, 1)
  assert.equal(received.facing, 'front')
})

test('capturePhoto falls back to the legacy capture method', async () => {
  let received = null
  const adapter = createNativeCameraAdapter({
    capture: (options, callback) => {
      received = options
      callback({ base64: 'aGVsbG8=', width: 10, height: 20 })
    },
  })
  const photo = await adapter.capturePhoto({ flash: 'on', quality: 0.5, facing: 'front' })
  assert.deepEqual(photo, {
    path: 'memory://lynx-camera/capture.jpg',
    width: 10,
    height: 20,
    orientation: 'up',
    mime: 'image/jpeg',
    base64: 'aGVsbG8=',
  })
  assert.deepEqual(received, { quality: 0.5, facing: 'front', flash: 'on' })
})

test('legacy capture errors and empty payloads reject', async () => {
  const failing = createNativeCameraAdapter({
    capture: (_options, callback) => callback({ error: 'denied by user' }),
  })
  await assert.rejects(failing.capturePhoto(), /denied by user/)

  const empty = createNativeCameraAdapter({
    capture: (_options, callback) => callback({}),
  })
  await assert.rejects(empty.capturePhoto(), /no image data/)
})

test('capturePhoto rejects when no native capture method exists', async () => {
  const adapter = createNativeCameraAdapter({})
  await assert.rejects(adapter.capturePhoto(), /not available/)
})

test('v1 view-session methods reject as not available yet', async () => {
  const adapter = createNativeCameraAdapter({})
  await assert.rejects(adapter.startRecording(), /not available yet/)
  await assert.rejects(adapter.stopRecording(), /not available yet/)
  await assert.rejects(adapter.focusAtPoint({ x: 0, y: 0 }), /not available yet/)
  await assert.rejects(adapter.setZoom(2), /not available yet/)
  await assert.rejects(adapter.setTorch('on'), /not available yet/)
})
