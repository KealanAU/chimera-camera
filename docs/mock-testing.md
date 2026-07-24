# Mock Testing

`@vyui/chimera-camera/mock` provides a dev-only camera adapter for Lynx
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
    "@vyui/chimera-camera": "file:../../chimera-camera"
  }
}
```

After publishing:

```sh
pnpm add @vyui/chimera-camera
```

## Basic Usage

```ts
import { createCameraModule } from '@vyui/chimera-camera'
import { createMockCameraModule } from '@vyui/chimera-camera/mock'
import type { CameraModuleClient } from '@vyui/chimera-camera'

const camera: CameraModuleClient =
  createCameraModule({ optional: true }) ?? createMockCameraModule()

const permissions = await camera.getPermissions()
const photo = await camera.capturePhoto()
```

Or force the mock explicitly:

```ts
import { createCameraModule } from '@vyui/chimera-camera'

const camera = createCameraModule({ mock: true })
```

The default mock returns:

- authorized camera/microphone permissions
- one fake back camera
- one fake front camera
- a small JPEG fixture as `photo.base64`
- mock recording metadata from `startRecording()` / `stopRecording()`

## Custom Fixtures

```ts
import { createMockCameraModule } from '@vyui/chimera-camera/mock'

export const camera = createMockCameraModule({
  permissions: {
    camera: 'authorized',
    microphone: 'denied',
  },
  photo: {
    path: 'mock://test/photo.jpg',
    width: 320,
    height: 280,
    mime: 'image/jpeg',
    base64: '...',
  },
})
```

## Integration Shape

If your app already has a single native-camera boundary module, that boundary can
resolve a real native module first and fall back to the mock in development:

```ts
import { createCameraModule } from '@vyui/chimera-camera'
import { createMockCameraModule } from '@vyui/chimera-camera/mock'
import type { CameraModuleClient } from '@vyui/chimera-camera'

const camera: CameraModuleClient | null =
  createCameraModule({ optional: true }) ??
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
