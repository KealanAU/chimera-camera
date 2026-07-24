# iOS Native Sources

These files are shipped in the npm package so a Lynx host app can compile them
into its iOS target.

Installing `@kealanau/chimera-camera` puts this folder in:

```text
node_modules/@kealanau/chimera-camera/ios
```

The package ships `ChimeraCamera.podspec` at its root, so the normal way to get
these into a host is one Podfile line:

```ruby
pod 'ChimeraCamera', :path => '../node_modules/@kealanau/chimera-camera'
```

Adding the files to an Xcode target by hand works too — the pod does nothing
more than that plus `-ObjC`. Either way the host still registers the module in
its Lynx bootstrap; Lynx has no autolinking (see `ROADMAP.md`). Full steps:
[../docs/ios-install.md](../docs/ios-install.md).

Sources:

- `ChimeraCameraModule.swift` — the `CameraModule` native module (permissions,
  device enumeration, interim system-camera capture). Register it explicitly
  in `LynxConfig`. This is the module surface (see `../docs/archive/V0.md`).
- `ChimeraCameraView.h` / `ChimeraCameraView.m` — the `camera-view` bridge-spike
  element (see `../docs/native-contract.md`). Self-registers via `LYNX_LAZY_REGISTER_UI` when
  compiled into the target; no bootstrap call needed.

Both compile clean against Lynx 3.9.0 pods on Xcode 26. The Swift module
needs `use_modular_headers!` in the host Podfile (for `import Lynx`) — a
podspec cannot set that for you. Embedded
preview, capture, front/back switching, and close/reopen were exercised on a
physical iPhone on 2026-07-10; remaining acceptance is tracked in `ROADMAP.md`.

For LynxExplorer, use `@kealanau/chimera-camera/mock`. Explorer cannot compile and
register native Swift from an installed npm package at runtime.
