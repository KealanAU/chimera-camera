export type PermissionStatus = 'not-determined' | 'authorized' | 'denied' | 'restricted'

export type CameraFacing = 'front' | 'back'
export type TargetCameraPosition = CameraFacing | 'external'
export type CameraPosition = TargetCameraPosition | 'unspecified'
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
  /** Stable native camera kind used to prefer physical wide-angle cameras. */
  deviceType?: 'wide-angle' | 'ultra-wide' | 'telephoto' | 'dual' | 'dual-wide' | 'triple' | 'external' | 'unknown'
  position: CameraPosition
  minZoom: number
  maxZoom: number
  hasFlash: boolean
  hasTorch: boolean
  supportsFocusMetering: boolean
}

export class ChimeraCameraError extends Error {
  readonly code: string
  readonly cause?: unknown

  constructor(code: string, message: string, cause?: unknown) {
    super(message)
    this.name = 'ChimeraCameraError'
    this.code = code
    this.cause = cause
  }
}

export interface CameraPermissions {
  camera: PermissionStatus
  microphone: PermissionStatus
}

export interface ImageOutputOptions {
  /** JPEG quality 0..1. Default 0.9. */
  quality?: number
  /** Include the JPEG as base64. Off by default. */
  includeBase64?: boolean
  /** Downscale images whose longest side exceeds this pixel count. */
  maxDimension?: number
}

export interface CapturePhotoOptions extends ImageOutputOptions {
  flash?: FlashMode
  /**
   * View-session capture only. The V0 system camera UI owns its shutter
   * sound and ignores this.
   */
  enableShutterSound?: boolean
  /**
   * Which camera the V0 system-camera capture opens with. V1 view-session
   * capture uses the `camera-view` `facing` prop instead of this option.
   */
  facing?: CameraFacing
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

export interface CameraPingResult {
  ok: true
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

export interface CameraSessionMethods {
  capturePhoto(options?: CapturePhotoOptions): Promise<PhotoFile>
  startRecording(options?: StartRecordingOptions): Promise<void>
  stopRecording(): Promise<VideoFile>
  focusAtPoint(point: Point): Promise<void>
  setZoom(value: number): Promise<void>
  setTorch(mode: TorchMode): Promise<void>
}

export interface CameraViewMethods extends CameraSessionMethods {
  ping(): Promise<CameraPingResult>
}

export type PickPhotoOptions = ImageOutputOptions

export interface CameraAdapter extends CameraModule, CameraSessionMethods {
  /** Picks an existing photo via the system library picker (no permission needed). */
  pickPhoto(options?: PickPhotoOptions): Promise<PhotoFile>
}
