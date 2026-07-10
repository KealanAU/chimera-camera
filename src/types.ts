export type PermissionStatus = 'not-determined' | 'authorized' | 'denied' | 'restricted'

export type CameraPosition = 'front' | 'back' | 'external' | 'unspecified'
export type TargetCameraPosition = 'front' | 'back' | 'external'
export type TorchMode = 'on' | 'off'
export type FlashMode = 'off' | 'on' | 'auto'
export type PreviewResizeMode = 'cover' | 'contain'

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface CameraDevice {
  id: string
  localizedName: string
  position: CameraPosition
  minZoom: number
  maxZoom: number
  hasFlash: boolean
  hasTorch: boolean
  supportsFocusMetering: boolean
}

export interface CameraPermissions {
  camera: PermissionStatus
  microphone: PermissionStatus
}

export interface CapturePhotoOptions {
  flash?: FlashMode
  /**
   * View-session capture only. The V0 system camera UI owns its shutter
   * sound and ignores this.
   */
  enableShutterSound?: boolean
  /** JPEG quality 0..1. Honored by the V0 system-camera path. Default 0.9. */
  quality?: number
  /**
   * Which camera the V0 system-camera capture opens with. V1 view-session
   * capture uses the `camera-view` `facing` prop instead of this option.
   */
  facing?: 'front' | 'back'
  /**
   * Also return the JPEG as `base64`. Off by default — the path-only result
   * keeps multi-MB strings off the bridge — but JS can't read the temp file,
   * so upload pipelines fed from JS need it until native upload exists.
   */
  includeBase64?: boolean
  /**
   * Cap the longest image side in pixels; larger captures are downscaled
   * before encoding. Unset means full resolution. V0 module path only.
   */
  maxDimension?: number
}

export interface StartRecordingOptions {
  enableAudio?: boolean
  maxDurationMs?: number
  maxFileSizeBytes?: number
}

export interface PhotoFile {
  path: string
  width?: number
  height?: number
  orientation?: string
  mime?: string
  base64?: string
}

export interface VideoFile {
  path: string
  durationMs?: number
  sizeBytes?: number
}

export interface CameraReadyEvent {
  deviceId: string
}

export interface CameraErrorEvent {
  code: string
  message: string
  cause?: unknown
}

export interface RecordingStartedEvent {
  path?: string
}

export interface RecordingFinishedEvent {
  file: VideoFile
}

export interface CameraModule {
  getPermissions(): Promise<CameraPermissions>
  requestCameraPermission(): Promise<PermissionStatus>
  requestMicrophonePermission(): Promise<PermissionStatus>
  getAvailableCameraDevices(): Promise<CameraDevice[]>
  getDefaultCamera(position: TargetCameraPosition): Promise<CameraDevice | null>
}

export interface CameraViewProps {
  active?: boolean
  cameraId?: string
  facing?: TargetCameraPosition
  resizeMode?: PreviewResizeMode
  torch?: TorchMode
  zoom?: number
  enableAudio?: boolean
  onReady?: (event: CameraReadyEvent) => void
  onError?: (event: CameraErrorEvent) => void
  onRecordingStarted?: (event: RecordingStartedEvent) => void
  onRecordingFinished?: (event: RecordingFinishedEvent) => void
}

export interface CameraViewMethods {
  ping(): Promise<{ ok: true }>
  capturePhoto(options?: CapturePhotoOptions): Promise<PhotoFile>
  startRecording(options?: StartRecordingOptions): Promise<void>
  stopRecording(): Promise<VideoFile>
  focusAtPoint(point: Point): Promise<void>
  setZoom(value: number): Promise<void>
  setTorch(mode: TorchMode): Promise<void>
}

export interface PickPhotoOptions {
  /** JPEG re-encode quality 0..1. Default 0.9. */
  quality?: number
  /** Also return the JPEG as `base64` (off by default; see CapturePhotoOptions). */
  includeBase64?: boolean
  /** Cap the longest image side in pixels; larger picks are downscaled. */
  maxDimension?: number
}

export interface CameraAdapter extends CameraModule {
  capturePhoto(options?: CapturePhotoOptions): Promise<PhotoFile>
  /** Picks an existing photo via the system library picker (no permission needed). */
  pickPhoto(options?: PickPhotoOptions): Promise<PhotoFile>
  startRecording(options?: StartRecordingOptions): Promise<void>
  stopRecording(): Promise<VideoFile>
  focusAtPoint(point: Point): Promise<void>
  setZoom(value: number): Promise<void>
  setTorch(mode: TorchMode): Promise<void>
}
