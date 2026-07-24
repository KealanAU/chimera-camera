# Third-Party Notices

Chimera Camera's own code is MIT licensed; see [LICENSE](LICENSE). The package
declares `MIT AND Apache-2.0` because the shipped artwork derives from
Apache-licensed material. Both third-party notices are reproduced below.

## react-native-vision-camera

Chimera Camera is built off
[`react-native-vision-camera`](https://github.com/mrousavy/react-native-vision-camera)
by Marc Rousavy and its contributors. Its architecture, its native camera
handling, and a good deal of its implementation are ported from that project and
rebuilt against Lynx's native APIs, replacing the React Native, Nitro Modules,
and JSI surfaces with Lynx native module and native element equivalents. The
public JavaScript API was rewritten as framework-neutral plain TypeScript.

The MIT License requires that the copyright notice and the permission notice
travel with substantial portions of the software, so the full text follows.

```text
MIT License

Copyright (c) 2025 Marc Rousavy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Material Symbols (icon glyph)

The camera glyph in the project logo (`images/`), the README banner, the example
apps' in-app header chip (`example/vue/src/App.vue`), and the iOS host's
launcher icon
(`example/host-ios/ChimeraHost/Assets.xcassets/AppIcon.appiconset/`) comes from
[Material Symbols](https://github.com/google/material-design-icons) by Google.

```text
Copyright Google LLC
```

Material Symbols is licensed under the Apache License, Version 2.0. The full
text is in [LICENSES/Apache-2.0.txt](LICENSES/Apache-2.0.txt) and online at
<https://www.apache.org/licenses/LICENSE-2.0>.

Modifications: the source glyph was recolored from a solid fill to a
violet-to-teal gradient, redrawn as the phone-and-camera composite mark, and
rasterized to PNG and WebP — transparent for the in-app chip and the logo, and
on an opaque lavender field for the launcher icon.
