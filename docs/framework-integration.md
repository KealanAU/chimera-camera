# Framework Integration: the `camera-view` element and SelectorQuery contract

Chimera Camera's core is framework-neutral. A Lynx app — React, Vue, Svelte, or
plain TypeScript — drives the live camera through exactly two primitives:

1. **A custom element**, `<camera-view>`, configured with props and `bind*`
   events. This is the preview and the session.
2. **Imperative methods** on that element, called through Lynx's SelectorQuery
   bridge and wrapped by `createCameraViewHandle(selector)`.

That is the whole live-session surface; there is no React (or Vue, or Svelte)
dependency in the core. Module operations — permissions, device discovery,
system-camera capture, photo picking — are a separate surface that needs no
rendered element (see the README "Surface ownership" section).

## The custom element

The native layer registers one element under the tag **`camera-view`** (exported
from the package as `CAMERA_VIEW_TAG`). Render it like any Lynx element and give
it a stable `id` so imperative calls can find it.

### Props

| Prop         | Type                              | Default   | Notes                                    |
| ------------ | --------------------------------- | --------- | ---------------------------------------- |
| `active`     | boolean                           | `false`   | No camera session until `true`.          |
| `facing`     | `'front' \| 'back' \| 'external'` | `'back'`  | Which camera to open.                    |
| `cameraId`   | string                            | unset     | Explicit device; `facing`-based for now. |
| `resizeMode` | `'cover' \| 'contain'`            | `'cover'` | Fill/crop vs. fit/letterbox.             |
| `torch`      | `'on' \| 'off'`                   | `'off'`   | Session control (0.3).                   |
| `zoom`       | number                            | `1`       | Session control (0.3).                   |
| `enableAudio`| boolean                           | `false`   | Recording audio (0.3).                   |

Defaults are applied **natively** (see [native-contract.md](native-contract.md)),
so an unset prop behaves the same on every platform and every framework.

### Events

The element emits events using Lynx's `bind<event>` convention. The payload
arrives on `event.detail`.

| Binding                 | `event.detail`               | Status      |
| ----------------------- | ---------------------------- | ----------- |
| `bindready`             | `{ deviceId: string }`       | implemented |
| `binderror`             | `{ code: string, message }`  | implemented |
| `bindrecordingstarted`  | `{ path?: string }`          | 0.3         |
| `bindrecordingfinished` | `{ file: VideoFile }`        | 0.3         |

`binderror` carries the same `code` values as the imperative errors below.

## The imperative (SelectorQuery) contract

Preview is declarative; actions are imperative. `createCameraViewHandle(selector)`
returns a typed `CameraViewMethods` object whose methods each round-trip to the
native element through Lynx's SelectorQuery:

```ts
import { createCameraViewHandle } from '@vyui/chimera-camera'

const camera = createCameraViewHandle('#camera')
await camera.ping()                 // { ok: true } once the bridge is live
const photo = await camera.capturePhoto({ maxDimension: 1600 })
```

Under the hood every call is the same SelectorQuery shape:

```ts
lynx
  .createSelectorQuery()
  .select(selector)                 // '#camera'
  .invoke({
    method,                         // 'capturePhoto', 'ping', 'startRecording', …
    params,                         // the options object, or {}
    success: (result) => …,         // resolves the promise
    fail: (error) => …,             // rejected as a ChimeraCameraError
  })
  .exec()
```

Method surface (`CameraViewMethods`): `ping`, `capturePhoto`, `startRecording`,
`stopRecording`, `focusAtPoint`, `setZoom`, `setTorch`. iOS implements `ping` and
`capturePhoto` today; the rest land with the 0.3 recording/controls work.

### Errors

Native failures reach JS as `ChimeraCameraError` with a stable `.code` (e.g.
`capture/not-active`, `camera/permission-denied`). String codes are preserved;
numeric Lynx transport codes normalize to `camera/native-error`. The full table
is in [native-contract.md](native-contract.md). Outside a Lynx runtime (no
`lynx.createSelectorQuery`) the calls reject with an actionable error instead of
hanging — use the `/mock` adapter in web previews and unit tests.

## Framework bindings are thin

Because the element plus the SelectorQuery contract is the entire surface, a
framework binding is just: render `<camera-view>` with the right props/events,
and call `createCameraViewHandle('#id')` for actions. No framework runtime lives
in the core, and helpers are added only where a framework's lifecycle genuinely
requires one.

### ReactLynx

```tsx
import { createCameraViewHandle } from '@vyui/chimera-camera'

<camera-view
  id="camera"
  active={true}
  facing="back"
  resizeMode="cover"
  bindready={(e) => console.log('ready', e.detail.deviceId)}
  binderror={(e) => console.warn(e.detail?.message)}
  style={{ width: '100%', height: '320px' }}
/>

// later, in a handler:
const photo = await createCameraViewHandle('#camera').capturePhoto()
```

See `example/react/src/App.tsx` for a complete ReactLynx flow (run it with
`pnpm --filter @chimera-camera/react run dev`).

### Vue, Svelte, and plain TypeScript

The same element and the same `createCameraViewHandle('#camera')` calls apply
unchanged. Each framework renders `<camera-view>` and binds its `ready`/`error`
events with its own template syntax, then calls the identical imperative handle
for actions. The per-framework demo shells that pin each framework's exact syntax
and prove behavioral parity are the remaining 0.3 "framework-neutral acceptance"
work (see [ROADMAP.md](ROADMAP.md)); the contract they all bind to is the one on
this page.

## Displaying and uploading results

`capturePhoto()` and (in 0.3) `stopRecording()` return native file paths, not
base64 by default. See [output-transport.md](output-transport.md) for how to
display, upload, and clean up those files.
