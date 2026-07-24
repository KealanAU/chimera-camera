/*
 * ReactLynx camera demo — iOS-style glass controls over Chimera Camera's
 * `camera-view`. Every framework-free piece (module wiring, screen probe, zoom
 * arc, exposure math) lives in `example/shared/camera-core.ts`, which
 * `example/vue/src/App.vue` imports verbatim; this file is state + handlers + JSX.
 *
 * Lynx note: `<view>` defaults to `display: linear`, so every flex row/centre
 * here sets `display: 'flex'` explicitly — without it children stack and overlap.
 *
 * ponytail: "glass" is faked with translucency + a hairline highlight + shadow
 * (Lynx iOS exposes no backdrop blur); flash/flip icons are text glyphs. Swap in
 * baked SF-style PNGs for a pixel-true look.
 */
import { useEffect, useRef, useState } from '@lynx-js/react'

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
  DIAL_PIVOT_Y,
  DIAL_RADIUS,
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

export interface CameraDemoProps {
  uploadPhoto?: (photo: PhotoFile) => Promise<void>
}

export function CameraDemo({ uploadPhoto }: CameraDemoProps) {
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>('photo')
  const [facing, setFacing] = useState<TargetCameraPosition>('back')
  const [media, setMedia] = useState<Media | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [recording, setRecording] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [zoomStops, setZoomStops] = useState<number[]>(DEFAULT_ZOOM_STOPS)
  const [flash, setFlash] = useState<FlashMode>('off')
  const [screenFlash, setScreenFlash] = useState(false)
  const [reticle, setReticle] = useState<{ x: number; y: number } | null>(null)
  const [exposureBias, setExposureBias] = useState(0)
  const [dialOpen, setDialOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSentZoom = useRef(1)
  const wideFactor = useRef(1)
  const activeFocus = useRef(false)
  const focusStartY = useRef(0)
  const lastSentBias = useRef(0)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-load: request permissions on mount so the preview just starts.
  useEffect(() => {
    void (async () => {
      try {
        await cameraModule.requestCameraPermission()
        await cameraModule.requestMicrophonePermission()
      } catch (e) {
        setError(toMessage(e))
      }
    })()
  }, [])

  async function shutter() {
    if (mode === 'video') return toggleRecording()
    if (busy) return
    setBusy(true)
    setError(null)
    // Most front cameras have no flash unit: light the subject with a screen
    // flash (the display faces the user), held briefly so the sensor sees it.
    // Back cameras get the real flash, fired by native at the shutter.
    if (facing === 'front' && flash === 'on') {
      setScreenFlash(true)
      await delay(180)
    }
    try {
      const handle = isNative ? session : cameraModule
      setMedia({ kind: 'photo', file: await handle.capturePhoto({ flash, includeBase64: true, maxDimension: 1600 }) })
    } catch (e) {
      setError(toMessage(e))
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
      setError(toMessage(e))
    }
  }

  // `value` is a display multiplier (0.5×, 1×, 3×…); convert to the device's
  // videoZoomFactor at the setZoom edge.
  async function applyZoom(value: number) {
    try {
      await session.setZoom(displayToFactor(value, wideFactor.current))
      setZoom(value)
      lastSentZoom.current = value
    } catch (e) {
      setError(toMessage(e))
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
      void session.setZoom(displayToFactor(rounded, wideFactor.current)).catch((e) => setError(toMessage(e)))
    }
  }

  // iOS order: off → auto → on. Nothing is sent to native here; the mode rides
  // along with capturePhoto() so the flash only fires at the shutter.
  function cycleFlash() {
    setFlash(flash === 'off' ? 'auto' : flash === 'auto' ? 'on' : 'off')
  }

  function flip() {
    setFacing(facing === 'back' ? 'front' : 'back')
    // Swapping the device input resets zoom to 1× natively, so mirror that here.
    setZoom(1)
    lastSentZoom.current = 1
  }

  // iOS focus+exposure gesture. Touch-down drops the reticle and focuses there
  // (resetting exposure to auto); then sliding up/down slides the sun to
  // brighten/dim; releasing fades the reticle out. Refs (not state) gate the
  // move so the rapid down→move sequence isn't tripped by async re-renders.
  function focusDown(event: TouchEventLike) {
    const t = touchPoint(event)
    const x = typeof t?.clientX === 'number' ? t.clientX : screenW / 2
    const y = typeof t?.clientY === 'number' ? t.clientY : screenH / 2
    if (fadeTimer.current) {
      clearTimeout(fadeTimer.current)
      fadeTimer.current = null
    }
    activeFocus.current = true
    focusStartY.current = y
    lastSentBias.current = 0
    setReticle({ x, y })
    setExposureBias(0)
    void session.focusAtPoint({ x: clamp01(x / screenW), y: clamp01(y / screenH) }).catch((e) => setError(toMessage(e)))
    void session.setExposureBias(0).catch(() => {})
  }

  function focusMove(event: TouchEventLike) {
    if (!activeFocus.current) return
    const t = touchPoint(event)
    if (typeof t?.clientY !== 'number') return
    const bias = clampEv((focusStartY.current - t.clientY) / EXPOSURE_PX_PER_EV) // drag up = brighter
    setExposureBias(bias)
    const rounded = Math.round(bias * 10) / 10
    if (rounded !== lastSentBias.current) {
      lastSentBias.current = rounded
      void session.setExposureBias(rounded).catch((e) => setError(toMessage(e)))
    }
  }

  function focusUp() {
    activeFocus.current = false
    fadeTimer.current = setTimeout(() => setReticle(null), 1500)
  }

  async function uploadCurrentPhoto() {
    if (media?.kind !== 'photo' || !uploadPhoto) return
    setBusy(true)
    try {
      await uploadPhoto(media.file)
      setReviewing(false)
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  // The other half of "upload or save": keep the capture in the device library.
  // Same temp file the upload path uses; saveToLibrary copies it into Photos.
  async function saveCurrentMedia() {
    if (!media) return
    setBusy(true)
    try {
      await cameraModule.saveToLibrary(media.file)
      setSaved(true)
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const photoSource = media?.kind === 'photo' && media.file.base64 ? `data:${media.file.mime ?? 'image/jpeg'};base64,${media.file.base64}` : null
  const shutterInner = recording ? shutterStopStyle : mode === 'video' ? shutterVideoStyle : shutterPhotoStyle

  return (
    <view style={rootStyle}>
      {/* Preview layer: live camera-view on native, last photo (or black) on mock. */}
      {isNative ? (
        <camera-view
          id="camera"
          active={true}
          facing={facing}
          resizeMode="cover"
          bindready={onCameraReady}
          binderror={(event: { detail?: { message?: string } }) => setError(event.detail?.message ?? 'camera-view failed')}
          style={fillStyle}
        />
      ) : photoSource ? (
        <image src={photoSource} style={fillStyle} mode="aspectFill" />
      ) : null}

      {/* Focus + exposure catcher — above the preview, below the controls. */}
      <view bindtouchstart={focusDown} bindtouchmove={focusMove} bindtouchend={focusUp} style={fillStyle} />
      {reticle && (
        <>
          <view style={{ ...reticleStyle, left: `${reticle.x - 35}px`, top: `${reticle.y - 35}px` }} />
          {/* Sun thumb slides on a track to the right of the box; up = brighter. */}
          <view style={{ position: 'absolute', left: `${reticle.x + 44}px`, top: `${reticle.y - EXPOSURE_TRACK_PX}px`, width: '2px', height: `${EXPOSURE_TRACK_PX * 2}px`, backgroundColor: 'rgba(255,214,10,0.4)' }} />
          <view style={{ position: 'absolute', left: `${reticle.x + 38}px`, top: `${reticle.y - (exposureBias / EXPOSURE_MAX) * EXPOSURE_TRACK_PX - 7}px`, width: '14px', height: '14px', borderRadius: '7px', backgroundColor: '#ffd60a' }} />
          {Math.abs(exposureBias) > 0.05 && (
            <text style={{ position: 'absolute', left: `${reticle.x + 58}px`, top: `${reticle.y - 9}px`, color: '#ffd60a', fontSize: '13px', fontWeight: 'bold' }}>
              {exposureBias > 0 ? '+' : ''}{exposureBias.toFixed(1)}
            </text>
          )}
        </>
      )}

      {/* Retina screen flash for the front camera (no hardware torch). */}
      {screenFlash && <view style={{ ...fillStyle, backgroundColor: '#ffffff' }} />}

      {/* Top strip: flash. */}
      <view style={topBarStyle}>
        <view bindtap={cycleFlash} style={{ ...glassCircle, backgroundColor: flash === 'off' ? glassBg : 'rgba(255,214,10,0.9)' }}>
          <text style={{ ...glyphStyle, color: flash === 'off' ? '#ffffff' : '#141414' }}>{flash === 'auto' ? '⚡︎A' : '⚡︎'}</text>
        </view>
      </view>

      {error && (
        <view bindtap={() => setError(null)} style={errorBannerStyle}>
          <text style={errorTextStyle}>{error}</text>
        </view>
      )}

      {/* Zoom pill — tap a stop, or long-press to open the arc dial. */}
      <view style={zoomWrapStyle} bindtouchstart={armDial} bindtouchend={cancelDial} bindtouchmove={dialDrag}>
        <view style={zoomPillStyle}>
          {zoomStops.map((stop) => {
            const active = zoom === stop
            return (
              <view key={stop} bindtap={() => applyZoom(stop)} style={{ ...zoomItemStyle, backgroundColor: active ? 'rgba(255,255,255,0.9)' : 'transparent' }}>
                <text style={{ ...zoomTextStyle, color: active ? '#141414' : '#ffffff', fontWeight: active ? 'bold' : 'normal' }}>
                  {stop}×
                </text>
              </view>
            )
          })}
        </view>
      </view>

      {/* PHOTO / VIDEO mode. */}
      <view style={modeWrapStyle}>
        {(['photo', 'video'] as Mode[]).map((m) => (
          <view key={m} bindtap={() => setMode(m)} style={modeItemStyle}>
            <text style={{ ...modeTextStyle, color: mode === m ? '#ffd60a' : '#ffffff' }}>{m.toUpperCase()}</text>
          </view>
        ))}
      </view>

      {/* Bottom bar: library thumbnail · shutter · flip. */}
      <view style={bottomBarStyle}>
        <view bindtap={() => media && (setSaved(false), setReviewing(true))} style={{ ...thumbStyle, opacity: media ? 1 : 0.4 }}>
          {photoSource ? (
            <image src={photoSource} style={fillStyle} mode="aspectFill" />
          ) : media?.kind === 'video' ? (
            <text style={playGlyphStyle}>{'▶'}</text>
          ) : null}
        </view>

        <view bindtap={shutter} style={{ ...shutterRingStyle, opacity: busy ? 0.5 : 1 }}>
          <view style={shutterInner} />
        </view>

        <view bindtap={flip} style={glassCircle}>
          <text style={glyphStyle}>{'↻'}</text>
        </view>
      </view>

      {/* Zoom arc — long-press dial for fine, continuous zoom. */}
      {dialOpen && (
        <view bindtap={() => setDialOpen(false)} bindtouchmove={dialDrag} style={dialOverlayStyle}>
          {dialTicks().map((z, i) => {
            const p = dialPoint(z)
            const on = Math.abs(z - zoom) < 0.25
            return (
              <view
                key={i}
                style={{ position: 'absolute', left: `${p.x - (on ? 5 : 3)}px`, top: `${p.y - (on ? 5 : 3)}px`, width: `${on ? 10 : 6}px`, height: `${on ? 10 : 6}px`, borderRadius: '5px', backgroundColor: on ? '#ffd60a' : 'rgba(255,255,255,0.55)' }}
              />
            )
          })}
          {zoomStops.map((z) => {
            const p = dialPoint(z)
            return (
              <text key={`lbl${z}`} style={{ position: 'absolute', left: `${p.x - 16}px`, top: `${p.y - 34}px`, width: '32px', textAlign: 'center' as const, color: '#ffffff', fontSize: '12px' }}>
                {z}×
              </text>
            )
          })}
          <text style={dialValueStyle}>{zoom.toFixed(1)}×</text>
        </view>
      )}

      {/* Full-screen review — tapping the thumbnail lands here. */}
      {reviewing && media && (
        <view style={reviewStyle}>
          {media.kind === 'photo' && photoSource ? (
            <image src={photoSource} style={fillStyle} mode="aspectFit" />
          ) : (
            <view style={{ ...fillStyle, ...center, flexDirection: 'column' }}>
              <text style={{ ...playGlyphStyle, fontSize: '56px' }}>{'▶'}</text>
              <text style={reviewMetaStyle}>Video · {media.kind === 'video' ? (media.file.durationMs ?? 0) : 0}ms</text>
            </view>
          )}
          <view bindtap={() => setReviewing(false)} style={{ ...glassCircle, position: 'absolute', top: '56px', left: '20px' }}>
            <text style={glyphStyle}>{'✕'}</text>
          </view>
          <view bindtap={saved ? undefined : saveCurrentMedia} style={saveStyle}>
            <text style={saveTextStyle}>{saved ? 'Saved ✓' : busy ? 'Saving…' : 'Save'}</text>
          </view>
          {media.kind === 'photo' && uploadPhoto && (
            <view bindtap={uploadCurrentPhoto} style={usePhotoStyle}>
              <text style={usePhotoTextStyle}>{busy ? 'Uploading…' : 'Use Photo'}</text>
            </view>
          )}
        </view>
      )}
    </view>
  )
}

export default CameraDemo
