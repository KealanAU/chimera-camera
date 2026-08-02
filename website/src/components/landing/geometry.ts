import {
  FRONT_LAYER_BIAS_END_ASPECT_RATIO,
  FRONT_LAYER_BIAS_START_ASPECT_RATIO,
  FRONT_LAYER_MIN_OBJECT_POSITION_X_PERCENT,
  IMAGE_LAYER_SCALE,
  type LandingLayer,
  type LandingLayerId,
  LAYERS,
  type Offset,
  type Point,
} from '@/components/landing/constants'

export function clamp(value: number, max: number) {
  return Math.max(-max, Math.min(max, value))
}

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

export function easeInOutSine(value: number) {
  return -(Math.cos(Math.PI * value) - 1) / 2
}

export function getFrontLayerObjectPositionXPercent(
  containerAspectRatio: number | null,
) {
  if (
    containerAspectRatio == null ||
    !Number.isFinite(containerAspectRatio) ||
    containerAspectRatio <= 0
  ) {
    return 50
  }

  const rawProgress = clamp01(
    (FRONT_LAYER_BIAS_START_ASPECT_RATIO - containerAspectRatio) /
      (FRONT_LAYER_BIAS_START_ASPECT_RATIO - FRONT_LAYER_BIAS_END_ASPECT_RATIO),
  )
  const biasProgress = easeInOutSine(rawProgress)

  return 50 - biasProgress * (50 - FRONT_LAYER_MIN_OBJECT_POSITION_X_PERCENT)
}

function getObjectCoverLocalCoordinate(
  normalizedValue: number,
  axis: 'x' | 'y',
  containerAspectRatio: number,
  imageAspectRatio: number,
  objectPosition: number,
) {
  const value = clamp01(normalizedValue)

  if (
    !Number.isFinite(containerAspectRatio) ||
    containerAspectRatio <= 0 ||
    !Number.isFinite(imageAspectRatio) ||
    imageAspectRatio <= 0
  ) {
    return value
  }

  if (axis === 'x') {
    if (containerAspectRatio >= imageAspectRatio) {
      return value
    }

    const visibleFraction = containerAspectRatio / imageAspectRatio
    const start = (1 - visibleFraction) * objectPosition
    return clamp01(start + value * visibleFraction)
  }

  if (containerAspectRatio <= imageAspectRatio) {
    return value
  }

  const visibleFraction = imageAspectRatio / containerAspectRatio
  const start = (1 - visibleFraction) * objectPosition
  return clamp01(start + value * visibleFraction)
}

function getLayerLocalPoint(
  normalizedX: number,
  normalizedY: number,
  width: number,
  height: number,
  offset: Offset,
  layer: LandingLayer,
  frontLayerObjectPositionXPercent: number,
) {
  if (width <= 0 || height <= 0) {
    return {
      x: clamp01(normalizedX),
      y: clamp01(normalizedY),
    }
  }

  const offsetX = offset.x / width
  const offsetY = offset.y / height + layer.offsetYPercent / 100
  const containerAspectRatio = width / height
  const imageAspectRatio = layer.image.width / layer.image.height
  const objectPositionX = layer.hasBiasedObjectPosition
    ? frontLayerObjectPositionXPercent / 100
    : 0.5
  const layerX = clamp01(
    0.5 + (normalizedX - 0.5 - offsetX) / IMAGE_LAYER_SCALE,
  )
  const layerY = clamp01(
    0.5 + (normalizedY - 0.5 - offsetY) / IMAGE_LAYER_SCALE,
  )

  return {
    x: getObjectCoverLocalCoordinate(
      layerX,
      'x',
      containerAspectRatio,
      imageAspectRatio,
      objectPositionX,
    ),
    y: getObjectCoverLocalCoordinate(
      layerY,
      'y',
      containerAspectRatio,
      imageAspectRatio,
      0.5,
    ),
  }
}

function isPointInPolygon(x: number, y: number, polygon: Point[]) {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]

    if (
      a.y > y !== b.y > y &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside
    }
  }

  return inside
}

export function hitTestLayers(
  normalizedX: number,
  normalizedY: number,
  width: number,
  height: number,
  offsets: Record<LandingLayerId, Offset>,
  frontLayerObjectPositionXPercent: number,
): LandingLayerId {
  for (let index = LAYERS.length - 1; index >= 0; index -= 1) {
    const layer = LAYERS[index]
    if (layer.hitPolygon == null) {
      continue
    }

    const localPoint = getLayerLocalPoint(
      normalizedX,
      normalizedY,
      width,
      height,
      offsets[layer.id],
      layer,
      frontLayerObjectPositionXPercent,
    )

    if (isPointInPolygon(localPoint.x, localPoint.y, layer.hitPolygon)) {
      return layer.id
    }
  }

  return 'back'
}
