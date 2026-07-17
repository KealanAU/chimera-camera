# Android Native Sources

These files ship in the npm package so a Lynx host app can compile them into its
Android target.

> **Status: experimental, not device-audited.** The Kotlin/CameraX surface is a
> first cut written to `../docs/native-contract.md` and the iOS behavior. It has
> not been compiled or run. Verify it on an emulator (see
> `../docs/android-testing.md`) before treating Android as working. Each file
> carries an `UNVERIFIED` header noting what to confirm.

Installing `@kealanau/chimera-camera` puts this folder in:

```text
node_modules/@kealanau/chimera-camera/android
```

## Integration (manual — autolink is deferred)

1. Add these sources to the host build: either include this directory as a Gradle
   module, or point a source set at `android/src/main` and add the dependencies
   from `build.gradle` (CameraX + AndroidX lifecycle). Pin `lynx` to the host's
   version.
2. Merge `src/main/AndroidManifest.xml` — the `CAMERA`/`RECORD_AUDIO` permissions,
   the transparent `ChimeraProxyActivity`, and the `FileProvider`. Confirm the
   FileProvider authority (`${applicationId}.chimeracamera.fileprovider`) matches
   the one in `ChimeraProxyActivity`.
3. Register the module and the `camera-view` behavior in the Lynx host:

   ```kotlin
   LynxEnv.inst().registerModule("CameraModule", ChimeraCameraModule::class.java)

   val builder = LynxViewBuilder()
   ChimeraCameraBehaviors.behaviors().forEach { builder.addBehavior(it) }
   ```

## Sources

- `ChimeraCameraModule.kt` — the `CameraModule` native module (version,
  permissions, device discovery, system-camera capture, photo pick).
- `ChimeraCameraView.kt` — the CameraX-backed `camera-view` element (preview,
  `ping`, `capturePhoto`, ready/error events).
- `ChimeraCameraBehaviors.kt` — `camera-view` registration for the host.
- `ChimeraProxyActivity.kt` — Activity-scoped glue for permission requests and
  system camera/picker intents (the least-verified path; the `camera-view` path
  needs none of it).
- `PhotoEncoder.kt` — shared JPEG post-processing so module and view captures
  return an identical `PhotoFile` shape.

The Android implementation should match `../docs/native-contract.md` and may port
CameraX concepts from the upstream VisionCamera reference under
`../upstream/vision-camera`. Real-device acceptance is tracked in `../ROADMAP.md`.
