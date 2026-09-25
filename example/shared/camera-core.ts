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
} from '@vyui/camera'
import { createMockCameraModule } from '@vyui/camera/mock'

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

/**
 * iOS-style framing. Photo shows the sensor's 3:4 portrait frame between black
 * bands, so what you see is what the capture holds; video opens up to 9:16.
 * On short screens the frame slides up to the top rather than overlapping more
 * of the controls.
 */
export function previewFrame(mode: Mode): { top: number; height: number } {
  const [w, h] = mode === 'video' ? [9, 16] : [3, 4]
  const height = Math.min(screenH, Math.round((screenW * h) / w))
  // Video starts just under the top controls so the clock never straddles its edge.
  const top = Math.max(0, Math.min(mode === 'video' ? 104 : Math.round(screenH * 0.133), screenH - height))
  return { top, height }
}

/** "0.5" → ".5", "2.0" → "2", "1.43" → "1.4" — the Camera app's zoom labels. */
export const formatZoom = (z: number): string => {
  const r = Math.round(z * 10) / 10
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace(/^0\./, '.')
}

/**
 * The stop whose button carries the live value: the highest one at or below
 * the current zoom. A dialled 1.4× lights the 1× button as "1.4×", like iOS,
 * instead of leaving every button unlit.
 */
export const activeStop = (zoom: number, stops: number[]): number =>
  stops.reduce((best, stop) => (stop <= zoom + 0.05 ? stop : best), stops[0])

/** Recording clock, "00:01:07". */
export const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`
}

// Mode carousel: fixed-width items slid so the selected one sits dead centre.
export const MODES: Mode[] = ['video', 'photo']
export const MODE_ITEM_W = 84
export const modeOffset = (mode: Mode): number => screenW / 2 - (MODES.indexOf(mode) + 0.5) * MODE_ITEM_W

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
export const DIAL_PIVOT_X = screenW / 2
export const DIAL_PIVOT_Y = screenH + 56
export const DIAL_RADIUS = screenH * 0.4
const DIAL_CENTER_DEG = -90
const DIAL_SWEEP_DEG = 64
// The arc is logarithmic, like iOS: each doubling of zoom gets the same
// sweep, so .5× and 1× don't crowd together at one end of a 10× range.
const dialSpan = () => Math.log(dialMax / dialMin)
/** 41 ticks evenly spaced (in log terms) across the current display range. */
export const dialTicks = () => Array.from({ length: 41 }, (_, i) => dialMin * Math.exp((i / 40) * dialSpan()))

const toRad = (deg: number) => (deg * Math.PI) / 180
const zoomToDeg = (z: number) => DIAL_CENTER_DEG + (Math.log(z / dialMin) / dialSpan() - 0.5) * DIAL_SWEEP_DEG
const angleToZoom = (deg: number) =>
  dialMin * Math.exp(clamp01((deg - (DIAL_CENTER_DEG - DIAL_SWEEP_DEG / 2)) / DIAL_SWEEP_DEG) * dialSpan())

/** Rotation that lays a tick along the arc's radius at a zoom value. */
export const dialTickRotation = (z: number) => zoomToDeg(z) - 90

/** Screen position of a zoom value on the arc. */
export const dialPoint = (z: number) => {
  const r = toRad(zoomToDeg(z))
  return { x: DIAL_PIVOT_X + DIAL_RADIUS * Math.cos(r), y: DIAL_PIVOT_Y + DIAL_RADIUS * Math.sin(r) }
}

/** Inverse of dialPoint: where a finger sits on the arc → zoom value. */
export const pointToZoom = (x: number, y: number) =>
  angleToZoom((Math.atan2(y - DIAL_PIVOT_Y, x - DIAL_PIVOT_X) * 180) / Math.PI)
