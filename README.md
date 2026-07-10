# Lynx Camera

`lynx-camera` is a planned Lynx-native camera package inspired by
[`react-native-vision-camera`](https://github.com/mrousavy/react-native-vision-camera).

Thanks to Marc Rousavy and the VisionCamera contributors for building and
maintaining the camera library this project is based on. VisionCamera is MIT
licensed, and this project should preserve the required copyright and license
notices for any code or structure we reuse.

The goal is to create a Lynx-native camera library, not a React Native
compatibility layer. VisionCamera is built around React Native, Nitro Modules,
JSI, and React Native view bindings. This project should start from the useful
native ideas and MIT-licensed source, then replace the React Native/Nitro-facing
surface with a plain JavaScript API that Lynx apps can use from React, Vue,
Svelte, or any other JS integration layer.

## Why This Exists

Lynx does not currently appear to have a maintained, drop-in camera package with
VisionCamera-style capabilities. This project fills that gap with a native iOS
and Android camera view designed specifically for Lynx apps.

The first release should be practical rather than exhaustive: preview, device
selection, permissions, photo capture, video recording, zoom, torch, and
tap-to-focus. Frame processors, barcode scanning, GPU pipelines, and full
VisionCamera parity can come later once the base camera surface is stable.
React Native compatibility and web support are intentionally out of scope for
this project.

For app development before native iOS/Android wiring is complete, the package
ships a mock adapter at `@kealanau/lynx-camera/mock`. It lets Lynx apps exercise
permission, device, photo, and recording flows in Explorer, web preview, or unit
tests without touching device hardware.

LynxExplorer users should start with the mock adapter. Real iPhone camera access
requires a custom iOS Lynx host app that compiles and registers the package's
`ios/` sources.

The package also exposes install checks:

```ts
import { assertCameraInstalledAsync, getCameraInstallStatusAsync } from '@kealanau/lynx-camera'

const status = await getCameraInstallStatusAsync()
await assertCameraInstalledAsync()
```

If native setup is missing, the error explains whether `NativeModules`,
`CameraModule`, required native methods, or native version alignment failed.

## Architecture

This package should be built as a new native Lynx library from a fresh
repository, not as a long-lived fork of VisionCamera. The project can lift,
study, and selectively port MIT-compatible pieces from VisionCamera, but the
repo should stay focused on Lynx from day one.

- TypeScript exposes a plain JavaScript-friendly public API.
- iOS uses AVFoundation.
- Android uses CameraX.
- Lynx native view/module APIs bridge camera operations into the host app.
- VisionCamera source may be forked, referenced, or selectively ported where the
  code is useful and MIT-compatible.
- React Native, Nitro Modules, JSI, and NitroImage dependencies should be
  removed or replaced with Lynx-native equivalents.

The native layering should be similar in spirit to Python libraries that expose a
friendly high-level API over a lower-level native engine: JavaScript is the
developer-facing API, Kotlin/CameraX powers Android, and Swift/AVFoundation
powers iOS.

The React Native package itself should not be a runtime dependency.

## Repository Shape

Use a package-root layout:

- `src/` for the public TypeScript and JavaScript API.
- `ios/` for Swift and AVFoundation integration.
- `android/` for Kotlin and CameraX integration.
- `example/` for a minimal Lynx app used to validate installation, native
  registration, rendering, commands, and events.
- `LICENSE` for this project's MIT license.
- `THIRD_PARTY_NOTICES.md` for upstream VisionCamera attribution.
- `docs/` for native install and mock-testing guides.

## Initial API Shape

### Camera View

The first public component should be `CameraView`.

Suggested props:

- `active`
- `facing`
- `cameraId`
- `resizeMode`
- `enableAudio`
- `torch`
- `zoom`
- `onReady`
- `onError`
- `onRecordingStarted`
- `onRecordingFinished`

Suggested imperative methods:

- `capturePhoto()`
- `startRecording(options)`
- `stopRecording()`
- `focusAtPoint({ x, y })`
- `setZoom(value)`
- `setTorch(mode)`

### Camera Module

The companion module should expose non-view operations:

- `getCameraPermissionStatus()`
- `requestCameraPermission()`
- `getMicrophonePermissionStatus()`
- `requestMicrophonePermission()`
- `getAvailableCameraDevices()`

## First Milestone: Lynx Bridge Spike

Before porting camera behavior, prove the native bridge works end to end:

- Render a native `CameraView` placeholder from Lynx JavaScript.
- Call one imperative native method from JavaScript.
- Emit one native event back to JavaScript.
- Wire this through the `example/` app.

This milestone de-risks the project. Once native view, command, and event
plumbing are confirmed, camera implementation can proceed behind the same API.

## V1 Scope

V1 should include:

- iOS and Android support.
- Camera permission checks and requests.
- Microphone permission checks and requests for video with audio.
- Front and back camera selection.
- Live preview.
- Photo capture to a local file.
- Video recording to a local file.
- Torch control where supported.
- Zoom control where supported.
- Tap-to-focus where supported.
- Consistent error codes across platforms.
- Basic lifecycle handling for mount, unmount, background, foreground, and
  permission changes.

V1 should not include:

- Frame processors.
- Barcode scanning.
- Skia or custom GPU rendering.
- RAW capture.
- Depth data.
- HDR tuning.
- React Native compatibility.
- Web support.

## Implementation Plan

### 1. Package Foundation

- Create the package layout for TypeScript, iOS, and Android.
- Add MIT license and attribution files based on the upstream VisionCamera
  license requirements.
- Define public TypeScript types before implementing native behavior.
- Ship a mock camera adapter for JS/app-flow testing before native wiring.
- Document the unsupported VisionCamera features clearly.
- Start from a fork/lift-and-shift of the useful project structure, then remove
  React Native/Nitro-specific code while preserving native camera behavior.
- Add the minimal `example/` app skeleton for bridge validation.

### 2. Lynx Bridge Spike

- Register a native view on iOS and Android.
- Render that view from JavaScript.
- Add one no-op imperative method.
- Add one native-to-JS event.
- Confirm the same JS API shape can be consumed without React Native concepts.

### 3. Permissions and Devices

- Implement camera and microphone permission status mapping.
- Implement permission request flows.
- Implement device enumeration with stable device IDs and front/back metadata.
- Normalize platform-specific device information into one JS shape.

### 4. Preview View

- Implement the native camera preview view on iOS.
- Implement the native camera preview view on Android.
- Bind preview lifecycle to Lynx mount/unmount and the `active` prop.
- Surface `onReady` and `onError` events.

### 5. Photo Capture

- Add `capturePhoto()`.
- Save output to a local file.
- Return file path, dimensions, orientation, and basic metadata when available.
- Normalize errors for missing permissions, unavailable devices, inactive
  sessions, and capture failures.

### 6. Video Recording

- Add `startRecording(options)` and `stopRecording()`.
- Support audio only when microphone permission is granted.
- Return file path and best-effort duration/size metadata.
- Handle interruption, app backgrounding, and repeated start/stop calls.

### 7. Camera Controls

- Add zoom.
- Add torch.
- Add tap-to-focus with coordinate mapping from Lynx view space to native camera
  coordinates.
- Validate unsupported controls per device and return predictable errors.

### 8. Hardening

- Test rapid mount/unmount.
- Test permission denial and revocation.
- Test camera already in use.
- Test switching front/back cameras.
- Test app background/foreground transitions.
- Test video recording interruption.

## Testing Strategy

Automated tests should cover:

- TypeScript API exports.
- Option validation.
- Error normalization.
- Permission state mapping.
- Device metadata normalization.

Manual device acceptance should cover:

- iOS real device preview, photo, and video.
- Android real device preview, photo, and video.
- Permission denied and permission granted flows.
- Front and back cameras.
- Zoom, torch, and tap-to-focus.
- Background/foreground lifecycle.
- Rapid mount/unmount without crashes or leaked sessions.

Simulator testing is useful for bridge and lifecycle work, but real devices are
required before treating camera behavior as correct.

## License Notes

VisionCamera is MIT licensed. This project may reference, fork, modify, or port
compatible parts of that code, provided the original copyright and license
notice are preserved.

This package should avoid implying that it is the official VisionCamera package.
Use clear attribution and separate naming.

The repository should include:

- This project's MIT license.
- VisionCamera's original MIT license notice where required.
- A visible README thank-you and attribution near the top of the file.

## Current Status

See [ROADMAP.md](ROADMAP.md) for milestone-level status and known debt, and
[TODO.md](TODO.md) for the working task list.
[V0.md](V0.md) is the contract for what ships today; [V1.md](V1.md) is the
target contract for the native `camera-view` element.

Working today:

- TypeScript API, mock adapter, fixtures, and install checks.
- iOS `CameraModule`: permission checks/requests, device enumeration, and
  interim photo capture through the system camera UI
  (`UIImagePickerController`). This is a stepping stone that lets apps ship
  photo capture before the `camera-view` path is proven on device.
- iOS `camera-view`: embedded AVFoundation live preview (`active`, `facing`,
  `resizeMode` props; `ready`/`error` events) with `capturePhoto()` writing a
  JPEG to a temp file and returning its path. Custom camera UI can now be
  layered over the preview in Lynx. Awaiting on-device verification.

Not started yet:

- Android native source.
- Video recording, zoom, torch, and tap-to-focus.
