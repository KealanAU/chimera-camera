import type { StaticImageData } from 'next/image'
import landingBgBack from '../../../public/img/landing-bg-back.webp'
import landingBgFront from '../../../public/img/landing-bg-front.webp'
import landingBgLynx from '../../../public/img/landing-bg-lynx.webp'
import landingBgMid from '../../../public/img/landing-bg-mid.webp'

export const PARALLAX_MAX = 5
export const PARALLAX_IDLE_RAMP_MS = 3000
export const PARALLAX_MOUSE_OVERRIDE_MS = 1200
export const PARALLAX_MULTIPLIER = 25
export const IMAGE_OVERSCAN_PERCENT = 2
export const PARALLAX_SPRING = {
  stiffness: 80,
  damping: 22,
  mass: 0.8,
} as const
export const PARALLAX_IDLE_X = {
  a: { amplitude: 0.85, frequency: 0.42, phase: 0 },
  b: { amplitude: 0.55, frequency: 0.19, phase: 1.2 },
  c: { amplitude: 0.3, frequency: 0.11, phase: 0.4 },
} as const
export const PARALLAX_IDLE_Y = {
  a: { amplitude: 0.7, frequency: 0.33, phase: 0.7 },
  b: { amplitude: 0.45, frequency: 0.17, phase: 2.1 },
  c: { amplitude: 0.25, frequency: 0.09, phase: 1.4 },
} as const
export const IMAGE_LAYER_SCALE = 1.05
export const ENTRY_ANIMATION = {
  introDelayMs: 800,
  reticlePulseMs: 375,
  focusDelayMs: 500,
  focusTransitionMs: 650,
  reticleVisibleAfterFocusMs: 200,
} as const
export const FOCUS_TRANSITION = `filter ${ENTRY_ANIMATION.focusTransitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`
export const LOGO_HIT_PADDING_PX = 24
export const INTRO_LOGO_FOCUS_POINT = {
  xRatio: 0.075,
  yRatio: 0.16,
} as const

export type Point = {
  x: number
  y: number
}

export type LandingLayerId = 'back' | 'mid' | 'lynx' | 'front'

export type LandingLayer = {
  id: LandingLayerId
  image: StaticImageData
  alt: string
  speed: number
  zIndexClassName: string
  offsetYPercent: number
  hasBiasedObjectPosition: boolean
  /**
   * Tap target in normalized image coordinates, tested front-to-back.
   * null means the layer only catches taps as the final fallback.
   */
  hitPolygon: Point[] | null
}

// sampled from each layer's alpha crest — regenerate if a cut moves
const MID_CREST: Point[] = [
  { x: 0, y: 0.378 },
  { x: 0.083, y: 0.349 },
  { x: 0.166, y: 0.381 },
  { x: 0.25, y: 0.408 },
  { x: 0.333, y: 0.388 },
  { x: 0.416, y: 0.355 },
  { x: 0.5, y: 0.37 },
  { x: 0.583, y: 0.433 },
  { x: 0.667, y: 0.451 },
  { x: 0.75, y: 0.454 },
  { x: 0.833, y: 0.455 },
  { x: 0.917, y: 0.456 },
  { x: 1, y: 0.458 },
]

const BERG_CREST: Point[] = [
  { x: 0, y: 0.469 },
  { x: 0.166, y: 0.462 },
  { x: 0.333, y: 0.487 },
  { x: 0.5, y: 0.484 },
  { x: 0.667, y: 0.479 },
  { x: 0.833, y: 0.484 },
  { x: 1, y: 0.484 },
]

const FRONT_RIDGE: Point[] = [
  { x: 0, y: 0.709 },
  { x: 0.166, y: 0.714 },
  { x: 0.25, y: 0.727 },
  { x: 0.333, y: 0.766 },
  { x: 0.5, y: 0.783 },
  { x: 0.667, y: 0.738 },
  { x: 0.75, y: 0.716 },
  { x: 1, y: 0.705 },
]

const BOTTOM_RIGHT: Point = { x: 1, y: 1 }
const BOTTOM_LEFT: Point = { x: 0, y: 1 }

export const FRONT_LAYER_OFFSET_Y_PERCENT = 0

export const LAYERS: LandingLayer[] = [
  {
    id: 'back',
    image: landingBgBack,
    alt: 'Clouds over the Jökulsárlón glacier lagoon',
    speed: 0.02,
    zIndexClassName: 'z-0',
    offsetYPercent: 0,
    hasBiasedObjectPosition: false,
    hitPolygon: null,
  },
  {
    id: 'mid',
    image: landingBgMid,
    alt: 'Snow-covered mountains and glacier tongue in the distance',
    speed: 0.04,
    zIndexClassName: 'z-[1]',
    offsetYPercent: 0,
    hasBiasedObjectPosition: false,
    hitPolygon: [...MID_CREST, BOTTOM_RIGHT, BOTTOM_LEFT],
  },
  {
    id: 'lynx',
    image: landingBgLynx,
    alt: 'Icebergs drifting in the glacier lagoon',
    speed: 0.06,
    zIndexClassName: 'z-[3]',
    offsetYPercent: 0,
    hasBiasedObjectPosition: false,
    hitPolygon: [...BERG_CREST, BOTTOM_RIGHT, BOTTOM_LEFT],
  },
  {
    id: 'front',
    image: landingBgFront,
    alt: 'Foreground lagoon water',
    speed: 0.08,
    zIndexClassName: 'z-[5]',
    offsetYPercent: FRONT_LAYER_OFFSET_Y_PERCENT,
    hasBiasedObjectPosition: true,
    hitPolygon: [...FRONT_RIDGE, BOTTOM_RIGHT, BOTTOM_LEFT],
  },
]

export const BLUR_AMOUNTS = {
  back: { back: 0, mid: 2, logo: 2, lynx: 10, front: 24 },
  mid: { back: 2, mid: 0, logo: 1, lynx: 8, front: 20 },
  logo: { back: 1, mid: 1, logo: 0, lynx: 8, front: 24 },
  lynx: { back: 8, mid: 5, logo: 4, lynx: 0, front: 10 },
  front: { back: 12, mid: 10, logo: 8, lynx: 4, front: 0 },
} as const

const FRONT_LAYER_IMAGE_WIDTH =
  typeof landingBgFront.width === 'number' ? landingBgFront.width : 2000
const FRONT_LAYER_IMAGE_HEIGHT =
  typeof landingBgFront.height === 'number' ? landingBgFront.height : 1332
export const FRONT_LAYER_BIAS_START_ASPECT_RATIO =
  FRONT_LAYER_IMAGE_WIDTH / FRONT_LAYER_IMAGE_HEIGHT
export const FRONT_LAYER_BIAS_END_ASPECT_RATIO = 0.5
export const FRONT_LAYER_MIN_OBJECT_POSITION_X_PERCENT = 33
export const LANDING_BG_SIZES = '(max-aspect-ratio: 3/2) 150vh, 100vw'
export const FOCUS_RETICLE_SIZE = 16
export const FOCUS_RETICLE_BOX_SIZE = FOCUS_RETICLE_SIZE * 4
export const LANDING_SKIP_INTRO_STORAGE_KEY = '@vyui/camera-landing-skip-intro-once'

export type FocusTarget = keyof typeof BLUR_AMOUNTS

export type FocusPosition = {
  xPercent: number
  yPercent: number
}

export type Offset = {
  x: number
  y: number
}

export type Size = {
  width: number
  height: number
}
