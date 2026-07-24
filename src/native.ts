import { createMockCameraModule, type MockCameraOptions } from './mock.js'
import { ChimeraCameraError } from './types.js'
import type {
  CameraDevice,
  CameraErrorEvent,
  CameraModuleClient,
  CameraPermissions,
  CapturePhotoOptions,
  ImageOutputOptions,
  PermissionStatus,
  PickPhotoOptions,
  PhotoFile,
  TargetCameraPosition,
  VideoFile,
} from './types.js'

declare const NativeModules: Record<string, unknown> | undefined

export const CHIMERA_CAMERA_JS_VERSION = '0.0.1'

type NativeCallback<T> = (result: T) => void

interface NativeCameraModuleShape {
  getChimeraCameraNativeVersion?: (callback: NativeCallback<string | NativeErrorResult>) => unknown
  getPermissions?: (callback: NativeCallback<CameraPermissions | NativeErrorResult>) => unknown
  requestCameraPermission?: (callback: NativeCallback<PermissionStatus | NativeErrorResult>) => unknown
  requestMicrophonePermission?: (callback: NativeCallback<PermissionStatus | NativeErrorResult>) => unknown
  getAvailableCameraDevices?: (callback: NativeCallback<CameraDevice[] | NativeErrorResult>) => unknown
  capturePhoto?: (options: Record<string, unknown>, callback: NativeCallback<PhotoFile | NativeErrorResult>) => unknown
  pickPhoto?: (options: Record<string, unknown>, callback: NativeCallback<PhotoFile | NativeErrorResult>) => unknown
  saveToLibrary?: (options: Record<string, unknown>, callback: NativeCallback<NativeErrorResult | Record<string, never>>) => unknown
}

interface NativeErrorResult {
  error?: string | Partial<Pick<CameraErrorEvent, 'code' | 'message'>>
}

export interface CreateCameraModuleOptions {
  nativeModuleName?: string
  mock?: boolean | MockCameraOptions
  /**
   * By default createCameraModule throws when neither the native module nor
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

export function createCameraModule(options?: CreateCameraModuleOptions & { optional?: false }): CameraModuleClient
export function createCameraModule(options: CreateCameraModuleOptions & { optional: boolean }): CameraModuleClient | null
export function createCameraModule(options: CreateCameraModuleOptions = {}): CameraModuleClient | null {
  const nativeModule = getNativeCameraModule<NativeCameraModuleShape>(options.nativeModuleName)
  // A registered module must expose every required method — otherwise a
  // half-registered host would look "available" here yet report
  // native-methods-missing from getCameraInstallStatus and throw at call time.
  if (nativeModule && hasRequiredMethods(nativeModule)) return createNativeCameraModule(nativeModule)
  if (options.mock) {
    return createMockCameraModule(options.mock === true ? undefined : options.mock)
  }
  if (options.optional) return null
  throw new Error(getCameraInstallStatus(options).message)
}

function hasRequiredMethods(nativeModule: NativeCameraModuleShape): boolean {
  return requiredNativeMethods.every((method) => typeof nativeModule[method] === 'function')
}

export function getCameraInstallStatus(options: CreateCameraModuleOptions = {}): CameraInstallStatus {
  const nativeModuleName = options.nativeModuleName ?? 'CameraModule'

  if (options.mock) {
    return {
      ok: true,
      code: 'mock',
      nativeModuleName,
      jsVersion: CHIMERA_CAMERA_JS_VERSION,
      nativeVersion: 'mock',
      missingMethods: [],
      message: '@vyui/chimera-camera is running with the mock adapter.',
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
    message: '@vyui/chimera-camera native module is registered.',
  }
}

export async function getCameraInstallStatusAsync(
  options: CreateCameraModuleOptions = {},
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

export function assertCameraInstalled(options: CreateCameraModuleOptions = {}): void {
  const status = getCameraInstallStatus(options)
  if (!status.ok) throw new Error(status.message)
}

export async function assertCameraInstalledAsync(options: CreateCameraModuleOptions = {}): Promise<void> {
  const status = await getCameraInstallStatusAsync(options)
  if (!status.ok) throw new Error(status.message)
}

export function createNativeCameraModule(nativeModule: NativeCameraModuleShape): CameraModuleClient {
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

    async saveToLibrary(file: PhotoFile | VideoFile): Promise<void> {
      // Optional like pickPhoto; only the path is needed — native infers photo
      // vs. video from the extension and persists it to the media library.
      if (!nativeModule.saveToLibrary) throw unavailableMethodError('saveToLibrary')
      await callNative((callback) => nativeModule.saveToLibrary?.({ path: file.path }, callback))
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
    `@vyui/chimera-camera native module (NativeModules.${nativeModuleName}) is not installed correctly.`,
    reason,
    'For JS-only hosts like LynxExplorer / Lynx Go, use createCameraModule({ mock: true }).',
    'Native setup: see docs/ios-install.md, docs/android-install.md, docs/lynx-explorer.md.',
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
