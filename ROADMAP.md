# Roadmap

This is the single source of truth for project status, release gates, working
tasks, and known debt. Do not create separate TODO or per-version checklist
files; update this document when implementation or device evidence changes.

[V0.md](V0.md) defines the current `0.1.x` behavior. [V1.md](V1.md) defines the
target native `camera-view` contract. [README.md](README.md) explains the
project and architecture without duplicating the working checklist here.

Last reconciled: 2026-07-10.

## Current checkpoint

Chimera Camera is at the end of the iOS `0.1` implementation and partway
through physical-device acceptance. It is no longer just a bridge placeholder:
the repository contains a real AVFoundation preview and view-session photo
capture. Android, autolinking, recording, and native camera controls have not
started.

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

## 0.1 — Device-proven iOS alpha (current)

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
- [ ] Build the the consuming app capture → preview → upload flow against
      `createCameraAdapter({ mock: true })`.
- [ ] Expose `getCameraInstallStatus()` in the app so native versus mock use is
      explicit rather than an invisible fallback.

### Distribution follow-up (not an implementation gate)

- [ ] Verify ownership of the `@kealanau` npm scope.
- [ ] Create an npm Automation token and add it as the `NPM_TOKEN` repository
      secret.
- [x] Add `npm test` to `.github/workflows/release.yml` before publishing.
- [ ] Publish with the `alpha` dist-tag and label the release iOS-only.
- [ ] Install the published artifact in a clean host and repeat the basic flow.
- [x] Add `CHANGELOG.md`.

### 0.1 exit criteria

The iOS module, native element, preview, front/back switching, close/reopen,
and both capture paths work on a physical iPhone; capture results feed the
preview/upload boundary and current limitations are explicit.

## 0.2 — Autolinked package and Android photo parity

**Goal:** installing the npm package gives a Lynx host discoverable native
modules/elements on both platforms, with the same photo contract on iOS and
Android.

### Lynx native-library packaging

- [ ] Migrate to Lynx native-library/autolink conventions using tooling from
      the same Lynx release channel as the consuming app.
- [ ] Add generated/spec inputs and iOS/Android package metadata for
      `CameraModule` and `camera-view` discovery.
- [ ] Prove a clean host can install the package and discover both native
      surfaces without copying sources or registering them by hand.
- [ ] Update install, publishing, platform, and npm documentation for the
      autolinked flow.
- [ ] Retain useful install/version diagnostics for absent, stale, or
      mismatched native builds.

### Android module and element

- [ ] Kotlin `CameraModule`: permissions, device discovery, native version,
      system capture, and photo picking where supported by the contract.
- [ ] Add Kotlin/native-version coverage to the synchronization tests.
- [ ] Register `camera-view` with bridge `ping()` and `ready`/`error` events.
- [ ] Implement CameraX live preview with iOS-equivalent `active`, `facing`,
      and `resizeMode` behavior.
- [ ] Implement CameraX view-session photo capture with matching `PhotoFile`
      semantics and error codes.
- [ ] Compile in a real Android Lynx host and pass the flow on a physical
      device.

### Clarify the framework-neutral core

- [ ] Keep the root package free of React, Vue, and Svelte runtime imports.
- [ ] Make ownership explicit: permissions/device discovery/photo picking are
      module operations; capture/recording/focus/zoom/torch belong to a
      rendered `CameraViewHandle` session.
- [ ] Decide how to deprecate the V0 combined `CameraAdapter` before adding
      more view-session controls.
- [ ] Preserve structured native error codes in JavaScript instead of reducing
      failures to message-only `Error` objects.
- [ ] Normalize prop defaults, result/event shapes, and unsupported-feature
      errors across iOS and Android.

### 0.2 cleanup

- [ ] Remove the deprecated legacy `capture(options, callback)` fallback and
      `legacy-capture-only` install status.
- [ ] Replace soft degradation for missing native methods with documented,
      coded behavior.
- [ ] Prefer the plain wide-angle device in `getDefaultCamera()` rather than
      relying on discovery order.

### 0.2 exit criteria

A clean iOS or Android Lynx host can install and autolink the package, render a
preview, and capture a photo through the same framework-independent contract.

## 0.3 — Complete view sessions and prove framework portability

**Goal:** complete the useful session controls on both platforms and prove
that React, Vue, and Svelte Lynx consumers drive the same native element and
imperative TypeScript API.

### Recording and controls

- [ ] Implement `startRecording()` / `stopRecording()` with real `VideoFile`
      results on iOS and Android.
- [ ] Honor `enableAudio` and check microphone permission before recording.
- [ ] Emit normalized recording-started and recording-finished events.
- [ ] Implement clamped zoom, torch with unsupported-device errors, and
      focus-at-point where supported.
- [ ] Revisit output orientation when a non-portrait host consumes the view.

### Framework-neutral acceptance

- [ ] ReactLynx example exercises the complete native view surface.
- [ ] Vue-on-Lynx example performs the same flow without a React dependency.
- [ ] Svelte-on-Lynx example performs the same flow without React/Vue runtime
      dependencies.
- [ ] Plain TypeScript documentation explains the underlying custom element,
      events, and SelectorQuery contract.
- [ ] Keep framework helpers thin and optional; add them only where lifecycle
      differences require them.
- [ ] Add contract tests asserting equivalent normalized behavior through each
      binding.

### Output transport

- [ ] Settle how apps display and upload native photo/video paths without
      making multi-megabyte base64 strings the default bridge payload.
- [ ] Document file lifetime and cleanup ownership, with explicit base64 and
      `maxDimension` fallback guidance where native paths cannot be consumed.

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

## Explicitly deferred

Filters, barcode scanning, frame processors, RAW capture, GPU pipelines, and
VisionCamera feature parity are not release blockers. Evaluate them only after
the cross-platform Lynx surface is stable.

## Known debt

- `createNativeCameraAdapter()` soft-degrades when individual native methods
  are missing; callers must opt into install checks to notice partial hosts.
- Native coded errors are currently flattened to ordinary JS `Error` messages.
- `getDefaultCamera()` can select a dual/triple virtual camera before the plain
  wide-angle camera because it trusts discovery order.
- The package is not yet configured for Lynx autolinking, so current native
  installation still requires manual host integration.
