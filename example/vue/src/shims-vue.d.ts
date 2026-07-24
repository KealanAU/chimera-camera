import type { Component } from 'vue-lynx'

// Types the native <camera-view> element for templates; see shared/camera-element.ts.
import '../../shared/camera-element.js'

declare module '*.vue' {
  const component: Component
  export default component
}
