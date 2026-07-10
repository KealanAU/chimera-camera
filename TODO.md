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
      `pnpm add @kealanau/chimera-camera@alpha`.

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
- [x] Compile `ChimeraCameraView.h/.m` and `ChimeraCameraModule.swift` — both build
      clean on Xcode 26 with `use_modular_headers!` (simulator SDK).
- [ ] On device: render `<camera-view>`, confirm `bindready` fires and
      `createCameraViewHandle('#camera').ping()` returns `{ ok: true }`.
- [ ] Register `ChimeraCameraModule`, add `Info.plist` keys, and confirm
      `assertCameraInstalledAsync()` passes on device.
- [ ] Capture a real photo through the system camera path end to end.

## V0 debt (keep 0.1.x honest)

- [x] Audit 2026-07-10: `SystemCameraCapture.present` hang — fixed with an
      in-flight guard (`capture/in-progress`), a present-completion check
      that fails via callback (`camera/present-failed`), and an idempotent
      `finish` so the callback fires exactly once.
- [x] Audit 2026-07-10: `topViewController()` now also accepts
      `.foregroundInactive` (cold-start scene-activation race).
- [x] Audit 2026-07-10: `maxDimension` option downscales captures/picks
      before encode.
- [x] Audit 2026-07-10 (minor): front-camera availability checked; permission
      callbacks dispatched to main; `flash` mapped to `cameraFlashMode`.
      `enableShutterSound` stays ignored — the system camera UI owns it
      (documented in types.ts / V0.md).

- [x] Captured JPEG now written to a temp file in Swift with a real `path`;
      `base64` opt-in via `includeBase64` (capture + pick, mock matches).
      Needs device verification with the M2 pass.
- [ ] Decide the removal release for the legacy `capture` fallback
      (V0.md says before `0.2.0`).
- [ ] Consider coded errors from the adapter instead of soft-degrading when
      individual native methods are missing.

## Android (M3)

- [ ] Kotlin `CameraModule`: permissions, device enumeration,
      `getChimeraCameraNativeVersion`, interim capture — mirror the iOS method
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
