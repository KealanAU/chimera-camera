# Native Contract (iOS / Android parity)

The single normalized contract every native platform implements. iOS conforms
today; Android must match this exactly when built. Types live in
[`src/types.ts`](../src/types.ts); milestone status in [ROADMAP.md](../ROADMAP.md).

## Prop defaults (`camera-view`)

Applied natively. A platform must use these when the prop is unset.

| Prop         | Default   | Notes                                                        |
| ------------ | --------- | ------------------------------------------------------------ |
| `active`     | `false`   | No session until `true`.                                     |
| `facing`     | `'back'`  | `front` \| `back`; `external` where hardware exists.         |
| `resizeMode` | `'cover'` | `cover` = fill/crop, `contain` = fit/letterbox.              |
| `cameraId`   | unset     | Not yet honored; selection is `facing`-based until 0.3.      |
| `torch`      | `'off'`   | Session control; implemented in 0.3.                         |
| `zoom`       | `1`       | Session control; implemented in 0.3.                         |
| `enableAudio`| `false`   | Recording only; implemented in 0.3.                          |

## Option defaults (capture / pick)

| Option              | Default        | Notes                                                     |
| ------------------- | -------------- | --------------------------------------------------------- |
| `quality`           | `0.9`          | JPEG quality, clamped to `0..1`.                          |
| `includeBase64`     | `false`        | base64 rides along only when requested.                  |
| `maxDimension`      | unset          | No downscale unless set; caps the longest side in pixels. |
| `flash`             | `'off'`        | System-camera capture only; view capture ignores it.      |
| `enableShutterSound`| `true`         | System-camera capture only; the OS UI owns the sound.     |
| `facing`            | `'back'`       | System-camera capture only; view capture uses the prop.   |

## Result shapes

`PhotoFile` (module capture, module pick, and view capture — identical):

| Field         | Type     | Guarantee                                             |
| ------------- | -------- | ----------------------------------------------------- |
| `path`        | string   | Bare filesystem path to a JPEG temp file (no scheme). |
| `width`       | number   | Integer pixels.                                       |
| `height`      | number   | Integer pixels.                                       |
| `orientation` | string   | `'up'` (portrait-locked until host orientation lands).|
| `mime`        | string   | `'image/jpeg'`.                                       |
| `base64`      | string?  | Present only when `includeBase64` is set.             |

`VideoFile` (recording, 0.3): `{ path, durationMs?, sizeBytes? }`.

Paths are **bare temp-file paths with no scheme**. See
[output-transport.md](output-transport.md) for how a host displays (`file://`),
uploads, and cleans up these files, and when base64 is the right fallback.

## Event payloads (`camera-view`)

| Event               | Detail                        | Status        |
| ------------------- | ----------------------------- | ------------- |
| `ready`             | `{ deviceId: string }`        | implemented   |
| `error`             | `{ code: string, message }`   | implemented   |
| `recordingStarted`  | `{ path?: string }`           | reserved, 0.3 |
| `recordingFinished` | `{ file: VideoFile }`         | reserved, 0.3 |

## Error codes

Every failure reaches JS as `ChimeraCameraError` with `.code` and `.message`.
Module errors ride the callback `{ error: { code, message } }`; view method
errors ride the SelectorQuery `fail` payload `{ code, message }`; view lifecycle
errors ride the `error` event `detail: { code, message }`. Numeric transport
codes are not contract codes and normalize to `camera/native-error`.

| Code                       | Surface       | Meaning                                          |
| -------------------------- | ------------- | ------------------------------------------------ |
| `camera/method-unavailable`| module        | Required native method not registered.           |
| `camera/native-error`      | module + view | Generic native failure / uncoded native error.   |
| `camera/unavailable`       | module + view | No camera hardware, source, or `facing` device.  |
| `camera/permission-denied` | view          | Camera permission denied (request via module).   |
| `camera/no-presenter`      | module (iOS)  | No view controller to present the system UI.     |
| `camera/present-failed`    | module (iOS)  | System camera UI failed to present.              |
| `camera/unsupported`       | reserved      | Feature unsupported by device (e.g. torch), 0.3. |
| `capture/not-active`       | view          | View not active/ready; set `active` and await.   |
| `capture/in-progress`      | module + view | Another capture is already running.              |
| `capture/cancelled`        | module        | User cancelled the system capture.               |
| `capture/failed`           | view          | Capture pipeline failed.                          |
| `capture/encode-failed`    | module        | Could not read or encode the image.              |
| `capture/write-failed`     | module + view | Could not write the temp file.                   |

Platform-specific codes (`camera/no-presenter`, `camera/present-failed`) may have
no Android equivalent; Android reports its own presentation failures under
`camera/native-error` unless a shared code is added here first.
