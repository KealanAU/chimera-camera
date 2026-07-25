# Chimera Host (iOS) — the on-device Sparkling shell

A minimal native Lynx iOS app that compiles this package's `ios/` sources into
its target, so **`CameraModule` and `<camera-view>` are the real native surface
on a physical iPhone** — not the mock. It loads whichever Lynx bundle your dev
server is serving, so the **same host runs the ReactLynx or the Vue app**
(`example/react` / `example/vue`) with one shared native camera registration.

Verified: `xcodegen generate && pod install` resolves Lynx 3.9.0, and the app
builds and links for arm64 with `ChimeraCameraModule`, `ChimeraCameraView`, and
the `camera-view` registration embedded.

## One-time setup

Needs Xcode, plus `xcodegen` and `cocoapods`:

```sh
brew install xcodegen cocoapods
```

Then, from this folder:

```sh
echo "DEVELOPMENT_TEAM=YOURTEAMID" > .env   # optional, see below
./setup.sh                                  # xcodegen generate + pod install
open ChimeraHost.xcworkspace
```

In Xcode: select the **ChimeraHost** scheme, pick your iPhone, and Run. Grant
camera + microphone when asked.

Signing is yours, not ours: the spec reads `DEVELOPMENT_TEAM` from the
environment, and `setup.sh` loads a git-ignored `.env` if you leave one here
(your team ID is in Xcode ▸ Settings ▸ Accounts). Skip it and Xcode just asks
you to pick a team on the first Run — you then re-pick after each `./setup.sh`.

The `.xcodeproj`, `.xcworkspace`, `Pods/`, and `.env` are generated or local
(git-ignored). `project.yml` and `Podfile` are the source of truth — re-run
`./setup.sh` after editing either.

## Point it at a bundle

1. Start a dev server (either framework — both serve `main.lynx.bundle`):

   ```sh
   pnpm --filter @vyui/camera run build   # once
   pnpm --filter @chimera-camera/react run dev         # ReactLynx
   # or
   pnpm --filter @chimera-camera/vue run dev           # Vue Lynx
   ```

2. In the app's URL bar, enter the bundle URL and tap **Load**:

   - Simulator: `http://localhost:3000/main.lynx.bundle`
   - Device: replace `localhost` with your Mac's LAN IP (the one `pnpm dev`
     prints), e.g. `http://192.168.1.20:3000/main.lynx.bundle`. Phone and Mac
     must share a Wi-Fi network.

   The URL is remembered between launches. Switch React ↔ Vue by stopping one
   dev server and starting the other — same URL.

On a real device you get the `NATIVE CAMERA` badge, a live preview, and the full
`camera-view` surface (capture, front/back, zoom, torch, focus, recording). The
simulator has no camera, so `camera-view` emits `camera/unavailable` there — it's
only good for confirming the bundle loads and the bridge is wired.

## How it's wired

- `Podfile` — Lynx 3.9.0 (`Framework` pulls PrimJS in transitively), `LynxService`
  for `<image>`/log/http, `XElement`. A `post_install` appends `-Wno-error` to the
  Lynx pods' per-file flags (Xcode 26 turns their deprecations into errors otherwise).
- `project.yml` — compiles `../../ios/ChimeraCameraModule.swift` and
  `ChimeraCameraView.{h,m}` straight into the app target.
- `ChimeraHost/AppDelegate.swift` — inits `LynxEnv`, shows `RootViewController`.
- `ChimeraHost/RootViewController.swift` — builds the `LynxView`, registers
  `ChimeraCameraModule` on its `LynxConfig`, and fetches the bundle over HTTP
  (`DevServerTemplateProvider`). `<camera-view>` self-registers via
  `LYNX_LAZY_REGISTER_UI`.
- `ChimeraHost/Info.plist` — camera/mic usage strings and an arbitrary-loads ATS
  exception for the plain-HTTP dev server (dev host only).
