# Publishing

The package is scoped as:

```text
@kealanau/chimera-camera
```

## Local Validation

```sh
pnpm install
pnpm test              # builds, then runs the JS suite
npm pack --dry-run     # exactly what npm would receive
pod lib lint ChimeraCamera.podspec --use-modular-headers --allow-warnings
```

The version lives in four places — `package.json`, `CHIMERA_CAMERA_JS_VERSION`
in `src/native.ts`, `nativeVersion` in the Swift module, and `NATIVE_VERSION` in
the Kotlin module. `tests/version-sync.test.js` fails if they drift. The podspec
reads its version from `package.json`, so it needs no bump.

## Publish

Releases are published from GitHub Actions through `.github/workflows/release.yml`.

One-time repository setup:

1. Own the `@kealanau` npm scope (`npm org ls kealanau`, or just publish once —
   the scope is created on first publish of a package you own).
2. Create an npm **automation** token (granular tokens work; classic
   "Automation" is simplest, and it must bypass 2FA for CI).
3. Add it to the GitHub repository as the `NPM_TOKEN` secret.

Then, per release:

1. `pnpm run bump` — patch only, and it rewrites all four version sites at once.
2. Update `CHANGELOG.md` and commit.
3. Run the `Release` workflow manually. The dist-tag defaults to `latest`, which
   is what a plain `pnpm add @kealanau/chimera-camera` resolves to. Pick
   `alpha`/`beta` only for a release you do *not* want as the default.

### Every release before 1.0.0 is a patch

The whole `0.0.x` line is the pre-alpha; `1.0.0` will be the first real launch.
So there is no minor or major bump to make in between, and nothing else to
decide at release time — `pnpm run bump` only knows how to increment the patch,
and `tests/version-sync.test.js` fails CI if the version leaves the `0.0.x`
track. Cutting `1.0.0` means editing the four files by hand and deleting that
guard, deliberately.

The workflow installs, builds, tests, then runs:

```sh
pnpm publish --access public --tag latest --no-git-checks
```

with `NPM_CONFIG_PROVENANCE=true`, so npm records a signed provenance
attestation linking the tarball to this repo and workflow run.

Publishing with `--access public` makes the whole tarball world-readable —
including the Swift and Kotlin sources — regardless of the GitHub repo being
private. That is intentional (MIT), but it is a one-way door: npm only allows
unpublishing within 72 hours.

## Installing In A Lynx App

```sh
pnpm add @kealanau/chimera-camera
```

The npm package includes JavaScript, TypeScript declarations, docs, a CocoaPods
podspec, and native source under `ios/` and `android/`. JavaScript works the
moment it installs. The native side is a Podfile line on iOS
([ios-install.md](ios-install.md)) and a Gradle module include on Android
([android-install.md](android-install.md)), plus one bootstrap registration call
per platform — Lynx has no autolinking, so that last call cannot be automated
away (see `ROADMAP.md`).
