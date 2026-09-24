/*
 * Shared style objects for the camera demo. `react/src/App.tsx` passes them to
 * `style={}` and `vue/src/App.vue` to `:style=""` — plain objects, so both
 * frameworks take them verbatim.
 *
 * The look follows the iOS Camera app: the preview sits in its capture frame
 * between black bands, controls are flat dark chips rather than glass, and the
 * one accent is the system yellow. State-dependent styles are small functions
 * so both apps compute them the same way.
 *
 * Lynx note: `<view>` defaults to `display: linear`, so every flex row/centre
 * here sets `display: 'flex'` explicitly — without it children stack and overlap.
 *
 * ponytail: icons are text glyphs. Swap in baked SF-style PNGs for a pixel-true look.
 */
import { DIAL_PIVOT_X, DIAL_PIVOT_Y, DIAL_RADIUS, MODE_ITEM_W, modeOffset, previewFrame, screenH, screenW, type Mode } from './camera-core.js'

export const YELLOW = '#ffd60a'
export const RED = '#ff3b30'
const chipBg = 'rgba(28,28,30,0.72)'
// iOS spring-ish ease for everything that moves.
const ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

const row = { display: 'flex' as const, flexDirection: 'row' as const }
export const center = { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const }
const abs = { position: 'absolute' as const }

export const rootStyle = { position: 'relative' as const, width: '100%', height: '100%', backgroundColor: '#000000' }
export const fillStyle = { ...abs, left: '0', top: '0', right: '0', bottom: '0', width: '100%', height: '100%' }

// Controls hang off the bottom of the photo frame (or a fixed band on short
// screens), so switching photo ↔ video resizes the preview without moving them.
const photo = previewFrame('photo')
const CONTROLS_TOP = Math.min(photo.top + photo.height, screenH - 212)

/** The preview's box for a mode; the focus catcher and capture blink share it. */
export const previewStyle = (mode: Mode) => {
  const f = previewFrame(mode)
  return { ...abs, left: '0', width: `${screenW}px`, top: `${f.top}px`, height: `${f.height}px`, overflow: 'hidden' as const }
}

/** Letterbox bands above and below the frame: solid for photo, see-through for video. */
export const bandStyles = (mode: Mode) => {
  const f = previewFrame(mode)
  const backgroundColor = mode === 'video' ? 'rgba(0,0,0,0.35)' : '#000000'
  return [
    { ...abs, left: '0', right: '0', top: '0', height: `${f.top}px`, backgroundColor },
    { ...abs, left: '0', right: '0', top: `${f.top + f.height}px`, bottom: '0', backgroundColor },
  ]
}

/** The shutter "blink": the preview goes black for a beat as the photo is taken. */
export const blinkStyle = (on: boolean) => ({ ...fillStyle, backgroundColor: '#000000', opacity: on ? 1 : 0, transition: 'opacity 120ms linear' })

// Focus reticle: a thin yellow square with a tick at each edge's midpoint. It
// lands at 1.3× and settles to 1× so each tap reads as a fresh focus.
export const RETICLE = 76
export const reticleStyle = (x: number, y: number, settled: boolean) => ({
  ...abs,
  left: `${x - RETICLE / 2}px`,
  top: `${y - RETICLE / 2}px`,
  width: `${RETICLE}px`,
  height: `${RETICLE}px`,
  borderWidth: '1px',
  borderStyle: 'solid' as const,
  borderColor: YELLOW,
  transform: `scale(${settled ? 1 : 1.3})`,
  transition: `transform 280ms ${ease}`,
})
const mid = `${RETICLE / 2 - 1}px`
export const reticleTickStyles = [
  { ...abs, left: mid, top: '0', width: '1px', height: '6px', backgroundColor: YELLOW },
  { ...abs, left: mid, bottom: '0', width: '1px', height: '6px', backgroundColor: YELLOW },
  { ...abs, top: mid, left: '0', width: '6px', height: '1px', backgroundColor: YELLOW },
  { ...abs, top: mid, right: '0', width: '6px', height: '1px', backgroundColor: YELLOW },
]
export const exposureTextStyle = { color: YELLOW, fontSize: '13px', fontWeight: 'bold' as const }

// Top strip: flash · recording clock · (spacer), inside the top band.
export const topBarStyle = { ...row, ...abs, top: '54px', left: '16px', right: '16px', height: '44px', alignItems: 'center' as const, justifyContent: 'space-between' as const }
export const hitStyle = { ...center, width: '44px', height: '44px' }
export const flashChipStyle = (on: boolean) => ({ ...center, width: '34px', height: '34px', borderRadius: '17px', backgroundColor: on ? YELLOW : chipBg })
export const flashGlyphStyle = (on: boolean) => ({ color: on ? '#000000' : '#ffffff', fontSize: '16px' })
export const flashBadgeStyle = { color: '#ffffff', fontSize: '9px', fontWeight: 'bold' as const, marginLeft: '1px' }

export const timerStyle = (recording: boolean) => ({ ...center, height: '26px', paddingLeft: '8px', paddingRight: '8px', borderRadius: '6px', backgroundColor: recording ? RED : 'transparent' })
export const timerTextStyle = { color: '#ffffff', fontSize: '17px' }

// Transient status pill ("Flash Auto", "Saved to Photos", errors) under the top bar.
export const toastWrapStyle = { ...row, ...abs, top: '104px', left: '20px', right: '20px', justifyContent: 'center' as const }
export const toastStyle = { ...row, alignItems: 'center' as const, paddingTop: '7px', paddingBottom: '7px', paddingLeft: '14px', paddingRight: '14px', borderRadius: '16px', backgroundColor: 'rgba(44,44,46,0.92)' }
export const toastTextStyle = { color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const }
export const toastDotStyle = { width: '8px', height: '8px', borderRadius: '4px', backgroundColor: RED, marginRight: '8px' }

// Zoom stops: small dark chips; the active one grows and shows the live value in yellow.
export const zoomWrapStyle = { ...row, ...abs, left: '0', right: '0', top: `${CONTROLS_TOP - 58}px`, justifyContent: 'center' as const }
export const zoomPillStyle = { ...row, alignItems: 'center' as const, padding: '4px', borderRadius: '24px', backgroundColor: 'rgba(0,0,0,0.28)' }
export const zoomItemStyle = (active: boolean) => {
  const size = active ? 40 : 32
  return { ...center, width: `${size}px`, height: `${size}px`, borderRadius: '20px', marginLeft: '2px', marginRight: '2px', backgroundColor: chipBg, transition: `width 200ms ${ease}, height 200ms ${ease}` }
}
export const zoomTextStyle = (active: boolean) => ({ color: active ? YELLOW : '#ffffff', fontSize: active ? '13px' : '12px', fontWeight: 'bold' as const })

// Mode carousel: the selected mode slides to the centre.
export const modeWrapStyle = { ...abs, left: '0', top: `${CONTROLS_TOP + 14}px`, width: `${screenW}px`, height: '32px', overflow: 'hidden' as const }
export const modeRowStyle = (mode: Mode, hidden: boolean) => ({
  ...row,
  transform: `translateX(${modeOffset(mode)}px)`,
  opacity: hidden ? 0 : 1,
  transition: `transform 320ms ${ease}, opacity 200ms linear`,
})
export const modeItemStyle = { ...center, width: `${MODE_ITEM_W}px`, height: '32px' }
export const modeTextStyle = (active: boolean) => ({ color: active ? YELLOW : '#ffffff', fontSize: '13px', fontWeight: 'bold' as const, letterSpacing: '1px' })

// Bottom bar: last capture · shutter · flip.
export const bottomBarStyle = {
  ...row,
  ...abs,
  top: `${CONTROLS_TOP + 68}px`,
  left: '28px',
  right: '28px',
  height: '80px',
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
}
export const fade = (hidden: boolean) => ({ opacity: hidden ? 0 : 1, transition: 'opacity 200ms linear' })
export const thumbStyle = { ...center, position: 'relative' as const, width: '48px', height: '48px', borderRadius: '8px', backgroundColor: '#1c1c1e', overflow: 'hidden' as const }
export const playGlyphStyle = { color: '#ffffff', fontSize: '18px' }

export const shutterRingStyle = { ...center, width: '78px', height: '78px', borderRadius: '39px', borderWidth: '4px', borderStyle: 'solid' as const, borderColor: '#ffffff' }
/** Inner disc: white for photo, red for video, a red rounded square while recording; dips when pressed. */
export const shutterInnerStyle = (kind: 'photo' | 'video' | 'stop', pressed: boolean) => {
  const size = kind === 'stop' ? 30 : 62
  return {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: kind === 'stop' ? '7px' : `${size / 2}px`,
    backgroundColor: kind === 'photo' ? '#ffffff' : RED,
    transform: `scale(${pressed ? 0.88 : 1})`,
    transition: `width 250ms ${ease}, height 250ms ${ease}, border-radius 250ms ${ease}, transform 120ms linear`,
  }
}

export const flipStyle = { ...center, width: '48px', height: '48px', borderRadius: '24px', backgroundColor: 'rgba(255,255,255,0.14)' }
/** The flip glyph turns half a revolution per switch. */
export const flipGlyphStyle = (turns: number) => ({ color: '#ffffff', fontSize: '22px', transform: `rotate(${turns * 180}deg)`, transition: `transform 450ms ${ease}` })
export const glyphStyle = { color: '#ffffff', fontSize: '20px' }

// Zoom dial: a dark fan behind a radial tick ruler; ticks near the value light up.
export const dialOverlayStyle = { ...fillStyle }
const FAN_R = DIAL_RADIUS + 44
export const dialFanStyle = {
  ...abs,
  left: `${DIAL_PIVOT_X - FAN_R}px`,
  top: `${DIAL_PIVOT_Y - FAN_R}px`,
  width: `${FAN_R * 2}px`,
  height: `${FAN_R * 2}px`,
  borderRadius: `${FAN_R}px`,
  backgroundColor: 'rgba(0,0,0,0.5)',
}
export const dialTickStyle = (x: number, y: number, rotation: number, major: boolean, on: boolean) => {
  const h = major ? 16 : 9
  return {
    ...abs,
    left: `${x - 0.75}px`,
    top: `${y - h / 2}px`,
    width: '1.5px',
    height: `${h}px`,
    backgroundColor: on ? YELLOW : major ? '#ffffff' : 'rgba(255,255,255,0.5)',
    transform: `rotate(${rotation}deg)`,
  }
}
export const dialLabelStyle = (x: number, y: number) => ({ ...abs, left: `${x - 16}px`, top: `${y + 12}px`, width: '32px', textAlign: 'center' as const, color: '#ffffff', fontSize: '12px', fontWeight: 'bold' as const })
export const dialValueStyle = { ...abs, left: '0', right: '0', top: `${DIAL_PIVOT_Y - DIAL_RADIUS - 44}px`, textAlign: 'center' as const, color: YELLOW, fontSize: '17px', fontWeight: 'bold' as const }

// Review: the capture in its photo frame, iOS picker bar underneath.
export const reviewStyle = { ...fillStyle, backgroundColor: '#000000' }
export const reviewImageStyle = previewStyle('photo')
export const reviewMetaStyle = { marginTop: '16px', color: '#d7d7d7', fontSize: '15px' }
export const reviewBarStyle = { ...row, ...abs, top: `${CONTROLS_TOP + 84}px`, left: '12px', right: '12px', height: '48px', alignItems: 'center' as const, justifyContent: 'space-between' as const }
export const textButtonStyle = { ...center, height: '48px', minWidth: '88px', paddingLeft: '12px', paddingRight: '12px' }
export const textButtonTextStyle = { color: '#ffffff', fontSize: '17px' }
export const primaryButtonTextStyle = { ...textButtonTextStyle, fontWeight: 'bold' as const }
export const saveButtonStyle = { ...flipStyle }
