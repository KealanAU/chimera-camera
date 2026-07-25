import { SAMPLE_PHOTO_FIXTURE } from './fixtures.js'
import { ChimeraCameraError, pickDefaultCamera } from './types.js'
import type {
  CameraModuleClient,
  CameraDevice,
  CameraPermissions,
  CameraSessionMethods,
  CapturePhotoOptions,
  PermissionStatus,
  PickPhotoOptions,
  PhotoFile,
  StartRecordingOptions,
  TargetCameraPosition,
  VideoFile,
} from './types.js'

export interface MockCameraOptions {
  permissions?: CameraPermissions
  devices?: CameraDevice[]
  photo?: PhotoFile
  recordingPath?: string
  recordingDurationMs?: number
  captureDelayMs?: number
}

// A mock stands in for a full device, so it doubles both the stateless module
// surface and a live session — no rendered `<camera-view>` needed under test.
export function createMockCameraModule(options: MockCameraOptions = {}): CameraModuleClient & CameraSessionMethods {
  const devices = options.devices ?? defaultMockDevices()
  const permissions = options.permissions ?? { camera: 'authorized', microphone: 'authorized' }
  const photo = options.photo ?? SAMPLE_PHOTO_FIXTURE
  const recordingPath = options.recordingPath ?? 'mock://chimera-camera/video.mp4'
  const recordingDurationMs = options.recordingDurationMs ?? 1000
  const captureDelayMs = options.captureDelayMs ?? 0

  let recordingStartedAt: number | null = null

  return {
    async getPermissions(): Promise<CameraPermissions> {
      return { ...permissions }
    },

    async requestCameraPermission(): Promise<PermissionStatus> {
      return permissions.camera
    },

    async requestMicrophonePermission(): Promise<PermissionStatus> {
      return permissions.microphone
    },

    async getAvailableCameraDevices(): Promise<CameraDevice[]> {
      return devices.map((device) => ({ ...device }))
    },

    async getDefaultCamera(position: TargetCameraPosition): Promise<CameraDevice | null> {
      return pickDefaultCamera(devices, position)
    },

    async capturePhoto(options?: CapturePhotoOptions): Promise<PhotoFile> {
      await delay(captureDelayMs)
      return mockPhotoResult(photo, options?.includeBase64)
    },

    async pickPhoto(options?: PickPhotoOptions): Promise<PhotoFile> {
      await delay(captureDelayMs)
      return mockPhotoResult(photo, options?.includeBase64)
    },

    async saveToLibrary(): Promise<void> {},

    async startRecording(options?: StartRecordingOptions): Promise<void> {
      // Mirror the native contract's rejections so apps exercise these paths.
      if (recordingStartedAt !== null) {
        throw new ChimeraCameraError('recording/in-progress', 'A recording is already in progress.')
      }
      if (options?.enableAudio && permissions.microphone !== 'authorized') {
        throw new ChimeraCameraError(
          'camera/permission-denied',
          'Microphone permission is required for audio recording; request it via CameraModule.',
        )
      }
      recordingStartedAt = Date.now()
    },

    async stopRecording(): Promise<VideoFile> {
      const durationMs =
        recordingStartedAt === null ? recordingDurationMs : Math.max(1, Date.now() - recordingStartedAt)
      recordingStartedAt = null
      return {
        path: recordingPath,
        durationMs,
        sizeBytes: 0,
      }
    },

    async focusAtPoint(): Promise<void> {},

    async setZoom(): Promise<void> {},

    async setTorch(): Promise<void> {},

    async setExposureBias(): Promise<void> {},
  }
}

export function defaultMockDevices(): CameraDevice[] {
  return [
    {
      id: 'mock-back-camera',
      localizedName: 'Mock Back Camera',
      position: 'back',
      deviceType: 'wide-angle',
      minZoom: 1,
      maxZoom: 8,
      hasFlash: true,
      hasTorch: true,
      supportsFocusMetering: true,
    },
    {
      id: 'mock-front-camera',
      localizedName: 'Mock Front Camera',
      position: 'front',
      deviceType: 'wide-angle',
      minZoom: 1,
      maxZoom: 4,
      hasFlash: false,
      hasTorch: false,
      supportsFocusMetering: true,
    },
  ]
}

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()
}

// Matches the native contract: base64 rides along only when asked for.
function mockPhotoResult(photo: PhotoFile, includeBase64: boolean | undefined): PhotoFile {
  const { base64, ...rest } = photo
  return includeBase64 ? { ...photo } : rest
}
