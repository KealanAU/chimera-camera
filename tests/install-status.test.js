import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'

import {
  CHIMERA_CAMERA_JS_VERSION,
  assertCameraInstalled,
  createCameraAdapter,
  getCameraInstallStatus,
  getCameraInstallStatusAsync,
} from '../dist/index.js'

const REQUIRED_METHODS = [
  'getChimeraCameraNativeVersion',
  'getPermissions',
  'requestCameraPermission',
  'requestMicrophonePermission',
  'getAvailableCameraDevices',
  'capturePhoto',
]

function completeNativeModule(overrides = {}) {
  const module = {}
  for (const method of REQUIRED_METHODS) {
    module[method] = (callback) => callback({})
  }
  module.getChimeraCameraNativeVersion = (callback) => callback(CHIMERA_CAMERA_JS_VERSION)
  return { ...module, ...overrides }
}

afterEach(() => {
  delete globalThis.NativeModules
})

test('reports native-modules-missing outside a Lynx runtime', () => {
  const status = getCameraInstallStatus()
  assert.equal(status.ok, false)
  assert.equal(status.code, 'native-modules-missing')
  assert.deepEqual(status.missingMethods, REQUIRED_METHODS)
})

test('reports native-module-missing when CameraModule is not registered', () => {
  globalThis.NativeModules = {}
  const status = getCameraInstallStatus()
  assert.equal(status.ok, false)
  assert.equal(status.code, 'native-module-missing')
  assert.match(status.message, /NativeModules\.CameraModule is not registered/)
})

test('reports which required methods are missing', () => {
  globalThis.NativeModules = { CameraModule: { getPermissions: () => {} } }
  const status = getCameraInstallStatus()
  assert.equal(status.ok, false)
  assert.equal(status.code, 'native-methods-missing')
  assert.ok(!status.missingMethods.includes('getPermissions'))
  assert.ok(status.missingMethods.includes('capturePhoto'))
})

test('reports a capture()-only host as stale and incomplete', () => {
  globalThis.NativeModules = { CameraModule: { capture: (_o, cb) => cb({}) } }
  const status = getCameraInstallStatus()
  assert.equal(status.ok, false)
  assert.equal(status.code, 'native-methods-missing')
  assert.ok(status.missingMethods.includes('capturePhoto'))
  assert.throws(() => createCameraAdapter(), /missing required methods/)
})

test('createCameraAdapter rejects a registered module that cannot capture', () => {
  globalThis.NativeModules = { CameraModule: { getPermissions: (cb) => cb({}) } }
  assert.throws(() => createCameraAdapter(), /missing required methods/)
  assert.equal(createCameraAdapter({ optional: true }), null)
})

test('reports installed for a complete native module', () => {
  globalThis.NativeModules = { CameraModule: completeNativeModule() }
  const status = getCameraInstallStatus()
  assert.equal(status.ok, true)
  assert.equal(status.code, 'installed')
  assert.deepEqual(status.missingMethods, [])
})

test('reports mock when the mock adapter is requested', () => {
  const status = getCameraInstallStatus({ mock: true })
  assert.equal(status.ok, true)
  assert.equal(status.code, 'mock')
})

test('respects a custom native module name', () => {
  globalThis.NativeModules = { MyCamera: completeNativeModule() }
  assert.equal(getCameraInstallStatus({ nativeModuleName: 'MyCamera' }).ok, true)
  assert.equal(getCameraInstallStatus().code, 'native-module-missing')
})

test('async status verifies the native version', async () => {
  globalThis.NativeModules = { CameraModule: completeNativeModule() }
  const status = await getCameraInstallStatusAsync()
  assert.equal(status.ok, true)
  assert.equal(status.nativeVersion, CHIMERA_CAMERA_JS_VERSION)
})

test('async status flags a native/JS version mismatch', async () => {
  globalThis.NativeModules = {
    CameraModule: completeNativeModule({
      getChimeraCameraNativeVersion: (callback) => callback('9.9.9'),
    }),
  }
  const status = await getCameraInstallStatusAsync()
  assert.equal(status.ok, false)
  assert.equal(status.code, 'native-version-mismatch')
  assert.equal(status.nativeVersion, '9.9.9')
})

test('assertCameraInstalled throws an actionable message', () => {
  assert.throws(() => assertCameraInstalled(), /docs\/ios-install\.md/)
  globalThis.NativeModules = { CameraModule: completeNativeModule() }
  assert.doesNotThrow(() => assertCameraInstalled())
})

test('createCameraAdapter throws loudly when nothing is available', () => {
  assert.throws(() => createCameraAdapter(), /not installed correctly/)
  assert.throws(() => createCameraAdapter(), /LynxExplorer \/ Lynx Go/)
  assert.throws(() => createCameraAdapter(), /mock: true/)
})

test('createCameraAdapter({ optional: true }) returns null instead of throwing', () => {
  assert.equal(createCameraAdapter({ optional: true }), null)
})

test('createCameraAdapter picks native or mock when available', async () => {
  const mock = createCameraAdapter({ mock: true })
  assert.equal((await mock.getPermissions()).camera, 'authorized')

  globalThis.NativeModules = {
    CameraModule: completeNativeModule({
      getPermissions: (callback) => callback({ camera: 'denied', microphone: 'denied' }),
    }),
  }
  const native = createCameraAdapter()
  assert.equal((await native.getPermissions()).camera, 'denied')
})
