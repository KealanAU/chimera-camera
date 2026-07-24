# Changelog

All notable changes to Chimera Camera are documented here. Until the API is
stable, prerelease entries may include breaking changes.

## 0.0.1 — First published release

Renumbered from the unpublished `0.2.0-alpha.0`. Nothing had ever been published
to npm, so this restarts at `0.0.1` under the default `latest` dist-tag: a plain
`pnpm add @kealanau/chimera-camera` resolves to it, with no `@alpha` suffix to
remember. The `0.0.x` line is the pre-alpha and `1.0.0` will be the launch, so
every release in between is a patch — `pnpm run bump` is the only bump path, and
a test fails CI if the version leaves the `0.0.x` track. The README carries the
pre-alpha warning where people actually read it.

- Rebuild the README as a package front page: banner, logo, feature list,
  numbered iOS/Android install steps, and an explicit pre-alpha warning. Artwork
  sources are in `images/src/`; `node images/src/render.mjs` regenerates the
  WebP files, which ship in the tarball so the npm page renders.

- Make native installation two build-config lines instead of a manual file
  copy. iOS ships `ChimeraCamera.podspec`, so a host adds one
  `pod 'ChimeraCamera', :path => '.../node_modules/@kealanau/chimera-camera'`
  line; the spec leaves `Lynx` unpinned to resolve against the host's pin and
  adds `-ObjC` so `LYNX_LAZY_REGISTER_UI` survives a static-library link.
  Android's `android/` is a consumable `com.android.library` module, so a
  `settings.gradle` include also merges the manifest's permissions, proxy
  activity, and FileProvider. The one Lynx bootstrap registration call per
  platform stays manual — Lynx has no autolinking.
- Honor `flash` (`off` / `on` / `auto`) in `camera-view` capture on both
  platforms; it fires at the shutter instead of lighting the preview, and `auto`
  defers to OS scene metering. The ReactLynx demo's flash button now cycles
  off → auto → on and passes the mode to `capturePhoto()` rather than holding the
  torch on.

- Begin the 0.3 session controls: add **experimental, unverified** `camera-view`
  recording and controls on both platforms — `startRecording`/`stopRecording`
  (AVFoundation movie output / CameraX `VideoCapture`, `enableAudio` gated on
  microphone permission, `recordingStarted`/`recordingFinished` events), clamped
  `setZoom`, `setTorch` (`camera/unsupported` when absent), and `focusAtPoint`.
  Written to `docs/native-contract.md`; not compiled or run — see the platform
  support matrix.
- Settle and document output transport (`docs/output-transport.md`), the
  `camera-view`/SelectorQuery contract (`docs/framework-integration.md`), and add
  a Vue Lynx demo scaffold alongside the ReactLynx one.
- Add a first, **experimental and not-device-audited** Android implementation:
  Kotlin `CameraModule` (version, permissions, device discovery, system
  capture/pick) and a CameraX `camera-view` (preview, `ping`, `capturePhoto`,
  ready/error events), matching `docs/native-contract.md`. Not yet compiled or
  run — see the platform support matrix and `docs/android-testing.md`.
- Guard the framework-neutral core: a test fails if any React/Vue/Svelte
  runtime import leaks into the published `dist`, and the README states which
  surface (module vs. view session) owns each operation.
- Normalize the native contract across platforms
  (`docs/native-contract.md`): `camera-view` method failures now reject with
  `ChimeraCameraError` carrying the native `.code`, matching the module surface.
- Split the combined `CameraAdapter` into `CameraModuleClient`
  (`createCameraModule` / `createNativeCameraModule`) for module operations and
  `CameraViewHandle` for live-session controls. `CameraAdapter`,
  `createCameraAdapter`, and `createNativeCameraAdapter` are removed, along with
  their throwing session stubs; `CreateCameraAdapterOptions` is now
  `CreateCameraModuleOptions`.
- Remove the deprecated `capture(options, callback)` compatibility path.
- Preserve native failure codes with the exported `ChimeraCameraError` class.
- Reject missing native methods with `camera/method-unavailable` instead of
  returning placeholder permission and device results.
- Prefer physical wide-angle cameras for default device selection.

## 0.1.0-alpha.0 — never published

Initial iOS-only alpha for validating the Lynx-native camera architecture.
Android support, autolinking, recording, and native camera controls are not
included in this release.

### Added

- Framework-neutral TypeScript camera types and public exports.
- Mock adapter and fixtures for capture, preview, and upload development
  without a native host.
- Native installation diagnostics and JavaScript/native version checks.
- iOS camera and microphone permission APIs, camera discovery, system-camera
  capture, and system photo-library picking.
- iOS `camera-view` with an AVFoundation preview, front/back switching,
  `active` and `resizeMode` props, ready/error events, bridge `ping()`, and
  view-session photo capture with foreground recovery and deterministic
  concurrent-capture errors.
- JPEG temp-file results for capture and picking, with opt-in base64 payloads
  and optional `maxDimension` downscaling.
- ReactLynx and plain mock examples plus iOS host-integration documentation.

### Known limitations

- Native installation requires manual host integration.
- The native implementation is iOS-only.
- Recording, zoom, torch, focus, and Android preview/capture are not yet
  implemented.
- The public API is prerelease and may change before `1.0.0`.
