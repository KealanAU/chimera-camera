# The npm side of chimera-camera

This is a plain-language tour of where this package sits with npm today and what
publishing actually does. The command-level detail lives in
[docs/publishing.md](docs/publishing.md); this file is the why and the when.

## Where things stand today

The package has never been published to npm, so nobody can `npm install` it yet.
The only consumer today is `example/host-ios`, which compiles the `ios/` sources
straight off disk. `pnpm pack --dry-run` is the cheapest way to see exactly what
the registry would receive without sending anything — pnpm rather than npm
because `pnpm publish` is what releases, and it strips `packageManager` from the
published package.json, so the two disagree by a few bytes.

## What publishing actually means

Publishing uploads a tarball of the package to the npm registry under the
`@vyui` scope — the same org as `@vyui/core` and `@vyui/kit` — so the full
name is `@vyui/camera`.

The repository is public and the package is MIT licensed, so everything in the
tarball is readable either way: the compiled JS, the Swift and Kotlin sources,
the docs. Worth remembering that a publish is still a one-way door in a way a
git push is not — npm only allows unpublishing within 72 hours of a release, and
anything downloaded in that window is already gone.

## How to publish

The flow is already wired up; the steps are in
[docs/publishing.md](docs/publishing.md). In short: publish `0.0.1` by hand once,
register this repo as a trusted publisher on npmjs.com, then run the `Release`
workflow manually from GitHub Actions for every release after that. It defaults
to the `latest` dist-tag, so the published version is what a plain
`pnpm add @vyui/camera` resolves to.

There is no publish token anywhere in the repo. The workflow authenticates by
OIDC, exchanging a GitHub-issued token for a short-lived registry credential at
publish time — nothing long-lived to leak, nothing to rotate.

Before triggering it, the local sanity check is:

```sh
pnpm install --ignore-scripts
pnpm run build
pnpm pack --dry-run
```

That last command prints exactly which files would go into the tarball, which
is the cheapest way to catch a stray file before it becomes public.

## What ships in the tarball

The `files` list in package.json controls this: `dist/` (the compiled JS and
type declarations), `ChimeraCamera.podspec`, `ios/` and `android/` (native
sources), `docs/`, `example/`, plus the README, LICENSE, and third-party
notices.

## What "it just works" does and doesn't mean

The JavaScript half genuinely is automatic. Install the package, import from it,
and the types, the mock adapter, and the install diagnostics are there — nothing
else to do.

The native half cannot be, and it is worth being precise about why. Two separate
things would have to happen for a camera to appear with zero setup:

1. **Get the native code into the app's build.** This part is now one line per
   platform. iOS ships a CocoaPods podspec, so the host adds
   `pod 'ChimeraCamera', :path => '../node_modules/@vyui/camera'`
   and `pod install` compiles the Swift and Objective-C into the app. Android
   ships `android/` as a real `com.android.library` Gradle module, so the host
   includes it in `settings.gradle` — and the Android manifest merger folds in
   the camera permissions, the proxy activity, and the FileProvider on its own.

2. **Tell Lynx the module exists at runtime.** This part is still one line of
   host code: `config.register(ChimeraCameraModule.self)` on iOS,
   `LynxEnv.inst().registerModule(...)` plus the `camera-view` behavior on
   Android. React Native automates the equivalent step with autolinking; Lynx
   has no such mechanism, so there is nothing to hook into. (`<camera-view>`
   itself does self-register on iOS via `LYNX_LAZY_REGISTER_UI` — that is why the
   podspec adds `-ObjC`, without which the linker would drop the class from a
   static build and the element would silently never appear.)

So the honest promise is: install, two build-config lines, one registration
line. Not zero, but not "drag these files into Xcode" either.

The native code also ships as plain source rather than a prebuilt
`.xcframework` or `.aar`. That is deliberate: it links against whatever Lynx
version the host pins, and a prebuilt binary would freeze one Lynx version into
the package.

## Versioning

The first published version is `0.0.1`, under the default `latest` dist-tag —
so a plain `pnpm add @vyui/camera` picks it up with no `@alpha`
suffix. The `0.0.x` line *is* the alpha; there is no separate dist-tag to
remember, and the README carries the pre-alpha warning where people actually
read it.

Every release until launch is a patch bump: `0.0.1`, `0.0.2`, `0.0.3`, and so
on. `1.0.0` is the first real launch, and there is deliberately nothing in
between — no minor releases to reason about, no judgement call at release time
about whether a change "deserves" one. `pnpm run bump` is the mechanism: it
increments the patch across all four files that carry the version
(`package.json`, `src/native.ts`, the Swift module, the Kotlin module), and
`tests/version-sync.test.js` fails CI both if they drift apart and if the
version ever leaves the `0.0.x` track. Cutting `1.0.0` means doing it by hand
and deleting that guard on purpose.

Bump every time you publish; npm refuses to republish an existing version.
