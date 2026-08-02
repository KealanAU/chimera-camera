// Runs verify-links.mts under plain node. The fumadocs-generated .source
// barrel imports every .mdx eagerly (with ?collection= queries), which only a
// bundler loader can satisfy — upstream ran this under bun's bunfig loader.
// Here esbuild bundles the script, stubbing those content imports: the
// checker only consumes collection metadata (urls, file paths) and re-parses
// the mdx from disk itself, so the compiled bodies are dead weight.
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const stubContentImports = {
  name: 'stub-content-imports',
  setup(build) {
    build.onResolve({ filter: /\?collection=/ }, (args) => ({
      path: args.path,
      namespace: 'content-stub',
    }))
    build.onLoad({ filter: /./, namespace: 'content-stub' }, () => ({
      contents: `
        export default {}
        export const frontmatter = { title: 'stub' }
        export const structuredData = { headings: [], contents: [] }
        export const toc = []
      `,
      loader: 'js',
    }))
  },
}

// inside the package so the bundle's externalized imports still resolve
const outDir = fileURLToPath(new URL('../node_modules/.cache/verify-links/', import.meta.url))
const outfile = outDir + 'verify-links.mjs'
await mkdir(outDir, { recursive: true })

try {
  await build({
    entryPoints: [new URL('./verify-links.mts', import.meta.url).pathname],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    plugins: [stubContentImports],
    outfile,
    logLevel: 'silent',
  })
  await import(pathToFileURL(outfile).href)
} finally {
  await rm(outDir, { recursive: true, force: true })
}
