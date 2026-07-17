import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { CHIMERA_CAMERA_JS_VERSION } from '../dist/index.js'

// The V0 contract (V0.md) requires package.json, CHIMERA_CAMERA_JS_VERSION, and
// the Swift module's nativeVersion to be bumped together, and the Swift
// module to implement every method the install check requires.

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const swift = readFileSync(new URL('../ios/ChimeraCameraModule.swift', import.meta.url), 'utf8')
const cameraView = readFileSync(new URL('../ios/ChimeraCameraView.m', import.meta.url), 'utf8')
const kotlin = readFileSync(
  new URL('../android/src/main/java/com/kealanau/chimeracamera/ChimeraCameraModule.kt', import.meta.url),
  'utf8',
)

const requiredNativeMethods = [
  'getChimeraCameraNativeVersion',
  'getPermissions',
  'requestCameraPermission',
  'requestMicrophonePermission',
  'getAvailableCameraDevices',
  'capturePhoto',
]

test('package.json version matches CHIMERA_CAMERA_JS_VERSION', () => {
  assert.equal(pkg.version, CHIMERA_CAMERA_JS_VERSION)
})

test('iOS nativeVersion matches CHIMERA_CAMERA_JS_VERSION', () => {
  assert.ok(
    swift.includes(`nativeVersion = "${CHIMERA_CAMERA_JS_VERSION}"`),
    `ios/ChimeraCameraModule.swift must declare nativeVersion = "${CHIMERA_CAMERA_JS_VERSION}"`,
  )
})

test('iOS module registers every method the install check requires', () => {
  for (const method of requiredNativeMethods) {
    assert.ok(swift.includes(`"${method}"`), `methodLookup is missing "${method}"`)
  }
})

test('Android nativeVersion matches CHIMERA_CAMERA_JS_VERSION', () => {
  assert.ok(
    kotlin.includes(`NATIVE_VERSION = "${CHIMERA_CAMERA_JS_VERSION}"`),
    `ChimeraCameraModule.kt must declare NATIVE_VERSION = "${CHIMERA_CAMERA_JS_VERSION}"`,
  )
})

test('Android module exposes every method the install check requires', () => {
  for (const method of requiredNativeMethods) {
    assert.ok(kotlin.includes(`fun ${method}(`), `ChimeraCameraModule.kt is missing fun ${method}(`)
  }
})

test('iOS camera-view has deterministic alpha capture guards', () => {
  assert.ok(cameraView.includes('@"capture/in-progress"'))
  assert.ok(cameraView.includes('params[@"maxDimension"]'))
  assert.ok(cameraView.includes('UIImageJPEGRepresentation(image, quality)'))
})

test('iOS camera-view reconciles active state after app foregrounding', () => {
  assert.ok(cameraView.includes('UIApplicationDidEnterBackgroundNotification'))
  assert.ok(cameraView.includes('UIApplicationWillEnterForegroundNotification'))
  assert.match(cameraView, /applicationWillEnterForeground:[\s\S]*?\[self syncSession\]/)
})
