<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./images/banner-dark.webp" />
  <source media="(prefers-color-scheme: light)" srcset="./images/banner-light.webp" />
  <img alt="Chimera Camera" src="./images/banner-light.webp" />
</picture>

<br />
<br />

<div>
  <img align="right" width="26%" src="./images/logo.webp">
</div>

> [!WARNING]
> **Pre-alpha.** Published as `0.0.x` while the surface settles. iOS photo
> capture is proven on a physical iPhone; Android is written but has never been
> compiled or run; the 0.3 recording and session controls are written but
> unverified on both platforms. Expect breaking changes on any release, and read
> the [platform support](#platform-support) table before depending on this.
> `1.0.0` will be the first real launch.

Chimera Camera is a native camera library for [Lynx](https://lynxjs.org),
inspired by [`react-native-vision-camera`](https://github.com/mrousavy/react-native-vision-camera).
It is built for Lynx from day one rather than as a React Native compatibility
layer, so the public API is plain TypeScript that any JS framework can drive.

- 📸 Photo capture — embedded preview or the system camera
- 🎥 Video recording with optional audio *(written, unverified)*
- 🔦 Zoom, torch, and tap-to-focus *(written, unverified)*
- 🔄 Front/back switching, `resizeMode`, and live `active` toggling
- 🖼️ Photo-library picking
- 🔐 Camera and microphone permission checks and requests
- ⚛️ Framework-neutral — React, Vue, Svelte, or plain TypeScript, no wrapper
- 🧪 A mock adapter, so app flows can be built before any native wiring exists
- 🩺 Install diagnostics that say exactly which native step is missing
- 📁 File paths, not multi-megabyte base64 payloads, across the bridge

## Installation

### 1. Install the package

```sh
pnpm add @vyui/chimera-camera
```

That is all JavaScript needs. Types, the mock adapter, and the install
diagnostics work immediately, so you can build your whole capture flow before
touching a native host:

```ts
import { createCameraModule } from '@vyui/chimera-camera'

const camera = createCameraModule({ mock: true })
```

For a real camera, your Lynx host app also has to compile the shipped native
sources and register them. That is steps 2–4.

### 2. iOS

Add the pod to your `Podfile`, then run `pod install`:

```ruby
target 'YourApp' do
  # Required so ChimeraCameraModule.swift can `import Lynx`.
  use_modular_headers!

  pod 'Lynx', '3.9.0', :subspecs => ['Framework']   # your own Lynx pin
  pod 'ChimeraCamera', :path => '../node_modules/@vyui/chimera-camera'
end
```

The path is relative to your `Podfile` — adjust it for your layout. The podspec
leaves its `Lynx` dependency unpinned so it resolves to whatever you pin above,
and it adds `-ObjC` to your linker flags so `<camera-view>` survives a
static-library build.

Add the usage strings to `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>This app needs camera access to capture photos.</string>
<key>NSMicrophoneUsageDescription</key>
<string>This app needs microphone access to record videos.</string>
<!-- Only if you call saveToLibrary(). -->
<key>NSPhotoLibraryAddUsageDescription</key>
<string>This app saves photos and videos you capture to your library.</string>
```

Then register the module in your Lynx bootstrap:

```swift
let config = LynxConfig(provider: templateProvider)
config.register(ChimeraCameraModule.self)
```

`<camera-view>` self-registers via `LYNX_LAZY_REGISTER_UI` — no bootstrap call
needed for the element itself.

Not using CocoaPods? Add the three files in
`node_modules/@vyui/chimera-camera/ios` to your app target directly. That is
all the pod does.

### 3. Android

The shipped `android/` folder is a complete `com.android.library` module.
In `settings.gradle`:

```gradle
include ':chimera-camera'
project(':chimera-camera').projectDir =
    new File(rootProject.projectDir, '../node_modules/@vyui/chimera-camera/android')
```

In your app module's `build.gradle`:

```gradle
dependencies {
    implementation project(':chimera-camera')
}
```

Nothing to add to your `AndroidManifest.xml` — the manifest merger folds in the
`CAMERA`/`RECORD_AUDIO` permissions, the proxy activity, and the FileProvider.
`lynx` is `compileOnly` in the module, so it links against your host's version.

Then register both surfaces in your Lynx host:

```kotlin
LynxEnv.inst().registerModule("CameraModule", ChimeraCameraModule::class.java)

val builder = LynxViewBuilder()
ChimeraCameraBehaviors.behaviors().forEach { builder.addBehavior(it) }
```

### 4. Verify

Lynx has no autolinking, so those registration calls in steps 2 and 3 are the
one thing that cannot be automated away. Confirm they took:

```ts
import { getCameraInstallStatusAsync, assertCameraInstalledAsync } from '@vyui/chimera-camera'

console.log(await getCameraInstallStatusAsync())
await assertCameraInstalledAsync()
```

If native setup is incomplete, the thrown error names the missing piece —
`NativeModules`, `CameraModule`, a required native method, or a native/JS
version mismatch.

Full details, including troubleshooting:
[docs/ios-install.md](docs/ios-install.md) ·
[docs/android-install.md](docs/android-install.md). `example/host-ios` is a
working Lynx iOS host you can copy from.

## Example

Render the element, then drive it through a handle. No framework wrapper is
involved — this is plain TypeScript against the DOM-ish Lynx element:

```tsx
<camera-view id="camera" active={true} facing="back" bindready={onReady} />
```

```ts
import { createCameraViewHandle } from '@vyui/chimera-camera'

const camera = createCameraViewHandle('#camera')

const photo = await camera.capturePhoto({ flash: 'auto' })
console.log(photo.path) // display with `file://${photo.path}`

await camera.setZoom(2)
await camera.startRecording({ enableAudio: true })
const video = await camera.stopRecording()
```

Runnable demos, same core driven by two different frameworks:
[`example/react`](example/react) and [`example/vue`](example/vue).

## Platform support

| Platform | Status | Verified |
| -------- | ------ | -------- |
| iOS | Alpha | Device-proven on a physical iPhone: preview, photo capture, front/back switch, close/reopen. Recording and session controls are written but unverified. |
| Android | Experimental | Written to the same contract as device-proven iOS and **believed to work — but never compiled or run** on any device or emulator. See [docs/android-testing.md](docs/android-testing.md). |
| Mock | Stable | Framework-neutral JS double for all hosts. |

Android ships as experimental on purpose: the Kotlin/CameraX surface mirrors
[docs/native-contract.md](docs/native-contract.md) and the device-proven iOS
behavior, so we expect it to work — but that expectation is unverified. Do not
treat Android as supported until it has passed device acceptance.

## How it fits together

TypeScript is the developer-facing API, Swift/AVFoundation powers iOS,
Kotlin/CameraX powers Android, and Lynx's native view and module APIs bridge
between them. React Native, Nitro Modules, and JSI are not dependencies.

**Two surfaces, and every operation belongs to exactly one:**

- **Module** (`createCameraModule()` → `CameraModuleClient`) — stateless,
  one-shot operations that need no rendered view: permissions, device discovery,
  system-camera capture, photo-library picking.
- **Session** (`createCameraViewHandle()` → `CameraViewHandle`) — controls tied
  to a live `<camera-view>`: view capture, recording, focus, zoom, torch, `ping()`.

**Captures return a native file path, not base64.** Display one with
`file://${photo.path}`, upload by streaming the file, and treat the temp file as
yours to persist or delete. base64 is an opt-in, `maxDimension`-bounded fallback
for mock/web previews and JSON transports.

## Links

- [Install: iOS](docs/ios-install.md) · [Android](docs/android-install.md)
- [Native contract](docs/native-contract.md) — props, methods, events, error codes
- [Framework integration](docs/framework-integration.md) — the element and SelectorQuery contract
- [Output transport](docs/output-transport.md) — file paths, lifetime, and cleanup ownership
- [Mock testing](docs/mock-testing.md) · [LynxExplorer](docs/lynx-explorer.md)
- [Publishing](docs/publishing.md) · [Changelog](CHANGELOG.md)
- [Roadmap](ROADMAP.md) — the single source of truth for status, gates, and known debt

## Credits

Thanks to [Marc Rousavy](https://github.com/mrousavy) and the VisionCamera
contributors for building and maintaining the camera library this project draws
on. VisionCamera is MIT licensed, and Chimera Camera preserves the required
copyright and license notices for anything reused — see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This is **not** the official VisionCamera package and is not affiliated with it.
Chimera Camera is MIT licensed; see [LICENSE](LICENSE).
