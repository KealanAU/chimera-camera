/*
 * JSX/template types for the native `<camera-view>` element. The package ships
 * the runtime contract (`CameraViewProps`, event payloads); this maps it onto
 * Lynx's element conventions — `bind<event>` handlers, `{ detail }`-wrapped
 * payloads, and every standard `<view>` prop (style, id, class…).
 *
 * Each app declares the element with these props for its own framework:
 * `react/src/lynx-env.d.ts` and `vue/src/shims-vue.d.ts`.
 */
import type { IntrinsicElements } from '@lynx-js/types'

import type {
  CameraErrorEvent,
  CameraReadyEvent,
  PreviewResizeMode,
  RecordingFinishedEvent,
  RecordingStartedEvent,
  TargetCameraPosition,
} from '@vyui/chimera-camera'

/** Lynx delivers every native event payload wrapped in `{ detail }`. */
export type LynxEvent<T> = { detail?: T }

// Props are the subset iOS implements today (see ios/ChimeraCameraView.m);
// `torch`/`zoom` are session methods, not props, so they're deliberately absent.
export type CameraViewElementProps = IntrinsicElements['view'] & {
  active?: boolean
  facing?: TargetCameraPosition
  resizeMode?: PreviewResizeMode
  bindready?: (event: LynxEvent<CameraReadyEvent>) => void
  binderror?: (event: LynxEvent<CameraErrorEvent>) => void
  bindrecordingstarted?: (event: LynxEvent<RecordingStartedEvent>) => void
  bindrecordingfinished?: (event: LynxEvent<RecordingFinishedEvent>) => void
}

// Declare the element where Lynx keeps its built-ins: ReactLynx's JSX namespace
// (`JSX.IntrinsicElements extends Lynx.IntrinsicElements`) and vue-lynx's
// `GlobalComponents` both derive from this interface, so one augmentation types
// `<camera-view>` in either framework. Each app pulls this file in through its
// own `*.d.ts`.
declare module '@lynx-js/types' {
  interface IntrinsicElements {
    'camera-view': CameraViewElementProps
  }
}
