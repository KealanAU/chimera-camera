import { createMockCameraModule } from '../src/mock'

async function runMockCameraDemo() {
  const camera = createMockCameraModule({ captureDelayMs: 250 })
  const permissions = await camera.getPermissions()
  const devices = await camera.getAvailableCameraDevices()
  const photo = await camera.capturePhoto()

  return {
    permissions,
    devices,
    photo,
  }
}

void runMockCameraDemo().then((result) => {
  console.log('[chimera-camera mock demo]', result)
})
