'use client'

import { type MotionValue, useMotionValue, useSpring } from 'motion/react'
import {
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  type LandingLayerId,
  LAYERS,
  PARALLAX_IDLE_RAMP_MS,
  PARALLAX_IDLE_X,
  PARALLAX_IDLE_Y,
  PARALLAX_MAX,
  PARALLAX_MOUSE_OVERRIDE_MS,
  PARALLAX_MULTIPLIER,
  PARALLAX_SPRING,
  type Size,
} from '@/components/landing/constants'
import { clamp, easeInOutSine } from '@/components/landing/geometry'

export type LayerMotion = {
  xTarget: MotionValue<number>
  yTarget: MotionValue<number>
  x: MotionValue<number>
  y: MotionValue<number>
}

function useLayerMotion(): LayerMotion {
  const xTarget = useMotionValue(0)
  const yTarget = useMotionValue(0)
  const x = useSpring(xTarget, PARALLAX_SPRING)
  const y = useSpring(yTarget, PARALLAX_SPRING)

  return useMemo(() => ({ xTarget, yTarget, x, y }), [xTarget, yTarget, x, y])
}

export function useParallaxMotion(
  containerRef: RefObject<HTMLDivElement | null>,
) {
  const mouseRef = useRef({ x: 0, y: 0 })
  const mouseLastMovedAtRef = useRef(0)
  const idleRef = useRef({
    startTime: 0,
  })
  const [containerSize, setContainerSize] = useState<Size | null>(null)

  const back = useLayerMotion()
  const mid = useLayerMotion()
  const lynx = useLayerMotion()
  const front = useLayerMotion()
  const layerMotion: Record<LandingLayerId, LayerMotion> = useMemo(
    () => ({ back, mid, lynx, front }),
    [back, mid, lynx, front],
  )

  useEffect(() => {
    const container = containerRef.current
    if (container == null) {
      return
    }

    const updateSize = (width: number, height: number) => {
      setContainerSize((current) => {
        if (current?.width === width && current.height === height) {
          return current
        }

        return { width, height }
      })
    }

    const rect = container.getBoundingClientRect()
    updateSize(rect.width, rect.height)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry == null) {
        return
      }

      updateSize(entry.contentRect.width, entry.contentRect.height)
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [containerRef])

  useEffect(() => {
    const container = containerRef.current
    if (container == null) {
      return
    }

    let rafId: number | null = null
    let pausedAt: number | null = null

    const animate = (now: number) => {
      const idle = idleRef.current
      const elapsedMs = now - idle.startTime
      const elapsedSeconds = elapsedMs / 1000

      const rampUp = easeInOutSine(
        Math.min(elapsedMs / PARALLAX_IDLE_RAMP_MS, 1),
      )

      const idleX =
        (Math.sin(
          elapsedSeconds * PARALLAX_IDLE_X.a.frequency +
            PARALLAX_IDLE_X.a.phase,
        ) *
          PARALLAX_IDLE_X.a.amplitude +
          Math.sin(
            elapsedSeconds * PARALLAX_IDLE_X.b.frequency +
              PARALLAX_IDLE_X.b.phase,
          ) *
            PARALLAX_IDLE_X.b.amplitude +
          Math.cos(
            elapsedSeconds * PARALLAX_IDLE_X.c.frequency +
              PARALLAX_IDLE_X.c.phase,
          ) *
            PARALLAX_IDLE_X.c.amplitude) *
        rampUp

      const idleY =
        (Math.cos(
          elapsedSeconds * PARALLAX_IDLE_Y.a.frequency +
            PARALLAX_IDLE_Y.a.phase,
        ) *
          PARALLAX_IDLE_Y.a.amplitude +
          Math.sin(
            elapsedSeconds * PARALLAX_IDLE_Y.b.frequency +
              PARALLAX_IDLE_Y.b.phase,
          ) *
            PARALLAX_IDLE_Y.b.amplitude +
          Math.cos(
            elapsedSeconds * PARALLAX_IDLE_Y.c.frequency +
              PARALLAX_IDLE_Y.c.phase,
          ) *
            PARALLAX_IDLE_Y.c.amplitude) *
        rampUp

      const msSinceMouseMove = now - mouseLastMovedAtRef.current
      const blend =
        mouseLastMovedAtRef.current === 0
          ? 0
          : Math.max(0, 1 - msSinceMouseMove / PARALLAX_MOUSE_OVERRIDE_MS)
      const mouse = mouseRef.current

      const combinedX = idleX * (1 - blend) + mouse.x * blend
      const combinedY = idleY * (1 - blend) + mouse.y * blend

      for (const layer of LAYERS) {
        const motion = layerMotion[layer.id]
        motion.xTarget.set(
          clamp(
            combinedX * PARALLAX_MAX * layer.speed * PARALLAX_MULTIPLIER,
            PARALLAX_MAX,
          ),
        )
        motion.yTarget.set(
          clamp(
            combinedY * PARALLAX_MAX * layer.speed * PARALLAX_MULTIPLIER,
            PARALLAX_MAX,
          ),
        )
      }

      rafId = requestAnimationFrame(animate)
    }

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseRef.current.x =
        (event.clientX - rect.left - rect.width / 2) / (rect.width / 2)
      mouseRef.current.y =
        (event.clientY - rect.top - rect.height / 2) / (rect.height / 2)
      mouseLastMovedAtRef.current = performance.now()
    }

    const startAnimationLoop = () => {
      if (rafId != null || document.visibilityState !== 'visible') {
        return
      }

      const now = performance.now()
      if (pausedAt != null) {
        idleRef.current.startTime += now - pausedAt
        pausedAt = null
      } else {
        idleRef.current.startTime = now
      }

      rafId = requestAnimationFrame(animate)
    }

    const stopAnimationLoop = () => {
      if (rafId == null) {
        return
      }

      cancelAnimationFrame(rafId)
      rafId = null
      pausedAt = performance.now()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startAnimationLoop()
        return
      }

      stopAnimationLoop()
    }

    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    startAnimationLoop()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (rafId != null) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [containerRef, layerMotion])

  return {
    layerMotion,
    containerSize,
  }
}
