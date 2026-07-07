# LynxExplorer Testing

LynxExplorer can test the JavaScript and UI flow, but it cannot compile and
register native Swift/Kotlin source from an npm package at runtime.

Use LynxExplorer with the mock adapter first:

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

Real iPhone camera testing requires a custom iOS Lynx host app that compiles the
package's `ios/` files, registers `LynxCameraModule`, and includes camera
permission keys in `Info.plist`.

## Recommended Test Order

1. LynxExplorer + mock adapter.
2. the consuming app app flow with mock capture.
3. Custom iOS host with `ios/LynxCameraModule.swift` registered.
4. Real iPhone system-camera capture through `CameraModule.capturePhoto`.
5. Later: native `camera-view` live preview once that component exists.
