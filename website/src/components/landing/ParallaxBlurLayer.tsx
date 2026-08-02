import type { MotionValue } from 'motion/react'
import { motion, useTransform } from 'motion/react'
import type { ReactNode } from 'react'
import {
  FOCUS_TRANSITION,
  IMAGE_OVERSCAN_PERCENT,
} from '@/components/landing/constants'

type ParallaxBlurLayerProps = {
  blurAmount: number
  children: ReactNode
  x: MotionValue<number>
  y: MotionValue<number>
  zIndexClassName: string
  /** ?debug=cut — outline this layer's alpha edge instead of blurring it */
  debugTint?: string
  /** ?debug=cut — exaggerate parallax so seams show while moving the mouse */
  motionScale?: number
}

export function ParallaxBlurLayer({
  blurAmount,
  children,
  x,
  y,
  zIndexClassName,
  debugTint,
  motionScale = 1,
}: ParallaxBlurLayerProps) {
  const scaledX = useTransform(x, (v) => v * motionScale)
  const scaledY = useTransform(y, (v) => v * motionScale)

  return (
    <motion.div
      className={`lc-landing-parallax-layer pointer-events-none absolute ${zIndexClassName}`}
      style={{
        top: `-${IMAGE_OVERSCAN_PERCENT}%`,
        right: `-${IMAGE_OVERSCAN_PERCENT}%`,
        bottom: `-${IMAGE_OVERSCAN_PERCENT}%`,
        left: `-${IMAGE_OVERSCAN_PERCENT}%`,
        x: scaledX,
        y: scaledY,
      }}
    >
      <div
        className="h-full w-full"
        style={{
          filter: debugTint
            ? `drop-shadow(0 0 1px ${debugTint}) drop-shadow(0 0 2px ${debugTint}) drop-shadow(0 0 4px ${debugTint})`
            : `blur(${blurAmount}px)`,
          transition: FOCUS_TRANSITION,
        }}
      >
        {children}
      </div>
    </motion.div>
  )
}
