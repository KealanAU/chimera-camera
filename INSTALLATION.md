# Installation

Installing Chimera Camera takes four steps. The first gets you a working
JavaScript API with a mock camera, which is enough to build an entire capture
flow. The rest wire up the real native camera on iOS and Android.

Per-platform reference material lives in [docs/ios-install.md](docs/ios-install.md)
and [docs/android-install.md](docs/android-install.md), and `example/host-ios` is
a working Lynx iOS host you can copy from.

## 1. Install the package

```sh
pnpm add @vyui/chimera-camera
```

JavaScript needs nothing further. The types, the mock adapter, and the install
diagnostics all work immediately, so you can build a complete capture flow
before touching a native host:

```ts
import { createCameraModule } from '@vyui/chimera-camera'

const camera = createCameraModule({ mock: true })
```

Getting a real camera means your Lynx host app also compiles the shipped native
sources and registers them, which is what the remaining steps cover.

> [!IMPORTANT]
> **LynxExplorer and Lynx Go can only ever run the mock.** Neither host compiles
> or registers native Swift and Kotlin from an installed npm package at runtime,
> so `createCameraModule()` without options throws there rather than falling
> back silently. The camera those apps use to scan QR codes is their own
> compiled-in feature, and your card's JavaScript cannot reach it. Steps 2
> through 4 require a host app you build yourself, which is what
> `example/host-ios` demonstrates. [docs/lynx-explorer.md](docs/lynx-explorer.md)
> covers running the demo in Lynx Go against the mock.

## 2. iOS

Add the pod to your `Podfile` and run `pod install`:

```ruby
target 'YourApp' do
  # Required so ChimeraCameraModule.swift can `import Lynx`.
  use_modular_headers!

  pod 'Lynx', '3.9.0', :subspecs => ['Framework']   # your own Lynx pin
  pod 'ChimeraCamera', :path => '../node_modules/@vyui/chimera-camera'
end
```

The path resolves relative to your `Podfile`, so adjust it for your own layout.
The podspec leaves its `Lynx` dependency unpinned so that it resolves to whatever
version you pin above, and it adds `-ObjC` to your linker flags so that
`<camera-view>` survives a static-library build.

Add the usage strings to `Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>This app needs camera access to capture photos.</string>
<key>NSMicrophoneUsageDescription</key>
<string>This app needs microphone access to record videos.</string>
<!-- Only if you call saveToLibrary(). -->
<key>NSPhotoLibraryAddUsageDescription</key>
<string>This app saves photos and videos you capture to your library.</string>
```

Then register the module in your Lynx bootstrap:

```swift
let config = LynxConfig(provider: templateProvider)
config.register(ChimeraCameraModule.self)
```

The element registers itself through `LYNX_LAZY_REGISTER_UI`, so `<camera-view>`
needs no bootstrap call of its own.

If you do not use CocoaPods, add the three files in
`node_modules/@vyui/chimera-camera/ios` to your app target directly, which is
all the pod does anyway.

## 3. Android

The shipped `android/` folder is a complete `com.android.library` module. In
`settings.gradle`:

```gradle
include ':chimera-camera'
project(':chimera-camera').projectDir =
    new File(rootProject.projectDir, '../node_modules/@vyui/chimera-camera/android')
```

In your app module's `build.gradle`:

```gradle
dependencies {
    implementation project(':chimera-camera')
}
```

Your `AndroidManifest.xml` needs nothing added, because the manifest merger
folds in the `CAMERA` and `RECORD_AUDIO` permissions, the proxy activity, and
the FileProvider on its own. The module declares `lynx` as `compileOnly`, so it
links against whatever version your host already ships.

Then register both surfaces in your Lynx host:

```kotlin
LynxEnv.inst().registerModule("CameraModule", ChimeraCameraModule::class.java)

val builder = LynxViewBuilder()
ChimeraCameraBehaviors.behaviors().forEach { builder.addBehavior(it) }
```

## 4. Verify

Lynx has no autolinking, which makes those registration calls in steps 2 and 3
the one part nobody can automate away for you. Confirm they took:

```ts
import { getCameraInstallStatusAsync, assertCameraInstalledAsync } from '@vyui/chimera-camera'

console.log(await getCameraInstallStatusAsync())
await assertCameraInstalledAsync()
```

When native setup is incomplete, the thrown error names the missing piece,
whether that turns out to be `NativeModules`, `CameraModule`, a required native
method, or a native/JS version mismatch.

## Troubleshooting

**The preview stays black and `<camera-view>` never fires `ready`.** On iOS this
usually means the element's class was stripped at link time. Confirm the podspec
applied `-ObjC` to your app target, since `LYNX_LAZY_REGISTER_UI` relies on Lynx
finding the class by scanning, and nothing references it at link time.

**`assertCameraInstalledAsync()` reports a missing `CameraModule`.** The Swift or
Kotlin sources compiled, but the bootstrap registration call never ran. Check
step 2 for iOS or step 3 for Android.

**A native/JS version mismatch.** The JavaScript package and the compiled native
sources come from different versions. Reinstall so both come from the same
release, then rebuild the host app rather than reusing a cached build.

**The simulator reports `camera/unavailable`.** iOS simulators have no camera.
Use a physical device, or the mock adapter from step 1.
