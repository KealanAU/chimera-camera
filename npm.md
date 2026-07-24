# The npm side of chimera-camera

This is a plain-language tour of where this package sits with npm today, what
publishing would actually do, and how the consuming app would consume the published
version. The command-level detail lives in [docs/publishing.md](docs/publishing.md);
this file is the why and the when.

## Where things stand today

The package lives in a private GitHub repo and has never been published to
npm. Nobody can `npm install` it yet. the consuming app consumes it as a sibling
checkout: the app's iOS host project points straight at `../chimera-camera/ios`
on disk, and there is also a local `.tgz` tarball from a previous `npm pack`
run, which is just a dry-run of what npm would receive. Nothing has left your
machine.

## What publishing actually means

Publishing uploads a tarball of the package to the npm registry under the
`@kealanau` scope, so the full name is `@kealanau/chimera-camera`. One thing
worth being clear-eyed about: the privacy of the GitHub repo has no bearing on
the privacy of the npm package. They are separate systems. The repo can stay
private forever, but the moment you publish with `--access public` (which is
what the release workflow does, and what `publishConfig` in package.json is
set to), everything in the tarball becomes publicly downloadable — the
compiled JS, the Swift sources under `ios/`, the docs, all of it. Anyone can
read that code even though they can't see the repo.

The alternative is a private npm package, which keeps the tarball behind your
account, but scoped private packages require a paid npm plan. So the real
choice is: publish publicly for free and accept that the code is out there, or
pay npm to keep it private, or keep using the sibling checkout and publish
nothing. Since the package is MIT licensed and built on MIT-licensed
VisionCamera ideas anyway, public is probably fine — but it should be a
decision, not a surprise.

## How to publish

The flow is already wired up; the steps are in
[docs/publishing.md](docs/publishing.md). In short: create an npm automation
token, add it to the GitHub repo as the `NPM_TOKEN` secret, then run the
`Release` workflow manually from GitHub Actions. It defaults to the `latest`
dist-tag, so the published version is what a plain
`pnpm add @kealanau/chimera-camera` resolves to.

Before triggering it, the local sanity check is:

```sh
npm install --ignore-scripts
npm run build
npm pack --dry-run
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
   `pod 'ChimeraCamera', :path => '../node_modules/@kealanau/chimera-camera'`
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

## Switching the consuming app over

Once the package is on npm, the consuming app drops the sibling-checkout dependency:

```sh
pnpm add @kealanau/chimera-camera
```

Then remove the three `../../../../chimera-camera/ios/*` source entries from
`consumer-app/app/native/ios-host/project.yml` and add the pod line to that host's
`Podfile` instead. There is already a comment in `project.yml` marking the
swap.

## Versioning

The first published version is `0.0.1`, under the default `latest` dist-tag —
so a plain `pnpm add @kealanau/chimera-camera` picks it up with no `@alpha`
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
