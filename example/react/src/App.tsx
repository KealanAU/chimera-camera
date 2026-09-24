/*
 * ReactLynx camera demo — iOS Camera-style controls over Chimera Camera's
 * `camera-view`. Every framework-free piece (module wiring, screen probe, zoom
 * arc, exposure math, framing) lives in `example/shared/camera-core.ts`, which
 * `example/vue/src/App.vue` imports verbatim; this file is state + handlers + JSX.
 *
 * Lynx note: `<view>` defaults to `display: linear`, so every flex row/centre
 * here sets `display: 'flex'` explicitly — without it children stack and overlap.
 *
 * ponytail: flash/flip icons are text glyphs. Swap in baked SF-style PNGs for a
 * pixel-true look.
 */
import { useEffect, useRef, useState } from '@lynx-js/react'

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

export interface CameraDemoProps {
  uploadPhoto?: (photo: PhotoFile) => Promise<void>
}

type Toast = { text: string; error: boolean }
const FLASH_LABEL: Record<FlashMode, string> = { off: 'Flash Off', auto: 'Flash Auto', on: 'Flash On' }

export function CameraDemo({ uploadPhoto }: CameraDemoProps) {
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>('photo')
  const [facing, setFacing] = useState<TargetCameraPosition>('back')
  const [flipTurns, setFlipTurns] = useState(0)
  const [media, setMedia] = useState<Media | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [pressed, setPressed] = useState(false)
  const [blink, setBlink] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [zoomStops, setZoomStops] = useState<number[]>(DEFAULT_ZOOM_STOPS)
  const [flash, setFlash] = useState<FlashMode>('off')
  const [screenFlash, setScreenFlash] = useState(false)
  const [reticle, setReticle] = useState<{ x: number; y: number } | null>(null)
  const [reticleSettled, setReticleSettled] = useState(true)
  const [exposureBias, setExposureBias] = useState(0)
  const [dialOpen, setDialOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSentZoom = useRef(1)
  const wideFactor = useRef(1)
  const activeFocus = useRef(false)
  const swiping = useRef(false)
  const focusStart = useRef({ x: 0, y: 0 })
  const lastSentBias = useRef(0)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-load: request permissions on mount so the preview just starts.
  useEffect(() => {
    void (async () => {
      try {
        await cameraModule.requestCameraPermission()
        await cameraModule.requestMicrophonePermission()
      } catch (e) {
        fail(e)
      }
    })()
  }, [])

  // Recording clock: tick while recording, from the moment it started.
  useEffect(() => {
    if (!recording) return
    const startedAt = Date.now()
    setElapsedMs(0)
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 250)
    return () => clearInterval(id)
  }, [recording])

  // One status pill for everything transient; errors linger longer.
  function showToast(text: string, error = false) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ text, error })
    toastTimer.current = setTimeout(() => setToast(null), error ? 4000 : 1400)
  }
  function fail(e: unknown) {
    showToast(toMessage(e), true)
  }

  async function shutter() {
    if (mode === 'video') return toggleRecording()
    if (busy) return
    setBusy(true)
    // Most front cameras have no flash unit: light the subject with a screen
    // flash (the display faces the user), held briefly so the sensor sees it.
    // Back cameras get the real flash, fired by native at the shutter.
    if (facing === 'front' && flash === 'on') {
      setScreenFlash(true)
      await delay(180)
    }
    try {
      const handle = isNative ? session : cameraModule
      const capture = handle.capturePhoto({ flash, includeBase64: true, maxDimension: 1600 })
      setBlink(true)
      setTimeout(() => setBlink(false), 110)
      setMedia({ kind: 'photo', file: await capture })
    } catch (e) {
      fail(e)
    } finally {
      setScreenFlash(false)
      setBusy(false)
    }
  }

  async function toggleRecording() {
    try {
      if (recording) {
        const file = await session.stopRecording()
        setRecording(false)
        setMedia({ kind: 'video', file })
      } else {
        await session.startRecording({ enableAudio: true })
        setRecording(true)
      }
    } catch (e) {
      setRecording(false)
      fail(e)
    }
  }

  function selectMode(next: Mode) {
    if (recording || next === mode) return
    setMode(next)
  }

  // `value` is a display multiplier (0.5×, 1×, 3×…); convert to the device's
  // videoZoomFactor at the setZoom edge.
  async function applyZoom(value: number) {
    try {
      await session.setZoom(displayToFactor(value, wideFactor.current))
      setZoom(value)
      lastSentZoom.current = value
    } catch (e) {
      fail(e)
    }
  }

  function onCameraReady(event: { detail?: { switchOverZoomFactors?: number[]; wideFactor?: number; minZoom?: number; maxZoom?: number } }) {
    const d = event.detail ?? {}
    const wf = typeof d.wideFactor === 'number' && d.wideFactor > 0 ? d.wideFactor : 1
    wideFactor.current = wf
    const stops = opticalZoomStops(d.switchOverZoomFactors, wf, d.minZoom ?? 1)
    setZoomStops(stops)
    // Dial spans the device's real display range (down to 0.5×, up to a sane
    // ceiling so digital zoom doesn't stretch the arc forever).
    const displayMax = typeof d.maxZoom === 'number' ? Math.round((d.maxZoom / wf) * 10) / 10 : 8
    setDialRange(stops[0], Math.max(Math.min(displayMax, 10), stops[stops.length - 1]))
  }

  // Long-press the zoom pill → arc opens. Drag anywhere to rotate (handled on
  // both the pill and the overlay, so it works whichever element Lynx routes the
  // move to); tap the scrim to close. setZoom is throttled to 0.1× steps.
  function armDial() {
    holdTimer.current = setTimeout(() => setDialOpen(true), 350)
  }
  function cancelDial() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }
  function dialDrag(event: TouchEventLike) {
    if (!dialOpen) return
    const t = touchPoint(event)
    if (typeof t?.clientX !== 'number' || typeof t.clientY !== 'number') return
    const z = pointToZoom(t.clientX, t.clientY)
    setZoom(z)
    const rounded = Math.round(z * 10) / 10
    if (rounded !== lastSentZoom.current) {
      lastSentZoom.current = rounded
      void session.setZoom(displayToFactor(rounded, wideFactor.current)).catch(fail)
    }
  }

  // iOS order: off → auto → on. Nothing is sent to native here; the mode rides
  // along with capturePhoto() so the flash only fires at the shutter.
  function cycleFlash() {
    const next: FlashMode = flash === 'off' ? 'auto' : flash === 'auto' ? 'on' : 'off'
    setFlash(next)
    showToast(FLASH_LABEL[next])
  }

  function flip() {
    if (recording) return
    setFacing(facing === 'back' ? 'front' : 'back')
    setFlipTurns(flipTurns + 1)
    // Swapping the device input resets zoom to 1× natively, so mirror that here.
    setZoom(1)
    lastSentZoom.current = 1
  }

  // iOS focus+exposure gesture. Touch-down drops the reticle and focuses there
  // (resetting exposure to auto); sliding up/down slides the sun to
  // brighten/dim; a mostly-sideways swipe switches mode instead. Releasing fades
  // the reticle out. Refs (not state) gate the move so the rapid down→move
  // sequence isn't tripped by async re-renders.
  function focusDown(event: TouchEventLike) {
    const frame = previewFrame(mode)
    const t = touchPoint(event)
    const x = typeof t?.clientX === 'number' ? t.clientX : screenW / 2
    const y = typeof t?.clientY === 'number' ? t.clientY : frame.top + frame.height / 2
    if (fadeTimer.current) {
      clearTimeout(fadeTimer.current)
      fadeTimer.current = null
    }
    activeFocus.current = true
    swiping.current = false
    focusStart.current = { x, y }
    lastSentBias.current = 0
    setReticle({ x, y })
    // Land large, then settle on the next frame so the transition plays.
    setReticleSettled(false)
    setTimeout(() => setReticleSettled(true), 16)
    setExposureBias(0)
    void session.focusAtPoint({ x: clamp01(x / screenW), y: clamp01((y - frame.top) / frame.height) }).catch(fail)
    void session.setExposureBias(0).catch(() => {})
  }

  function focusMove(event: TouchEventLike) {
    if (!activeFocus.current || swiping.current) return
    const t = touchPoint(event)
    if (typeof t?.clientX !== 'number' || typeof t.clientY !== 'number') return
    const dx = t.clientX - focusStart.current.x
    const dy = focusStart.current.y - t.clientY // drag up = brighter
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiping.current = true
      setReticle(null)
      const i = MODES.indexOf(mode) + (dx < 0 ? 1 : -1)
      if (i >= 0 && i < MODES.length) selectMode(MODES[i])
      return
    }
    const bias = clampEv(dy / EXPOSURE_PX_PER_EV)
    setExposureBias(bias)
    const rounded = Math.round(bias * 10) / 10
    if (rounded !== lastSentBias.current) {
      lastSentBias.current = rounded
      void session.setExposureBias(rounded).catch(fail)
    }
  }

  function focusUp() {
    activeFocus.current = false
    fadeTimer.current = setTimeout(() => setReticle(null), 1500)
  }

  function openReview() {
    if (!media || recording) return
    setSaved(false)
    setReviewing(true)
  }

  async function uploadCurrentPhoto() {
    if (media?.kind !== 'photo' || !uploadPhoto) return
    setBusy(true)
    try {
      await uploadPhoto(media.file)
      setReviewing(false)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  // The other half of "upload or save": keep the capture in the device library.
  // Same temp file the upload path uses; saveToLibrary copies it into Photos.
  async function saveCurrentMedia() {
    if (!media || saved || busy) return
    setBusy(true)
    try {
      await cameraModule.saveToLibrary(media.file)
      setSaved(true)
      showToast('Saved to Photos')
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const photoSource = media?.kind === 'photo' && media.file.base64 ? `data:${media.file.mime ?? 'image/jpeg'};base64,${media.file.base64}` : null
  const shutterKind = recording ? 'stop' : mode === 'video' ? 'video' : 'photo'
  const lit = activeStop(zoom, zoomStops)
  const [topBand, bottomBand] = bandStyles(mode)

  return (
    <view style={rootStyle}>
      {/* Preview in its capture frame: live camera-view on native, last photo (or black) on mock. */}
      <view style={previewStyle(mode)}>
        {isNative ? (
          <camera-view
            id="camera"
            active={true}
            facing={facing}
            resizeMode="cover"
            bindready={onCameraReady}
            binderror={(event: { detail?: { message?: string } }) => showToast(event.detail?.message ?? 'camera-view failed', true)}
            style={fillStyle}
          />
        ) : photoSource ? (
          <image src={photoSource} style={fillStyle} mode="aspectFill" />
        ) : null}
        <view style={blinkStyle(blink)} />
        {/* Focus + exposure + mode-swipe catcher — above the preview, below the controls. */}
        <view bindtouchstart={focusDown} bindtouchmove={focusMove} bindtouchend={focusUp} style={fillStyle} />
      </view>

      <view style={topBand} />
      <view style={bottomBand} />

      {reticle && (
        <>
          <view style={reticleStyle(reticle.x, reticle.y, reticleSettled)}>
            {reticleTickStyles.map((s, i) => (
              <view key={i} style={s} />
            ))}
          </view>
          {/* Sun thumb slides on a track to the right of the box; up = brighter. */}
          <view style={{ position: 'absolute', left: `${reticle.x + 50}px`, top: `${reticle.y - EXPOSURE_TRACK_PX}px`, width: '1px', height: `${EXPOSURE_TRACK_PX * 2}px`, backgroundColor: 'rgba(255,214,10,0.5)' }} />
          <view style={{ position: 'absolute', left: `${reticle.x + 44}px`, top: `${reticle.y - (exposureBias / EXPOSURE_MAX) * EXPOSURE_TRACK_PX - 7}px`, width: '14px', height: '14px', borderRadius: '7px', backgroundColor: YELLOW }} />
          {Math.abs(exposureBias) > 0.05 && (
            <text style={{ ...exposureTextStyle, position: 'absolute', left: `${reticle.x + 64}px`, top: `${reticle.y - 9}px` }}>
              {exposureBias > 0 ? '+' : ''}{exposureBias.toFixed(1)}
            </text>
          )}
        </>
      )}

      {/* Retina screen flash for the front camera (no hardware torch). */}
      {screenFlash && <view style={{ ...fillStyle, backgroundColor: '#ffffff' }} />}

      {/* Top strip: flash · recording clock · balance spacer. */}
      <view style={topBarStyle}>
        <view bindtap={cycleFlash} style={{ ...hitStyle, ...fade(recording) }}>
          <view style={flashChipStyle(flash === 'on')}>
            <text style={{ ...flashGlyphStyle(flash === 'on'), opacity: flash === 'off' ? 0.55 : 1 }}>{'⚡︎'}</text>
            {flash === 'auto' && <text style={flashBadgeStyle}>A</text>}
          </view>
        </view>
        {mode === 'video' && (
          <view style={timerStyle(recording)}>
            <text style={timerTextStyle}>{formatDuration(recording ? elapsedMs : 0)}</text>
          </view>
        )}
        <view style={hitStyle} />
      </view>

      {toast && (
        <view style={toastWrapStyle}>
          <view bindtap={() => setToast(null)} style={toastStyle}>
            {toast.error && <view style={toastDotStyle} />}
            <text style={toastTextStyle}>{toast.text}</text>
          </view>
        </view>
      )}

      {/* Zoom stops — tap one, or long-press to open the dial. The lit stop shows the live value. */}
      <view style={zoomWrapStyle} bindtouchstart={armDial} bindtouchend={cancelDial} bindtouchmove={dialDrag}>
        <view style={zoomPillStyle}>
          {zoomStops.map((stop) => {
            const active = stop === lit
            return (
              <view key={stop} bindtap={() => applyZoom(stop)} style={zoomItemStyle(active)}>
                <text style={zoomTextStyle(active)}>{active ? `${formatZoom(zoom)}×` : formatZoom(stop)}</text>
              </view>
            )
          })}
        </view>
      </view>

      {/* Mode carousel — tap a mode or swipe the preview sideways. */}
      <view style={modeWrapStyle}>
        <view style={modeRowStyle(mode, recording)}>
          {MODES.map((m) => (
            <view key={m} bindtap={() => selectMode(m)} style={modeItemStyle}>
              <text style={modeTextStyle(mode === m)}>{m.toUpperCase()}</text>
            </view>
          ))}
        </view>
      </view>

      {/* Bottom bar: last capture · shutter · flip. Side controls step aside while recording. */}
      <view style={bottomBarStyle}>
        <view bindtap={openReview} style={{ ...thumbStyle, ...fade(recording) }}>
          {photoSource ? (
            <image src={photoSource} style={fillStyle} mode="aspectFill" />
          ) : media?.kind === 'video' ? (
            <text style={playGlyphStyle}>{'▶'}</text>
          ) : null}
        </view>

        <view
          bindtouchstart={() => setPressed(true)}
          bindtouchend={() => setPressed(false)}
          bindtouchcancel={() => setPressed(false)}
          bindtap={shutter}
          style={{ ...shutterRingStyle, opacity: busy ? 0.5 : 1 }}
        >
          <view style={shutterInnerStyle(shutterKind, pressed)} />
        </view>

        <view bindtap={flip} style={{ ...flipStyle, ...fade(recording) }}>
          <text style={flipGlyphStyle(flipTurns)}>{'↻'}</text>
        </view>
      </view>

      {/* Zoom dial — long-press for fine, continuous zoom. */}
      {dialOpen && (
        <view bindtap={() => setDialOpen(false)} bindtouchmove={dialDrag} style={dialOverlayStyle}>
          <view style={dialFanStyle} />
          {dialTicks().map((z, i) => {
            const p = dialPoint(z)
            return <view key={i} style={dialTickStyle(p.x, p.y, dialTickRotation(z), i % 10 === 0, Math.abs(z - zoom) < 0.12)} />
          })}
          {zoomStops.map((z) => {
            const p = dialPoint(z)
            return (
              <text key={`lbl${z}`} style={dialLabelStyle(p.x, p.y)}>
                {formatZoom(z)}
              </text>
            )
          })}
          <text style={dialValueStyle}>{formatZoom(zoom)}×</text>
        </view>
      )}

      {/* Review — tapping the thumbnail lands here. */}
      {reviewing && media && (
        <view style={reviewStyle}>
          {media.kind === 'photo' && photoSource ? (
            <image src={photoSource} style={reviewImageStyle} mode="aspectFill" />
          ) : (
            <view style={{ ...fillStyle, ...center, flexDirection: 'column' }}>
              <text style={{ ...playGlyphStyle, fontSize: '56px' }}>{'▶'}</text>
              <text style={reviewMetaStyle}>Video · {formatDuration(media.kind === 'video' ? (media.file.durationMs ?? 0) : 0)}</text>
            </view>
          )}
          <view style={reviewBarStyle}>
            <view bindtap={() => setReviewing(false)} style={textButtonStyle}>
              <text style={textButtonTextStyle}>Retake</text>
            </view>
            <view bindtap={saveCurrentMedia} style={{ ...saveButtonStyle, opacity: busy ? 0.5 : 1 }}>
              <text style={glyphStyle}>{saved ? '✓' : '↓'}</text>
            </view>
            {media.kind === 'photo' && uploadPhoto ? (
              <view bindtap={uploadCurrentPhoto} style={textButtonStyle}>
                <text style={primaryButtonTextStyle}>{busy ? 'Uploading…' : 'Use Photo'}</text>
              </view>
            ) : (
              <view bindtap={() => setReviewing(false)} style={textButtonStyle}>
                <text style={primaryButtonTextStyle}>Done</text>
              </view>
            )}
          </view>
          {toast && (
            <view style={toastWrapStyle}>
              <view style={toastStyle}>
                {toast.error && <view style={toastDotStyle} />}
                <text style={toastTextStyle}>{toast.text}</text>
              </view>
            </view>
          )}
        </view>
      )}
    </view>
  )
}

export default CameraDemo
