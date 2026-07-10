# The npm side of lynx-camera

This is a plain-language tour of where this package sits with npm today, what
publishing would actually do, and how the consuming app would consume the published
version. The command-level detail lives in [docs/publishing.md](docs/publishing.md);
this file is the why and the when.

## Where things stand today

The package lives in a private GitHub repo and has never been published to
npm. Nobody can `npm install` it yet. the consuming app consumes it as a sibling
checkout: the app's iOS host project points straight at `../lynx-camera/ios`
on disk, and there is also a local `.tgz` tarball from a previous `npm pack`
run, which is just a dry-run of what npm would receive. Nothing has left your
machine.

## What publishing actually means

Publishing uploads a tarball of the package to the npm registry under the
`@kealanau` scope, so the full name is `@kealanau/lynx-camera`. One thing
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

## How to publish the alpha

The flow is already wired up; the steps are in
[docs/publishing.md](docs/publishing.md). In short: create an npm automation
token, add it to the GitHub repo as the `NPM_TOKEN` secret, then run the
`Release` workflow manually from GitHub Actions with the `alpha` dist-tag.
The workflow installs, builds, and runs
`npm publish --access public --tag alpha --provenance`.

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
type declarations), `ios/` and `android/` (native sources), `docs/`,
`example/`, plus the README, V1.md, LICENSE, and third-party notices. Note
that the native code ships as plain source, not as a prebuilt framework. Lynx
has no autolinking convention yet, so a host app that installs the package
still has to compile and register the `ios/` (and eventually `android/`)
sources itself — exactly what the consuming app's ios-host project does today, just from
a different path.

## Switching the consuming app over

Once the package is on npm, the consuming app drops the sibling-checkout dependency in
two moves. First, in the app:

```sh
pnpm add @kealanau/lynx-camera@alpha
```

Then in `consumer-app/app/native/ios-host/project.yml`, swap the LynxCamera source
path from `../../../../lynx-camera/ios` to
`../../node_modules/@kealanau/lynx-camera/ios`. There is already a comment in
that file marking this exact swap, so future-you will find it.

## Versioning

The current version is `0.1.0-alpha.0`. The `-alpha.0` suffix is a prerelease
identifier, and publishing under the `alpha` dist-tag means people only get it
if they explicitly ask for `@alpha` — a plain `npm install
@kealanau/lynx-camera` would not pick it up. That is the right posture while
the API and native wiring are still moving (the roadmap has the bridge spike
in progress and Android not started).

Bump the version every time you publish; npm refuses to republish an existing
version. While things are unstable, bump the prerelease number
(`0.1.0-alpha.1`, `.2`, and so on) for each alpha. When the V1 surface feels
settled, drop the prerelease suffix, publish `0.1.0` under the default
`latest` tag, and from there follow ordinary semver: patch for fixes, minor
for new capability, major for breaking changes.
