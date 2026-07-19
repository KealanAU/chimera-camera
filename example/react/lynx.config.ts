import { defineConfig } from '@lynx-js/rspeedy'
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

export default defineConfig({
  source: {
    entry: './src/index.tsx',
  },
  plugins: [pluginQRCode(), pluginReactLynx()],
})
