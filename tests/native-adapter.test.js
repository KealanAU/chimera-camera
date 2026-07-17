import assert from 'node:assert/strict'
import test from 'node:test'

import { ChimeraCameraError, createNativeCameraAdapter } from '../dist/index.js'

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
  await assert.rejects(codeOnly.capturePhoto(), (error) => {
    assert.ok(error instanceof ChimeraCameraError)
    assert.equal(error.code, 'camera/unavailable')
    return true
  })
})

test('missing native methods reject with a stable coded error', async () => {
  const adapter = createNativeCameraAdapter({})
  await assert.rejects(adapter.getPermissions(), (error) => {
    assert.ok(error instanceof ChimeraCameraError)
    assert.equal(error.code, 'camera/method-unavailable')
    return true
  })
  await assert.rejects(adapter.requestCameraPermission(), /requestCameraPermission/)
  await assert.rejects(adapter.requestMicrophonePermission(), /requestMicrophonePermission/)
  await assert.rejects(adapter.getAvailableCameraDevices(), /getAvailableCameraDevices/)
  await assert.rejects(adapter.getDefaultCamera('back'), /getAvailableCameraDevices/)
})

test('getDefaultCamera prefers the physical wide-angle device', async () => {
  const adapter = createNativeCameraAdapter({
    getAvailableCameraDevices: (callback) => callback([
      { id: 'triple', localizedName: 'Back Triple', position: 'back', deviceType: 'triple' },
      { id: 'wide', localizedName: 'Back Wide', position: 'back', deviceType: 'wide-angle' },
    ]),
  })
  assert.equal((await adapter.getDefaultCamera('back')).id, 'wide')
})

test('capturePhoto prefers the modern native method and applies defaults', async () => {
  let received = null
  const adapter = createNativeCameraAdapter({
    capturePhoto: (options, callback) => {
      received = options
      callback({ path: 'file:///photo.jpg', width: 100, height: 200 })
    },
  })
  const photo = await adapter.capturePhoto()
  assert.equal(photo.path, 'file:///photo.jpg')
  assert.deepEqual(received, {
    flash: 'off',
    enableShutterSound: true,
    quality: 0.9,
    facing: 'back',
    includeBase64: false,
  })
})

test('capturePhoto passes quality and facing through, clamped to 0..1', async () => {
  let received = null
  const adapter = createNativeCameraAdapter({
    capturePhoto: (options, callback) => {
      received = options
      callback({ path: 'file:///photo.jpg' })
    },
  })
  await adapter.capturePhoto({ quality: 1.7, facing: 'front', includeBase64: true, maxDimension: 1600 })
  assert.equal(received.quality, 1)
  assert.equal(received.facing, 'front')
  assert.equal(received.includeBase64, true)
  assert.equal(received.maxDimension, 1600)
})

test('pickPhoto passes options through with defaults', async () => {
  let received = null
  const adapter = createNativeCameraAdapter({
    capturePhoto: (_options, callback) => callback({ path: 'file:///photo.jpg' }),
    pickPhoto: (options, callback) => {
      received = options
      callback({ path: 'file:///picked.jpg' })
    },
  })
  await adapter.pickPhoto()
  assert.deepEqual(received, { quality: 0.9, includeBase64: false })
  await adapter.pickPhoto({ quality: 0.5, includeBase64: true, maxDimension: 800 })
  assert.deepEqual(received, { quality: 0.5, includeBase64: true, maxDimension: 800 })
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
