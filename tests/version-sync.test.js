import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { CHIMERA_CAMERA_JS_VERSION, getCameraInstallStatus } from '../dist/index.js'

// The V0 contract (V0.md) requires package.json, CHIMERA_CAMERA_JS_VERSION, and
// the Swift module's nativeVersion to be bumped together, and the Swift
// module to implement every method the install check requires.

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const swift = readFileSync(new URL('../ios/ChimeraCameraModule.swift', import.meta.url), 'utf8')
const cameraView = readFileSync(new URL('../ios/ChimeraCameraView.m', import.meta.url), 'utf8')
const kotlin = readFileSync(
  new URL('../android/src/main/java/com/vyui/chimeracamera/ChimeraCameraModule.kt', import.meta.url),
  'utf8',
)
const androidCameraView = readFileSync(
  new URL('../android/src/main/java/com/vyui/chimeracamera/ChimeraCameraView.kt', import.meta.url),
  'utf8',
)

// Derived from the package's own install check rather than re-listed here: with
// no NativeModules under Node, every required method comes back as missing.
// Keeps this file from silently guarding a stale list if src/native.ts changes.
const requiredNativeMethods = getCameraInstallStatus().missingMethods

test('package.json version matches CHIMERA_CAMERA_JS_VERSION', () => {
  assert.equal(pkg.version, CHIMERA_CAMERA_JS_VERSION)
})

// Without this the two "registers every method" loops below would pass
// vacuously if the install check ever stopped reporting the list.
test('the install check reports the required native methods', () => {
  assert.ok(requiredNativeMethods.length > 0, 'expected getCameraInstallStatus() to list the required methods')
})

// Everything before the 1.0.0 launch is a patch bump — `pnpm run bump` is the
// only supported way to move the version. Delete this test when cutting 1.0.0.
test('version stays on the 0.0.x patch track until 1.0.0', () => {
  assert.match(
    pkg.version,
    /^0\.0\.\d+$/,
    `expected a 0.0.x patch version, got "${pkg.version}" — use \`pnpm run bump\``,
  )
})

test('the podspec ships and reads its version from package.json', () => {
  const podspec = readFileSync(new URL('../ChimeraCamera.podspec', import.meta.url), 'utf8')
  assert.ok(podspec.includes("package['version']"), 'podspec must derive s.version from package.json')
  assert.ok(pkg.files.includes('ChimeraCamera.podspec'), 'package.json files must ship the podspec')
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

// The one-call host registration helpers. Neither platform is compiled in CI, so
// this is a surface check: that both exist, register under the name JS resolves
// ("CameraModule"), and register globally rather than per-view. It cannot prove
// they run correctly on device.
test('both platforms expose a one-call registration helper', () => {
  const swiftHelper = readFileSync(new URL('../ios/ChimeraCamera.swift', import.meta.url), 'utf8')
  assert.match(swiftHelper, /static func register\(\)/, 'iOS helper must expose register()')
  assert.ok(
    swiftHelper.includes('LynxEnv.sharedInstance().config.register(ChimeraCameraModule.self)'),
    'iOS helper must register the module on the global LynxEnv config',
  )

  const kotlinHelper = readFileSync(
    new URL('../android/src/main/java/com/vyui/chimeracamera/ChimeraCamera.kt', import.meta.url),
    'utf8',
  )
  assert.match(kotlinHelper, /fun register\(\)/, 'Android helper must expose register()')
  assert.ok(
    kotlinHelper.includes('registerModule("CameraModule", ChimeraCameraModule::class.java)'),
    'Android helper must register the module as "CameraModule"',
  )
  assert.ok(
    kotlinHelper.includes('addBehaviors(ChimeraCameraBehaviors.behaviors())'),
    'Android helper must register the camera-view behaviors globally on LynxEnv',
  )
})

// `<camera-view>` is automatic on iOS only; if this macro is ever dropped the
// element silently stops resolving and the install docs become wrong.
test('iOS camera-view still self-registers', () => {
  assert.ok(
    cameraView.includes('LYNX_LAZY_REGISTER_UI("camera-view")'),
    'ChimeraCameraView.m must keep LYNX_LAZY_REGISTER_UI("camera-view")',
  )
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

// The 0.3 session controls/recording are UNVERIFIED native code, but both
// platforms must expose the same method, error-code, and event surface as the
// contract (docs/native-contract.md). This guards against the two drifting.
test('native camera-view exposes the 0.3 session controls and recording', () => {
  for (const method of ['setZoom', 'setTorch', 'setExposureBias', 'focusAtPoint', 'startRecording', 'stopRecording']) {
    assert.ok(cameraView.includes(`LYNX_UI_METHOD(${method})`), `iOS view is missing ${method}`)
    assert.ok(androidCameraView.includes(`fun ${method}(`), `Android view is missing ${method}`)
  }
  for (const code of ['camera/unsupported', 'recording/in-progress', 'recording/not-active', 'recording/failed']) {
    assert.ok(cameraView.includes(`"${code}"`), `iOS view is missing code ${code}`)
    assert.ok(androidCameraView.includes(`"${code}"`), `Android view is missing code ${code}`)
  }
  for (const event of ['recordingStarted', 'recordingFinished']) {
    assert.ok(cameraView.includes(`"${event}"`), `iOS view is missing event ${event}`)
    assert.ok(androidCameraView.includes(`"${event}"`), `Android view is missing event ${event}`)
  }
})
