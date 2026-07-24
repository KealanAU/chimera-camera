# Run on device (after a restart)

The Xcode project + Pods live on disk (git-ignored, not wiped by a restart), so
you normally skip setup and just do these two things.

**1. Serve a bundle** (pick one framework):

```sh
pnpm install                                        # if node_modules is gone
pnpm --filter @vyui/chimera-camera run build    # build the package once
pnpm --filter @chimera-camera/react run dev         # ReactLynx  (or ...vue for Vue)
```

Note the LAN URL it prints (e.g. `http://192.168.1.20:3000`).

**2. Run the app:**

```sh
open example/host-ios/ChimeraHost.xcworkspace
```

In Xcode: **ChimeraHost** scheme → your iPhone → Run. In the app's URL bar enter
`http://<that-LAN-ip>:3000/main.lynx.bundle` and tap **Load**. Phone + Mac on the
same Wi-Fi. The URL is remembered, so after the first time just tap Load.

---

**Only if `example/host-ios/Pods/` or `ChimeraHost.xcworkspace` is missing**
(fresh clone, or you cleaned it):

```sh
cd example/host-ios && ./setup.sh     # needs: brew install xcodegen cocoapods
```

Full details: [`example/host-ios/README.md`](example/host-ios/README.md).
