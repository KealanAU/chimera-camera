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
> **Pre-alpha.** The package publishes as `0.0.x` while the surface settles. iOS
> photo capture is proven on a physical iPhone, Android is written but has never
> been compiled or run, and the recording and session controls are written but
> unverified on both platforms. Any release can break you, so read the
> [platform support](#platform-support) table before depending on this. The first
> real launch will be `1.0.0`.

Chimera Camera is a native camera library for [Lynx](https://lynxjs.org), built
off the amazing work in [`react-native-vision-camera`](https://github.com/mrousavy/react-native-vision-camera).
Its architecture, its native camera handling, and a good deal of its
implementation come from that project, rebuilt against Lynx's native APIs. It
targets Lynx directly instead of wrapping React Native, which is why the public
API is plain TypeScript that any JS framework can drive.

- 📸 Photo capture, through an embedded preview or the system camera
- 🎥 Video recording with optional audio *(written, unverified)*
- 🔦 Zoom, torch, and tap-to-focus *(written, unverified)*
- 🔄 Front/back switching, `resizeMode`, and live `active` toggling
- 🖼️ Photo-library picking
- 🔐 Camera and microphone permission checks and requests
- ⚛️ Framework-neutral, so React, Vue, Svelte, or plain TypeScript all work unwrapped
- 🧪 A mock adapter, so app flows can be built before any native wiring exists
- 🩺 Install diagnostics that name the native step you are missing
- 📁 File paths across the bridge rather than multi-megabyte base64 payloads

## Installation

### 1. Install the package

```sh
pnpm add @vyui/chimera-camera
```

JavaScript needs nothing further. The types, the mock adapter, and the install
diagnostics all work immediately, so you can build a complete capture flow
before touching a native host:

```ts
import { createCameraModule } from '@vyui/chimera-camera'

const camera = createCameraModule({ mock: true })
```

Getting a real camera means your Lynx host app also compiles the shipped native
sources and registers them, which is what steps 2 through 4 cover.

### 2. iOS

Add the pod to your `Podfile` and run `pod install`:

```ruby
target 'YourApp' do
  # Required so ChimeraCameraModule.swift can `import Lynx`.
  use_modular_headers!

  pod 'Lynx', '3.9.0', :subspecs => ['Framework']   # your own Lynx pin
  pod 'ChimeraCamera', :path => '../node_modules/@vyui/chimera-camera'
end
```

The path resolves relative to your `Podfile`, so adjust it for your own layout.
The podspec leaves its `Lynx` dependency unpinned so that it resolves to whatever
version you pin above, and it adds `-ObjC` to your linker flags so that
`<camera-view>` survives a static-library build.

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

The element registers itself through `LYNX_LAZY_REGISTER_UI`, so `<camera-view>`
needs no bootstrap call of its own.

If you do not use CocoaPods, add the three files in
`node_modules/@vyui/chimera-camera/ios` to your app target directly, which is
all the pod does anyway.

### 3. Android

The shipped `android/` folder is a complete `com.android.library` module. In
`settings.gradle`:

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

Your `AndroidManifest.xml` needs nothing added, because the manifest merger
folds in the `CAMERA` and `RECORD_AUDIO` permissions, the proxy activity, and
the FileProvider on its own. The module declares `lynx` as `compileOnly`, so it
links against whatever version your host already ships.

Then register both surfaces in your Lynx host:

```kotlin
LynxEnv.inst().registerModule("CameraModule", ChimeraCameraModule::class.java)

val builder = LynxViewBuilder()
ChimeraCameraBehaviors.behaviors().forEach { builder.addBehavior(it) }
```

### 4. Verify

Lynx has no autolinking, which makes those registration calls in steps 2 and 3
the one part nobody can automate away for you. Confirm they took:

```ts
import { getCameraInstallStatusAsync, assertCameraInstalledAsync } from '@vyui/chimera-camera'

console.log(await getCameraInstallStatusAsync())
await assertCameraInstalledAsync()
```

When native setup is incomplete, the thrown error names the missing piece,
whether that turns out to be `NativeModules`, `CameraModule`, a required native
method, or a native/JS version mismatch.

Full details and troubleshooting live in
[docs/ios-install.md](docs/ios-install.md) and
[docs/android-install.md](docs/android-install.md), and `example/host-ios` is a
working Lynx iOS host you can copy from.

## Example

You render the element and then drive it through a handle. No framework wrapper
sits in between, because this is plain TypeScript talking to the Lynx element:

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

Two runnable demos drive that same core from different frameworks:
[`example/react`](example/react) and [`example/vue`](example/vue).

## Platform support

| Platform | Status | Verified |
| -------- | ------ | -------- |
| iOS | Alpha | Device-proven on a physical iPhone: preview, photo capture, front/back switch, close/reopen. Recording and session controls are written but unverified. |
| Android | Experimental | Written to the same contract as device-proven iOS and believed to work, but never compiled or run on any device or emulator. See [docs/android-testing.md](docs/android-testing.md). |
| Mock | Stable | Framework-neutral JS double for all hosts. |

Android ships as experimental on purpose. The Kotlin/CameraX surface mirrors
[docs/native-contract.md](docs/native-contract.md) and the device-proven iOS
behavior, which is fair reason to expect it to work, but nobody has confirmed
that on hardware yet. Treat Android as unsupported until it passes device
acceptance.

## How it fits together

TypeScript is the developer-facing API, Swift and AVFoundation power iOS, Kotlin
and CameraX power Android, and Lynx's native view and module APIs bridge between
them. React Native, Nitro Modules, and JSI are not dependencies.

The library exposes two surfaces, and every operation belongs to exactly one of
them:

- **Module** (`createCameraModule()` → `CameraModuleClient`) handles stateless,
  one-shot operations that need no rendered view: permissions, device discovery,
  system-camera capture, and photo-library picking.
- **Session** (`createCameraViewHandle()` → `CameraViewHandle`) handles controls
  tied to a live `<camera-view>`: view capture, recording, focus, zoom, torch,
  and `ping()`.

Captures return a native file path rather than base64. You display one with
`file://${photo.path}`, upload by streaming the file at that path, and own the
temp file from that point on, to persist or delete as you see fit. base64 stays
available as an opt-in fallback bounded by `maxDimension`, which is what you
want for mock previews, web previews, and JSON transports.

## Links

- [Install: iOS](docs/ios-install.md) · [Android](docs/android-install.md)
- [Native contract](docs/native-contract.md) covers props, methods, events, and error codes
- [Framework integration](docs/framework-integration.md) covers the element and SelectorQuery contract
- [Output transport](docs/output-transport.md) covers file paths, lifetime, and cleanup ownership
- [Mock testing](docs/mock-testing.md) · [LynxExplorer](docs/lynx-explorer.md)
- [Publishing](docs/publishing.md) · [Changelog](CHANGELOG.md)
- [Roadmap](ROADMAP.md) is the single source of truth for status, gates, and known debt

## Credits and licensing

Chimera Camera is built off
[`react-native-vision-camera`](https://github.com/mrousavy/react-native-vision-camera)
by [Marc Rousavy](https://github.com/mrousavy) and its contributors, and the
debt runs deeper than inspiration. This project lifts source, structure, and
implementation approach from it wherever the MIT license allows, then rebuilds
that work against Lynx rather than React Native. VisionCamera is copyright 2021
Marc Rousavy and MIT licensed, and those terms carry over to everything ported
here. It is worth saying plainly that this would be a much smaller project
without it.

The camera glyph in the logo, the banner, and the example app icons comes from
[Material Symbols](https://github.com/google/material-design-icons), copyright
Google LLC, licensed under the Apache License 2.0. The original glyph was
recolored from a solid fill to a violet-to-teal gradient and rasterized to PNG
and WebP.

Chimera Camera's own code is MIT licensed, and [LICENSE](LICENSE) has the text.
The package declares `MIT AND Apache-2.0` because the shipped artwork derives
from Apache-licensed material, and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
carries the full notices for both.

This is not the official VisionCamera package and has no affiliation with it.
