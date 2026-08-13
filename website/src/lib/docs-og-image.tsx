import { getCloudflareContext } from '@opennextjs/cloudflare'
import { notFound } from 'next/navigation'
import { ImageResponse } from 'next/og'
import { siteConfig } from '@/lib/site-config'
import { apiSource, docsSource } from '@/lib/source'

// The fonts come out of /public rather than off disk: this renders on Cloudflare
// Workers, which has no filesystem. They go through the ASSETS binding, not a
// plain fetch — a Worker fetching its own hostname times out (522). Cached per
// isolate.
let fontsPromise: Promise<[ArrayBuffer, ArrayBuffer]> | undefined

function loadFonts(base: string): Promise<[ArrayBuffer, ArrayBuffer]> {
  fontsPromise ??= Promise.all([
    fetchFont('/fonts/geist-400.woff', base),
    fetchFont('/fonts/geist-700.woff', base),
  ]).catch((error) => {
    // Otherwise one transient failure poisons the isolate for its whole life.
    fontsPromise = undefined
    throw error
  })
  return fontsPromise
}

async function fetchFont(path: string, base: string): Promise<ArrayBuffer> {
  const url = new URL(path, base)
  // `next dev` has no bindings; there a plain fetch hits the dev server.
  const assets = (await getCloudflareContext({ async: true })).env.ASSETS
  const response = await (assets ? assets.fetch(url) : fetch(url))
  if (!response.ok) {
    throw new Error(`Failed to load OG font ${path}: ${response.status}`)
  }
  return response.arrayBuffer()
}

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

async function renderOgImageResponse(
  base: string,
  title: string,
  description?: string,
) {
  const [geistRegular, geistBold] = await loadFonts(base)

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

export function renderOpenGraphImage(base: string, slug?: string[]) {
  if (slug == null || slug.length === 0) {
    return renderOgImageResponse(base, siteConfig.name, siteConfig.description)
  }

  const [section, ...rest] = slug
  const source = sectionSources[section as keyof typeof sectionSources]
  if (source == null) notFound()

  const page = source.getPage(rest.length > 0 ? rest : undefined)
  if (!page) notFound()

  return renderOgImageResponse(
    base,
    String(page.data.title),
    page.data.description ?? undefined,
  )
}
