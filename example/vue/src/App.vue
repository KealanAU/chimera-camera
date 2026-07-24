<!--
  Vue Lynx port of the ReactLynx demo (example/react/src/App.tsx). Same glass
  camera UI, same native `camera-view` element and `createCameraViewHandle`
  contract, no React dependency — the 0.3 framework-portability proof.

  Everything framework-free (module wiring, screen probe, zoom-arc geometry,
  exposure math, styles) lives in `example/shared/`, imported verbatim by both
  apps; this file is state + handlers + template.

  Native-element events use Vue Lynx's `@event` convention (maps to the native
  `bind<event>`, so `@tap` -> `bindtap`). Reactivity comes from `vue-lynx` (not
  `vue`) so it runs in the Lynx runtime rather than the DOM runtime.
-->
<template>
  <view :style="rootStyle">
    <!-- Preview layer: live camera-view on native, last photo (or black) on mock. -->
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

    <!-- Focus + exposure catcher — above the preview, below the controls. -->
    <view :style="fillStyle" @touchstart="focusDown" @touchmove="focusMove" @touchend="focusUp" />
    <template v-if="reticle">
      <view :style="{ ...reticleStyle, left: `${reticle.x - 35}px`, top: `${reticle.y - 35}px` }" />
      <!-- Sun thumb slides on a track to the right of the box; up = brighter. -->
      <view :style="{ position: 'absolute', left: `${reticle.x + 44}px`, top: `${reticle.y - EXPOSURE_TRACK_PX}px`, width: '2px', height: `${EXPOSURE_TRACK_PX * 2}px`, backgroundColor: 'rgba(255,214,10,0.4)' }" />
      <view :style="{ position: 'absolute', left: `${reticle.x + 38}px`, top: `${reticle.y - (exposureBias / EXPOSURE_MAX) * EXPOSURE_TRACK_PX - 7}px`, width: '14px', height: '14px', borderRadius: '7px', backgroundColor: '#ffd60a' }" />
      <text
        v-if="Math.abs(exposureBias) > 0.05"
        :style="{ position: 'absolute', left: `${reticle.x + 58}px`, top: `${reticle.y - 9}px`, color: '#ffd60a', fontSize: '13px', fontWeight: 'bold' }"
      >
        {{ exposureBias > 0 ? '+' : '' }}{{ exposureBias.toFixed(1) }}
      </text>
    </template>

    <!-- Retina screen flash for the front camera (no hardware torch). -->
    <view v-if="screenFlash" :style="{ ...fillStyle, backgroundColor: '#ffffff' }" />

    <!-- Top strip: flash. -->
    <view :style="topBarStyle">
      <view :style="{ ...glassCircle, backgroundColor: flash === 'off' ? glassBg : 'rgba(255,214,10,0.9)' }" @tap="cycleFlash">
        <text :style="{ ...glyphStyle, color: flash === 'off' ? '#ffffff' : '#141414' }">{{ flash === 'auto' ? '⚡︎A' : '⚡︎' }}</text>
      </view>
    </view>

    <view v-if="error" :style="errorBannerStyle" @tap="error = null">
      <text :style="errorTextStyle">{{ error }}</text>
    </view>

    <!-- Zoom pill — tap a stop, or long-press to open the arc dial. -->
    <view :style="zoomWrapStyle" @touchstart="armDial" @touchend="cancelDial" @touchmove="dialDrag">
      <view :style="zoomPillStyle">
        <view
          v-for="stop in zoomStops"
          :key="stop"
          :style="{ ...zoomItemStyle, backgroundColor: zoom === stop ? 'rgba(255,255,255,0.9)' : 'transparent' }"
          @tap="applyZoom(stop)"
        >
          <text :style="{ ...zoomTextStyle, color: zoom === stop ? '#141414' : '#ffffff', fontWeight: zoom === stop ? 'bold' : 'normal' }">
            {{ stop }}×
          </text>
        </view>
      </view>
    </view>

    <!-- PHOTO / VIDEO mode. -->
    <view :style="modeWrapStyle">
      <view v-for="m in MODES" :key="m" :style="modeItemStyle" @tap="mode = m">
        <text :style="{ ...modeTextStyle, color: mode === m ? '#ffd60a' : '#ffffff' }">{{ m.toUpperCase() }}</text>
      </view>
    </view>

    <!-- Bottom bar: library thumbnail · shutter · flip. -->
    <view :style="bottomBarStyle">
      <view :style="{ ...thumbStyle, opacity: media ? 1 : 0.4 }" @tap="openReview">
        <image v-if="photoSource" :src="photoSource" :style="fillStyle" mode="aspectFill" />
        <text v-else-if="media?.kind === 'video'" :style="playGlyphStyle">▶</text>
      </view>

      <view :style="{ ...shutterRingStyle, opacity: busy ? 0.5 : 1 }" @tap="shutter">
        <view :style="shutterInner" />
      </view>

      <view :style="glassCircle" @tap="flip">
        <text :style="glyphStyle">↻</text>
      </view>
    </view>

    <!-- Zoom arc — long-press dial for fine, continuous zoom. -->
    <view v-if="dialOpen" :style="dialOverlayStyle" @tap="dialOpen = false" @touchmove="dialDrag">
      <view
        v-for="(tick, i) in ticks"
        :key="i"
        :style="{
          position: 'absolute',
          left: `${tick.x - (tick.on ? 5 : 3)}px`,
          top: `${tick.y - (tick.on ? 5 : 3)}px`,
          width: `${tick.on ? 10 : 6}px`,
          height: `${tick.on ? 10 : 6}px`,
          borderRadius: '5px',
          backgroundColor: tick.on ? '#ffd60a' : 'rgba(255,255,255,0.55)',
        }"
      />
      <text
        v-for="z in zoomStops"
        :key="`lbl${z}`"
        :style="{ position: 'absolute', left: `${dialPoint(z).x - 16}px`, top: `${dialPoint(z).y - 34}px`, width: '32px', textAlign: 'center', color: '#ffffff', fontSize: '12px' }"
      >
        {{ z }}×
      </text>
      <text :style="dialValueStyle">{{ zoom.toFixed(1) }}×</text>
    </view>

    <!-- Full-screen review — tapping the thumbnail lands here. -->
    <view v-if="reviewing && media" :style="reviewStyle">
      <image v-if="photoSource" :src="photoSource" :style="fillStyle" mode="aspectFit" />
      <view v-else :style="{ ...fillStyle, ...center, flexDirection: 'column' }">
        <text :style="{ ...playGlyphStyle, fontSize: '56px' }">▶</text>
        <text :style="reviewMetaStyle">Video · {{ videoDurationMs }}ms</text>
      </view>
      <view :style="{ ...glassCircle, position: 'absolute', top: '56px', left: '20px' }" @tap="reviewing = false">
        <text :style="glyphStyle">✕</text>
      </view>
      <view :style="saveStyle" @tap="saveCurrentMedia">
        <text :style="saveTextStyle">{{ saved ? 'Saved ✓' : busy ? 'Saving…' : 'Save' }}</text>
      </view>
      <view v-if="media.kind === 'photo' && props.uploadPhoto" :style="usePhotoStyle" @tap="uploadCurrentPhoto">
        <text :style="usePhotoTextStyle">{{ busy ? 'Uploading…' : 'Use Photo' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue-lynx'

import type { FlashMode, PhotoFile, TargetCameraPosition } from '@vyui/chimera-camera'

import {
  cameraModule,
  clamp01,
  clampEv,
  delay,
  dialPoint,
  dialTicks,
  displayToFactor,
  isNative,
  opticalZoomStops,
  pointToZoom,
  screenH,
  screenW,
  session,
  setDialRange,
  toMessage,
  touchPoint,
  DEFAULT_ZOOM_STOPS,
  EXPOSURE_MAX,
  EXPOSURE_PX_PER_EV,
  EXPOSURE_TRACK_PX,
  type Media,
  type Mode,
  type TouchEventLike,
} from '../../shared/camera-core.js'
import {
  bottomBarStyle,
  center,
  dialOverlayStyle,
  dialValueStyle,
  errorBannerStyle,
  errorTextStyle,
  fillStyle,
  glassBg,
  glassCircle,
  glyphStyle,
  modeItemStyle,
  modeTextStyle,
  modeWrapStyle,
  playGlyphStyle,
  reticleStyle,
  reviewMetaStyle,
  reviewStyle,
  rootStyle,
  saveStyle,
  saveTextStyle,
  shutterPhotoStyle,
  shutterRingStyle,
  shutterStopStyle,
  shutterVideoStyle,
  thumbStyle,
  topBarStyle,
  usePhotoStyle,
  usePhotoTextStyle,
  zoomItemStyle,
  zoomPillStyle,
  zoomTextStyle,
  zoomWrapStyle,
} from '../../shared/camera-styles.js'

const props = defineProps<{ uploadPhoto?: (photo: PhotoFile) => Promise<void> }>()

const MODES: Mode[] = ['photo', 'video']

const busy = ref(false)
const mode = ref<Mode>('photo')
const facing = ref<TargetCameraPosition>('back')
const media = ref<Media | null>(null)
const reviewing = ref(false)
const saved = ref(false)
const recording = ref(false)
const zoom = ref(1)
const zoomStops = ref<number[]>(DEFAULT_ZOOM_STOPS)
const flash = ref<FlashMode>('off')
const screenFlash = ref(false)
const reticle = ref<{ x: number; y: number } | null>(null)
const exposureBias = ref(0)
const dialOpen = ref(false)
const error = ref<string | null>(null)

// Plain locals, not refs — nothing renders off them; `<script setup>` runs once
// per instance, so these are React's useRef equivalent.
let holdTimer: ReturnType<typeof setTimeout> | null = null
let fadeTimer: ReturnType<typeof setTimeout> | null = null
let lastSentZoom = 1
let wideFactor = 1
let activeFocus = false
let focusStartY = 0
let lastSentBias = 0

const photoSource = computed(() =>
  media.value?.kind === 'photo' && media.value.file.base64
    ? `data:${media.value.file.mime ?? 'image/jpeg'};base64,${media.value.file.base64}`
    : null,
)
const shutterInner = computed(() =>
  recording.value ? shutterStopStyle : mode.value === 'video' ? shutterVideoStyle : shutterPhotoStyle,
)
const videoDurationMs = computed(() => (media.value?.kind === 'video' ? (media.value.file.durationMs ?? 0) : 0))
// Tick geometry recomputes only when the dial value changes, not per render.
const ticks = computed(() =>
  dialTicks().map((z) => ({ ...dialPoint(z), on: Math.abs(z - zoom.value) < 0.25 })),
)

// Auto-load: request permissions on mount so the preview just starts.
onMounted(async () => {
  try {
    await cameraModule.requestCameraPermission()
    await cameraModule.requestMicrophonePermission()
  } catch (e) {
    error.value = toMessage(e)
  }
})

async function shutter() {
  if (mode.value === 'video') return toggleRecording()
  if (busy.value) return
  busy.value = true
  error.value = null
  // Most front cameras have no flash unit: light the subject with a screen
  // flash (the display faces the user), held briefly so the sensor sees it.
  // Back cameras get the real flash, fired by native at the shutter.
  if (facing.value === 'front' && flash.value === 'on') {
    screenFlash.value = true
    await delay(180)
  }
  try {
    const handle = isNative ? session : cameraModule
    const file = await handle.capturePhoto({ flash: flash.value, includeBase64: true, maxDimension: 1600 })
    media.value = { kind: 'photo', file }
  } catch (e) {
    error.value = toMessage(e)
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
    error.value = toMessage(e)
  }
}

// `value` is a display multiplier (0.5×, 1×, 3×…); convert to the device's
// videoZoomFactor at the setZoom edge.
async function applyZoom(value: number) {
  try {
    await session.setZoom(displayToFactor(value, wideFactor))
    zoom.value = value
    lastSentZoom = value
  } catch (e) {
    error.value = toMessage(e)
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
  error.value = event.detail?.message ?? 'camera-view failed'
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
    void session.setZoom(displayToFactor(rounded, wideFactor)).catch((e) => (error.value = toMessage(e)))
  }
}

// iOS order: off → auto → on. Nothing is sent to native here; the mode rides
// along with capturePhoto() so the flash only fires at the shutter.
function cycleFlash() {
  flash.value = flash.value === 'off' ? 'auto' : flash.value === 'auto' ? 'on' : 'off'
}

function flip() {
  facing.value = facing.value === 'back' ? 'front' : 'back'
  // Swapping the device input resets zoom to 1× natively, so mirror that here.
  zoom.value = 1
  lastSentZoom = 1
}

// iOS focus+exposure gesture. Touch-down drops the reticle and focuses there
// (resetting exposure to auto); then sliding up/down slides the sun to
// brighten/dim; releasing fades the reticle out. Plain locals (not refs) gate
// the move so the rapid down→move sequence isn't tripped by async re-renders.
function focusDown(event: TouchEventLike) {
  const t = touchPoint(event)
  const x = typeof t?.clientX === 'number' ? t.clientX : screenW / 2
  const y = typeof t?.clientY === 'number' ? t.clientY : screenH / 2
  if (fadeTimer) {
    clearTimeout(fadeTimer)
    fadeTimer = null
  }
  activeFocus = true
  focusStartY = y
  lastSentBias = 0
  reticle.value = { x, y }
  exposureBias.value = 0
  void session.focusAtPoint({ x: clamp01(x / screenW), y: clamp01(y / screenH) }).catch((e) => (error.value = toMessage(e)))
  void session.setExposureBias(0).catch(() => {})
}

function focusMove(event: TouchEventLike) {
  if (!activeFocus) return
  const t = touchPoint(event)
  if (typeof t?.clientY !== 'number') return
  const bias = clampEv((focusStartY - t.clientY) / EXPOSURE_PX_PER_EV) // drag up = brighter
  exposureBias.value = bias
  const rounded = Math.round(bias * 10) / 10
  if (rounded !== lastSentBias) {
    lastSentBias = rounded
    void session.setExposureBias(rounded).catch((e) => (error.value = toMessage(e)))
  }
}

function focusUp() {
  activeFocus = false
  fadeTimer = setTimeout(() => (reticle.value = null), 1500)
}

function openReview() {
  if (!media.value) return
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
    error.value = toMessage(e)
  } finally {
    busy.value = false
  }
}

// The other half of "upload or save": keep the capture in the device library.
// Same temp file the upload path uses; saveToLibrary copies it into Photos.
async function saveCurrentMedia() {
  if (!media.value || saved.value) return
  busy.value = true
  try {
    await cameraModule.saveToLibrary(media.value.file)
    saved.value = true
  } catch (e) {
    error.value = toMessage(e)
  } finally {
    busy.value = false
  }
}
</script>
