# Publishing

The package is scoped as:

```text
@kealanau/chimera-camera
```

## Local Validation

```sh
npm install --ignore-scripts
npm run build
npm pack --dry-run
```

## Alpha Publish

Releases are published from GitHub Actions through `.github/workflows/release.yml`.

Repository setup:

1. Create an npm automation token.
2. Add it to the GitHub repository as `NPM_TOKEN`.
3. Run the `Release` workflow manually.
4. Choose the `alpha` dist-tag while the API and native wiring are still unstable.

The release workflow runs:

```sh
npm install --ignore-scripts
npm run build
npm publish --access public --tag alpha --provenance
```

## Installing In A Lynx App

```sh
pnpm add @kealanau/chimera-camera@alpha
```

The npm package includes JavaScript, TypeScript declarations, docs, and native
source under `ios/` and `android/`. This package is not configured for Lynx's
native-library/autolink conventions, so host apps compile and register the
native source manually. Autolink packaging is deferred as a distribution task
(see `ROADMAP.md`).
