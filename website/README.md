# Chimera Camera Docs

This is the Fumadocs/Next.js documentation site for Chimera Camera.

The current docs content is the V1 kickoff surface:

- Lynx-native bridge model.
- Public TypeScript API shape.
- `CameraModule` responsibilities.
- `CameraView` props, methods, and events.
- Bridge spike and camera MVP acceptance criteria.
- Upstream VisionCamera reference strategy.

## Commands

```bash
pnpm run docs
pnpm run check:links
pnpm run build
```

`pnpm run dev` is available for local development, but this workspace does not
start servers automatically.

TypeDoc generation is disabled until the Chimera Camera TypeScript package
foundation exists. The API reference is hand-authored in `content/api/index.mdx`
for now.
