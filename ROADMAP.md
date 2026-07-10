# Roadmap

Milestone-level status for `chimera-camera`. The contract for what ships today
is [V0.md](V0.md); the target contract for the native view is [V1.md](V1.md);
the long-form plan lives in [README.md](README.md). Per-release checklists
(done and remaining points for each npm version) live in
[versions/](versions/): [0.1](versions/0.1.md), [0.2](versions/0.2.md),
[0.3](versions/0.3.md), [1.0](versions/1.0.md). Update this file whenever
a milestone changes state so the plan docs never have to guess.

## Milestones

### M0 — Package foundation and mock adapter — ✅ Done

- TypeScript package layout, public types, build, CI, and release workflows.
- Mock adapter at `@kealanau/chimera-camera/mock` with photo fixtures.
- Install and testing guides under `docs/`.

### M1 — iOS module with system-camera capture (interim) — ✅ Done

Formal contract: [V0.md](V0.md).

- `ios/ChimeraCameraModule.swift` registers as `CameraModule`: permission
  status/request for camera and microphone, device enumeration.
- `capturePhoto()` presents the system camera UI (`UIImagePickerController`)
  and returns the captured JPEG.
- Install checks (`getCameraInstallStatus`, `assertCameraInstalled` and async
  variants) so apps can tell missing native registration apart from a real
  camera error.

This milestone is a deliberate stepping stone, not part of the V1 contract. It
lets a host app ship photo capture before the `camera-view` bridge exists.
Known differences from the V1 contract, to be resolved in M4/M5:

- Capture lives on the module; V1 puts capture on the `camera-view` session.
- ~~The photo returns as base64 with a `memory://` pseudo-path~~ Resolved
  2026-07-10: the module now writes a JPEG temp file and returns its real
  path; `base64` is opt-in via `includeBase64`, `maxDimension` caps size.

### M2 — Lynx bridge spike (`camera-view`) — 🚧 In progress

Acceptance criteria in V1.md ("Bridge Spike Acceptance Criteria"):

- [x] iOS `camera-view` placeholder element written
      (`ios/ChimeraCameraView.h/.m`: `facing`/`active` props, `ping()` method,
      `ready` detail event).
- [x] JS surface: `CAMERA_VIEW_TAG`, `invokeCameraViewMethod`,
      `createCameraViewHandle` in `src/view.ts`, with tests against a fake
      SelectorQuery bridge.
- [x] Compile in a real iOS Lynx host app: both `ChimeraCameraModule.swift` and
      `ChimeraCameraView.m` build clean against Lynx 3.9.0 pods / Xcode 26
      (ExampleHost dev shell, simulator SDK, 2026-07-10). Requires
      `use_modular_headers!` in the host Podfile for the Swift module.
- [ ] Verify on device: props reach native, `ping()` returns `{ ok: true }`,
      `bindready` fires in JavaScript.
- [ ] Android equivalent (`Behavior`/`LynxUI`, `@LynxUIMethod`,
      `LynxDetailEvent`).

This is the de-risking milestone: every later milestone builds behind this
bridge, and the native halves remain unproven until a host app compiles them.

### M3 — Android module parity — ⬜ Not started

- Kotlin `CameraModule`: permissions, device enumeration, interim capture.
- `android/` currently contains no source; iOS is deliberately sequenced first.

### M4 — Embedded live preview — 🚧 In progress (iOS done, Android not started)

- [x] iOS: `AVCaptureVideoPreviewLayer` inside `camera-view`
      (`ios/ChimeraCameraView.m`): `active` bound to session start/stop,
      `facing` switches the input live, `resizeMode` maps to video gravity,
      `ready` `{ deviceId }` / `error` `{ code, message }` detail events,
      permission checked (and requested if undetermined) before start.
- [ ] Verify on device: preview renders, facing switch works, `ready` fires.
- [ ] Android: `androidx.camera.view.PreviewView` equivalent.

### M5 — Capture, recording, and controls on the view — 🚧 In progress

- [x] iOS `capturePhoto()` on the view: `AVCapturePhotoOutput` JPEG written to
      a temp file, returns `{ path, width, height, orientation, mime }` — no
      base64 across the bridge (resolves the M1 debt for the view path).
- [ ] `startRecording(options)` / `stopRecording()`.
- [ ] Zoom, torch, and tap-to-focus with predictable unsupported-control errors.

### M6 — Hardening and device acceptance — ⬜ Not started

- Rapid mount/unmount, permission revocation, camera-in-use, and
  background/foreground testing per the README testing strategy.
- Real-device acceptance pass on iOS and Android.

## Known debt

- `createNativeCameraAdapter` still soft-degrades when individual native
  methods are missing (returns `not-determined`, empty device lists). The
  install checks make this detectable, but apps must opt in by calling them;
  consider throwing coded errors from the adapter itself.
- `getDefaultCamera` returns the first device matching a position; on iOS the
  discovery order can surface a dual/triple virtual camera before the plain
  wide-angle one.
