# Roadmap

Milestone-level status for `lynx-camera`. The V1 contract lives in
[V1.md](V1.md); the long-form plan lives in [README.md](README.md). Update this
file whenever a milestone changes state so the plan docs never have to guess.

## Milestones

### M0 — Package foundation and mock adapter — ✅ Done

- TypeScript package layout, public types, build, CI, and release workflows.
- Mock adapter at `@kealanau/lynx-camera/mock` with photo fixtures.
- Install and testing guides under `docs/`.

### M1 — iOS module with system-camera capture (interim) — ✅ Done

- `ios/LynxCameraModule.swift` registers as `CameraModule`: permission
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
- The photo returns as base64 with a `memory://` pseudo-path instead of a real
  local file path. Base64 across the bridge is 3–8 MB per 12 MP photo; the fix
  is to write a temp file in Swift and return its path.

### M2 — Lynx bridge spike (`camera-view`) — ⬜ Not started (next up)

Acceptance criteria in V1.md ("Bridge Spike Acceptance Criteria"):

- Register a native `camera-view` placeholder element on iOS.
- Pass props from JavaScript into native code.
- Call `ping()` on the view and receive `{ ok: true }`.
- Receive a native `ready` event in JavaScript.

This is the de-risking milestone: every later milestone builds behind this
bridge, and it is the only part of the architecture not yet proven.

### M3 — Android module parity — ⬜ Not started

- Kotlin `CameraModule`: permissions, device enumeration, interim capture.
- `android/` currently contains no source; iOS is deliberately sequenced first.

### M4 — Embedded live preview — ⬜ Not started

- `AVCaptureVideoPreviewLayer` (iOS) and `androidx.camera.view.PreviewView`
  (Android) inside `camera-view`.
- `active` prop bound to session lifecycle; `onReady` / `onError` events.

### M5 — Capture, recording, and controls on the view — ⬜ Not started

- `capturePhoto()` writing to a real local file path.
- `startRecording(options)` / `stopRecording()`.
- Zoom, torch, and tap-to-focus with predictable unsupported-control errors.

### M6 — Hardening and device acceptance — ⬜ Not started

- Rapid mount/unmount, permission revocation, camera-in-use, and
  background/foreground testing per the README testing strategy.
- Real-device acceptance pass on iOS and Android.

## Known debt

- No automated tests yet. The pure-JS surface (mock behavior, `callNative`
  callback/promise handling, the legacy `capture` fallback, error
  normalization) is cheap to cover now.
- `createNativeCameraAdapter` still soft-degrades when individual native
  methods are missing (returns `not-determined`, empty device lists). The
  install checks make this detectable, but apps must opt in by calling them;
  consider throwing coded errors from the adapter itself.
- `getDefaultCamera` returns the first device matching a position; on iOS the
  discovery order can surface a dual/triple virtual camera before the plain
  wide-angle one.
