import { createMockCameraModule, type MockCameraOptions } from './mock.js'
import { ChimeraCameraError } from './types.js'
import type {
  CameraAdapter,
  CameraDevice,
  CameraErrorEvent,
  CameraPermissions,
  CapturePhotoOptions,
  ImageOutputOptions,
  PermissionStatus,
  PickPhotoOptions,
  PhotoFile,
  Point,
  StartRecordingOptions,
  TargetCameraPosition,
  TorchMode,
  VideoFile,
} from './types.js'

declare const NativeModules: Record<string, unknown> | undefined

export const CHIMERA_CAMERA_JS_VERSION = '0.2.0-alpha.0'

type NativeCallback<T> = (result: T) => void

interface NativeCameraModuleShape {
  getChimeraCameraNativeVersion?: (callback: NativeCallback<string | NativeErrorResult>) => unknown
  getPermissions?: (callback: NativeCallback<CameraPermissions | NativeErrorResult>) => unknown
  requestCameraPermission?: (callback: NativeCallback<PermissionStatus | NativeErrorResult>) => unknown
  requestMicrophonePermission?: (callback: NativeCallback<PermissionStatus | NativeErrorResult>) => unknown
  getAvailableCameraDevices?: (callback: NativeCallback<CameraDevice[] | NativeErrorResult>) => unknown
  capturePhoto?: (options: Record<string, unknown>, callback: NativeCallback<PhotoFile | NativeErrorResult>) => unknown
  pickPhoto?: (options: Record<string, unknown>, callback: NativeCallback<PhotoFile | NativeErrorResult>) => unknown
}

interface NativeErrorResult {
  error?: string | Partial<Pick<CameraErrorEvent, 'code' | 'message'>>
}

export interface CreateCameraAdapterOptions {
  nativeModuleName?: string
  mock?: boolean | MockCameraOptions
  /**
   * By default createCameraAdapter throws when neither the native module nor
   * the mock is available, so hosts like LynxExplorer / Lynx Go fail loudly
   * with setup instructions. Pass `optional: true` to get `null` instead and
   * handle the fallback yourself.
   */
  optional?: boolean
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

export function createCameraAdapter(options?: CreateCameraAdapterOptions & { optional?: false }): CameraAdapter
export function createCameraAdapter(options: CreateCameraAdapterOptions & { optional: boolean }): CameraAdapter | null
export function createCameraAdapter(options: CreateCameraAdapterOptions = {}): CameraAdapter | null {
  const nativeModule = getNativeCameraModule<NativeCameraModuleShape>(options.nativeModuleName)
  // A registered module must actually be able to capture — otherwise a
  // half-registered host would look "available" and only fail at capture time.
  if (nativeModule && hasCaptureMethod(nativeModule)) return createNativeCameraAdapter(nativeModule)
  if (options.mock) {
    return createMockCameraModule(options.mock === true ? undefined : options.mock)
  }
  if (options.optional) return null
  throw new Error(getCameraInstallStatus(options).message)
}

function hasCaptureMethod(nativeModule: NativeCameraModuleShape): boolean {
  return typeof nativeModule.capturePhoto === 'function'
}

export function getCameraInstallStatus(options: CreateCameraAdapterOptions = {}): CameraInstallStatus {
  const nativeModuleName = options.nativeModuleName ?? 'CameraModule'

  if (options.mock) {
    return {
      ok: true,
      code: 'mock',
      nativeModuleName,
      jsVersion: CHIMERA_CAMERA_JS_VERSION,
      nativeVersion: 'mock',
      missingMethods: [],
      message: '@kealanau/chimera-camera is running with the mock adapter.',
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
      jsVersion: CHIMERA_CAMERA_JS_VERSION,
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
    jsVersion: CHIMERA_CAMERA_JS_VERSION,
    missingMethods: [],
    message: '@kealanau/chimera-camera native module is registered.',
  }
}

export async function getCameraInstallStatusAsync(
  options: CreateCameraAdapterOptions = {},
): Promise<CameraInstallStatus> {
  const status = getCameraInstallStatus(options)
  if (!status.ok || status.code === 'mock') return status

  const nativeModule = getNativeCameraModule<NativeCameraModuleShape>(options.nativeModuleName)
  if (!nativeModule?.getChimeraCameraNativeVersion) return status

  const nativeVersion = await callNative(nativeModule.getChimeraCameraNativeVersion.bind(nativeModule))
  if (nativeVersion !== CHIMERA_CAMERA_JS_VERSION) {
    return {
      ...status,
      ok: false,
      code: 'native-version-mismatch',
      nativeVersion,
      message: createInstallErrorMessage(
        status.nativeModuleName,
        `Native module version ${nativeVersion} does not match JS package version ${CHIMERA_CAMERA_JS_VERSION}.`,
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
      requireNativeMethod(nativeModule.getPermissions, 'getPermissions')
      return callNative(nativeModule.getPermissions.bind(nativeModule))
    },

    async requestCameraPermission(): Promise<PermissionStatus> {
      requireNativeMethod(nativeModule.requestCameraPermission, 'requestCameraPermission')
      return callNative(nativeModule.requestCameraPermission.bind(nativeModule))
    },

    async requestMicrophonePermission(): Promise<PermissionStatus> {
      requireNativeMethod(nativeModule.requestMicrophonePermission, 'requestMicrophonePermission')
      return callNative(nativeModule.requestMicrophonePermission.bind(nativeModule))
    },

    async getAvailableCameraDevices(): Promise<CameraDevice[]> {
      requireNativeMethod(nativeModule.getAvailableCameraDevices, 'getAvailableCameraDevices')
      return callNative(nativeModule.getAvailableCameraDevices.bind(nativeModule))
    },

    async getDefaultCamera(position: TargetCameraPosition): Promise<CameraDevice | null> {
      const devices = await this.getAvailableCameraDevices()
      const matching = devices.filter((device) => device.position === position)
      return matching.find((device) => device.deviceType === 'wide-angle') ?? matching[0] ?? null
    },

    async capturePhoto(options?: CapturePhotoOptions): Promise<PhotoFile> {
      requireNativeMethod(nativeModule.capturePhoto, 'capturePhoto')
      return callNative((callback) => nativeModule.capturePhoto?.(captureOptionsToNative(options), callback))
    },

    async pickPhoto(options?: PickPhotoOptions): Promise<PhotoFile> {
      // Optional on purpose: hosts compiled before this method exist happily
      // without it, so it is not in requiredNativeMethods.
      if (!nativeModule.pickPhoto) throw unavailableMethodError('pickPhoto')
      return callNative((callback) => nativeModule.pickPhoto?.(pickOptionsToNative(options), callback))
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
  'getChimeraCameraNativeVersion',
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
    jsVersion: CHIMERA_CAMERA_JS_VERSION,
    missingMethods: [...requiredNativeMethods],
    message: createInstallErrorMessage(nativeModuleName, reason),
  }
}

function createInstallErrorMessage(nativeModuleName: string, reason: string): string {
  return [
    '@kealanau/chimera-camera native module is not installed correctly.',
    '',
    reason,
    '',
    `Expected native module: NativeModules.${nativeModuleName}`,
    `JS package version: ${CHIMERA_CAMERA_JS_VERSION}`,
    '',
    'For iOS:',
    '- Add node_modules/@kealanau/chimera-camera/ios/ChimeraCameraModule.swift to your Xcode target.',
    '- Add NSCameraUsageDescription to Info.plist.',
    '- Register ChimeraCameraModule in your LynxConfig.',
    '',
    'For Android:',
    '- Add the package Android source/module to the host Gradle build.',
    '- Add CAMERA permission to AndroidManifest.xml.',
    '- Register CameraModule in the Lynx host app.',
    '',
    'For LynxExplorer / Lynx Go or JS-only development:',
    '- The real camera cannot work in these hosts: they cannot compile this',
    '  package\'s native source, even though the host app itself uses a camera',
    '  (e.g. to scan QR codes).',
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
  if (typeof error === 'string') throw new ChimeraCameraError('camera/native-error', error)
  throw new ChimeraCameraError(error.code ?? 'camera/native-error', error.message ?? error.code ?? 'Camera native error')
}

function requireNativeMethod<T>(method: T | undefined, name: string): asserts method is T {
  if (!method) throw unavailableMethodError(name)
}

function unavailableMethodError(name: string): ChimeraCameraError {
  return new ChimeraCameraError('camera/method-unavailable', `CameraModule.${name} is not available.`)
}

function captureOptionsToNative(options: CapturePhotoOptions | undefined): Record<string, unknown> {
  return {
    ...imageOutputOptionsToNative(options),
    flash: options?.flash ?? 'off',
    enableShutterSound: options?.enableShutterSound ?? true,
    facing: options?.facing ?? 'back',
  }
}

function pickOptionsToNative(options: PickPhotoOptions | undefined): Record<string, unknown> {
  return imageOutputOptionsToNative(options)
}

function imageOutputOptionsToNative(options: ImageOutputOptions | undefined): Record<string, unknown> {
  const native: Record<string, unknown> = {
    quality: clampQuality(options?.quality),
    includeBase64: options?.includeBase64 ?? false,
  }
  if (options?.maxDimension !== undefined) native.maxDimension = options.maxDimension
  return native
}

function clampQuality(quality: number | undefined): number {
  if (quality === undefined || Number.isNaN(quality)) return 0.9
  return Math.min(1, Math.max(0, quality))
}
