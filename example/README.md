# Chimera Camera Example

This example app validates the complete `0.1` application flow: explicit
native/mock detection, capture, JavaScript preview, and a host-provided upload
mutation.

Files:

- `CameraDemo.tsx` — ReactLynx page driving the native `camera-view` surface
  (preview, `ready`/`error`, `ping()`, `capturePhoto()`, front/back switch,
  close/reopen). Copy it in as `src/App.tsx` for a standard `create-rspeedy`
  project; this is the one to use with Lynx Go / LynxExplorer (see
  `docs/lynx-explorer.md`). iOS device-proven.
- `CameraDemo.vue` — Vue Lynx port of the same page, driving the **same**
  `camera-view` element and `createCameraViewHandle` contract with no React
  dependency — the 0.3 framework-portability proof. **Unverified**: written
  against `npm create vue-lynx@latest`, not yet built or run.
- `MockCameraDemo.vue` — module-only Vue demo (mock/system `capturePhoto`, no
  rendered `camera-view`). The minimal Vue + mock walkthrough.
- `mock-camera-demo.ts` — minimal console-only mock walkthrough.

There is no Svelte-on-Lynx page; it is gated on a maintained Svelte-on-Lynx
toolchain (see `ROADMAP.md`).

## The 0.3 Sparkling shell

The framework-portability harness is one Sparkling app hosting both page bundles
so they share a single native camera registration:

```
sparkling-app/
  react/    -> entry mounts CameraDemo.tsx   (ReactLynx build)
  vue/      -> entry mounts CameraDemo.vue    (Vue Lynx build)
  native/   -> registers CameraModule + camera-view once, shared by both
```

Sparkling owns the native shell and routing; each framework keeps its own build
entry and consumes the same `@kealanau/chimera-camera` package and the same
registered native surface. Both page bundles are scaffolded here; standing up the
Sparkling host and running the two bundles needs the Lynx toolchain and is the
remaining 0.3 acceptance step.

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
