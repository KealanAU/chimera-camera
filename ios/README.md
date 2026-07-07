# iOS Native Sources

These files are shipped in the npm package so a Lynx host app can compile them
into its iOS target.

Installing `@kealanau/lynx-camera` puts this folder in:

```text
node_modules/@kealanau/lynx-camera/ios
```

Lynx does not currently provide a package autolinking convention we can rely on,
so host apps must add these files to their Xcode target and register the module
in their Lynx bootstrap.

For LynxExplorer, use `@kealanau/lynx-camera/mock`. Explorer cannot compile and
register native Swift from an installed npm package at runtime.
