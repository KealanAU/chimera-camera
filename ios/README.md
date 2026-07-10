# iOS Native Sources

These files are shipped in the npm package so a Lynx host app can compile them
into its iOS target.

Installing `@kealanau/chimera-camera` puts this folder in:

```text
node_modules/@kealanau/chimera-camera/ios
```

Chimera Camera is not yet configured for Lynx's native-library/autolink tooling,
so current host apps must add these files to their Xcode target and register
the module in their Lynx bootstrap. The migration is tracked for 0.2 in
`ROADMAP.md`.

Sources:

- `ChimeraCameraModule.swift` — the `CameraModule` native module (permissions,
  device enumeration, interim system-camera capture). Register it explicitly
  in `LynxConfig`. This is the V0 surface (see `V0.md`).
- `ChimeraCameraView.h` / `ChimeraCameraView.m` — the `camera-view` bridge-spike
  element (see `V1.md`). Self-registers via `LYNX_LAZY_REGISTER_UI` when
  compiled into the target; no bootstrap call needed.

Both compile clean against Lynx 3.9.0 pods on Xcode 26. The Swift module
needs `use_modular_headers!` in the host Podfile (for `import Lynx`). Embedded
preview, capture, front/back switching, and close/reopen were exercised on a
physical iPhone on 2026-07-10; remaining acceptance is tracked in `ROADMAP.md`.

For LynxExplorer, use `@kealanau/chimera-camera/mock`. Explorer cannot compile and
register native Swift from an installed npm package at runtime.
