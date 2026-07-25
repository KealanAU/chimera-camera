export * from './types.js'

export {
  CHIMERA_CAMERA_JS_VERSION,
  assertCameraInstalled,
  assertCameraInstalledAsync,
  createCameraModule,
  createNativeCameraModule,
  getCameraInstallStatus,
  getCameraInstallStatusAsync,
  getNativeCameraModule,
  type CameraInstallStatus,
  type CameraInstallStatusCode,
  type CreateCameraModuleOptions,
} from './native.js'

export {
  CAMERA_VIEW_TAG,
  createCameraViewHandle,
  invokeCameraViewMethod,
  isCameraViewBridgeAvailable,
  type CameraViewHandle,
} from './view.js'
