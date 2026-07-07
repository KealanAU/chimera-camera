import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { LYNX_CAMERA_JS_VERSION } from '../dist/index.js'

// The V0 contract (V0.md) requires package.json, LYNX_CAMERA_JS_VERSION, and
// the Swift module's nativeVersion to be bumped together, and the Swift
// module to implement every method the install check requires.

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const swift = readFileSync(new URL('../ios/LynxCameraModule.swift', import.meta.url), 'utf8')

test('package.json version matches LYNX_CAMERA_JS_VERSION', () => {
  assert.equal(pkg.version, LYNX_CAMERA_JS_VERSION)
})

test('iOS nativeVersion matches LYNX_CAMERA_JS_VERSION', () => {
  assert.ok(
    swift.includes(`nativeVersion = "${LYNX_CAMERA_JS_VERSION}"`),
    `ios/LynxCameraModule.swift must declare nativeVersion = "${LYNX_CAMERA_JS_VERSION}"`,
  )
})

test('iOS module registers every method the install check requires', () => {
  const required = [
    'getLynxCameraNativeVersion',
    'getPermissions',
    'requestCameraPermission',
    'requestMicrophonePermission',
    'getAvailableCameraDevices',
    'capturePhoto',
  ]
  for (const method of required) {
    assert.ok(swift.includes(`"${method}"`), `methodLookup is missing "${method}"`)
  }
})
