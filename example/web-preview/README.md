# Web preview

Renders the real `example/react/src/App.tsx`, unmodified, in a browser at
iPhone size (390×844 pt), with a photo standing in for the camera feed. It is
for checking layout and interaction without a device; it is not a Lynx runtime.

```sh
pnpm run build                                        # the package's dist/, which the shim wraps
pnpm --filter @chimera-camera/web-preview run build   # → dist/index.html (self-contained)
pnpm --filter @chimera-camera/web-preview run shots   # → dist/shots/*.png, one per state
```

How it works:

- `src/jsx-runtime.js` maps Lynx elements onto DOM: `view` → `div`, `text` →
  `span`, `image` → `img`, and `bindtap` / `bindtouch*` onto click and pointer
  events (captured to the element the touch started on, like Lynx).
  `camera-view` becomes the photo in `src/viewfinder.jpg`; it fires `bindready`
  with an iPhone Pro's lens layout (.5 / 1 / 3) and zooms and mirrors from the
  same `setZoom` calls the real preview gets.
- `src/camera-shim.js` replaces `@vyui/camera`: it reports a native install so the
  app takes its `camera-view` path, and backs every call with the package's mock.

What it cannot show: anything the native view does (real exposure, focus, lens
switching), Lynx-specific layout quirks, and whether Lynx honours a CSS property
(transitions, transforms). Check those on a device.
