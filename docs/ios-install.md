# iOS Install

The npm package ships JavaScript and native source. Installing it puts the iOS
files on disk; a CocoaPods line compiles them into the host, and one bootstrap
line registers the module.

## Required Host Steps

1. Install the package:

   ```sh
   pnpm add @kealanau/chimera-camera
   ```

2. Add the pod to the host `Podfile`:

   ```ruby
   target 'YourApp' do
     # Needed so ChimeraCameraModule.swift can `import Lynx`.
     use_modular_headers!

     pod 'Lynx', '3.9.0', :subspecs => ['Framework']   # your Lynx pin
     pod 'ChimeraCamera', :path => '../node_modules/@kealanau/chimera-camera'
   end
   ```

   Then `pod install`. The path is relative to the `Podfile`; adjust it for your
   project layout. The podspec leaves its `Lynx` dependency unpinned so it
   resolves to whatever version you pin above, and it adds `-ObjC` to your
   target's linker flags so `<camera-view>` survives a static-library build.

   The pod compiles both native surfaces:

   - `ChimeraCameraModule.swift` — the `CameraModule` native module.
   - `ChimeraCameraView.h` + `ChimeraCameraView.m` — the `camera-view` element.
     It self-registers via `LYNX_LAZY_REGISTER_UI`; no bootstrap call needed.

   Not using CocoaPods? Add those three files from
   `node_modules/@kealanau/chimera-camera/ios` to your app target directly —
   that is all the pod does.

3. Add camera permissions to `Info.plist`:

   ```xml
   <key>NSCameraUsageDescription</key>
   <string>This app needs camera access to capture photos.</string>
   <key>NSMicrophoneUsageDescription</key>
   <string>This app needs microphone access to record videos.</string>
   <!-- Only if you call saveToLibrary() to save captures to Photos. -->
   <key>NSPhotoLibraryAddUsageDescription</key>
   <string>This app saves photos and videos you capture to your library.</string>
   ```

4. Register the native module in the Lynx bootstrap.

   The Swift class is `ChimeraCameraModule`, and it registers itself to JavaScript
   as `CameraModule`.

   ```swift
   let config = LynxConfig(provider: templateProvider)
   config.register(ChimeraCameraModule.self)
   ```

The exact bootstrap location depends on the host app's Lynx setup. That one
`config.register` line is the only hand-wiring left; Lynx has no autolinking, so
nothing can discover the module for you (see `ROADMAP.md`).

## Verify Registration

From JavaScript:

```ts
import {
  assertCameraInstalledAsync,
  getCameraInstallStatusAsync,
} from '@kealanau/chimera-camera'

const status = await getCameraInstallStatusAsync()
console.log(status)

await assertCameraInstalledAsync()
```

If the Swift file is not compiled or the module is not registered, the package
throws a targeted error that lists the missing iOS setup steps.

To verify the `camera-view` bridge spike, render the element and ping it:

```tsx
<camera-view id="camera" active={true} bindready={(e) => console.log('ready', e.detail)} />
```

```ts
import { createCameraViewHandle } from '@kealanau/chimera-camera'

const camera = createCameraViewHandle('#camera')
console.log(await camera.ping()) // { ok: true }
```

## Testing

Use a physical iPhone for camera validation. The mock adapter is for JS flow
testing only.

LynxExplorer can use the mock adapter, but it cannot compile and register the
Swift files from this package at runtime.
