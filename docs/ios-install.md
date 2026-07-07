# iOS Install

The npm package ships JavaScript and native source. Installing it puts the iOS
files on disk, but the Lynx host app still needs to compile and register them.

## Required Host Steps

1. Install the package:

   ```sh
   pnpm add @kealanau/lynx-camera@alpha
   ```

2. Add the package's `ios/` files to the iOS app target:

   - `LynxCameraModule.swift` — the `CameraModule` native module.
   - `LynxCameraView.h` + `LynxCameraView.m` — the `camera-view` element
     (bridge spike). It self-registers via `LYNX_LAZY_REGISTER_UI` when
     compiled into the target; no bootstrap call needed.

3. Add camera permissions to `Info.plist`:

   ```xml
   <key>NSCameraUsageDescription</key>
   <string>This app needs camera access to capture photos.</string>
   <key>NSMicrophoneUsageDescription</key>
   <string>This app needs microphone access to record videos.</string>
   ```

4. Register the native module in the Lynx bootstrap.

   The Swift class is `LynxCameraModule`, and it registers itself to JavaScript
   as `CameraModule`.

   ```swift
   let config = LynxConfig(provider: templateProvider)
   config.register(LynxCameraModule.self)
   ```

The exact bootstrap location depends on the host app's Lynx setup. V1 will keep
this manual until Lynx has a standard native package autolinking story.

## Verify Registration

From JavaScript:

```ts
import {
  assertCameraInstalledAsync,
  getCameraInstallStatusAsync,
} from '@kealanau/lynx-camera'

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
import { createCameraViewHandle } from '@kealanau/lynx-camera'

const camera = createCameraViewHandle('#camera')
console.log(await camera.ping()) // { ok: true }
```

## Testing

Use a physical iPhone for camera validation. The mock adapter is for JS flow
testing only.

LynxExplorer can use the mock adapter, but it cannot compile and register the
Swift files from this package at runtime.
