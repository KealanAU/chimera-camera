# Android Install

The npm package ships JavaScript and native source. Installing it puts the
Android files on disk, but the Lynx host app still needs to compile and register
them.

## Required Host Steps

1. Install the package:

   ```sh
   pnpm add @kealanau/chimera-camera@alpha
   ```

2. Add the package's `android/` source to the host app build.

3. Add permissions to `AndroidManifest.xml`:

   ```xml
   <uses-permission android:name="android.permission.CAMERA" />
   <uses-permission android:name="android.permission.RECORD_AUDIO" />
   <uses-feature android:name="android.hardware.camera" android:required="false" />
   ```

4. Register the native module/view in the Lynx host app.

V1 keeps this manual until Lynx has a standard native package autolinking story.

## Testing

Use a physical Android device for camera validation. The mock adapter is for JS
flow testing only.
