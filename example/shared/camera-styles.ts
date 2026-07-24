/*
 * Shared style objects for the camera demo. `react/src/App.tsx` passes them to
 * `style={}` and `vue/src/App.vue` to `:style=""` — plain objects, so both
 * frameworks take them verbatim.
 *
 * Lynx note: `<view>` defaults to `display: linear`, so every flex row/centre
 * here sets `display: 'flex'` explicitly — without it children stack and overlap.
 *
 * ponytail: "glass" is faked with translucency + a hairline highlight + shadow
 * (Lynx iOS exposes no backdrop blur); flash/flip icons are text glyphs. Swap in
 * baked SF-style PNGs for a pixel-true look.
 */
import { DIAL_PIVOT_Y, DIAL_RADIUS } from './camera-core.js'

export const glassBg = 'rgba(255,255,255,0.14)'
const glass = {
  backgroundColor: glassBg,
  borderWidth: '1px',
  borderStyle: 'solid' as const,
  borderColor: 'rgba(255,255,255,0.28)',
  boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
}
const row = { display: 'flex' as const, flexDirection: 'row' as const }
export const center = { display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const }

export const rootStyle = { position: 'relative' as const, width: '100%', height: '100%', backgroundColor: '#000000' }
export const fillStyle = { position: 'absolute' as const, left: '0', top: '0', right: '0', bottom: '0', width: '100%', height: '100%' }

export const reticleStyle = {
  position: 'absolute' as const,
  width: '70px',
  height: '70px',
  borderRadius: '6px',
  borderWidth: '1px',
  borderStyle: 'solid' as const,
  borderColor: '#ffd60a',
}

export const topBarStyle = { ...row, position: 'absolute' as const, top: '56px', left: '20px', right: '20px' }

export const glassCircle = { ...glass, ...center, width: '52px', height: '52px', borderRadius: '26px' }
export const glyphStyle = { color: '#ffffff', fontSize: '22px' }
export const playGlyphStyle = { color: '#ffffff', fontSize: '20px' }

export const errorBannerStyle = {
  ...glass,
  position: 'absolute' as const,
  top: '120px',
  left: '20px',
  right: '20px',
  padding: '10px 14px',
  borderRadius: '14px',
  backgroundColor: 'rgba(201,42,42,0.9)',
}
export const errorTextStyle = { color: '#ffffff', fontSize: '13px' }

export const zoomWrapStyle = { ...row, position: 'absolute' as const, left: '0', right: '0', bottom: '190px', justifyContent: 'center' as const }
export const zoomPillStyle = { ...glass, ...row, padding: '4px', borderRadius: '22px' }
export const zoomItemStyle = { ...center, width: '42px', height: '34px', borderRadius: '17px' }
export const zoomTextStyle = { fontSize: '14px' }

export const modeWrapStyle = { ...row, position: 'absolute' as const, left: '0', right: '0', bottom: '138px', justifyContent: 'center' as const }
export const modeItemStyle = { ...center, padding: '4px 14px' }
export const modeTextStyle = { fontSize: '13px', fontWeight: 'bold' as const, letterSpacing: '1px' }

export const bottomBarStyle = {
  ...row,
  position: 'absolute' as const,
  bottom: '44px',
  left: '32px',
  right: '32px',
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
}

export const thumbStyle = {
  ...center,
  position: 'relative' as const,
  width: '54px',
  height: '54px',
  borderRadius: '12px',
  borderWidth: '1px',
  borderStyle: 'solid' as const,
  borderColor: 'rgba(255,255,255,0.5)',
  backgroundColor: 'rgba(255,255,255,0.1)',
  overflow: 'hidden' as const,
}

export const shutterRingStyle = { ...center, width: '80px', height: '80px', borderRadius: '40px', borderWidth: '4px', borderStyle: 'solid' as const, borderColor: 'rgba(255,255,255,0.95)' }
export const shutterPhotoStyle = { width: '64px', height: '64px', borderRadius: '32px', backgroundColor: '#ffffff' }
export const shutterVideoStyle = { width: '64px', height: '64px', borderRadius: '32px', backgroundColor: '#ff3b30' }
export const shutterStopStyle = { width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#ff3b30' }

// Light scrim so the camera stays clearly visible while zooming.
export const dialOverlayStyle = { ...fillStyle, backgroundColor: 'rgba(0,0,0,0.12)' }
// Value sits in the lower third, below the arc — not smack in the middle.
export const dialValueStyle = { position: 'absolute' as const, left: '0', right: '0', top: `${DIAL_PIVOT_Y - DIAL_RADIUS + 40}px`, textAlign: 'center' as const, color: '#ffd60a', fontSize: '30px', fontWeight: 'bold' as const }

export const reviewStyle = { ...fillStyle, backgroundColor: '#000000' }
export const reviewMetaStyle = { marginTop: '16px', color: '#d7d7d7', fontSize: '15px' }
export const usePhotoStyle = {
  ...center,
  position: 'absolute' as const,
  bottom: '48px',
  alignSelf: 'center' as const,
  left: '32px',
  right: '32px',
  height: '52px',
  borderRadius: '26px',
  backgroundColor: '#ffffff',
}
export const usePhotoTextStyle = { color: '#141414', fontSize: '16px', fontWeight: 'bold' as const }

// Secondary "save to library" pill above the primary Use Photo button.
export const saveStyle = {
  ...center,
  ...glass,
  position: 'absolute' as const,
  bottom: '112px',
  alignSelf: 'center' as const,
  left: '32px',
  right: '32px',
  height: '52px',
  borderRadius: '26px',
}
export const saveTextStyle = { color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const }
