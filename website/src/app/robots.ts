import type { MetadataRoute } from 'next'

// ponytail: closed to crawlers while the site is still being built out. Swap
// `disallow` back to `allow: '/'` and re-add the sitemap at launch, together
// with the robots metadata in app/layout.tsx.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',
      },
    ],
  }
}
