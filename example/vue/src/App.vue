<!--
  Vue Lynx port of the ReactLynx demo (example/react/src/App.tsx). Same iOS
  Camera-style UI, same native `camera-view` element and
  `createCameraViewHandle` contract, no React dependency — the 0.3
  framework-portability proof.

  Everything framework-free (module wiring, screen probe, zoom-arc geometry,
  exposure math, framing, styles) lives in `example/shared/`, imported verbatim
  by both apps; this file is state + handlers + template.

  Native-element events use Vue Lynx's `@event` convention (maps to the native
  `bind<event>`, so `@tap` -> `bindtap`). Reactivity comes from `vue-lynx` (not
  `vue`) so it runs in the Lynx runtime rather than the DOM runtime.
-->
<template>
  <view :style="rootStyle">
    <!-- Preview in its capture frame: live camera-view on native, last photo (or black) on mock. -->
    <view :style="previewStyle(mode)">
      <camera-view
        v-if="isNative"
        id="camera"
        :active="true"
        :facing="facing"
        resizeMode="cover"
        :style="fillStyle"
        @ready="onCameraReady"
        @error="onCameraViewError"
      />
      <image v-else-if="photoSource" :src="photoSource" :style="fillStyle" mode="aspectFill" />
      <view :style="blinkStyle(blink)" />
      <!-- Focus + exposure + mode-swipe catcher — above the preview, below the controls. -->
      <view :style="fillStyle" @touchstart="focusDown" @touchmove="focusMove" @touchend="focusUp" />
    </view>

    <view :style="bands[0]" />
    <view :style="bands[1]" />

    <template v-if="reticle">
      <view :style="reticleStyle(reticle.x, reticle.y, reticleSettled)">
        <view v-for="(s, i) in reticleTickStyles" :key="i" :style="s" />
      </view>
      <!-- Sun thumb slides on a track to the right of the box; up = brighter. -->
      <view :style="{ position: 'absolute', left: `${reticle.x + 50}px`, top: `${reticle.y - EXPOSURE_TRACK_PX}px`, width: '1px', height: `${EXPOSURE_TRACK_PX * 2}px`, backgroundColor: 'rgba(255,214,10,0.5)' }" />
      <view :style="{ position: 'absolute', left: `${reticle.x + 44}px`, top: `${reticle.y - (exposureBias / EXPOSURE_MAX) * EXPOSURE_TRACK_PX - 7}px`, width: '14px', height: '14px', borderRadius: '7px', backgroundColor: YELLOW }" />
      <text
        v-if="Math.abs(exposureBias) > 0.05"
        :style="{ ...exposureTextStyle, position: 'absolute', left: `${reticle.x + 64}px`, top: `${reticle.y - 9}px` }"
      >
        {{ exposureBias > 0 ? '+' : '' }}{{ exposureBias.toFixed(1) }}
      </text>
    </template>

    <!-- Retina screen flash for the front camera (no hardware torch). -->
    <view v-if="screenFlash" :style="{ ...fillStyle, backgroundColor: '#ffffff' }" />

    <!-- Top strip: flash · recording clock · balance spacer. -->
    <view :style="topBarStyle">
      <view :style="{ ...hitStyle, ...fade(recording) }" @tap="cycleFlash">
        <view :style="flashChipStyle(flash === 'on')">
          <text :style="{ ...flashGlyphStyle(flash === 'on'), opacity: flash === 'off' ? 0.55 : 1 }">⚡︎</text>
          <text v-if="flash === 'auto'" :style="flashBadgeStyle">A</text>
        </view>
      </view>
      <view v-if="mode === 'video'" :style="timerStyle(recording)">
        <text :style="timerTextStyle">{{ formatDuration(recording ? elapsedMs : 0) }}</text>
      </view>
      <view :style="hitStyle" />
    </view>

    <view v-if="toast" :style="toastWrapStyle">
      <view :style="toastStyle" @tap="toast = null">
        <view v-if="toast.error" :style="toastDotStyle" />
        <text :style="toastTextStyle">{{ toast.text }}</text>
      </view>
    </view>

    <!-- Zoom stops — tap one, or long-press to open the dial. The lit stop shows the live value. -->
    <view :style="zoomWrapStyle" @touchstart="armDial" @touchend="cancelDial" @touchmove="dialDrag">
      <view :style="zoomPillStyle">
        <view v-for="stop in zoomStops" :key="stop" :style="zoomItemStyle(stop === lit)" @tap="applyZoom(stop)">
          <text :style="zoomTextStyle(stop === lit)">{{ stop === lit ? `${formatZoom(zoom)}×` : formatZoom(stop) }}</text>
        </view>
      </view>
    </view>

    <!-- Mode carousel — tap a mode or swipe the preview sideways. -->
    <view :style="modeWrapStyle">
      <view :style="modeRowStyle(mode, recording)">
        <view v-for="m in MODES" :key="m" :style="modeItemStyle" @tap="selectMode(m)">
          <text :style="modeTextStyle(mode === m)">{{ m.toUpperCase() }}</text>
        </view>
      </view>
    </view>

    <!-- Bottom bar: last capture · shutter · flip. Side controls step aside while recording. -->
    <view :style="bottomBarStyle">
      <view :style="{ ...thumbStyle, ...fade(recording) }" @tap="openReview">
        <image v-if="photoSource" :src="photoSource" :style="fillStyle" mode="aspectFill" />
        <text v-else-if="media?.kind === 'video'" :style="playGlyphStyle">▶</text>
      </view>

      <view
        :style="{ ...shutterRingStyle, opacity: busy ? 0.5 : 1 }"
        @touchstart="pressed = true"
        @touchend="pressed = false"
        @touchcancel="pressed = false"
        @tap="shutter"
      >
        <view :style="shutterInnerStyle(shutterKind, pressed)" />
      </view>

      <view :style="{ ...flipStyle, ...fade(recording) }" @tap="flip">
        <text :style="flipGlyphStyle(flipTurns)">↻</text>
      </view>
    </view>

    <!-- Zoom dial — long-press for fine, continuous zoom. -->
    <view v-if="dialOpen" :style="dialOverlayStyle" @tap="dialOpen = false" @touchmove="dialDrag">
      <view :style="dialFanStyle" />
      <view v-for="(tick, i) in ticks" :key="i" :style="tick" />
      <text v-for="z in zoomStops" :key="`lbl${z}`" :style="dialLabelStyle(dialPoint(z).x, dialPoint(z).y)">
        {{ formatZoom(z) }}
      </text>
      <text :style="dialValueStyle">{{ formatZoom(zoom) }}×</text>
    </view>

    <!-- Review — tapping the thumbnail lands here. -->
    <view v-if="reviewing && media" :style="reviewStyle">
      <image v-if="photoSource" :src="photoSource" :style="reviewImageStyle" mode="aspectFill" />
      <view v-else :style="{ ...fillStyle, ...center, flexDirection: 'column' }">
        <text :style="{ ...playGlyphStyle, fontSize: '56px' }">▶</text>
        <text :style="reviewMetaStyle">Video · {{ formatDuration(videoDurationMs) }}</text>
      </view>
      <view :style="reviewBarStyle">
        <view :style="textButtonStyle" @tap="reviewing = false">
          <text :style="textButtonTextStyle">Retake</text>
        </view>
        <view :style="{ ...saveButtonStyle, opacity: busy ? 0.5 : 1 }" @tap="saveCurrentMedia">
          <text :style="glyphStyle">{{ saved ? '✓' : '↓' }}</text>
        </view>
        <view v-if="media.kind === 'photo' && props.uploadPhoto" :style="textButtonStyle" @tap="uploadCurrentPhoto">
          <text :style="primaryButtonTextStyle">{{ busy ? 'Uploading…' : 'Use Photo' }}</text>
        </view>
        <view v-else :style="textButtonStyle" @tap="reviewing = false">
          <text :style="primaryButtonTextStyle">Done</text>
        </view>
      </view>
      <view v-if="toast" :style="toastWrapStyle">
        <view :style="toastStyle">
          <view v-if="toast.error" :style="toastDotStyle" />
          <text :style="toastTextStyle">{{ toast.text }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue-lynx'

import type { FlashMode, PhotoFile, TargetCameraPosition } from '@vyui/camera'

import {
  activeStop,
  cameraModule,
  clamp01,
  clampEv,
  delay,
  dialPoint,
  dialTickRotation,
  dialTicks,
  displayToFactor,
  formatDuration,
  formatZoom,
  isNative,
  opticalZoomStops,
  pointToZoom,
  previewFrame,
  screenW,
  session,
  setDialRange,
  toMessage,
  touchPoint,
  DEFAULT_ZOOM_STOPS,
  EXPOSURE_MAX,
  EXPOSURE_PX_PER_EV,
  EXPOSURE_TRACK_PX,
  MODES,
  type Media,
  type Mode,
  type TouchEventLike,
} from '../../shared/camera-core.js'
import {
  bandStyles,
  blinkStyle,
  bottomBarStyle,
  center,
  dialFanStyle,
  dialLabelStyle,
  dialOverlayStyle,
  dialTickStyle,
  dialValueStyle,
  exposureTextStyle,
  fade,
  fillStyle,
  flashBadgeStyle,
  flashChipStyle,
  flashGlyphStyle,
  flipGlyphStyle,
  flipStyle,
  glyphStyle,
  hitStyle,
  modeItemStyle,
  modeRowStyle,
  modeTextStyle,
  modeWrapStyle,
  playGlyphStyle,
  previewStyle,
  primaryButtonTextStyle,
  reticleStyle,
  reticleTickStyles,
  reviewBarStyle,
  reviewImageStyle,
  reviewMetaStyle,
  reviewStyle,
  rootStyle,
  saveButtonStyle,
  shutterInnerStyle,
  shutterRingStyle,
  textButtonStyle,
  textButtonTextStyle,
  thumbStyle,
  timerStyle,
  timerTextStyle,
  toastDotStyle,
  toastStyle,
  toastTextStyle,
  toastWrapStyle,
  topBarStyle,
  zoomItemStyle,
  zoomPillStyle,
  zoomTextStyle,
  zoomWrapStyle,
  YELLOW,
} from '../../shared/camera-styles.js'

const props = defineProps<{ uploadPhoto?: (photo: PhotoFile) => Promise<void> }>()

type Toast = { text: string; error: boolean }
const FLASH_LABEL: Record<FlashMode, string> = { off: 'Flash Off', auto: 'Flash Auto', on: 'Flash On' }

const busy = ref(false)
const mode = ref<Mode>('photo')
const facing = ref<TargetCameraPosition>('back')
const flipTurns = ref(0)
const media = ref<Media | null>(null)
const reviewing = ref(false)
const saved = ref(false)
const recording = ref(false)
const elapsedMs = ref(0)
const pressed = ref(false)
const blink = ref(false)
const zoom = ref(1)
const zoomStops = ref<number[]>(DEFAULT_ZOOM_STOPS)
const flash = ref<FlashMode>('off')
const screenFlash = ref(false)
const reticle = ref<{ x: number; y: number } | null>(null)
const reticleSettled = ref(true)
const exposureBias = ref(0)
const dialOpen = ref(false)
const toast = ref<Toast | null>(null)

// Plain locals, not refs — nothing renders off them; `<script setup>` runs once
// per instance, so these are React's useRef equivalent.
let holdTimer: ReturnType<typeof setTimeout> | null = null
let fadeTimer: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null
let clockTimer: ReturnType<typeof setInterval> | null = null
let lastSentZoom = 1
let wideFactor = 1
let activeFocus = false
let swiping = false
let focusStart = { x: 0, y: 0 }
let lastSentBias = 0

const photoSource = computed(() =>
  media.value?.kind === 'photo' && media.value.file.base64
    ? `data:${media.value.file.mime ?? 'image/jpeg'};base64,${media.value.file.base64}`
    : null,
)
const shutterKind = computed(() => (recording.value ? 'stop' : mode.value === 'video' ? 'video' : 'photo'))
const lit = computed(() => activeStop(zoom.value, zoomStops.value))
const bands = computed(() => bandStyles(mode.value))
const videoDurationMs = computed(() => (media.value?.kind === 'video' ? (media.value.file.durationMs ?? 0) : 0))
// Tick geometry recomputes only when the dial value changes, not per render.
const ticks = computed(() =>
  dialTicks().map((z, i) => {
    const p = dialPoint(z)
    return dialTickStyle(p.x, p.y, dialTickRotation(z), i % 10 === 0, Math.abs(z - zoom.value) < 0.12)
  }),
)

// Auto-load: request permissions on mount so the preview just starts.
onMounted(async () => {
  try {
    await cameraModule.requestCameraPermission()
    await cameraModule.requestMicrophonePermission()
  } catch (e) {
    fail(e)
  }
})

// Recording clock: tick while recording, from the moment it started.
watch(recording, (on) => {
  if (clockTimer) clearInterval(clockTimer)
  clockTimer = null
  if (!on) return
  const startedAt = Date.now()
  elapsedMs.value = 0
  clockTimer = setInterval(() => (elapsedMs.value = Date.now() - startedAt), 250)
})
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

// One status pill for everything transient; errors linger longer.
function showToast(text: string, error = false) {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { text, error }
  toastTimer = setTimeout(() => (toast.value = null), error ? 4000 : 1400)
}

function fail(e: unknown) {
  showToast(toMessage(e), true)
}

async function shutter() {
  if (mode.value === 'video') return toggleRecording()
  if (busy.value) return
  busy.value = true
  // Most front cameras have no flash unit: light the subject with a screen
  // flash (the display faces the user), held briefly so the sensor sees it.
  // Back cameras get the real flash, fired by native at the shutter.
  if (facing.value === 'front' && flash.value === 'on') {
    screenFlash.value = true
    await delay(180)
  }
  try {
    const handle = isNative ? session : cameraModule
    const capture = handle.capturePhoto({ flash: flash.value, includeBase64: true, maxDimension: 1600 })
    blink.value = true
    setTimeout(() => (blink.value = false), 110)
    media.value = { kind: 'photo', file: await capture }
  } catch (e) {
    fail(e)
  } finally {
    screenFlash.value = false
    busy.value = false
  }
}

async function toggleRecording() {
  try {
    if (recording.value) {
      const file = await session.stopRecording()
      recording.value = false
      media.value = { kind: 'video', file }
    } else {
      await session.startRecording({ enableAudio: true })
      recording.value = true
    }
  } catch (e) {
    recording.value = false
    fail(e)
  }
}

function selectMode(next: Mode) {
  if (recording.value || next === mode.value) return
  mode.value = next
}

// `value` is a display multiplier (0.5×, 1×, 3×…); convert to the device's
// videoZoomFactor at the setZoom edge.
async function applyZoom(value: number) {
  try {
    await session.setZoom(displayToFactor(value, wideFactor))
    zoom.value = value
    lastSentZoom = value
  } catch (e) {
    fail(e)
  }
}

function onCameraReady(event: { detail?: { switchOverZoomFactors?: number[]; wideFactor?: number; minZoom?: number; maxZoom?: number } }) {
  const d = event.detail ?? {}
  const wf = typeof d.wideFactor === 'number' && d.wideFactor > 0 ? d.wideFactor : 1
  wideFactor = wf
  const stops = opticalZoomStops(d.switchOverZoomFactors, wf, d.minZoom ?? 1)
  zoomStops.value = stops
  // Dial spans the device's real display range (down to 0.5×, up to a sane
  // ceiling so digital zoom doesn't stretch the arc forever).
  const displayMax = typeof d.maxZoom === 'number' ? Math.round((d.maxZoom / wf) * 10) / 10 : 8
  setDialRange(stops[0], Math.max(Math.min(displayMax, 10), stops[stops.length - 1]))
}

function onCameraViewError(event: { detail?: { message?: string } }) {
  showToast(event.detail?.message ?? 'camera-view failed', true)
}

// Long-press the zoom pill → arc opens. Drag anywhere to rotate (handled on
// both the pill and the overlay, so it works whichever element Lynx routes the
// move to); tap the scrim to close. setZoom is throttled to 0.1× steps.
function armDial() {
  holdTimer = setTimeout(() => (dialOpen.value = true), 350)
}

function cancelDial() {
  if (holdTimer) {
    clearTimeout(holdTimer)
    holdTimer = null
  }
}

function dialDrag(event: TouchEventLike) {
  if (!dialOpen.value) return
  const t = touchPoint(event)
  if (typeof t?.clientX !== 'number' || typeof t.clientY !== 'number') return
  const z = pointToZoom(t.clientX, t.clientY)
  zoom.value = z
  const rounded = Math.round(z * 10) / 10
  if (rounded !== lastSentZoom) {
    lastSentZoom = rounded
    void session.setZoom(displayToFactor(rounded, wideFactor)).catch(fail)
  }
}

// iOS order: off → auto → on. Nothing is sent to native here; the mode rides
// along with capturePhoto() so the flash only fires at the shutter.
function cycleFlash() {
  const next: FlashMode = flash.value === 'off' ? 'auto' : flash.value === 'auto' ? 'on' : 'off'
  flash.value = next
  showToast(FLASH_LABEL[next])
}

function flip() {
  if (recording.value) return
  facing.value = facing.value === 'back' ? 'front' : 'back'
  flipTurns.value += 1
  // Swapping the device input resets zoom to 1× natively, so mirror that here.
  zoom.value = 1
  lastSentZoom = 1
}

// iOS focus+exposure gesture. Touch-down drops the reticle and focuses there
// (resetting exposure to auto); sliding up/down slides the sun to
// brighten/dim; a mostly-sideways swipe switches mode instead. Releasing fades
// the reticle out. Plain locals (not refs) gate the move so the rapid
// down→move sequence isn't tripped by async re-renders.
function focusDown(event: TouchEventLike) {
  const frame = previewFrame(mode.value)
  const t = touchPoint(event)
  const x = typeof t?.clientX === 'number' ? t.clientX : screenW / 2
  const y = typeof t?.clientY === 'number' ? t.clientY : frame.top + frame.height / 2
  if (fadeTimer) {
    clearTimeout(fadeTimer)
    fadeTimer = null
  }
  activeFocus = true
  swiping = false
  focusStart = { x, y }
  lastSentBias = 0
  reticle.value = { x, y }
  // Land large, then settle on the next frame so the transition plays.
  reticleSettled.value = false
  setTimeout(() => (reticleSettled.value = true), 16)
  exposureBias.value = 0
  void session.focusAtPoint({ x: clamp01(x / screenW), y: clamp01((y - frame.top) / frame.height) }).catch(fail)
  void session.setExposureBias(0).catch(() => {})
}

function focusMove(event: TouchEventLike) {
  if (!activeFocus || swiping) return
  const t = touchPoint(event)
  if (typeof t?.clientX !== 'number' || typeof t.clientY !== 'number') return
  const dx = t.clientX - focusStart.x
  const dy = focusStart.y - t.clientY // drag up = brighter
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    swiping = true
    reticle.value = null
    const i = MODES.indexOf(mode.value) + (dx < 0 ? 1 : -1)
    if (i >= 0 && i < MODES.length) selectMode(MODES[i])
    return
  }
  const bias = clampEv(dy / EXPOSURE_PX_PER_EV)
  exposureBias.value = bias
  const rounded = Math.round(bias * 10) / 10
  if (rounded !== lastSentBias) {
    lastSentBias = rounded
    void session.setExposureBias(rounded).catch(fail)
  }
}

function focusUp() {
  activeFocus = false
  fadeTimer = setTimeout(() => (reticle.value = null), 1500)
}

function openReview() {
  if (!media.value || recording.value) return
  saved.value = false
  reviewing.value = true
}

async function uploadCurrentPhoto() {
  if (media.value?.kind !== 'photo' || !props.uploadPhoto) return
  busy.value = true
  try {
    await props.uploadPhoto(media.value.file)
    reviewing.value = false
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}

// The other half of "upload or save": keep the capture in the device library.
// Same temp file the upload path uses; saveToLibrary copies it into Photos.
async function saveCurrentMedia() {
  if (!media.value || saved.value || busy.value) return
  busy.value = true
  try {
    await cameraModule.saveToLibrary(media.value.file)
    saved.value = true
    showToast('Saved to Photos')
  } catch (e) {
    fail(e)
  } finally {
    busy.value = false
  }
}
</script>
