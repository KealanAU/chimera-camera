export type ExternalSymbolLinkMappings = Record<string, Record<string, string>>

export const externalSymbolLinkMappings = {
  typescript: {
    ArrayBuffer:
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer',
    Error:
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error',
    Object:
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object',
    Promise:
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise',
  },
} satisfies ExternalSymbolLinkMappings
