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

```sh
pnpm add @vyui/camera
```

That is everything JavaScript needs. The types, the mock adapter, and the
install diagnostics work immediately, so you can build a complete capture flow
before touching a native host:

```ts
import { createCameraModule } from '@vyui/camera'

const camera = createCameraModule({ mock: true })
```

A real camera also needs your Lynx host app to compile the shipped native
sources and register them, which is two build-config lines and one registration
call per platform. [INSTALLATION.md](INSTALLATION.md) walks through all of it,
including the iOS podspec, the Android Gradle module, and troubleshooting.

Note that LynxExplorer and Lynx Go can only run the mock. Neither compiles
native source from an installed npm package at runtime, so the native path
needs a host app you build yourself.

## Example

You render the element and then drive it through a handle. No framework wrapper
sits in between, because this is plain TypeScript talking to the Lynx element:

```tsx
<camera-view id="camera" active={true} facing="back" bindready={onReady} />
```

```ts
import { createCameraViewHandle } from '@vyui/camera'

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

- [Installation](INSTALLATION.md) is the full four-step setup and troubleshooting guide
- Platform reference: [iOS](docs/ios-install.md) · [Android](docs/android-install.md)
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
from Apache-licensed material.
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) reproduces VisionCamera's MIT
license in full alongside the Material Symbols notice, and the Apache text sits
in [LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt).

This is not the official VisionCamera package and has no affiliation with it.
