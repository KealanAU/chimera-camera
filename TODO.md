# TODO

Working checklist, ordered by what unblocks what. Milestone context lives in
[ROADMAP.md](ROADMAP.md); tick items here as you go and promote milestone
state there when a block completes.

## Ship the first alpha to npm

- [ ] Verify the npm account owns the `@kealanau` scope (username `kealanau`,
      or an org with that name).
- [ ] Create an npm **Automation** token and add it to the repo:
      `gh secret set NPM_TOKEN`.
- [ ] Add `npm test` to `.github/workflows/release.yml` before the publish
      step (CI tests on push, but the release workflow currently publishes
      without running tests).
- [ ] Publish: `gh workflow run release.yml -f tag=alpha`.
- [ ] Confirm install from the registry in a scratch dir:
      `pnpm add @kealanau/lynx-camera@alpha`.

## Prove the mock flow in the consuming app

- [ ] `npm pack` here, `pnpm add <tarball>` in the consuming app (or use the published
      alpha once it exists).
- [ ] Build the capture → preview → upload flow against
      `createCameraAdapter({ mock: true })`.
- [ ] Wire `getCameraInstallStatus()` into the app so mock vs native fallback
      is explicit, not accidental.

## Bridge spike on a real device (M2 — the de-risking work)

- [x] Set up an iOS Lynx host app that compiles this package's `ios/` sources
      (ExampleHost dev shell: consumer-app/app/native/ios-host, XcodeGen +
      CocoaPods, Lynx 3.9.0).
- [x] Compile `LynxCameraView.h/.m` and `LynxCameraModule.swift` — both build
      clean on Xcode 26 with `use_modular_headers!` (simulator SDK).
- [ ] On device: render `<camera-view>`, confirm `bindready` fires and
      `createCameraViewHandle('#camera').ping()` returns `{ ok: true }`.
- [ ] Register `LynxCameraModule`, add `Info.plist` keys, and confirm
      `assertCameraInstalledAsync()` passes on device.
- [ ] Capture a real photo through the system camera path end to end.

## V0 debt (keep 0.1.x honest)

- [ ] Audit 2026-07-10: `SystemCameraCapture.present` can hang the JS promise
      forever — `present(picker)` is fire-and-forget; if UIKit refuses the
      presentation (presenter mid-transition, another picker up), no delegate
      fires and `retainSelf` leaks. Guard in-flight captures, use the
      present-completion handler, and fail via callback.
- [ ] Audit 2026-07-10: `topViewController()` requires `.foregroundActive` —
      cold-start captures race scene activation; accept `foregroundInactive`
      or retry briefly.
- [ ] Audit 2026-07-10: downscale captures in the module (max-dimension cap)
      — full 12 MP JPEGs are 4–8 MB of base64 across the bridge.
- [ ] Audit 2026-07-10 (minor): check `isCameraDeviceAvailable(.front)`
      before setting `picker.cameraDevice`; dispatch `requestPermission`
      callbacks to the main queue; module ignores `flash`/`enableShutterSound`
      that the JS adapter sends.

- [ ] Write the captured JPEG to a temp file in Swift and return a real
      `path` (keep `base64` optional) — removes the 3–8 MB bridge payload
      and the `memory://` pseudo-path.
- [ ] Decide the removal release for the legacy `capture` fallback
      (V0.md says before `0.2.0`).
- [ ] Consider coded errors from the adapter instead of soft-degrading when
      individual native methods are missing.

## Android (M3)

- [ ] Kotlin `CameraModule`: permissions, device enumeration,
      `getLynxCameraNativeVersion`, interim capture — mirror the iOS method
      list so the install check passes.
- [ ] Extend the version-sync test to cover the Kotlin source once it exists.

## Housekeeping

- [ ] Switch CI from `macos-latest` to `ubuntu-latest` — nothing in CI needs
      macOS yet, and private-repo macOS minutes bill at 10×. Revisit when a
      native build step lands.
- [ ] Add a CHANGELOG.md at the first published release.

## Later (M4–M6)

Embedded preview, view-session capture/recording, zoom/torch/focus, and
hardening — sequenced in [ROADMAP.md](ROADMAP.md); not worth task-level
breakdown until M2 is proven.
