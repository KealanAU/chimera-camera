# Lynx Camera Example

This example app exists to validate package integration, not to demonstrate a
finished product UI.

The first milestone for this app is a native bridge spike:

- Render a placeholder native `CameraView`.
- Call one imperative native method from JavaScript.
- Receive one native event in JavaScript.

Once that bridge is proven on iOS and Android, this app should become the manual
acceptance target for preview, permissions, photo capture, video recording,
zoom, torch, and tap-to-focus.
