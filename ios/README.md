# iOS Native Sources

These files are shipped in the npm package so a Lynx host app can compile them
into its iOS target.

Installing `@kealanau/lynx-camera` puts this folder in:

```text
node_modules/@kealanau/lynx-camera/ios
```

Lynx does not currently provide a package autolinking convention we can rely on,
so host apps must add these files to their Xcode target and register the module
in their Lynx bootstrap.

Sources:

- `LynxCameraModule.swift` — the `CameraModule` native module (permissions,
  device enumeration, interim system-camera capture). Register it explicitly
  in `LynxConfig`. This is the V0 surface (see `V0.md`).
- `LynxCameraView.h` / `LynxCameraView.m` — the `camera-view` bridge-spike
  element (see `V1.md`). Self-registers via `LYNX_LAZY_REGISTER_UI` when
  compiled into the target; no bootstrap call needed. Not yet verified in a
  host app build — expect to fix imports/lifecycle details on first compile.

For LynxExplorer, use `@kealanau/lynx-camera/mock`. Explorer cannot compile and
register native Swift from an installed npm package at runtime.
