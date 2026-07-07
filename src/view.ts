import type {
  CameraViewMethods,
  CapturePhotoOptions,
  PhotoFile,
  Point,
  StartRecordingOptions,
  TorchMode,
  VideoFile,
} from './types.js'

/** Tag name the native element registers under on iOS and Android. */
export const CAMERA_VIEW_TAG = 'camera-view'

interface SelectorQueryNode {
  invoke(options: {
    method: string
    params?: Record<string, unknown>
    success?: (result: unknown) => void
    fail?: (error: unknown) => void
  }): SelectorQuery
}

interface SelectorQuery {
  select(selector: string): SelectorQueryNode
  exec(): void
}

declare const lynx: { createSelectorQuery?: () => SelectorQuery } | undefined

function resolveSelectorQuery(): SelectorQuery | null {
  try {
    if (typeof lynx === 'undefined' || typeof lynx?.createSelectorQuery !== 'function') return null
    return lynx.createSelectorQuery()
  } catch {
    return null
  }
}

export function isCameraViewBridgeAvailable(): boolean {
  return resolveSelectorQuery() !== null
}

/**
 * Call an imperative method on a rendered `<camera-view>` element through
 * Lynx's SelectorQuery bridge, e.g. `invokeCameraViewMethod('#camera', 'ping')`.
 */
export function invokeCameraViewMethod<T = unknown>(
  selector: string,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const query = resolveSelectorQuery()
    if (!query) {
      reject(
        new Error(
          `Cannot call ${method}() on "${selector}": lynx.createSelectorQuery is not available in this runtime. ` +
            'Camera view methods only work inside a Lynx app with the native camera-view element registered.',
        ),
      )
      return
    }

    query
      .select(selector)
      .invoke({
        method,
        params: params ?? {},
        success: (result) => resolve(result as T),
        fail: (error) => reject(normalizeInvokeError(selector, method, error)),
      })
      .exec()
  })
}

export interface CameraViewHandle extends CameraViewMethods {
  selector: string
}

/**
 * Wrap a rendered `<camera-view>` element in the typed `CameraViewMethods`
 * surface. Only `ping()` is implemented natively today (bridge spike);
 * remaining methods reject at the native layer until the V1 milestones land.
 */
export function createCameraViewHandle(selector: string): CameraViewHandle {
  return {
    selector,

    async ping(): Promise<{ ok: true }> {
      return invokeCameraViewMethod(selector, 'ping')
    },

    async capturePhoto(options?: CapturePhotoOptions): Promise<PhotoFile> {
      return invokeCameraViewMethod(selector, 'capturePhoto', { ...options })
    },

    async startRecording(options?: StartRecordingOptions): Promise<void> {
      await invokeCameraViewMethod(selector, 'startRecording', { ...options })
    },

    async stopRecording(): Promise<VideoFile> {
      return invokeCameraViewMethod(selector, 'stopRecording')
    },

    async focusAtPoint(point: Point): Promise<void> {
      await invokeCameraViewMethod(selector, 'focusAtPoint', { x: point.x, y: point.y })
    },

    async setZoom(value: number): Promise<void> {
      await invokeCameraViewMethod(selector, 'setZoom', { value })
    },

    async setTorch(mode: TorchMode): Promise<void> {
      await invokeCameraViewMethod(selector, 'setTorch', { mode })
    },
  }
}

function normalizeInvokeError(selector: string, method: string, error: unknown): Error {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const { code, message, data } = error as { code?: unknown; message?: unknown; data?: unknown }
    const reason = message ?? data ?? code
    if (reason !== undefined) {
      return new Error(`camera-view ${method}() on "${selector}" failed: ${String(reason)}`)
    }
  }
  return new Error(`camera-view ${method}() on "${selector}" failed.`)
}
