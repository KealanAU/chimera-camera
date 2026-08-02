import { absoluteUrl, siteConfig } from './site-config'

export function getSiteStructuredData() {
  const siteUrl = absoluteUrl('/')
  const websiteId = `${siteUrl}#website`
  const projectId = `${siteUrl}#project`
  const softwareId = `${siteUrl}#software`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': websiteId,
        url: siteUrl,
        name: siteConfig.name,
        alternateName: [...siteConfig.alternateNames],
        description: siteConfig.description,
        inLanguage: 'en',
        publisher: { '@id': projectId },
        about: { '@id': softwareId },
      },
      {
        '@type': 'Organization',
        '@id': projectId,
        name: siteConfig.name,
        alternateName: [...siteConfig.alternateNames],
        url: siteUrl,
        sameAs: [siteConfig.repositoryUrl, siteConfig.packageUrl],
      },
      {
        '@type': 'SoftwareSourceCode',
        '@id': softwareId,
        name: '@vyui/camera',
        description: siteConfig.description,
        codeRepository: siteConfig.repositoryUrl,
        sameAs: [siteConfig.repositoryUrl, siteConfig.packageUrl],
        programmingLanguage: ['TypeScript', 'Swift', 'Kotlin'],
        runtimePlatform: 'Lynx',
        license: 'https://opensource.org/licenses/MIT',
        url: siteUrl,
        publisher: { '@id': projectId },
      },
    ],
  }
}

export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
