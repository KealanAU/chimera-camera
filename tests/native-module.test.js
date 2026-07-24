import assert from 'node:assert/strict'
import test from 'node:test'

import { ChimeraCameraError, createNativeCameraModule } from '../dist/index.js'

test('resolves callback-style native results', async () => {
  const module = createNativeCameraModule({
    getPermissions: (callback) => callback({ camera: 'authorized', microphone: 'denied' }),
  })
  assert.deepEqual(await module.getPermissions(), { camera: 'authorized', microphone: 'denied' })
})

test('resolves promise-style native results', async () => {
  const module = createNativeCameraModule({
    requestCameraPermission: () => Promise.resolve('authorized'),
  })
  assert.equal(await module.requestCameraPermission(), 'authorized')
})

test('normalizes string native errors', async () => {
  const module = createNativeCameraModule({
    getAvailableCameraDevices: (callback) => callback({ error: 'boom' }),
  })
  await assert.rejects(module.getAvailableCameraDevices(), /boom/)
})

test('normalizes coded native errors, preferring message over code', async () => {
  const withMessage = createNativeCameraModule({
    capturePhoto: (_options, callback) => callback({ error: { code: 'capture/cancelled', message: 'Capture cancelled.' } }),
  })
  await assert.rejects(withMessage.capturePhoto(), /Capture cancelled\./)

  const codeOnly = createNativeCameraModule({
    capturePhoto: (_options, callback) => callback({ error: { code: 'camera/unavailable' } }),
  })
  await assert.rejects(codeOnly.capturePhoto(), (error) => {
    assert.ok(error instanceof ChimeraCameraError)
    assert.equal(error.code, 'camera/unavailable')
    return true
  })
})

test('missing native methods reject with a stable coded error', async () => {
  const module = createNativeCameraModule({})
  await assert.rejects(module.getPermissions(), (error) => {
    assert.ok(error instanceof ChimeraCameraError)
    assert.equal(error.code, 'camera/method-unavailable')
    return true
  })
  await assert.rejects(module.requestCameraPermission(), /requestCameraPermission/)
  await assert.rejects(module.requestMicrophonePermission(), /requestMicrophonePermission/)
  await assert.rejects(module.getAvailableCameraDevices(), /getAvailableCameraDevices/)
  await assert.rejects(module.getDefaultCamera('back'), /getAvailableCameraDevices/)
})

test('getDefaultCamera prefers the physical wide-angle device', async () => {
  const module = createNativeCameraModule({
    getAvailableCameraDevices: (callback) => callback([
      { id: 'triple', localizedName: 'Back Triple', position: 'back', deviceType: 'triple' },
      { id: 'wide', localizedName: 'Back Wide', position: 'back', deviceType: 'wide-angle' },
    ]),
  })
  assert.equal((await module.getDefaultCamera('back')).id, 'wide')
})

test('capturePhoto prefers the modern native method and applies defaults', async () => {
  let received = null
  const module = createNativeCameraModule({
    capturePhoto: (options, callback) => {
      received = options
      callback({ path: 'file:///photo.jpg', width: 100, height: 200 })
    },
  })
  const photo = await module.capturePhoto()
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
  const module = createNativeCameraModule({
    capturePhoto: (options, callback) => {
      received = options
      callback({ path: 'file:///photo.jpg' })
    },
  })
  await module.capturePhoto({ quality: 1.7, facing: 'front', includeBase64: true, maxDimension: 1600 })
  assert.equal(received.quality, 1)
  assert.equal(received.facing, 'front')
  assert.equal(received.includeBase64, true)
  assert.equal(received.maxDimension, 1600)
})

test('pickPhoto passes options through with defaults', async () => {
  let received = null
  const module = createNativeCameraModule({
    capturePhoto: (_options, callback) => callback({ path: 'file:///photo.jpg' }),
    pickPhoto: (options, callback) => {
      received = options
      callback({ path: 'file:///picked.jpg' })
    },
  })
  await module.pickPhoto()
  assert.deepEqual(received, { quality: 0.9, includeBase64: false })
  await module.pickPhoto({ quality: 0.5, includeBase64: true, maxDimension: 800 })
  assert.deepEqual(received, { quality: 0.5, includeBase64: true, maxDimension: 800 })
})

test('capturePhoto rejects when no native capture method exists', async () => {
  const module = createNativeCameraModule({})
  await assert.rejects(module.capturePhoto(), /not available/)
})

test('saveToLibrary forwards only the file path and resolves', async () => {
  let received = null
  const module = createNativeCameraModule({
    capturePhoto: (_options, callback) => callback({ path: 'file:///photo.jpg' }),
    saveToLibrary: (options, callback) => {
      received = options
      callback({})
    },
  })
  await module.saveToLibrary({ path: '/tmp/x.jpg', width: 16, height: 16, mime: 'image/jpeg' })
  assert.deepEqual(received, { path: '/tmp/x.jpg' })
})

test('saveToLibrary rejects the native library error code', async () => {
  const module = createNativeCameraModule({
    capturePhoto: (_options, callback) => callback({ path: 'file:///photo.jpg' }),
    saveToLibrary: (_options, callback) => callback({ error: { code: 'library/permission-denied', message: 'nope' } }),
  })
  await assert.rejects(module.saveToLibrary({ path: '/tmp/x.jpg' }), (error) => {
    assert.ok(error instanceof ChimeraCameraError)
    assert.equal(error.code, 'library/permission-denied')
    return true
  })
})

test('saveToLibrary rejects when the native method is absent', async () => {
  const module = createNativeCameraModule({})
  await assert.rejects(module.saveToLibrary({ path: '/tmp/x.jpg' }), (error) => {
    assert.ok(error instanceof ChimeraCameraError)
    assert.equal(error.code, 'camera/method-unavailable')
    return true
  })
})
