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

## Integration

This directory is a complete `com.android.library` module, so the host includes
it rather than copying sources. Full steps:
[../docs/android-install.md](../docs/android-install.md).

1. In the host's `settings.gradle`:

   ```gradle
   include ':chimera-camera'
   project(':chimera-camera').projectDir =
       new File(rootProject.projectDir, '../node_modules/@kealanau/chimera-camera/android')
   ```

   then `implementation project(':chimera-camera')` in the app module. `lynx` is
   `compileOnly` here, so it links against the host's own Lynx.
2. Nothing to merge by hand — the manifest merger pulls in
   `src/main/AndroidManifest.xml` (the `CAMERA`/`RECORD_AUDIO` permissions, the
   transparent `ChimeraProxyActivity`, and the `FileProvider` authority
   `${applicationId}.chimeracamera.fileprovider`).
3. Register the module and the `camera-view` behavior in the Lynx host — Lynx
   has no autolinking, so this call is yours to make:

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
