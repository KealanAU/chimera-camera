# LynxExplorer / Lynx Go Testing

LynxExplorer and Lynx Go can test the JavaScript and UI flow, but they cannot
compile and register native Swift/Kotlin source from an npm package at
runtime. The camera these hosts use to scan QR codes is their own compiled-in
feature — it is not reachable from your card's JavaScript.

Because of that, `createCameraModule()` without options **throws** in these
hosts, with a message listing the native setup steps and pointing at the mock.
When debugging on device, render `getCameraInstallStatus().code` into your UI
— console logs are only visible with Lynx DevTool connected.

## Run The Demo In Lynx Go

Lynx Go does not load source files directly — it loads a compiled bundle from
a dev server.

**From this repo** (contributors): the runnable ReactLynx app already lives at
`example/react`. Build the package once, then start its dev server:

```sh
pnpm install
pnpm --filter @vyui/chimera-camera run build
pnpm --filter @chimera-camera/react run dev   # scan the QR code with Lynx Go
```

**From your own project** (consuming the published package):

```sh
# 1. Create a standard ReactLynx project (if you don't have one)
pnpm create rspeedy@latest camera-demo
cd camera-demo

# 2. Install this package. It is NOT on npm yet — use the local tarball:
pnpm add /path/to/chimera-camera/vyui-chimera-camera-0.0.1.tgz

# 3. Replace src/App.tsx with the ReactLynx demo:
cp node_modules/@vyui/chimera-camera/example/react/src/App.tsx src/App.tsx

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

A standard `create-rspeedy` project is ReactLynx and uses the demo at
`example/react/src/App.tsx`. For a Vue Lynx scaffold (`npm create
vue-lynx@latest`), use `example/vue/src/App.vue` instead — it drives the same
contract through the same `example/shared/camera-core.ts`.

## Mock Adapter Basics

Use these hosts with the mock adapter first:

```ts
import { createCameraModule } from '@vyui/chimera-camera'

const camera = createCameraModule({ mock: true })
```

The install checker also reports mock mode:

```ts
import { getCameraInstallStatus } from '@vyui/chimera-camera'

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
node_modules/@vyui/chimera-camera/example/react/src/App.tsx      (ReactLynx — standard)
node_modules/@vyui/chimera-camera/example/vue/src/App.vue        (Vue Lynx)
node_modules/@vyui/chimera-camera/example/shared/camera-core.ts  (shared by both)
```

Both show the host-detection pattern, but only the ReactLynx example is the
standard verified path. No Svelte-on-Lynx example is currently provided.

Real iPhone camera testing requires a custom iOS Lynx host app that compiles the
package's `ios/` files, registers `ChimeraCameraModule`, and includes camera
permission keys in `Info.plist`.

## Recommended Test Order

1. LynxExplorer + mock adapter.
2. Consuming-app flow with mock capture.
3. Custom iOS host with `ios/ChimeraCameraModule.swift` registered.
4. Real iPhone system-camera capture through `CameraModule.capturePhoto`.
5. Native `camera-view` live preview, front/back switching, close/reopen, and
   view-session capture. These core behaviors were first exercised on a
   physical iPhone on 2026-07-10; remaining cases live in `ROADMAP.md`.
