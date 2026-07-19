import { root } from '@lynx-js/react'

import { CameraDemo } from './App.js'

root.render(<CameraDemo />)

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
}
