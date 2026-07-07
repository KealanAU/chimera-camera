# Mock Testing

`@kealanau/lynx-camera/mock` provides a dev-only camera adapter for Lynx
Explorer, web preview, tests, and apps that have not wired native iOS/Android
camera code yet.

The mock is intentionally plain TypeScript. It does not render native preview,
request OS permissions, or touch device hardware. It mirrors the JS-facing V1
contract so app flows can be tested before native integration.

## Install Locally

During early development, link the package from the local workspace:

```json
{
  "dependencies": {
    "@kealanau/lynx-camera": "file:../../lynx-camera"
  }
}
```

After an alpha publish:

```sh
pnpm add @kealanau/lynx-camera@alpha
```

## Basic Usage

```ts
import { getNativeCameraModule } from '@kealanau/lynx-camera'
import { createMockCameraModule } from '@kealanau/lynx-camera/mock'
import type { CameraAdapter } from '@kealanau/lynx-camera'

const camera: CameraAdapter =
  getNativeCameraModule<CameraAdapter>() ?? createMockCameraModule()

const permissions = await camera.getPermissions()
const photo = await camera.capturePhoto()
```

Or use the package adapter helper:

```ts
import { createCameraAdapter } from '@kealanau/lynx-camera'

const camera = createCameraAdapter({ mock: true })
```

The default mock returns:

- authorized camera/microphone permissions
- one fake back camera
- one fake front camera
- a small JPEG fixture as `photo.base64`
- mock recording metadata from `startRecording()` / `stopRecording()`

## Custom Fixtures

```ts
import { createMockCameraModule } from '@kealanau/lynx-camera/mock'

export const camera = createMockCameraModule({
  permissions: {
    camera: 'authorized',
    microphone: 'denied',
  },
  photo: {
    path: 'mock://consumer-app/test-photo.jpg',
    width: 320,
    height: 280,
    mime: 'image/jpeg',
    base64: '...',
  },
})
```

## the consuming app Integration Shape

the consuming app already has a boundary at `app/src/native/camera.ts`. During migration,
that boundary can resolve a real native module first and fall back to the mock in
development:

```ts
import { getNativeCameraModule } from '@kealanau/lynx-camera'
import { createMockCameraModule } from '@kealanau/lynx-camera/mock'
import type { CameraAdapter } from '@kealanau/lynx-camera'

const camera =
  getNativeCameraModule<CameraAdapter>() ??
  (import.meta.env.DEV ? createMockCameraModule() : null)
```

Production apps should not silently use the mock unless that is an intentional
product fallback.

## Native Still Required For Device Testing

The mock proves JS app flows. Real iPhone testing still requires the host app to:

- compile the package's `ios/` files into the app target
- register the native Lynx module/view
- add `NSCameraUsageDescription`
- test on a physical device
