# Output Transport: Displaying and Uploading Capture Results

Chimera Camera returns a capture as a **native file path**, not a base64 blob.
`capturePhoto()`, `pickPhoto()`, and (in 0.3) `stopRecording()` write the media
to a temp file and return its path; base64 is opt-in and bounded. This document
settles how a host displays and uploads those paths, and who owns the file's
lifetime.

Photo paths are exercised today (iOS device-proven; Android written to the same
contract). Video paths are contract-level until recording lands in the 0.3
recording track — the transport rules below apply to both.

## The default payload is a path, not base64

- `PhotoFile.path` / `VideoFile.path` — a **bare filesystem path**, no `file://`
  scheme. iOS writes to `NSTemporaryDirectory()`; Android writes to
  `context.cacheDir`. Each capture gets a fresh `chimera-camera-<uuid>` name.
- `PhotoFile.base64` — present **only** when you pass `includeBase64: true`.

base64 is ~1.33× the raw bytes and crosses the JS bridge as a single string, so a
full-resolution photo is multiple megabytes on the bridge and a video is
impractical. Keep the path as the payload and read the file where you need bytes.

## Displaying a result

| Surface | Source to use |
| ------- | ------------- |
| Native `<image>` (real iOS/Android capture) | `file://${photo.path}` |
| Mock / web preview / unit tests | base64 data URI (`data:${mime};base64,${base64}`) |

iOS and Android native image loaders load `file://` paths directly, so a real
capture needs no base64 for preview. The mock returns a `mock://` path with no
real file behind it (`SAMPLE_PHOTO_FIXTURE`), so mock-backed demos display via
base64 — that is why the code under `example/` sets `includeBase64: true`. Pick
the source by what backs the path:

```ts
const displaySource = photo.base64
  ? `data:${photo.mime ?? 'image/jpeg'};base64,${photo.base64}`
  : `file://${photo.path}`
```

## Uploading a result

Upload from the **path**, not base64:

- Hand `file://${path}` (or the bare path) to the host's HTTP layer and stream it
  as a multipart file part. This keeps the bytes off the JS bridge entirely.
- Use base64 only when the transport cannot take a file handle — e.g. a JSON API
  expecting an inline string. Always pair it with `maxDimension` to bound the
  payload:

```ts
const photo = await handle.capturePhoto({ includeBase64: true, maxDimension: 1600 })
```

`maxDimension` caps the longest side in pixels before encoding, so a 4032×3024
capture downscaled to 1600 is a fraction of the bridge cost.

## Saving a result to the gallery

Uploading and saving are separate choices — a capture returns a temp path, and
you decide what to do with it. To keep a capture in the device's media library
(iOS Photos, Android gallery), hand the file to `saveToLibrary`:

```ts
const photo = await handle.capturePhoto()
await fetch(uploadUrl, { method: 'POST', body: fileBody(photo.path) }) // upload it
await camera.saveToLibrary(photo)                                      // and/or keep it
```

`saveToLibrary` takes what capture returns (photo or video — inferred from the
extension) and copies it into the library. iOS prompts for add-only photo-library
permission the first time (`NSPhotoLibraryAddUsageDescription` required in
`Info.plist`); Android needs no permission on API 29+. It does not delete the
temp file — cleanup is still yours (below).

## File lifetime and cleanup ownership

**The library does not delete these files.** They are written to the OS temp
(iOS) / cache (Android) directory and left there.

- The OS reclaims temp/cache space on its own schedule — a file may vanish
  between app launches, or persist far longer than expected. Treat a returned
  path as **valid now, not guaranteed later**.
- **The host owns persistence.** If you need the file after the current flow
  (across a restart, a retry queue, a saved gallery), copy it into your own app
  storage immediately; don't rely on the temp path surviving.
- **The host may delete the temp file** once it has consumed it (uploaded,
  copied, or displayed). Deleting after upload keeps the cache from growing.
- Fresh per-capture filenames mean results never overwrite each other; the flip
  side is they accumulate until the OS or the host clears them.

## Summary

- Path is the payload; base64 is an opt-in, `maxDimension`-bounded fallback.
- Display native captures with `file://${path}`; use base64 for mock/web.
- Upload by streaming the file at `path`; base64 only when a file handle won't do.
- Temp files are the host's to persist and to clean up; the library leaves them.
