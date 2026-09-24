// Stands in for @vyui/camera in the browser: reports "native" so the app renders
// its camera-view, and backs every call with the package's own mock adapter.
export * from '@real-camera'
import { createMockCameraModule } from '@real-camera/mock'
import VIEWFINDER from './viewfinder.jpg'
import { update } from './zoom-store.js'

const mock = createMockCameraModule({
  captureDelayMs: 180,
  recordingDurationMs: 7000,
  photo: { path: 'mock://photo.jpg', uri: 'mock://photo.jpg', width: 780, height: 1040, mime: 'image/jpeg', base64: VIEWFINDER.split(',')[1] },
})
const session = {
  ...mock,
  async setZoom(factor) {
    update({ factor })
  },
}

export const getCameraInstallStatus = () => ({ ok: true, code: 'mock', missingMethods: [], message: 'browser preview' })
export const createCameraModule = () => mock
export const createCameraViewHandle = () => session
