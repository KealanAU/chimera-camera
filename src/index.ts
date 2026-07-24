export type {
  CameraDevice,
  CameraErrorEvent,
  CameraModule,
  CameraModuleClient,
  CameraFacing,
  CameraPingResult,
  CameraPermissions,
  CameraPosition,
  CameraReadyEvent,
  CameraSessionMethods,
  CameraViewMethods,
  CameraViewProps,
  CapturePhotoOptions,
  FlashMode,
  ImageOutputOptions,
  PermissionStatus,
  PickPhotoOptions,
  PhotoFile,
  Point,
  PreviewResizeMode,
  RecordingFinishedEvent,
  RecordingStartedEvent,
  Size,
  StartRecordingOptions,
  TargetCameraPosition,
  TorchMode,
  VideoFile,
} from './types.js'

export { ChimeraCameraError } from './types.js'

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
