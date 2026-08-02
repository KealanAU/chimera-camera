import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { notFound } from 'next/navigation'
import { ImageResponse } from 'next/og'
import { siteConfig } from '@/lib/site-config'
import { apiSource, docsSource } from '@/lib/source'

// Resolve the docs public directory: process.cwd() is docs/ locally, but can be
// the monorepo root in deployment environments.
function resolvePublicPath(relativePath: string): string {
  const fromCwd = join(process.cwd(), 'public', relativePath)
  if (existsSync(fromCwd)) return fromCwd
  return join(process.cwd(), 'docs/public', relativePath)
}

const geistRegular = readFileSync(resolvePublicPath('fonts/geist-400.woff'))
const geistBold = readFileSync(resolvePublicPath('fonts/geist-700.woff'))

export const ogImageAlt = `${siteConfig.name} documentation`
export const ogImageSize = {
  width: siteConfig.og.width,
  height: siteConfig.og.height,
} as const
export const ogImageContentType = 'image/png'

const ACCENT_COLOR = '#F5A623'

function CameraSlider() {
  const ticks: { id: string; height: number; opacity: number }[] = []
  const minorPerMajor = 8
  const majorSteps = 6
  const totalTicks = majorSteps * minorPerMajor + 1

  for (let i = 0; i < totalTicks; i++) {
    const isMajor = i % minorPerMajor === 0
    const center = (totalTicks - 1) / 2
    const distFromCenter = Math.abs(i - center) / center
    const edgeFade = Math.max(0, 1 - distFromCenter * 1.3)
    ticks.push({
      id: `tick-${i}`,
      height: isMajor ? 36 : 18,
      opacity: (isMajor ? 0.85 : 0.4) * edgeFade,
    })
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        width: '100%',
        height: 40,
      }}
    >
      {ticks.map((tick) => (
        <div
          key={tick.id}
          style={{
            display: 'flex',
            width: 6,
            height: tick.height,
            borderRadius: 3,
            backgroundColor: ACCENT_COLOR,
            opacity: tick.opacity,
          }}
        />
      ))}
    </div>
  )
}

function LynxCameraOgImage({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  const hasDescription = description != null && description.length > 0

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#1a1a1a',
        fontFamily: 'Geist',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: 48,
        }}
      >
        <div
          style={{
            display: 'flex',
            color: 'rgba(255,255,255,0.72)',
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          {siteConfig.name}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <p
            style={{
              display: '-webkit-box',
              WebkitLineClamp: hasDescription ? '2' : '3',
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: '#ffffff',
              fontSize: 100,
              fontWeight: 700,
              lineHeight: 1.15,
              wordBreak: 'break-word',
              margin: 0,
            }}
          >
            {title}
          </p>
          {hasDescription && (
            <p
              style={{
                display: '-webkit-box',
                WebkitLineClamp: '2',
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 50,
                fontWeight: 400,
                marginTop: 12,
                marginBottom: 0,
                marginLeft: 0,
                marginRight: 0,
                lineHeight: 1.4,
              }}
            >
              {description}
            </p>
          )}
          <div style={{ display: 'flex', marginTop: 48 }}>
            <CameraSlider />
          </div>
        </div>
      </div>
    </div>
  )
}

function renderOgImageResponse(title: string, description?: string) {
  return new ImageResponse(
    <LynxCameraOgImage title={title} description={description} />,
    {
      ...ogImageSize,
      fonts: [
        {
          name: 'Geist',
          data: geistRegular,
          weight: 400 as const,
          style: 'normal' as const,
        },
        {
          name: 'Geist',
          data: geistBold,
          weight: 700 as const,
          style: 'normal' as const,
        },
      ],
    },
  )
}

const sectionSources = {
  docs: docsSource,
  api: apiSource,
} as const

export function renderOpenGraphImage(slug?: string[]) {
  if (slug == null || slug.length === 0) {
    return renderOgImageResponse(siteConfig.name, siteConfig.description)
  }

  const [section, ...rest] = slug
  const source = sectionSources[section as keyof typeof sectionSources]
  if (source == null) notFound()

  const page = source.getPage(rest.length > 0 ? rest : undefined)
  if (!page) notFound()

  return renderOgImageResponse(
    String(page.data.title),
    page.data.description ?? undefined,
  )
}
