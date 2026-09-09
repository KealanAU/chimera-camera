# Chimera Camera Docs

The Fumadocs/Next.js documentation site for Chimera Camera, deployed to
Cloudflare Workers at <https://camera.vyui.dev>.

Content lives in two collections:

- `content/docs/` — the guides: overview, installation, mock adapter, the
  `camera-view` and module surfaces, native contract, output transport, errors,
  and install diagnostics. This is the source of truth for all of them; the
  matching files under the repo's `docs/` are pointers back here.
- `content/api/` — the public TypeScript surface, hand-authored against `src/`.

## Commands

```bash
pnpm run dev              # local dev server
pnpm run check:links      # cross-page and API link check
pnpm run build            # check:links, then next build
pnpm run types:check      # tsc over the app and the scripts
pnpm run test:logic       # vitest, src/ only
pnpm run test:screenshots # playwright, needs a built site
pnpm run deploy           # opennextjs-cloudflare
```

This workspace does not start servers automatically.

## Landing page image layers

The landing page parallax is four WebP layers cut from one photo, with crest
polygons in `src/components/landing/constants.ts` (`MID_CREST`, `BERG_CREST`,
`FRONT_RIDGE`). Cutting a fresh set, in Photopea or equivalent:

1. One photo, cropped 3:2, worked at 2304×1536 — all four exports must match
   that size exactly.
2. Duplicate the layer four times: `back`, `mid`, `lynx`, `front` (`lynx` is the
   mid-near band; its id is baked into `constants.ts`).
3. `back` is untouched and flattened, no alpha. It sits behind every hole, so it
   has to be the whole photo.
4. The other three: erase everything above that layer's crest line and keep the
   entire photo below it. Full frame every time, never a cut-out object — the
   layers are stacked horizons, not stickers. This is the step that goes wrong.
5. Feather by edge type: hard silhouette against sky ≈3px, soft or hazy boundary
   (water, mist, snowfield) 30–80px.
6. Crest lines must descend front-to-back — mid highest, lynx below it, front
   lowest. Overlapping crests show a visible seam when the layers slide.
7. Export each as PNG, then derive the WebPs and the `hitPolygon` points and
   paste those over the three crest constants.

The script that did step 7 lived in a scratchpad and is gone; it took the four
PNGs, wrote the WebPs into `public/img`, and printed the polygon points. Redo it
when a re-cut is actually needed.

Note that the current `landing-bg-back.webp` has an inpainted iceberg band, so
re-cuts of that particular set can never be fully clean. A fresh photo has no
such problem.
