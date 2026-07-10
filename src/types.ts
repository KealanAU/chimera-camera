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
  enableShutterSound?: boolean
  /** JPEG quality 0..1. Honored by the V0 system-camera path. Default 0.9. */
  quality?: number
  /**
   * Which camera the V0 system-camera capture opens with. V1 view-session
   * capture uses the `camera-view` `facing` prop instead of this option.
   */
  facing?: 'front' | 'back'
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

export interface CameraAdapter extends CameraModule {
  capturePhoto(options?: CapturePhotoOptions): Promise<PhotoFile>
  startRecording(options?: StartRecordingOptions): Promise<void>
  stopRecording(): Promise<VideoFile>
  focusAtPoint(point: Point): Promise<void>
  setZoom(value: number): Promise<void>
  setTorch(mode: TorchMode): Promise<void>
}
