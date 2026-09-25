// Bundles example/react/src/App.tsx, unmodified, into one self-contained HTML
// page (dist/index.html) that renders it in a 390×844 phone frame. Lynx
// elements map to DOM in src/jsx-runtime.js; @vyui/camera is swapped for a
// shim over the package's mock adapter (run `pnpm run build` at the root first).
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const exact = {
  '@vyui/camera': path.join(here, 'src/camera-shim.js'),
  '@vyui/camera/mock': path.join(repo, 'dist/mock.js'),
  '@real-camera': path.join(repo, 'dist/index.js'),
  '@real-camera/mock': path.join(repo, 'dist/mock.js'),
  '@lynx-js/react': path.join(here, 'src/lynx-react.js'),
  '@lynx-js/react/jsx-runtime': path.join(here, 'src/jsx-runtime.js'),
}

const result = await build({
  entryPoints: [path.join(here, 'src/entry.jsx')],
  bundle: true,
  write: false,
  format: 'esm',
  jsx: 'automatic',
  jsxImportSource: '@lynx-js/react',
  loader: { '.jpg': 'dataurl' },
  // The shared example code lives outside this package; resolve React from here.
  nodePaths: [path.join(here, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  logLevel: 'warning',
  plugins: [
    {
      name: 'lynx-to-dom',
      setup(b) {
        b.onResolve({ filter: /^(@vyui\/camera|@real-camera|@lynx-js\/react)(\/.*)?$/ }, (a) =>
          exact[a.path] ? { path: exact[a.path] } : undefined,
        )
      },
    },
  ],
})

const js = result.outputFiles[0].text.replaceAll('</script', '<\\/script')
const html = (await readFile(path.join(here, 'src/index.html'), 'utf8')).replace('/*APP*/', () => js)
await mkdir(path.join(here, 'dist'), { recursive: true })
await writeFile(path.join(here, 'dist/index.html'), html)
console.log(`dist/index.html (${Math.round(html.length / 1024)} kB)`)
