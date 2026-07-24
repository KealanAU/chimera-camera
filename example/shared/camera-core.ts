/*
 * Framework-free core of the camera demo: module wiring, screen probe, zoom-arc
 * geometry and exposure math. `react/src/App.tsx` and `vue/src/App.vue` import
 * this verbatim and differ only in their view layer.
 */
import {
  createCameraModule,
  createCameraViewHandle,
  getCameraInstallStatus,
  type CameraModuleClient,
  type CameraSessionMethods,
  type PhotoFile,
  type VideoFile,
} from '@vyui/chimera-camera'
import { createMockCameraModule } from '@vyui/chimera-camera/mock'

const mock = createMockCameraModule()

export const cameraInstallStatus = getCameraInstallStatus()
export const isNative = cameraInstallStatus.ok
export const cameraModule: CameraModuleClient = createCameraModule({ optional: true }) ?? mock
// Native drives the live camera-view; the mock drives the module. Both implement
// CameraSessionMethods, so the same glass controls work either way.
export const session: CameraSessionMethods = isNative ? createCameraViewHandle('#camera') : mock

export type Mode = 'photo' | 'video'
export type Media = { kind: 'photo'; file: PhotoFile } | { kind: 'video'; file: VideoFile }

export const toMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))
export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/** Lynx touch event narrowed to the one point both frameworks deliver. */
export type TouchEventLike = {
  changedTouches?: Array<{ clientX?: number; clientY?: number }>
  touches?: Array<{ clientX?: number; clientY?: number }>
}
export const touchPoint = (event: TouchEventLike) => event.changedTouches?.[0] ?? event.touches?.[0]

// Viewport size in CSS px, for normalising a tap into the preview's 0..1 space
// and laying out the zoom arc. Falls back to an iPhone-ish default if SystemInfo
// is unavailable (it shouldn't be on device).
const sys = (globalThis as { SystemInfo?: { pixelWidth?: number; pixelHeight?: number; pixelRatio?: number } }).SystemInfo
export const screenW = sys?.pixelWidth && sys.pixelRatio ? sys.pixelWidth / sys.pixelRatio : 390
export const screenH = sys?.pixelHeight && sys.pixelRatio ? sys.pixelHeight / sys.pixelRatio : 844

// Exposure drag (iOS "tap-to-focus, then slide the sun to dim/brighten"). EV
// range is the UI ceiling; native clamps to the device's real range.
const EXPOSURE_MIN = -4
export const EXPOSURE_MAX = 4
export const EXPOSURE_PX_PER_EV = 45 // vertical drag sensitivity
export const EXPOSURE_TRACK_PX = 60 // how far the sun thumb travels each way
export const clampEv = (n: number) => Math.max(EXPOSURE_MIN, Math.min(EXPOSURE_MAX, n))

export const DEFAULT_ZOOM_STOPS = [1, 2, 4]

// Everything user-facing is a DISPLAY multiplier (0.5×, 1×, 3×…). On multi-lens
// devices the ultra-wide is the base lens (videoZoomFactor 1.0), so display 1× =
// the wide lens sits at `wideFactor` in factor space. Convert at the setZoom edge.
export const displayToFactor = (display: number, wideFactor: number) => display * (wideFactor || 1)

// Dial range in display multipliers. Mutable so the view can widen it to the
// device's real range (incl. the ultra-wide 0.5×) once the camera reports in.
let dialMin = 1
let dialMax = 8
export function setDialRange(min: number, max: number): void {
  dialMin = min > 0 ? min : 1
  dialMax = max > dialMin ? max : dialMin + 1
}

/**
 * Turn the native lens switch-over factors into DISPLAY zoom stops — the real
 * optical fields, including the ultra-wide 0.5× when present. `wideFactor` maps
 * factor→display (1× = the wide lens). Single-lens devices keep the digital
 * defaults.
 */
export function opticalZoomStops(
  switchOverZoomFactors: number[] | undefined,
  wideFactor = 1,
  minZoom = 1,
): number[] {
  const factors = Array.isArray(switchOverZoomFactors) ? switchOverZoomFactors : []
  if (factors.length === 0) return DEFAULT_ZOOM_STOPS
  const toDisplay = (f: number) => Math.round((f / (wideFactor || 1)) * 10) / 10
  const stops = Array.from(new Set([toDisplay(minZoom), ...factors.map(toDisplay)]))
    .filter((d) => d > 0)
    .sort((a, b) => a - b)
  return stops.length > 1 ? stops : DEFAULT_ZOOM_STOPS
}

// iOS-style zoom arc. Pivot sits just below the screen so the tick fan bows
// shallowly across the lower third; drag an angle → zoom, tap away to close.
// ponytail: these four constants are the calibration knobs — untested on-device,
// nudge PIVOT_Y / RADIUS / SWEEP until the arc sits where it feels right.
const DIAL_PIVOT_X = screenW / 2
export const DIAL_PIVOT_Y = screenH + 56
export const DIAL_RADIUS = screenH * 0.4
const DIAL_CENTER_DEG = -90
const DIAL_SWEEP_DEG = 56
/** 15 evenly-spaced ticks across the current display range. */
export const dialTicks = () => Array.from({ length: 15 }, (_, i) => dialMin + (i / 14) * (dialMax - dialMin))

const toRad = (deg: number) => (deg * Math.PI) / 180
const zoomToDeg = (z: number) => DIAL_CENTER_DEG + ((z - dialMin) / (dialMax - dialMin) - 0.5) * DIAL_SWEEP_DEG
const angleToZoom = (deg: number) =>
  dialMin + clamp01((deg - (DIAL_CENTER_DEG - DIAL_SWEEP_DEG / 2)) / DIAL_SWEEP_DEG) * (dialMax - dialMin)

/** Screen position of a zoom value on the arc. */
export const dialPoint = (z: number) => {
  const r = toRad(zoomToDeg(z))
  return { x: DIAL_PIVOT_X + DIAL_RADIUS * Math.cos(r), y: DIAL_PIVOT_Y + DIAL_RADIUS * Math.sin(r) }
}

/** Inverse of dialPoint: where a finger sits on the arc → zoom value. */
export const pointToZoom = (x: number, y: number) =>
  angleToZoom((Math.atan2(y - DIAL_PIVOT_Y, x - DIAL_PIVOT_X) * 180) / Math.PI)
