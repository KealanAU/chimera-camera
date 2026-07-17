# LynxExplorer / Lynx Go Testing

LynxExplorer and Lynx Go can test the JavaScript and UI flow, but they cannot
compile and register native Swift/Kotlin source from an npm package at
runtime. The camera these hosts use to scan QR codes is their own compiled-in
feature — it is not reachable from your card's JavaScript.

Because of that, `createCameraAdapter()` without options **throws** in these
hosts, with a message listing the native setup steps and pointing at the mock.
When debugging on device, render `getCameraInstallStatus().code` into your UI
— console logs are only visible with Lynx DevTool connected.

## Run The Demo In Lynx Go

Lynx Go does not load source files directly — it loads a compiled bundle from
a dev server. The path that works end to end:

```sh
# 1. Create a standard ReactLynx project (if you don't have one)
pnpm create rspeedy@latest camera-demo
cd camera-demo

# 2. Install this package. It is NOT on npm yet — use the local tarball:
pnpm add /path/to/chimera-camera/kealanau-chimera-camera-0.2.0-alpha.0.tgz

# 3. Replace src/App.tsx with the ReactLynx demo:
cp node_modules/@kealanau/chimera-camera/example/CameraDemo.tsx src/App.tsx

# 4. Start the dev server and scan its QR code with Lynx Go
pnpm dev
```

Requirements for the QR step: the phone and computer must be on the same
Wi-Fi network, and macOS's firewall must allow incoming connections for the
dev server. If scanning does nothing, open the bundle URL shown by `pnpm dev`
in the phone browser to check reachability.

Expected result on Lynx Go: an orange `MOCK ADAPTER` badge,
`Install: native-module-missing`, the full explanation box, and a working
mock capture. A green `NATIVE CAMERA` badge only appears in a custom host
app that compiles this package's `ios/` sources.

`example/MockCameraDemo.vue` targets the separate, pre-alpha Vue Lynx scaffold
created with `npm create vue-lynx@latest`. It is not verified by this package.
A standard `create-rspeedy` project is ReactLynx and uses `CameraDemo.tsx`.

## Mock Adapter Basics

Use these hosts with the mock adapter first:

```ts
import { createCameraAdapter } from '@kealanau/chimera-camera'

const camera = createCameraAdapter({ mock: true })
```

The install checker also reports mock mode:

```ts
import { getCameraInstallStatus } from '@kealanau/chimera-camera'

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
node_modules/@kealanau/chimera-camera/example/CameraDemo.tsx      (ReactLynx — standard)
node_modules/@kealanau/chimera-camera/example/MockCameraDemo.vue  (pre-alpha Vue Lynx target)
```

Both show the host-detection pattern, but only the ReactLynx example is the
standard verified path. No Svelte-on-Lynx example is currently provided.

Real iPhone camera testing requires a custom iOS Lynx host app that compiles the
package's `ios/` files, registers `ChimeraCameraModule`, and includes camera
permission keys in `Info.plist`.

## Recommended Test Order

1. LynxExplorer + mock adapter.
2. the consuming app app flow with mock capture.
3. Custom iOS host with `ios/ChimeraCameraModule.swift` registered.
4. Real iPhone system-camera capture through `CameraModule.capturePhoto`.
5. Native `camera-view` live preview, front/back switching, close/reopen, and
   view-session capture. These core behaviors were first exercised on a
   physical iPhone on 2026-07-10; remaining cases live in `ROADMAP.md`.
