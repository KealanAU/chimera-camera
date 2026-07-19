/*
 * ReactLynx camera demo — the device-proven reference for driving Chimera
 * Camera from React. It renders the native `camera-view` preview and calls the
 * module + `createCameraViewHandle` surface, falling back to the mock adapter
 * when no native camera is installed.
 *
 * This is the runnable ReactLynx app's `src/App.tsx`; `src/index.tsx` renders it.
 * Run it with `pnpm --filter @chimera-camera/react run dev`. Full quickstart in
 * `docs/lynx-explorer.md`. `example/CameraDemo.vue` is the Vue Lynx port of this
 * same flow and native contract.
 *
 * Pass an `uploadPhoto(photo)` prop to wire a real uploader; without it the demo
 * still runs capture/preview and shows the upload step as inert.
 */
import { useEffect, useState } from '@lynx-js/react'

import {
  createCameraModule,
  createCameraViewHandle,
  getCameraInstallStatus,
  type CameraModuleClient,
  type CameraSessionMethods,
  type PhotoFile,
  type TargetCameraPosition,
  type TorchMode,
  type VideoFile,
} from '@kealanau/chimera-camera'
import { createMockCameraModule } from '@kealanau/chimera-camera/mock'

const cameraInstallStatus = getCameraInstallStatus()
const cameraModule: CameraModuleClient = createCameraModule({ optional: true }) ?? createMockCameraModule()

export interface CameraDemoProps {
  uploadPhoto?: (photo: PhotoFile) => Promise<void>
}

export function CameraDemo({ uploadPhoto }: CameraDemoProps) {
  const [busy, setBusy] = useState(false)
  const [cameraActive, setCameraActive] = useState(true)
  const [facing, setFacing] = useState<TargetCameraPosition>('back')
  const [cameraViewStatus, setCameraViewStatus] = useState(
    cameraInstallStatus.ok ? 'Waiting for camera-view ready' : 'Mock mode',
  )
  const [permission, setPermission] = useState('unknown')
  const [cameraName, setCameraName] = useState('unknown')
  const [capturedPhoto, setCapturedPhoto] = useState<PhotoFile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Session controls (0.3) run against the live camera-view when native is
  // present, or the mock adapter otherwise — both implement CameraSessionMethods,
  // so the same buttons drive either one. Recording/zoom/torch/focus are real on
  // the mock, so they're exercisable end-to-end in Lynx Go without a device.
  const session: CameraSessionMethods = cameraInstallStatus.ok ? createCameraViewHandle('#camera') : cameraModule
  const [recording, setRecording] = useState(false)
  const [lastVideo, setLastVideo] = useState<VideoFile | null>(null)
  const [zoom, setZoom] = useState(1)
  const [torch, setTorch] = useState<TorchMode>('off')
  const [controlStatus, setControlStatus] = useState('idle')

  async function toggleRecording() {
    try {
      if (recording) {
        const video = await session.stopRecording()
        setRecording(false)
        setLastVideo(video)
        setControlStatus(`recorded ${video.durationMs ?? 0}ms`)
      } else {
        await session.startRecording({ enableAudio: true })
        setRecording(true)
        setControlStatus('recording…')
      }
    } catch (e) {
      setRecording(false)
      setControlStatus(toMessage(e))
    }
  }

  async function nudgeZoom(delta: number) {
    const next = Math.max(1, Math.min(8, zoom + delta))
    try {
      await session.setZoom(next)
      setZoom(next)
      setControlStatus(`zoom ${next}x`)
    } catch (e) {
      setControlStatus(toMessage(e))
    }
  }

  async function toggleTorch() {
    const next: TorchMode = torch === 'on' ? 'off' : 'on'
    try {
      await session.setTorch(next)
      setTorch(next)
      setControlStatus(`torch ${next}`)
    } catch (e) {
      setControlStatus(toMessage(e))
    }
  }

  async function focusCenter() {
    try {
      await session.focusAtPoint({ x: 0.5, y: 0.5 })
      setControlStatus('focused center')
    } catch (e) {
      setControlStatus(toMessage(e))
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const permissions = await cameraModule.getPermissions()
        const devices = await cameraModule.getAvailableCameraDevices()
        setPermission(permissions.camera)
        setCameraName(devices[0]?.localizedName ?? 'No camera')
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [])

  async function captureSystemCamera() {
    setBusy(true)
    setError(null)
    try {
      setCapturedPhoto(await cameraModule.capturePhoto({ includeBase64: true, maxDimension: 1600 }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function captureEmbeddedCamera() {
    setBusy(true)
    setError(null)
    try {
      setCapturedPhoto(
        await createCameraViewHandle('#camera').capturePhoto({
          includeBase64: true,
          maxDimension: 1600,
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function verifyCameraViewBridge() {
    try {
      const pingResult = await createCameraViewHandle('#camera').ping()
      setCameraViewStatus(pingResult.ok ? 'camera-view ready; ping OK' : 'camera-view returned an invalid ping')
    } catch (e) {
      setCameraViewStatus(e instanceof Error ? e.message : String(e))
    }
  }

  async function uploadCapturedPhoto() {
    if (!capturedPhoto || !uploadPhoto) return
    setBusy(true)
    setError(null)
    try {
      await uploadPhoto(capturedPhoto)
      setCameraViewStatus('Upload complete')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const status =
    error ?? (capturedPhoto ? (cameraInstallStatus.ok ? 'Photo captured' : 'Mock photo captured') : 'Ready')
  const capturedPhotoLabel = capturedPhoto
    ? `${capturedPhoto.width ?? 0} x ${capturedPhoto.height ?? 0} ${capturedPhoto.mime ?? 'image'}`
    : 'No photo yet'
  // Mock/web previews display base64 (no real file behind the path); native
  // captures could display `file://${path}` instead. See docs/output-transport.md.
  const capturedPhotoPreviewSource = capturedPhoto?.base64
    ? `data:${capturedPhoto.mime ?? 'image/jpeg'};base64,${capturedPhoto.base64}`
    : null

  return (
    <view style={{ width: '100%', minHeight: '100%', padding: '24px', backgroundColor: '#111111' }}>
      <text style={{ color: '#ffffff', fontSize: '28px', fontWeight: 'bold' }}>Chimera Camera Demo</text>

      <view
        style={{
          marginTop: '12px',
          alignSelf: 'flex-start',
          padding: '4px 10px',
          borderRadius: '4px',
          backgroundColor: cameraInstallStatus.ok ? '#2f9e44' : '#e8590c',
        }}
      >
        <text style={{ color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}>
          {cameraInstallStatus.ok ? 'NATIVE CAMERA' : 'MOCK ADAPTER'}
        </text>
      </view>

      <text style={metaStyle}>Install: {cameraInstallStatus.code}</text>
      <text style={metaStyle}>Camera: {cameraName}</text>
      <text style={metaStyle}>Permission: {permission}</text>
      <text style={metaStyle}>Bridge: {cameraViewStatus}</text>
      <text style={metaStyle}>{status}</text>

      {!cameraInstallStatus.ok && (
        <view style={{ marginTop: '16px', padding: '12px', backgroundColor: '#2b1a12', borderRadius: '8px' }}>
          <text style={{ color: '#ffb38a', fontSize: '13px' }}>
            Mock mode — expected in Lynx Go / LynxExplorer, which can't load the native camera. The capture
            button below uses the mock adapter; a live camera needs a custom iOS/Android host. See
            docs/lynx-explorer.md.
          </text>
        </view>
      )}

      {cameraInstallStatus.ok && cameraActive && (
        <camera-view
          id="camera"
          active={true}
          facing={facing}
          resizeMode="cover"
          bindready={verifyCameraViewBridge}
          binderror={(event: { detail?: { message?: string } }) =>
            setError(event.detail?.message ?? 'camera-view failed')
          }
          bindrecordingstarted={() => setControlStatus('recordingStarted event')}
          bindrecordingfinished={(event: { detail?: { file?: VideoFile } }) => {
            if (event.detail?.file) setLastVideo(event.detail.file)
          }}
          style={{ marginTop: '24px', width: '100%', height: '320px', borderRadius: '8px' }}
        />
      )}

      <view
        style={{
          marginTop: '24px',
          width: '100%',
          height: '280px',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#222222',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {capturedPhotoPreviewSource ? (
          <image src={capturedPhotoPreviewSource} style={{ width: '100%', height: '100%' }} mode="aspectFit" />
        ) : (
          <text style={{ color: '#ffffff', fontSize: '18px' }}>{capturedPhotoLabel}</text>
        )}
      </view>

      <view
        bindtap={cameraInstallStatus.ok ? captureEmbeddedCamera : captureSystemCamera}
        style={{
          marginTop: '24px',
          height: '56px',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f7c948',
          borderRadius: '8px',
        }}
      >
        <text style={{ color: '#111111', fontSize: '17px', fontWeight: 'bold' }}>
          {busy ? 'Working...' : cameraInstallStatus.ok ? 'Capture embedded photo' : 'Capture mock photo'}
        </text>
      </view>

      {/* Session controls — drive the full CameraViewMethods surface (recording,
          zoom, torch, focus) against the live view or the mock. */}
      <text style={{ ...metaStyle, color: '#8ab4f8', fontWeight: 'bold' }}>
        Session controls ({cameraInstallStatus.ok ? 'live camera-view' : 'mock'}) — zoom {zoom}x, torch {torch}: {controlStatus}
      </text>
      <view
        bindtap={toggleRecording}
        style={{ ...secondaryButtonStyle, backgroundColor: recording ? '#c92a2a' : '#333333' }}
      >
        <text style={secondaryButtonTextStyle}>{recording ? 'Stop recording' : 'Start recording (audio)'}</text>
      </view>
      <view bindtap={() => nudgeZoom(1)} style={secondaryButtonStyle}>
        <text style={secondaryButtonTextStyle}>Zoom in (+1x)</text>
      </view>
      <view bindtap={() => nudgeZoom(-1)} style={secondaryButtonStyle}>
        <text style={secondaryButtonTextStyle}>Zoom out (-1x)</text>
      </view>
      <view bindtap={toggleTorch} style={secondaryButtonStyle}>
        <text style={secondaryButtonTextStyle}>Turn torch {torch === 'on' ? 'off' : 'on'}</text>
      </view>
      <view bindtap={focusCenter} style={secondaryButtonStyle}>
        <text style={secondaryButtonTextStyle}>Focus center</text>
      </view>
      {lastVideo && (
        <text style={metaStyle}>
          Last video: {lastVideo.path} ({lastVideo.durationMs ?? 0}ms)
        </text>
      )}

      {cameraInstallStatus.ok && (
        <>
          <view bindtap={() => setFacing(facing === 'back' ? 'front' : 'back')} style={secondaryButtonStyle}>
            <text style={secondaryButtonTextStyle}>Switch to {facing === 'back' ? 'front' : 'back'}</text>
          </view>
          <view bindtap={() => setCameraActive(!cameraActive)} style={secondaryButtonStyle}>
            <text style={secondaryButtonTextStyle}>{cameraActive ? 'Close camera' : 'Reopen camera'}</text>
          </view>
          <view bindtap={captureSystemCamera} style={secondaryButtonStyle}>
            <text style={secondaryButtonTextStyle}>Open system camera</text>
          </view>
        </>
      )}

      {capturedPhoto && (
        <view bindtap={uploadCapturedPhoto} style={{ ...secondaryButtonStyle, opacity: uploadPhoto ? 1 : 0.55 }}>
          <text style={secondaryButtonTextStyle}>
            {uploadPhoto ? 'Upload captured photo' : 'Photo ready — pass uploadPhoto to upload'}
          </text>
        </view>
      )}
    </view>
  )
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

const metaStyle = { marginTop: '12px', color: '#d7d7d7', fontSize: '16px' }
const secondaryButtonStyle = {
  marginTop: '12px',
  height: '48px',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: '#333333',
  borderRadius: '8px',
}
const secondaryButtonTextStyle = { color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const }

export default CameraDemo
