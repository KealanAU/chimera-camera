# Roadmap

This is the single source of truth for project status, release gates, working
tasks, and known debt. Do not create separate TODO or per-version checklist
files; update this document when implementation or device evidence changes.

The normalized native contract lives in
[docs/native-contract.md](docs/native-contract.md). The original planning specs
[V0.md](docs/archive/V0.md) and [V1.md](docs/archive/V1.md) are archived under
`docs/archive/`. [README.md](README.md) explains the project and architecture
without duplicating the working checklist here.

Last reconciled: 2026-07-25.

## Current checkpoint

Chimera Camera has completed the `0.2` implementation and is partway through
`0.3` (session controls and framework portability). iOS is device-proven
(preview, capture, front/back switch, and close/reopen on a physical iPhone).
Android has a full Kotlin/CameraX implementation written to the same contract as
iOS; it is **believed correct but has not been compiled or run**, so it stays
experimental. By project decision (2026-07-19) the Android device audit is
carried forward as a follow-up acceptance task rather than a 0.2 blocker — see
Known debt.

The 0.3 groundwork that needs no device or Lynx toolchain is done and documented:
the output-transport story ([output-transport.md](docs/output-transport.md)), the
plain-TypeScript `camera-view`/SelectorQuery contract
([framework-integration.md](docs/framework-integration.md)), the recording and
controls native contract ([native-contract.md](docs/native-contract.md)), and the
ReactLynx + Vue demo scaffolds (`example/`). The 0.3 native session controls and
recording (zoom, torch, focus, `startRecording`/`stopRecording` with audio and
events) are now written for iOS (AVFoundation) and Android (CameraX) but are
**UNVERIFIED** — not compiled or run. What remains for 0.3 is device verification
of that native code, output orientation for non-portrait hosts, and toolchain-bound
work (building the Sparkling React/Vue bundles, adding a Svelte page). Autolinking
stays deferred.

### Implemented and verified in the repository

- [x] Framework-neutral TypeScript types and public exports.
- [x] Mock adapter, fixtures, install diagnostics, and native/JS version checks.
- [x] iOS `CameraModule`: camera/microphone permissions, device discovery,
      system-camera capture, and system photo-library picking.
- [x] Captures/picks write JPEG temp files; base64 is opt-in and
      `maxDimension` can cap bridge payload size.
- [x] iOS `camera-view`: AVFoundation preview, `active`, `facing`, and
      `resizeMode` props, `ready`/`error` events, `ping()`, and view-session
      `capturePhoto()`.
- [x] Both iOS native surfaces compile in a Lynx 3.9.0 host with Xcode 26.
- [x] TypeScript build and all 46 JS tests pass.

### Physical iPhone evidence

Reported by the project owner on 2026-07-10:

- [x] Embedded camera preview rendered on an iPhone.
- [x] A photo was captured successfully.
- [x] Front/back camera switching was present and working.
- [x] The camera could be closed and reopened successfully.

This proves the central iOS architecture. It does not by itself prove explicit
`ping()`/`bindready` observation, system-camera capture, app
background/foreground recovery, or error cases; those remain listed below.

## 0.1 — Device-proven iOS alpha

**Goal:** finish the focused iPhone acceptance and produce an explicitly
iOS-only alpha candidate. Publishing is a separate distribution follow-up and
does not block implementation completion.

### Remaining device acceptance

- [ ] Confirm `bindready` reaches JavaScript and
      `createCameraViewHandle('#camera').ping()` returns `{ ok: true }`.
- [ ] Confirm `assertCameraInstalledAsync()` passes with the native module
      registered and the required `Info.plist` keys present.
- [ ] Capture a real photo through the module-level system-camera path.
- [ ] Confirm the returned temp-file result is usable by the intended preview
      or upload flow.
- [ ] Complete one app background/foreground cycle with the preview active.
- [ ] Exercise permission denial, cancellation, and a second concurrent
      capture; errors must reach JavaScript predictably.

### Mock/application flow

- [x] Package example exposes explicit native/mock install status and covers
      capture → bounded base64 preview → host-provided upload mutation.
- [ ] Build a real consuming app's capture → preview → upload flow against
      `createCameraModule({ mock: true })`.
- [ ] Have that app surface `getCameraInstallStatus()` so native versus mock use
      is explicit rather than an invisible fallback.

### Distribution follow-up (not an implementation gate)

- [x] Publish under the established `@vyui` scope (alongside `@vyui/core`,
      `@vyui/kit`, `@vyui/cli`) rather than a personal one — same Lynx audience,
      one brand. Docs land at `camera.vyui.dev`.
- [x] Authenticate the release workflow with OIDC trusted publishing instead of a
      long-lived `NPM_TOKEN` secret. Needs pnpm >= 11.1.3, so the repo runs
      pnpm 11.
- [x] Publish `0.0.1` by hand (2026-07-25). Shows `kealanau` as publisher rather
      than GitHub Actions, since it predates the trusted-publisher registration,
      and it carries no provenance attestation for the same reason.
- [ ] Register this repo as a trusted publisher on npmjs.com — package settings,
      owner `KealanAU`, repo `chimera-camera`, workflow `release.yml`, environment
      `npm-publish`. npm only exposes that setting on a package that already
      exists, which is why the first publish had to be manual. Until this is
      done the `Release` workflow cannot authenticate, so `0.0.2` onward would
      have to be published by hand too.
- [x] Add `npm test` to `.github/workflows/release.yml` before publishing.
- [x] Add the `repository` field to package.json — npm rejects a `--provenance`
      publish without it, and the release workflow sets
      `NPM_CONFIG_PROVENANCE=true`.
- [x] Renumber to `0.0.1` and default the release workflow to the `latest`
      dist-tag, so a plain `pnpm add @vyui/camera` resolves.
- [x] Fix the release cadence: `0.0.x` is the whole pre-alpha and `1.0.0` is the
      launch, so every release between them is a patch. `pnpm run bump` is the
      only bump path, and `tests/version-sync.test.js` fails if the version
      leaves the `0.0.x` track.
- [x] Rebuild the README as a package front page — banner, logo, features,
      numbered install steps, pre-alpha warning. Artwork sources live in
      `images/src/`; `node images/src/render.mjs` regenerates the WebP files.
- [ ] Publish `0.0.1` and label the release iOS-only in the GitHub release notes
      (Android is experimental; see the README support matrix).
- [ ] Install the published artifact in a clean host and repeat the basic flow.
- [x] Add `CHANGELOG.md`.
- [x] Host the docs on Cloudflare Workers via `@opennextjs/cloudflare`
      (`website/wrangler.jsonc`). Not Pages: `@cloudflare/next-on-pages` is
      deprecated and never supported Next 15+. `pnpm --filter
      @chimera-camera/website deploy` publishes.
- [ ] Connect Workers Builds to this repo so pushes to `main` deploy — root
      directory `website`, no CI workflow needed. One-time dashboard step (the
      GitHub app install); the `camera.vyui.dev` custom domain is declared in
      `wrangler.jsonc` and created by the first deploy.

### 0.1 exit criteria

The iOS module, native element, preview, front/back switching, close/reopen,
and both capture paths work on a physical iPhone; capture results feed the
preview/upload boundary and current limitations are explicit.

## 0.2 — Android photo parity

**Goal:** the same photo contract on iOS and Android through manual host
integration, so a Lynx host can render a preview and capture a photo the same
way on both platforms. Autolinked distribution is deferred (see below).

### Lynx native-library packaging (deferred — not a 0.2 gate)

Autolinking is a distribution convenience, not an architecture gate: it removes
the per-host manual native wiring, nothing more. npm install already delivers
the JS plus `ios/`/`android/` sources; manual integration works today (iOS is
device-proven). With a single in-house consumer today, full autolinking buys
little, so it stays deferred until an external consumer needs zero-setup
installs — realistically a 1.0 distribution task.

The cheap 80% landed for `0.0.1` (2026-07-24): the package ships standard
platform packaging, so getting the sources into a host build is one Podfile line
and one `settings.gradle` include instead of copying files. What autolinking
would still add on top is discovery — removing the single Lynx bootstrap
registration call per platform. The install/version diagnostics stay the safety
net either way.

- [x] Ship iOS/Android package metadata so hosts consume the sources through
      the normal platform tooling: `ChimeraCamera.podspec` (unpinned `Lynx` so
      it resolves against the host's pin; `-ObjC` so the
      `LYNX_LAZY_REGISTER_UI` class survives a static link) and `android/` as a
      consumable `com.android.library` module (manifest merger handles the
      permissions, proxy activity, and FileProvider).
- [x] Update install, publishing, platform, and npm documentation for the
      packaged flow.
- [ ] Migrate to Lynx native-library/autolink conventions using tooling from
      the same Lynx release channel as the consuming app.
- [ ] Add generated/spec inputs for `CameraModule` and `camera-view`
      *discovery*, removing the per-host bootstrap registration call.
- [ ] Prove a clean host can install the package and reach both native surfaces
      without registering them by hand.
- [ ] Verify the podspec end to end against a published tarball: `pod install`
      from `node_modules` in a clean Lynx host, then a real capture on device.
      Only `pod lib lint` has been run so far.
- [x] Retain useful install/version diagnostics for absent, stale, or
      mismatched native builds.

### Android module and element

A first unverified implementation exists under `android/src/main` (written
2026-07-18), matching `docs/native-contract.md` and the iOS behavior. It has not
been compiled or run — the boxes below stay unchecked until emulator/device
verification (see `docs/android-testing.md`). Each source carries an `UNVERIFIED`
header listing what to confirm.

- [~] Kotlin `CameraModule`: permissions, device discovery, native version,
      system capture, and photo picking where supported by the contract.
      *(written, unverified)*
- [x] Add Kotlin/native-version coverage to the synchronization tests.
- [~] Register `camera-view` with bridge `ping()` and `ready`/`error` events.
      *(written, unverified)*
- [~] Implement CameraX live preview with iOS-equivalent `active`, `facing`,
      and `resizeMode` behavior. *(written, unverified)*
- [~] Implement CameraX view-session photo capture with matching `PhotoFile`
      semantics and error codes. *(written, unverified)*
- [ ] Compile in a real Android Lynx host and pass the flow on a physical
      device.

### Clarify the framework-neutral core

- [x] Keep the root package free of React, Vue, and Svelte runtime imports.
      Enforced by `tests/framework-free.test.js`, which fails if any UI runtime
      import leaks into `dist`.
- [x] Make ownership explicit: permissions/device discovery/photo picking are
      module operations; capture/recording/focus/zoom/torch belong to a
      rendered `CameraViewHandle` session. Split enforced in types and factories;
      stated in the README "Surface ownership" section.
- [x] Decide how to deprecate the V0 combined `CameraAdapter` before adding
      more view-session controls. Split into `CameraModuleClient`
      (`createCameraModule`/`createNativeCameraModule`) for module operations
      and `CameraViewHandle` for live-session controls; `CameraAdapter` and its
      factories are deleted (never published, so no deprecation window needed).
- [x] Preserve structured native error codes in JavaScript instead of reducing
      failures to message-only `Error` objects.
- [x] Normalize prop defaults, result/event shapes, and unsupported-feature
      errors across iOS and Android. Canonical contract in
      [docs/native-contract.md](docs/native-contract.md); the view surface now
      throws `ChimeraCameraError` with native `.code`s like the module surface.
      Android must conform to the documented contract when implemented.

### 0.2 cleanup

- [x] Remove the deprecated legacy `capture(options, callback)` fallback and
      `legacy-capture-only` install status.
- [x] Replace soft degradation for missing native methods with documented,
      coded behavior.
- [x] Prefer the plain wide-angle device in `getDefaultCamera()` rather than
      relying on discovery order.

### 0.2 exit criteria

A manually integrated iOS or Android Lynx host renders a preview and captures a
photo through the same framework-independent contract. Autolinked, zero-setup
installation is explicitly out of scope for 0.2.

**Closed 2026-07-19.** iOS met this on a physical device. Android's surface is
implemented to the contract and believed correct, but its device/emulator audit
is deliberately deferred and carried forward as a device-acceptance task (Known
debt) rather than gating 0.3. Android stays experimental until that audit runs.

## 0.3 — Complete view sessions and prove framework portability (current)

**Goal:** complete the useful session controls on both platforms and prove
that React, Vue, and Svelte Lynx consumers drive the same native element and
imperative TypeScript API.

### Recording and controls

- [~] Implement `startRecording()` / `stopRecording()` with real `VideoFile`
      results on iOS and Android. *(AVFoundation + CameraX, written but unverified)*
- [~] Honor `enableAudio` and check microphone permission before recording.
      *(written, unverified)*
- [~] Emit normalized recording-started and recording-finished events.
      *(written, unverified)*
- [~] Implement clamped zoom, torch with unsupported-device errors, and
      focus-at-point where supported. *(written, unverified)*
- [ ] Revisit output orientation when a non-portrait host consumes the view.
      *(still portrait-locked in the recording/capture connections)*

### Framework-neutral acceptance

- [~] Add one Sparkling demo shell with separate ReactLynx and Vue Lynx page
      bundles sharing the same native camera registration. *(`example/react` and
      `example/vue` are both runnable rspeedy apps that boot and compile their
      bundles — each drives the same core with its own framework, no shared React.
      What remains is folding both under one shared Sparkling native registration
      — layout in `example/README.md`)*
- [~] ReactLynx page exercises the complete native view surface.
      *(`example/react/src/App.tsx` drives the full `CameraViewMethods` surface —
      preview, ping, capture, switch, close/reopen, plus recording, zoom, torch,
      and focus. Recording/controls run against the mock today and against the
      native view once a host compiles it; the Vue app has the same controls.)*
- [~] Vue Lynx page performs the same flow without a React dependency.
      *(`example/vue` is a runnable vue-lynx app — `pnpm --filter @chimera-camera/vue
      run dev` boots and compiles the bundle in mock mode, driving the same core with
      no React; on its own pinned rsbuild-1.x toolchain since vue-lynx 0.5.1 predates
      rspeedy 0.16. Native-backed flow still needs a host, like React's.)*
- [ ] Add a Svelte page only when a maintained Svelte-on-Lynx toolchain exists.
- [x] Plain TypeScript documentation explains the underlying custom element,
      events, and SelectorQuery contract. See
      [docs/framework-integration.md](docs/framework-integration.md).
- [x] Keep framework helpers thin and optional; add them only where lifecycle
      differences require them. Both demos drive the core directly through the
      package and `createCameraViewHandle`; no framework wrapper is needed.
- [~] Add contract tests asserting equivalent normalized behavior through each
      binding. *(`tests/contract.test.js` pins the shared imperative surface —
      method params, result shapes, and every view error code — plus the mock's
      recording-error parity; all frameworks drive this same handle with no
      wrapper, so this is the binding-neutral layer. Running the assertions
      through live React/Vue/Svelte runtimes still needs the Lynx toolchain.)*

### Output transport

- [x] Settle how apps display and upload native photo/video paths without
      making multi-megabyte base64 strings the default bridge payload. Settled in
      [docs/output-transport.md](docs/output-transport.md): the path is the
      payload; base64 is an opt-in `maxDimension`-bounded fallback. Photo paths
      are exercised today; video paths are contract-level until recording lands.
- [x] Document file lifetime and cleanup ownership, with explicit base64 and
      `maxDimension` fallback guidance where native paths cannot be consumed.
      See [docs/output-transport.md](docs/output-transport.md#file-lifetime-and-cleanup-ownership).

### 0.3 exit criteria

All advertised `CameraViewMethods` work on physical iOS and Android devices
and are consumed through the same core API by React, Vue, and Svelte examples.

## 1.0 — Stable cross-framework Lynx camera

**Goal:** one autolinked npm package provides equivalent, stable camera
behavior to Lynx applications regardless of frontend framework.

### Stable contract

- [ ] Request/check camera and microphone permissions.
- [ ] List cameras and select/switch front and back devices.
- [ ] Render preview and capture photos to usable local results.
- [ ] Record video with optional audio.
- [ ] Support zoom, torch, and focus where hardware allows.
- [ ] Freeze prop defaults, methods, events, error codes, file semantics, and
      native/JS version compatibility rules.
- [ ] Remove or formally deprecate the V0 combined adapter surface.
- [ ] Keep the core package independent of React, Vue, and Svelte runtimes.

### Hardening

- [ ] Stress rapid mount/unmount and rapid prop/device changes.
- [ ] Handle permission revocation, camera-in-use, calls, and interruptions.
- [ ] Recover safely across background/foreground during preview and recording.
- [ ] Verify orientation and output metadata where hosts rotate.
- [ ] Verify temporary-file cleanup and long-session resource use.
- [ ] Record startup, capture latency, payload size, and memory use on
      representative low/high-end devices.

### Verification and release

- [ ] Run JS contract tests and native iOS/Android host compile checks in CI
      where practical.
- [ ] Record a physical-device matrix for supported OS and Lynx versions.
- [ ] Test autolinking from a packed/published artifact in clean hosts.
- [ ] Review installation, API, migration, error, and output-path docs.
- [ ] Complete the 0.x changelog and mark V0 superseded.
- [ ] Publish with the `latest` dist-tag.

### 1.0 definition of done

An app installs one npm package, lets Lynx autolink it, renders the same native
`camera-view` from React, Vue, Svelte, or a plain Lynx integration, and receives
equivalent preview, photo, recording, control, lifecycle, and error behavior on
iOS and Android.

## VisionCamera parity

Reconciled against the `upstream/vision-camera` reference clone at **5.1.0** on
2026-07-25. Parity is not a release gate (see *Explicitly deferred* below), but
the gap should be known rather than assumed.

Note what 5.1.0 is before reading the gaps: a Nitro-based rearchitecture built
around composable *outputs* (photo, video, frame, depth, object, preview) plus a
`CameraController` that exposes hardware knobs individually. Chimera is a
stateless module plus one `<camera-view>` element. So the useful comparison is
coverage of the capture loop, not surface area — matching the upstream shape is
explicitly not a goal.

### Covered

Permissions (camera + microphone), device discovery and front/back selection,
preview with `resizeMode`, photo capture, video start/stop, zoom, tap-to-focus,
torch, flash, exposure bias, active-state lifecycle, and error events. Upstream
carries more depth on most of these — animated zoom, focus modes, torch strength,
exposure locking — but the operation exists on both sides.

`CameraReadyEvent`'s `wideFactor` and `switchOverZoomFactors` cover the same
display-multiplier ↔ zoom-factor mapping upstream exposes as
`displayableZoomFactor`.

### Present here, absent upstream

- `pickPhoto()` — system photo-library picker. Upstream has no picker; RN
  consumers reach for a separate library.
- `saveToLibrary()` — same; upstream leaves this to camera-roll packages.
- The mock adapter and `getCameraInstallStatus()` install diagnostics.

For a photo-upload flow these three are worth more than most of the gaps below.

### Known gaps, not triaged

Distinct from the deferral list — these are simply unexamined, not decided
against:

- Recording: no pause / resume / cancel; no codec, bitrate, or file-type control.
- No format selection at all — target resolution and fps are not exposed.
- Orientation: only the `orientation` field on `PhotoFile`; upstream has a full
  orientation manager.
- No HDR / dynamic range, stabilization mode, or white balance (modes, gains,
  temperature/tint).
- Photo output is JPEG-only (`UIImageJPEGRepresentation`); no HEIC or container
  choice, and no quality prioritization.
- No low-light boost, distortion correction, mirror mode, or camera calibration
  data.

### Candidates for after 0.3

Not committed, and deliberately none of them architectural:

1. **Pause / resume recording** — the cheapest real gap, and the one most visible
   in a recording UI.
2. **Format selection** (target resolution, fps) — unblocks callers who care
   about payload size, which is the same audience `maxDimension` already serves.
3. **HEIC / photo container format** — meaningful payload reduction on iOS for a
   one-flag change at the capture site.

Orientation is the gap most likely to cause visible bugs, but it is also the most
work and touches both platforms; it belongs with the 1.0 hardening pass that
already lists "verify orientation and output metadata where hosts rotate".

## Explicitly deferred

Filters, barcode scanning, frame processors, RAW capture, GPU pipelines, depth
output, and object detection are not release blockers — all of them are separate
packages upstream too. Evaluate them only after the cross-platform Lynx surface
is stable.

## Known debt

- The package is not configured for Lynx autolinking, so a host still makes one
  bootstrap registration call per platform — now literally one,
  `ChimeraCamera.register()`, which also moved the Android `camera-view`
  behaviors onto `LynxEnv` globally instead of per `LynxViewBuilder`. Getting the
  sources into the build is no longer manual as of `0.0.1` — a podspec covers iOS
  and `android/` is a consumable Gradle module — but discovery is not automated.
  Deferred by decision (2026-07-18, narrowed 2026-07-24 and 2026-07-25); revisit
  as a 1.0 distribution task.

  The remaining manual step is the build config — the Podfile pod, the
  `settings.gradle` include, the `build.gradle` dependency — and that part is not
  automatable at all: no npm package can edit a host's build files, and Lynx has
  no equivalent to React Native's autolinking CLI. A `postinstall` is the wrong
  tool for it too, since pnpm's `strictDepBuilds` blocks dependency build scripts
  by default and `--ignore-scripts` would skip it silently. See the "Why there is
  no setup script" section in [INSTALLATION.md](INSTALLATION.md).

- `ChimeraCamera.register()` ships unverified on both platforms. It is guarded
  only by grep-level surface tests in `tests/version-sync.test.js`, which prove
  the call sites exist and target the global registries but cannot prove they run
  on device. It sits on the startup path for every consumer, so it should be
  exercised through `example/host-ios` before Android is called supported.
- The podspec has passed `pod lib lint` (it resolves Lynx from trunk and
  compiles both native surfaces) but has never been consumed from an actual
  `node_modules` install. `example/host-ios` still compiles the `ios/` sources
  directly via `project.yml`. Verify the pod path against a published tarball
  before telling an external consumer to rely on it.
- The Android Kotlin/CameraX surface is written to the contract and believed
  correct, but has never been compiled or run. Its device/emulator audit was
  deferred at the 0.2→0.3 transition (decision 2026-07-19). Android must not be
  called supported until that audit passes; see
  [docs/android-testing.md](docs/android-testing.md).
