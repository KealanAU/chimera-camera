import { describe, expect, test } from 'vitest'
import { isLocalHref, resolveApiLocalHref } from '@/lib/resolve-api-link'

describe('resolveApiLocalHref', () => {
  test('treats document-relative paths as local', () => {
    expect(isLocalHref('./Frame.mdx')).toBe(true)
    expect(isLocalHref('../Frame.mdx')).toBe(true)
    expect(isLocalHref('#section')).toBe(false)
    expect(isLocalHref('https://example.com')).toBe(false)
  })

  test('resolves relative api links against the current page directory', () => {
    const calls: Array<{ href: string; dir: string; language?: string }> = []
    const href = resolveApiLocalHref({
      source: {
        getPageByHref(candidate, options) {
          calls.push({
            href: candidate,
            dir: options.dir,
            language: options.language,
          })

          return {
            page: {
              url: '/api/@vyui/camera/interfaces/CameraViewMethods',
            },
            hash: 'capturephoto',
          }
        },
      },
      href: 'CameraViewMethods.mdx',
      pagePath: '@vyui/camera/interfaces/CameraViewProps.mdx',
      locale: 'en',
    })

    expect(calls).toEqual([
      {
        href: './CameraViewMethods.mdx',
        dir: '@vyui/camera/interfaces',
        language: 'en',
      },
    ])
    expect(href).toBe(
      '/api/@vyui/camera/interfaces/CameraViewMethods#capturephoto',
    )
  })

  test('returns null for external links', () => {
    expect(
      resolveApiLocalHref({
        source: {
          getPageByHref() {
            throw new Error('should not resolve external links')
          },
        },
        href: 'mailto:hello@example.com',
        pagePath: '@vyui/camera/interfaces/CameraViewProps.mdx',
      }),
    ).toBeNull()
  })
})
