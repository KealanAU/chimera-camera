# LynxExplorer / Lynx Go Testing

LynxExplorer and Lynx Go can test the JavaScript and UI flow, but they cannot
compile and register native Swift/Kotlin source from an npm package at
runtime. The camera these hosts use to scan QR codes is their own compiled-in
feature — it is not reachable from your card's JavaScript.

Because of that, `createCameraAdapter()` without options **throws** in these
hosts, with a message listing the native setup steps and pointing at the mock.
When debugging on device, render `getCameraInstallStatus().code` into your UI
— console logs are only visible with Lynx DevTool connected.

Use these hosts with the mock adapter first:

```ts
import { createCameraAdapter } from '@kealanau/lynx-camera'

const camera = createCameraAdapter({ mock: true })
```

The install checker also reports mock mode:

```ts
import { getCameraInstallStatus } from '@kealanau/lynx-camera'

console.log(getCameraInstallStatus({ mock: true }))
```

This lets an app visualize:

- camera availability
- permission states
- fake front/back devices
- capture button states
- mock photo metadata
- upload/preview flows that depend on a captured photo

For a visual starting point, copy or adapt:

```text
node_modules/@kealanau/lynx-camera/example/MockCameraDemo.vue
```

The demo shows the recommended host-detection pattern: it renders the
install-status badge and message on screen, uses the real camera when the
native module is registered, and falls back to the mock (visibly) on hosts
like Lynx Go.

Real iPhone camera testing requires a custom iOS Lynx host app that compiles the
package's `ios/` files, registers `LynxCameraModule`, and includes camera
permission keys in `Info.plist`.

## Recommended Test Order

1. LynxExplorer + mock adapter.
2. the consuming app app flow with mock capture.
3. Custom iOS host with `ios/LynxCameraModule.swift` registered.
4. Real iPhone system-camera capture through `CameraModule.capturePhoto`.
5. Later: native `camera-view` live preview once that component exists.
