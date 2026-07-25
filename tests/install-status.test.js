import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'

import {
  CHIMERA_CAMERA_JS_VERSION,
  assertCameraInstalled,
  assertCameraInstalledAsync,
  createCameraModule,
  getCameraInstallStatus,
  getCameraInstallStatusAsync,
} from '../dist/index.js'

// Same derivation as tests/version-sync.test.js: the install check is the source
// of truth for this list, so a change in src/native.ts can't leave it stale.
// An empty list here fails loudly rather than silently — completeNativeModule()
// would return {} and every "installed" expectation below would break.
const REQUIRED_METHODS = getCameraInstallStatus().missingMethods

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
  assert.throws(() => createCameraModule(), /missing required methods/)
})

test('createCameraModule rejects a registered module that cannot capture', () => {
  globalThis.NativeModules = { CameraModule: { getPermissions: (cb) => cb({}) } }
  assert.throws(() => createCameraModule(), /missing required methods/)
  assert.equal(createCameraModule({ optional: true }), null)
})

test('createCameraModule rejects a capturePhoto-only host, matching install status', () => {
  // capturePhoto present but the other required methods absent: createCameraModule
  // must agree with getCameraInstallStatus instead of handing back a module whose
  // getPermissions() throws at call time.
  globalThis.NativeModules = { CameraModule: { capturePhoto: (_o, cb) => cb({}) } }
  assert.equal(getCameraInstallStatus().ok, false)
  assert.throws(() => createCameraModule(), /missing required methods/)
  assert.equal(createCameraModule({ optional: true }), null)
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

test('async status reports a failed version probe instead of rejecting', async () => {
  globalThis.NativeModules = {
    CameraModule: completeNativeModule({
      getChimeraCameraNativeVersion: (callback) => callback({ error: 'jni boom' }),
    }),
  }
  const status = await getCameraInstallStatusAsync()
  assert.equal(status.ok, false)
  assert.equal(status.code, 'native-version-mismatch')
  assert.match(status.message, /jni boom/)
  assert.match(status.message, /docs\/ios-install\.md/)
  await assert.rejects(assertCameraInstalledAsync(), /docs\/ios-install\.md/)
})

test('assertCameraInstalled throws an actionable message', () => {
  assert.throws(() => assertCameraInstalled(), /docs\/ios-install\.md/)
  globalThis.NativeModules = { CameraModule: completeNativeModule() }
  assert.doesNotThrow(() => assertCameraInstalled())
})

test('createCameraModule throws loudly when nothing is available', () => {
  assert.throws(() => createCameraModule(), /not installed correctly/)
  assert.throws(() => createCameraModule(), /LynxExplorer \/ Lynx Go/)
  assert.throws(() => createCameraModule(), /mock: true/)
})

test('createCameraModule({ optional: true }) returns null instead of throwing', () => {
  assert.equal(createCameraModule({ optional: true }), null)
})

test('createCameraModule picks native or mock when available', async () => {
  const mock = createCameraModule({ mock: true })
  assert.equal((await mock.getPermissions()).camera, 'authorized')

  globalThis.NativeModules = {
    CameraModule: completeNativeModule({
      getPermissions: (callback) => callback({ camera: 'denied', microphone: 'denied' }),
    }),
  }
  const native = createCameraModule()
  assert.equal((await native.getPermissions()).camera, 'denied')
})
