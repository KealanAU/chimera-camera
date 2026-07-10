// ReactLynx demo for a standard `pnpm create rspeedy` project.
// Drop this in as src/App.tsx (or render <CameraDemo /> from it), run
// `pnpm dev`, and scan the QR code with Lynx Go / LynxExplorer.
//
// Everything renders on screen — install status, errors, captured photo —
// because console logs are invisible on device without Lynx DevTool.

import { useEffect, useState } from '@lynx-js/react'

import {
  createCameraAdapter,
  getCameraInstallStatus,
  type CameraAdapter,
  type PhotoFile,
} from '@kealanau/lynx-camera'
import { createMockCameraModule } from '@kealanau/lynx-camera/mock'

// The pattern for hosts like Lynx Go: check install status first, use the
// real camera when the native module is registered, and fall back to the
// mock loudly (badge + message box) instead of silently.
const install = getCameraInstallStatus()
const camera: CameraAdapter = createCameraAdapter({ optional: true }) ?? createMockCameraModule()

export function CameraDemo() {
  const [busy, setBusy] = useState(false)
  const [permission, setPermission] = useState('unknown')
  const [cameraName, setCameraName] = useState('unknown')
  const [photo, setPhoto] = useState<PhotoFile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const permissions = await camera.getPermissions()
        const devices = await camera.getAvailableCameraDevices()
        setPermission(permissions.camera)
        setCameraName(devices[0]?.localizedName ?? 'No camera')
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [])

  async function capture() {
    setBusy(true)
    setError(null)
    try {
      setPhoto(await camera.capturePhoto())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const status = error ?? (photo ? (install.ok ? 'Photo captured' : 'Mock photo captured') : 'Ready')
  const photoLabel = photo
    ? `${photo.width ?? 0} x ${photo.height ?? 0} ${photo.mime ?? 'image'}`
    : 'No photo yet'
  const photoSrc = photo?.base64 ? `data:${photo.mime ?? 'image/jpeg'};base64,${photo.base64}` : null

  return (
    <view style={{ width: '100%', minHeight: '100%', padding: '24px', backgroundColor: '#111111' }}>
      <text style={{ color: '#ffffff', fontSize: '28px', fontWeight: 'bold' }}>Lynx Camera Demo</text>

      <view
        style={{
          marginTop: '12px',
          alignSelf: 'flex-start',
          padding: '4px 10px',
          borderRadius: '4px',
          backgroundColor: install.ok ? '#2f9e44' : '#e8590c',
        }}
      >
        <text style={{ color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}>
          {install.ok ? 'NATIVE CAMERA' : 'MOCK ADAPTER'}
        </text>
      </view>

      <text style={metaStyle}>Install: {install.code}</text>
      <text style={metaStyle}>Camera: {cameraName}</text>
      <text style={metaStyle}>Permission: {permission}</text>
      <text style={metaStyle}>{status}</text>

      {!install.ok && (
        <view style={{ marginTop: '16px', padding: '12px', backgroundColor: '#2b1a12', borderRadius: '8px' }}>
          <text style={{ color: '#ffb38a', fontSize: '12px' }}>{install.message}</text>
        </view>
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
        {photoSrc ? (
          <image src={photoSrc} style={{ width: '100%', height: '100%' }} mode="aspectFit" />
        ) : (
          <text style={{ color: '#ffffff', fontSize: '18px' }}>{photoLabel}</text>
        )}
      </view>

      <view
        bindtap={capture}
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
          {busy ? 'Capturing...' : 'Capture photo'}
        </text>
      </view>
    </view>
  )
}

const metaStyle = { marginTop: '12px', color: '#d7d7d7', fontSize: '16px' }

export default CameraDemo
