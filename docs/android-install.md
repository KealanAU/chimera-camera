# Android Install

The npm package ships JavaScript and native source. Installing it puts the
Android files on disk; the shipped `android/` folder is a complete
`com.android.library` Gradle module, so the host includes it and registers the
surfaces.

## Required Host Steps

1. Install the package:

   ```sh
   pnpm add @vyui/chimera-camera
   ```

2. Include the shipped Gradle module. In `settings.gradle`:

   ```gradle
   include ':chimera-camera'
   project(':chimera-camera').projectDir =
       new File(rootProject.projectDir, '../node_modules/@vyui/chimera-camera/android')
   ```

   In the app module's `build.gradle`:

   ```gradle
   dependencies {
       implementation project(':chimera-camera')
   }
   ```

   The module declares `lynx` as `compileOnly`, so it links against whatever
   Lynx version the host app already ships. Adjust the `projectDir` path for
   your project layout.

3. Nothing to add to your `AndroidManifest.xml`. The module ships its own, and
   the manifest merger folds in the `CAMERA`/`RECORD_AUDIO` permissions, the
   transparent `ChimeraProxyActivity`, and the FileProvider
   (`${applicationId}.chimeracamera.fileprovider`) for you.

4. Register the native module and the `camera-view` behavior in the Lynx host:

   ```kotlin
   LynxEnv.inst().registerModule("CameraModule", ChimeraCameraModule::class.java)

   val builder = LynxViewBuilder()
   ChimeraCameraBehaviors.behaviors().forEach { builder.addBehavior(it) }
   ```

Those registration calls are the only hand-wiring left; Lynx has no autolinking,
so nothing can discover the surfaces for you (see `ROADMAP.md`).

## Testing

Use a physical Android device for camera validation. The mock adapter is for JS
flow testing only.
