# Android Native Sources

These files are shipped in the npm package so a Lynx host app can compile them
into its Android target.

Android camera implementation is not included yet. Development started with the
TypeScript surface, mock adapter, and iOS system-camera module so iPhone testing
could begin.

The Android implementation should match the normalized contract in
`../docs/native-contract.md` and port CameraX concepts from the upstream
VisionCamera reference under `upstream/vision-camera`.
