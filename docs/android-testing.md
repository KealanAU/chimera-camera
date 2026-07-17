# Testing Android Without a Physical Device

You do **not** need a phone to functionally verify the Android camera surface.
The Android emulator supports cameras, so preview and photo capture work end to
end. What the emulator cannot prove is real-sensor behavior — that stays a
physical-device task.

## What the emulator proves vs. does not

| Proven on emulator                          | Needs a real device                     |
| ------------------------------------------- | --------------------------------------- |
| Bridge wiring (`ping`, methods, callbacks)  | Real-sensor orientation and color       |
| Permission flow and denial paths            | Torch/flash on real optics              |
| Preview renders; `capturePhoto` returns JPEG| Zoom on real lenses                     |
| `PhotoFile` shape and error codes match the | Capture latency and memory under load   |
| contract in `native-contract.md`            | Device-specific CameraX quirks          |

## Emulator setup (Android Studio AVD)

1. Create an AVD. On an Apple-Silicon Mac pick an **arm64-v8a** system image so
   it runs natively (fast).
2. In the AVD's **Advanced Settings → Camera**, set the back and/or front
   camera to one of:
   - **Emulated** — a synthetic animated scene (a test pattern). Good enough to
     confirm frames flow and capture works.
   - **Webcam0** — passthrough of your Mac's webcam, so you capture a real image.
3. Or from the CLI: `emulator -avd <name> -camera-back webcam0 -camera-front emulated`.

CameraX preview and `ImageCapture` both read from that emulated/webcam source, so
`capturePhoto()` returns a real JPEG file.

## Prerequisite: a Lynx Android host

Same limitation as iOS — Lynx Go / Lynx Explorer cannot compile this package's
native Kotlin at runtime. You need a **Lynx Android host app** with the module
and `camera-view` behavior compiled and registered (see
[android-install.md](android-install.md)). The emulator just runs that host app;
standing up the Android host is the real gating step, not owning a phone.

## Wanting real-hardware signal without buying devices

- **Firebase Test Lab**, **AWS Device Farm**, **BrowserStack App Live** — run
  real remote devices; some support feeding an image/video into the camera.
- **CameraX test artifacts** (`androidx.camera:camera-testing`, `FakeCamera`) —
  assert pipeline wiring on a JVM with no hardware, suitable for CI.

## Honesty gate before publishing

Until the Android path has run on a real device, it ships as **experimental,
not device-audited** — see the platform support matrix in the README. Emulator
verification is enough to move Android from "unwritten" to "experimental," not
to "supported."
