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
  /**
   * Fires at the shutter only; the preview stays unlit (use `setTorch` for a
   * constant light). `auto` leaves the decision to the OS scene metering.
   * Ignored on devices with no flash unit. Default `off`.
   */
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
  /** Device zoom envelope in videoZoomFactor units (iOS `min/maxAvailableVideoZoomFactor`). */
  minZoom?: number
  maxZoom?: number
  /** videoZoomFactor at which the wide lens sits (display 1×); maps display multipliers → factors. */
  wideFactor?: number
  /** Zoom factors where the virtual device switches lenses optically (empty for single-lens devices). */
  switchOverZoomFactors?: number[]
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
  /** Exposure bias in EV; clamped to the device's supported range rather than rejecting. */
  setExposureBias(bias: number): Promise<void>
}

export interface CameraViewMethods extends CameraSessionMethods {
  ping(): Promise<CameraPingResult>
}

export type PickPhotoOptions = ImageOutputOptions

/**
 * Stateless module surface: one-shot operations that need no rendered view —
 * permissions, device discovery, system-camera capture, and system
 * photo-library picking. Live-session controls (recording, focus, zoom, torch)
 * are deliberately absent; they belong to a rendered `<camera-view>` reached
 * through `createCameraViewHandle()`.
 */
export interface CameraModuleClient extends CameraModule {
  /** System-camera photo capture. Opens the OS camera UI; no rendered view needed. */
  capturePhoto(options?: CapturePhotoOptions): Promise<PhotoFile>
  /** Picks an existing photo via the system library picker (no permission needed). */
  pickPhoto(options?: PickPhotoOptions): Promise<PhotoFile>
  /**
   * Saves a captured photo or video temp file to the device's media library
   * (iOS Photos, Android gallery/MediaStore). Orthogonal to capture: a capture
   * returns a temp path you can upload; call this when the user wants it kept.
   * Photo vs. video is inferred from the file extension. iOS needs the add-only
   * photo-library permission (`NSPhotoLibraryAddUsageDescription`); Android needs
   * `WRITE_EXTERNAL_STORAGE` only below API 29. Rejects `library/permission-denied`
   * or `library/write-failed`.
   */
  saveToLibrary(file: PhotoFile | VideoFile): Promise<void>
}
