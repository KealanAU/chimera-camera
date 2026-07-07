import { createMockCameraModule, type MockCameraOptions } from './mock.js'
import type {
  CameraAdapter,
  CameraDevice,
  CameraPermissions,
  CapturePhotoOptions,
  PermissionStatus,
  PhotoFile,
  Point,
  StartRecordingOptions,
  TargetCameraPosition,
  TorchMode,
  VideoFile,
} from './types.js'

declare const NativeModules: Record<string, unknown> | undefined

export const LYNX_CAMERA_JS_VERSION = '0.1.0-alpha.0'

type NativeCallback<T> = (result: T) => void

interface NativeCameraModuleShape {
  getLynxCameraNativeVersion?: (callback: NativeCallback<string | NativeErrorResult>) => unknown
  getPermissions?: (callback: NativeCallback<CameraPermissions | NativeErrorResult>) => unknown
  requestCameraPermission?: (callback: NativeCallback<PermissionStatus | NativeErrorResult>) => unknown
  requestMicrophonePermission?: (callback: NativeCallback<PermissionStatus | NativeErrorResult>) => unknown
  getAvailableCameraDevices?: (callback: NativeCallback<CameraDevice[] | NativeErrorResult>) => unknown
  capturePhoto?: (options: Record<string, unknown>, callback: NativeCallback<PhotoFile | NativeErrorResult>) => unknown
  capture?: (options: Record<string, unknown>, callback: NativeCallback<LegacyCaptureResult>) => unknown
}

interface NativeErrorResult {
  error?: string | { code?: string; message?: string }
}

interface LegacyCaptureResult {
  base64?: string
  width?: number
  height?: number
  mime?: string
  error?: string
}

export interface CreateCameraAdapterOptions {
  nativeModuleName?: string
  mock?: boolean | MockCameraOptions
}

export type CameraInstallStatusCode =
  | 'mock'
  | 'installed'
  | 'native-modules-missing'
  | 'native-module-missing'
  | 'native-methods-missing'
  | 'native-version-mismatch'

export interface CameraInstallStatus {
  ok: boolean
  code: CameraInstallStatusCode
  nativeModuleName: string
  jsVersion: string
  nativeVersion?: string
  missingMethods: string[]
  message: string
}

export function getNativeCameraModule<T = NativeCameraModuleShape>(name = 'CameraModule'): T | null {
  try {
    if (typeof NativeModules === 'undefined') return null
    return (NativeModules[name] as T | undefined) ?? null
  } catch {
    return null
  }
}

export function createCameraAdapter(options: CreateCameraAdapterOptions = {}): CameraAdapter | null {
  const nativeModule = getNativeCameraModule<NativeCameraModuleShape>(options.nativeModuleName)
  if (nativeModule) return createNativeCameraAdapter(nativeModule)
  if (options.mock) {
    return createMockCameraModule(options.mock === true ? undefined : options.mock)
  }
  return null
}

export function getCameraInstallStatus(options: CreateCameraAdapterOptions = {}): CameraInstallStatus {
  const nativeModuleName = options.nativeModuleName ?? 'CameraModule'

  if (options.mock) {
    return {
      ok: true,
      code: 'mock',
      nativeModuleName,
      jsVersion: LYNX_CAMERA_JS_VERSION,
      nativeVersion: 'mock',
      missingMethods: [],
      message: '@kealanau/lynx-camera is running with the mock adapter.',
    }
  }

  let modules: Record<string, unknown> | undefined
  try {
    modules = typeof NativeModules === 'undefined' ? undefined : NativeModules
  } catch {
    modules = undefined
  }

  if (!modules) {
    return createMissingStatus(
      'native-modules-missing',
      nativeModuleName,
      'NativeModules is not available in this runtime.',
    )
  }

  const nativeModule = modules[nativeModuleName] as NativeCameraModuleShape | undefined
  if (!nativeModule) {
    return createMissingStatus(
      'native-module-missing',
      nativeModuleName,
      `NativeModules.${nativeModuleName} is not registered.`,
    )
  }

  const missingMethods = requiredNativeMethods.filter((method) => typeof nativeModule[method] !== 'function')
  if (missingMethods.length > 0) {
    return {
      ok: false,
      code: 'native-methods-missing',
      nativeModuleName,
      jsVersion: LYNX_CAMERA_JS_VERSION,
      missingMethods,
      message: createInstallErrorMessage(
        nativeModuleName,
        `NativeModules.${nativeModuleName} is registered, but it is missing required methods: ${missingMethods.join(
          ', ',
        )}.`,
      ),
    }
  }

  return {
    ok: true,
    code: 'installed',
    nativeModuleName,
    jsVersion: LYNX_CAMERA_JS_VERSION,
    missingMethods: [],
    message: '@kealanau/lynx-camera native module is registered.',
  }
}

export async function getCameraInstallStatusAsync(
  options: CreateCameraAdapterOptions = {},
): Promise<CameraInstallStatus> {
  const status = getCameraInstallStatus(options)
  if (!status.ok || status.code === 'mock') return status

  const nativeModule = getNativeCameraModule<NativeCameraModuleShape>(options.nativeModuleName)
  if (!nativeModule?.getLynxCameraNativeVersion) return status

  const nativeVersion = await callNative(nativeModule.getLynxCameraNativeVersion.bind(nativeModule))
  if (nativeVersion !== LYNX_CAMERA_JS_VERSION) {
    return {
      ...status,
      ok: false,
      code: 'native-version-mismatch',
      nativeVersion,
      message: createInstallErrorMessage(
        status.nativeModuleName,
        `Native module version ${nativeVersion} does not match JS package version ${LYNX_CAMERA_JS_VERSION}.`,
      ),
    }
  }

  return {
    ...status,
    nativeVersion,
  }
}

export function assertCameraInstalled(options: CreateCameraAdapterOptions = {}): void {
  const status = getCameraInstallStatus(options)
  if (!status.ok) throw new Error(status.message)
}

export async function assertCameraInstalledAsync(options: CreateCameraAdapterOptions = {}): Promise<void> {
  const status = await getCameraInstallStatusAsync(options)
  if (!status.ok) throw new Error(status.message)
}

export function createNativeCameraAdapter(nativeModule: NativeCameraModuleShape): CameraAdapter {
  return {
    async getPermissions(): Promise<CameraPermissions> {
      if (!nativeModule.getPermissions) {
        return {
          camera: 'not-determined',
          microphone: 'not-determined',
        }
      }
      return callNative(nativeModule.getPermissions.bind(nativeModule))
    },

    async requestCameraPermission(): Promise<PermissionStatus> {
      if (!nativeModule.requestCameraPermission) return 'not-determined'
      return callNative(nativeModule.requestCameraPermission.bind(nativeModule))
    },

    async requestMicrophonePermission(): Promise<PermissionStatus> {
      if (!nativeModule.requestMicrophonePermission) return 'not-determined'
      return callNative(nativeModule.requestMicrophonePermission.bind(nativeModule))
    },

    async getAvailableCameraDevices(): Promise<CameraDevice[]> {
      if (!nativeModule.getAvailableCameraDevices) return []
      return callNative(nativeModule.getAvailableCameraDevices.bind(nativeModule))
    },

    async getDefaultCamera(position: TargetCameraPosition): Promise<CameraDevice | null> {
      const devices = await this.getAvailableCameraDevices()
      return devices.find((device) => device.position === position) ?? null
    },

    async capturePhoto(options?: CapturePhotoOptions): Promise<PhotoFile> {
      if (nativeModule.capturePhoto) {
        return callNative((callback) => nativeModule.capturePhoto?.(captureOptionsToNative(options), callback))
      }

      if (nativeModule.capture) {
        const legacy = await callNative<LegacyCaptureResult>((callback) =>
          nativeModule.capture?.(legacyCaptureOptionsToNative(options), callback),
        )
        return legacyCaptureToPhoto(legacy)
      }

      throw new Error('CameraModule.capturePhoto is not available.')
    },

    async startRecording(_options?: StartRecordingOptions): Promise<void> {
      throw new Error('CameraModule.startRecording is not available yet.')
    },

    async stopRecording(): Promise<VideoFile> {
      throw new Error('CameraModule.stopRecording is not available yet.')
    },

    async focusAtPoint(_point: Point): Promise<void> {
      throw new Error('CameraModule.focusAtPoint is not available yet.')
    },

    async setZoom(_value: number): Promise<void> {
      throw new Error('CameraModule.setZoom is not available yet.')
    },

    async setTorch(_mode: TorchMode): Promise<void> {
      throw new Error('CameraModule.setTorch is not available yet.')
    },
  }
}

const requiredNativeMethods = [
  'getLynxCameraNativeVersion',
  'getPermissions',
  'requestCameraPermission',
  'requestMicrophonePermission',
  'getAvailableCameraDevices',
  'capturePhoto',
] as const

function createMissingStatus(
  code: Exclude<CameraInstallStatusCode, 'mock' | 'installed' | 'native-methods-missing' | 'native-version-mismatch'>,
  nativeModuleName: string,
  reason: string,
): CameraInstallStatus {
  return {
    ok: false,
    code,
    nativeModuleName,
    jsVersion: LYNX_CAMERA_JS_VERSION,
    missingMethods: [...requiredNativeMethods],
    message: createInstallErrorMessage(nativeModuleName, reason),
  }
}

function createInstallErrorMessage(nativeModuleName: string, reason: string): string {
  return [
    '@kealanau/lynx-camera native module is not installed correctly.',
    '',
    reason,
    '',
    `Expected native module: NativeModules.${nativeModuleName}`,
    `JS package version: ${LYNX_CAMERA_JS_VERSION}`,
    '',
    'For iOS:',
    '- Add node_modules/@kealanau/lynx-camera/ios/LynxCameraModule.swift to your Xcode target.',
    '- Add NSCameraUsageDescription to Info.plist.',
    '- Register LynxCameraModule in your LynxConfig.',
    '',
    'For Android:',
    '- Add the package Android source/module to the host Gradle build.',
    '- Add CAMERA permission to AndroidManifest.xml.',
    '- Register CameraModule in the Lynx host app.',
    '',
    'For LynxExplorer or JS-only development:',
    '- Use createCameraAdapter({ mock: true }) or createMockCameraModule().',
    '',
    'See docs/ios-install.md, docs/android-install.md, and docs/lynx-explorer.md.',
  ].join('\n')
}

function callNative<T>(invoke: (callback: NativeCallback<T | NativeErrorResult>) => unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      const returned = invoke((result) => {
        try {
          rejectIfNativeError(result)
          resolve(result as T)
        } catch (error) {
          reject(error)
        }
      })

      if (returned && typeof (returned as Promise<T>).then === 'function') {
        ;(returned as Promise<T>).then(resolve, reject)
      }
    } catch (error) {
      reject(error)
    }
  })
}

function rejectIfNativeError(result: unknown): void {
  if (!result || typeof result !== 'object' || !('error' in result)) return
  const error = (result as NativeErrorResult).error
  if (!error) return
  if (typeof error === 'string') throw new Error(error)
  throw new Error(error.message ?? error.code ?? 'Camera native error')
}

function captureOptionsToNative(options: CapturePhotoOptions | undefined): Record<string, unknown> {
  return {
    flash: options?.flash ?? 'off',
    enableShutterSound: options?.enableShutterSound ?? true,
  }
}

function legacyCaptureOptionsToNative(options: CapturePhotoOptions | undefined): Record<string, unknown> {
  return {
    quality: 0.9,
    facing: 'back',
    flash: options?.flash ?? 'off',
  }
}

function legacyCaptureToPhoto(result: LegacyCaptureResult): PhotoFile {
  if (result.error) throw new Error(result.error)
  if (!result.base64) throw new Error('Camera returned no image data.')
  return {
    path: 'memory://lynx-camera/capture.jpg',
    width: result.width ?? 0,
    height: result.height ?? 0,
    orientation: 'up',
    mime: result.mime ?? 'image/jpeg',
    base64: result.base64,
  }
}
