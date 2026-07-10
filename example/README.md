# Chimera Camera Example

This example app exists to validate package integration, not to demonstrate a
finished product UI.

Files:

- `CameraDemo.tsx` — ReactLynx demo for a standard `create-rspeedy` project.
  Copy it in as `src/App.tsx`. This is the one to use with Lynx Go /
  LynxExplorer (see `docs/lynx-explorer.md` for the full quickstart).
- `MockCameraDemo.vue` — the same demo for Vue-based Lynx setups only; it
  will not build in a ReactLynx project.
- `mock-camera-demo.ts` — minimal console-only mock walkthrough.

The first milestone for this app is a native bridge spike:

- Render a placeholder native `camera-view`.
- Call one imperative native method from JavaScript.
- Receive one native event in JavaScript.

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

Once that bridge is proven on iOS and Android, this app should become the manual
acceptance target for preview, permissions, photo capture, video recording,
zoom, torch, and tap-to-focus.
