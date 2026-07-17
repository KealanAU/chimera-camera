# Changelog

All notable changes to Chimera Camera are documented here. Until the API is
stable, prerelease entries may include breaking changes.

## 0.2.0-alpha.0 — Unreleased

- Remove the deprecated `capture(options, callback)` compatibility path.
- Preserve native failure codes with the exported `ChimeraCameraError` class.
- Reject missing native methods with `camera/method-unavailable` instead of
  returning placeholder permission and device results.
- Prefer physical wide-angle cameras for default device selection.

## 0.1.0-alpha.0

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
