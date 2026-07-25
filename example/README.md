# Chimera Camera Example

This example app validates the complete `0.1` application flow: explicit
native/mock detection, capture, JavaScript preview, and a host-provided upload
mutation.

> Reading this from the npm tarball instead of the repo? Each app's
> `package.json` depends on `"@vyui/camera": "workspace:*"`, which
> only resolves inside this repo's pnpm workspace. Swap it for the published
> version you installed (e.g. `"^0.0.1"`) before running an install.
> The `pnpm --filter` commands below are likewise repo-local.

Files:

- `shared/` — the framework-free half of the demo, imported verbatim by both
  apps so their `App` files are only state, handlers, and markup:
  `camera-core.ts` (module/mock wiring, screen probe, zoom-arc geometry,
  exposure math), `camera-styles.ts` (the glass UI's style objects) and
  `camera-element.ts` (the `<camera-view>` element's props, declared once for
  both ReactLynx JSX and Vue templates).
- `react/` — a runnable ReactLynx app (rspeedy). Its `src/App.tsx` drives the
  full `camera-view` surface (preview, `ready`/`error`, `ping()`,
  `capturePhoto()`, front/back switch, close/reopen, plus recording, zoom, torch,
  and focus), falling back to the mock adapter in hosts without native camera —
  so the session controls are exercisable end-to-end against the mock in Lynx Go.
  Run it with `pnpm --filter @chimera-camera/react run dev` and scan the QR code
  with Lynx Go / LynxExplorer (see `docs/lynx-explorer.md`). iOS device-proven.
- `vue/` — a runnable Vue Lynx app (`vue-lynx` + rspeedy). Its `src/App.vue` is a
  line-for-line port of `react/src/App.tsx` — same glass camera UI, driving the
  **same** `camera-view` element and `createCameraViewHandle` contract with no
  React dependency — the 0.3 framework-portability proof. Run it with
  `pnpm --filter @chimera-camera/vue run dev`. Boots and compiles in mock mode;
  the native-backed flow needs a host, same as React.
- `host-ios/` — the native iOS Lynx host that compiles the package's `ios/`
  sources and loads either bundle above from its dev server, so `camera-view` and
  `CameraModule` run for real on a device. `cd host-ios && ./setup.sh`, then open
  the workspace in Xcode. See `host-ios/README.md`.

There is no Svelte-on-Lynx page; it is gated on a maintained Svelte-on-Lynx
toolchain (see `ROADMAP.md`).

Both apps typecheck against the real Lynx element types (`@lynx-js/types`):
`pnpm run typecheck:examples` from the repo root, or
`pnpm --filter @chimera-camera/{react,vue} run typecheck` for one of them (Vue
runs `vue-tsc`, so templates are checked too).

## The 0.3 Sparkling shell

The framework-portability harness is one Sparkling app hosting both page bundles
so they share a single native camera registration:

```
sparkling-app/
  react/    -> mounts react/src/App.tsx    (ReactLynx build — runnable today)
  vue/      -> mounts vue/src/App.vue       (Vue Lynx build — runnable today)
  native/   -> registers CameraModule + camera-view once, shared by both
```

Sparkling owns the native shell and routing; each framework keeps its own build
entry and consumes the same `@vyui/camera` package and the same
registered native surface. Both bundles are runnable rspeedy apps today
(`pnpm --filter @chimera-camera/react run dev`,
`pnpm --filter @chimera-camera/vue run dev`) and each drives the same core with
its own framework. What remains is folding them under a single *shared* native
registration in one Sparkling host — the remaining 0.3 acceptance step.

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
import { createCameraViewHandle } from '@vyui/camera'

const camera = createCameraViewHandle('#camera')
console.log(await camera.ping()) // { ok: true }
```

Preview, capture, front/back switching, and close/reopen were exercised on a
physical iPhone on 2026-07-10. This app remains the manual acceptance target
for the focused iOS checks, future Android parity, video recording, zoom,
torch, and tap-to-focus tracked in `ROADMAP.md`.
