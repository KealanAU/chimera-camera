import assert from 'node:assert/strict'
import test from 'node:test'

import { SAMPLE_PHOTO_FIXTURE } from '../dist/fixtures.js'
import { createMockCameraModule, defaultMockDevices } from '../dist/mock.js'

test('mock permissions default to authorized', async () => {
  const camera = createMockCameraModule()
  assert.deepEqual(await camera.getPermissions(), { camera: 'authorized', microphone: 'authorized' })
  assert.equal(await camera.requestCameraPermission(), 'authorized')
  assert.equal(await camera.requestMicrophonePermission(), 'authorized')
})

test('mock permissions honor overrides', async () => {
  const camera = createMockCameraModule({
    permissions: { camera: 'denied', microphone: 'not-determined' },
  })
  assert.deepEqual(await camera.getPermissions(), { camera: 'denied', microphone: 'not-determined' })
  assert.equal(await camera.requestCameraPermission(), 'denied')
})

test('mock exposes front and back devices by default', async () => {
  const camera = createMockCameraModule()
  const devices = await camera.getAvailableCameraDevices()
  assert.deepEqual(devices, defaultMockDevices())
  assert.equal((await camera.getDefaultCamera('back'))?.id, 'mock-back-camera')
  assert.equal((await camera.getDefaultCamera('front'))?.id, 'mock-front-camera')
  assert.equal(await camera.getDefaultCamera('external'), null)
})

test('mock device lists are defensive copies', async () => {
  const camera = createMockCameraModule()
  const first = await camera.getAvailableCameraDevices()
  first[0].id = 'mutated'
  const second = await camera.getAvailableCameraDevices()
  assert.equal(second[0].id, 'mock-back-camera')
})

test('mock capturePhoto returns the sample fixture', async () => {
  const camera = createMockCameraModule()
  const photo = await camera.capturePhoto()
  assert.deepEqual(photo, SAMPLE_PHOTO_FIXTURE)
})

test('mock capturePhoto honors a custom photo and delay', async () => {
  const photo = { path: 'mock://custom.jpg', width: 1, height: 1 }
  const camera = createMockCameraModule({ photo, captureDelayMs: 10 })
  const started = Date.now()
  assert.deepEqual(await camera.capturePhoto(), photo)
  assert.ok(Date.now() - started >= 10)
})

test('mock recording returns path and measured duration', async () => {
  const camera = createMockCameraModule({ recordingPath: 'mock://clip.mp4' })
  await camera.startRecording()
  const file = await camera.stopRecording()
  assert.equal(file.path, 'mock://clip.mp4')
  assert.ok(file.durationMs >= 1)
})

test('mock stopRecording without start uses configured duration', async () => {
  const camera = createMockCameraModule({ recordingDurationMs: 1234 })
  const file = await camera.stopRecording()
  assert.equal(file.durationMs, 1234)
})

test('mock control methods resolve', async () => {
  const camera = createMockCameraModule()
  await camera.focusAtPoint({ x: 0.5, y: 0.5 })
  await camera.setZoom(2)
  await camera.setTorch('on')
})
