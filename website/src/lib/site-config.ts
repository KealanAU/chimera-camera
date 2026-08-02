const DEFAULT_SITE_URL = 'https://camera.vyui.dev'
const DEFAULT_BRANCH = 'main'
const DEFAULT_REPOSITORY_URL = 'https://github.com/KealanAU/chimera-camera'
const DEFAULT_PACKAGE_URL = 'https://www.npmjs.com/package/@vyui/camera'

export const siteConfig = {
  name: 'Chimera Camera',
  description:
    'A Lynx-native camera surface with a plain TypeScript API over CameraX and AVFoundation.',
  alternateNames: ['@vyui/camera', 'Chimera Camera for Lynx'],
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL),
  repositoryUrl:
    process.env.NEXT_PUBLIC_REPOSITORY_URL ?? DEFAULT_REPOSITORY_URL,
  packageUrl: process.env.NEXT_PUBLIC_PACKAGE_URL ?? DEFAULT_PACKAGE_URL,
  repositoryBranch: DEFAULT_BRANCH,
  contentRoots: {
    docs: 'website/content/docs',
    api: 'website/content/api',
  },
  og: {
    width: 1200,
    height: 630,
    site: 'Chimera Camera',
  },
} as const

export type DocsScope = keyof typeof siteConfig.contentRoots

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, siteConfig.metadataBase).toString()
}

export function getMarkdownPath(pageUrl: string): string {
  return `${pageUrl}.mdx`
}

export function getOgImageUrl(pageUrl: string): string {
  // /docs/zooming -> /og/docs/zooming, /api/foo -> /og/api/foo, / -> /og
  return pageUrl === '/' ? '/og' : `/og${pageUrl}`
}

export function getOgImage(pageUrl: string) {
  return {
    url: getOgImageUrl(pageUrl),
    width: siteConfig.og.width,
    height: siteConfig.og.height,
  }
}

export function getGithubContentUrl(
  scope: DocsScope,
  pagePath: string,
): string {
  const root = siteConfig.contentRoots[scope]
  return `${siteConfig.repositoryUrl}/blob/${siteConfig.repositoryBranch}/${root}/${pagePath}`
}
