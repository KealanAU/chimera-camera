import { defineConfig } from '@lynx-js/rspeedy'
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin'
import { pluginVueLynx } from 'vue-lynx/plugin'

export default defineConfig({
  source: {
    entry: './src/index.ts',
  },
  environments: {
    lynx: {},
  },
  plugins: [
    pluginQRCode(),
    pluginVueLynx({
      optionsApi: false,
    }),
  ],
})
