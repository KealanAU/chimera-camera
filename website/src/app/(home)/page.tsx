'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FOCUS_RETICLE_BOX_SIZE,
  FOCUS_TRANSITION,
  IMAGE_LAYER_SCALE,
  INTRO_LOGO_FOCUS_POINT,
  LANDING_BG_SIZES,
  LAYERS,
  LOGO_HIT_PADDING_PX,
  type Offset,
} from '@/components/landing/constants'
import {
  getFrontLayerObjectPositionXPercent,
  hitTestLayers,
} from '@/components/landing/geometry'
import { ParallaxBlurLayer } from '@/components/landing/ParallaxBlurLayer'
import {
  markSkipIntroOnNextLandingVisit,
  shouldSkipIntroForNextPath,
} from '@/components/landing/storage'
import { useFocusReticle } from '@/components/landing/useFocusReticle'
import { useParallaxMotion } from '@/components/landing/useParallaxMotion'

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const logoHitAreaRef = useRef<HTMLDivElement>(null)
  const logoWordmarkRef = useRef<HTMLHeadingElement>(null)
  const { containerSize, layerMotion } = useParallaxMotion(containerRef)

  // ?debug=cut outlines each cut layer's alpha edge and exaggerates parallax
  const [debugCut, setDebugCut] = useState(false)
  useEffect(() => {
    setDebugCut(new URLSearchParams(window.location.search).get('debug') === 'cut')
  }, [])

  const getIntroLogoFocusPosition = useCallback(() => {
    const containerRect = containerRef.current?.getBoundingClientRect()
    const logoRect = logoWordmarkRef.current?.getBoundingClientRect()

    if (containerRect == null || logoRect == null) {
      return { xPercent: 50, yPercent: 50 }
    }

    const x =
      logoRect.left +
      logoRect.width * INTRO_LOGO_FOCUS_POINT.xRatio -
      containerRect.left
    const y =
      logoRect.top +
      logoRect.height * INTRO_LOGO_FOCUS_POINT.yRatio -
      containerRect.top

    return {
      xPercent: (x / containerRect.width) * 100,
      yPercent: (y / containerRect.height) * 100,
    }
  }, [])

  const {
    blurAmounts,
    focusTarget,
    isReticlePulsing,
    isReticleVisible,
    reticlePosition,
    triggerFocus,
  } = useFocusReticle(getIntroLogoFocusPosition)

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      const anchor = target.closest('a[href]')
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        anchor.origin !== window.location.origin
      ) {
        return
      }

      if (shouldSkipIntroForNextPath(anchor.pathname)) {
        markSkipIntroOnNextLandingVisit()
      }
    }

    document.addEventListener('click', handleDocumentClick, true)
    return () => {
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [])

  const containerAspectRatio =
    containerSize != null && containerSize.height > 0
      ? containerSize.width / containerSize.height
      : null
  const frontLayerObjectPositionX =
    getFrontLayerObjectPositionXPercent(containerAspectRatio)
  const isLogoFocused = focusTarget === 'logo'
  const handleLogoLinkPointerDown = isLogoFocused
    ? (event: React.PointerEvent<HTMLAnchorElement>) => event.stopPropagation()
    : undefined
  const logoLinkTabIndex = isLogoFocused ? 0 : -1

  const handleFocusPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const targetElement = event.target instanceof Element ? event.target : null

    if (targetElement?.closest('a, button')) {
      return
    }

    const container = containerRef.current
    if (container == null) {
      return
    }

    const rect = container.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const normalizedX = x / rect.width
    const normalizedY = y / rect.height
    const xPercent = normalizedX * 100
    const yPercent = normalizedY * 100

    const logoRect = logoHitAreaRef.current?.getBoundingClientRect()
    const withinLogo =
      logoRect != null &&
      event.clientX >= logoRect.left - LOGO_HIT_PADDING_PX &&
      event.clientX <= logoRect.right + LOGO_HIT_PADDING_PX &&
      event.clientY >= logoRect.top - LOGO_HIT_PADDING_PX &&
      event.clientY <= logoRect.bottom + LOGO_HIT_PADDING_PX

    let target: typeof focusTarget
    if (withinLogo) {
      target = 'logo'
    } else {
      const offsets = {} as Record<(typeof LAYERS)[number]['id'], Offset>
      for (const layer of LAYERS) {
        offsets[layer.id] = {
          x: layerMotion[layer.id].x.get(),
          y: layerMotion[layer.id].y.get(),
        }
      }

      target = hitTestLayers(
        normalizedX,
        normalizedY,
        rect.width,
        rect.height,
        offsets,
        frontLayerObjectPositionX,
      )
    }

    triggerFocus(target, { xPercent, yPercent })
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-0 -mt-14 w-full overflow-hidden touch-none"
      onPointerDown={handleFocusPointerDown}
    >
      {LAYERS.map((layer) => (
        <ParallaxBlurLayer
          key={layer.id}
          x={layerMotion[layer.id].x}
          y={layerMotion[layer.id].y}
          blurAmount={blurAmounts[layer.id]}
          zIndexClassName={layer.zIndexClassName}
          debugTint={
            debugCut
              ? { back: undefined, mid: '#ff2d55', lynx: '#ffcc00', front: '#00b7ff' }[
                  layer.id
                ]
              : undefined
          }
          motionScale={debugCut ? 8 : 1}
        >
          <div
            className="relative h-full w-full"
            style={{
              transform: `translateY(${layer.offsetYPercent}%) scale(${IMAGE_LAYER_SCALE})`,
            }}
          >
            <Image
              src={layer.image}
              alt={layer.alt}
              fill
              className="object-cover"
              style={
                layer.hasBiasedObjectPosition
                  ? { objectPosition: `${frontLayerObjectPositionX}% 50%` }
                  : undefined
              }
              sizes={LANDING_BG_SIZES}
              quality={100}
              placeholder="blur"
              draggable={false}
              priority
            />
          </div>
        </ParallaxBlurLayer>
      ))}

      <div className="absolute inset-0 flex items-center justify-center z-[4]">
        <div ref={logoHitAreaRef} className="flex flex-col items-center gap-6">
          <h1
            ref={logoWordmarkRef}
            className="lc-wordmark m-0 max-w-[min(82vw,560px)] px-4 text-center text-5xl leading-none text-black md:text-7xl"
            style={{
              filter: `blur(${blurAmounts.logo}px)`,
              transition: FOCUS_TRANSITION,
            }}
          >
            Chimera Camera
          </h1>
          <div
            className="flex flex-wrap items-center justify-center gap-3"
            style={{
              filter: isLogoFocused ? 'none' : `blur(${blurAmounts.logo}px)`,
              transition: FOCUS_TRANSITION,
            }}
          >
            <Link
              href="/docs"
              onPointerDown={handleLogoLinkPointerDown}
              tabIndex={logoLinkTabIndex}
              aria-disabled={!isLogoFocused}
              className={`rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90 ${
                isLogoFocused ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
            >
              Get Started
            </Link>
            <Link
              href="/api"
              onPointerDown={handleLogoLinkPointerDown}
              tabIndex={logoLinkTabIndex}
              aria-disabled={!isLogoFocused}
              className={`rounded-full bg-black/60 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black/70 ${
                isLogoFocused ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
            >
              API Reference
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none z-[6]">
        <div className="absolute left-0 right-0 top-1/3 h-[1.5px] bg-white/35" />
        <div className="absolute left-0 right-0 bottom-1/3 h-[1.5px] bg-white/35" />
        <div className="absolute left-1/3 top-0 bottom-0 w-[1.5px] bg-white/35" />
        <div className="absolute right-1/3 top-0 bottom-0 w-[1.5px] bg-white/35" />
      </div>

      <a
        href="https://visioncamera.margelo.com"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-5 left-1/2 z-[8] -translate-x-1/2 whitespace-nowrap text-xs font-medium tracking-wide text-white/60 transition-colors hover:text-white"
      >
        Built on the open-source VisionCamera&ensp;❤️
      </a>

      <div className="absolute inset-0 pointer-events-none z-[7]">
        <div
          className={`absolute transition-opacity duration-150 ${
            isReticleVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            left: `${reticlePosition.xPercent}%`,
            top: `${reticlePosition.yPercent}%`,
            width: `${FOCUS_RETICLE_BOX_SIZE}px`,
            height: `${FOCUS_RETICLE_BOX_SIZE}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className={`relative h-full w-full ${isReticlePulsing ? 'focus-reticle-pulse' : ''}`}
          >
            <div className="absolute inset-0 border-2 border-yellow-400 rounded-sm" />
            <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[2px] h-3 bg-yellow-400" />
            <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[2px] h-3 bg-yellow-400" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-[2px] bg-yellow-400" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-[2px] bg-yellow-400" />
          </div>
        </div>
      </div>
    </div>
  )
}
