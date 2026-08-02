// Node module hook that stubs raw .mdx imports with empty modules. The
// fumadocs-generated .source files import every .mdx eagerly, but
// verify-links only consumes collection metadata (urls, paths, frontmatter)
// and re-parses the mdx from disk itself — the compiled bodies are unused.
// Upstream ran this under bun, whose bunfig loader did the same job.
import { registerHooks } from 'node:module'

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.mdx')) {
      return {
        format: 'module',
        source: 'export default {}',
        shortCircuit: true,
      }
    }
    const result = nextLoad(url, context)
    // node rejects an explicit `source: undefined` coming back through a user
    // hook (commonjs loads legitimately omit source); drop the key instead
    if (result != null && result.source === undefined) {
      delete result.source
    }
    return result
  },
})
