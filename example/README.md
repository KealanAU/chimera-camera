# Chimera Camera Example

This example app validates the complete `0.1` application flow: explicit
native/mock detection, capture, JavaScript preview, and a host-provided upload
mutation.

Files:

- `CameraDemo.tsx` — ReactLynx demo for a standard `create-rspeedy` project.
  Copy it in as `src/App.tsx`. This is the one to use with Lynx Go /
  LynxExplorer (see `docs/lynx-explorer.md` for the full quickstart).
- `MockCameraDemo.vue` — the same demo for Vue-based Lynx setups only; it
  will not build in a ReactLynx project.
- `mock-camera-demo.ts` — minimal console-only mock walkthrough.

`CameraDemo` accepts an `uploadPhoto(photo)` prop so the consuming app can wire
its own uploader without coupling this package to a networking library. Its
acceptance flow is:

- Render the native `camera-view` preview.
- Receive its `ready`/`error` events.
- Call `ping()` and `capturePhoto()` imperatively from JavaScript.
- Switch front/back cameras and close/reopen the session.
- Capture through the module-level system camera path.
- Preview a bounded base64 result and pass the same `PhotoFile` to the host's
  upload mutation.

The native element and JS handle for the spike exist
(`ios/ChimeraCameraView.m`, `createCameraViewHandle` from the package root); in
a host app that compiles the iOS sources this looks like:

```tsx
<camera-view id="camera" active={true} bindready={(e) => console.log('ready', e.detail)} />
```

```ts
import { createCameraViewHandle } from '@kealanau/chimera-camera'

const camera = createCameraViewHandle('#camera')
console.log(await camera.ping()) // { ok: true }
```

Preview, capture, front/back switching, and close/reopen were exercised on a
physical iPhone on 2026-07-10. This app remains the manual acceptance target
for the focused iOS checks, future Android parity, video recording, zoom,
torch, and tap-to-focus tracked in `ROADMAP.md`.
