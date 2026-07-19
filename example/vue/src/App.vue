<!--
  Vue Lynx port of the ReactLynx demo (example/react/src/App.tsx). Drives the
  SAME native `camera-view` element and `createCameraViewHandle` contract with no
  React dependency — the 0.3 framework-portability proof.

  This is the runnable Vue Lynx app's `src/App.vue`; `src/index.ts` mounts it.
  Run it with `pnpm --filter @chimera-camera/vue run dev`. Native-element event
  bindings use Vue Lynx's `@event` convention (maps to the native `bind<event>`,
  same as `@tap` -> `bindtap`). Reactivity is imported from `vue-lynx` (not `vue`)
  so it runs in the Lynx runtime rather than the DOM runtime.
-->
<template>
  <view class="screen">
    <text class="title">Chimera Camera Demo (Vue)</text>

    <view class="badge" :class="cameraInstallStatus.ok ? 'badgeNative' : 'badgeMock'">
      <text class="badgeText">{{ cameraInstallStatus.ok ? 'NATIVE CAMERA' : 'MOCK ADAPTER' }}</text>
    </view>

    <text class="meta">Install: {{ cameraInstallStatus.code }}</text>
    <text class="meta">Camera: {{ cameraName }}</text>
    <text class="meta">Permission: {{ permission }}</text>
    <text class="meta">Bridge: {{ cameraViewStatus }}</text>
    <text class="status">{{ status }}</text>

    <view v-if="!cameraInstallStatus.ok" class="installBox">
      <text class="installText">
        Mock mode — expected in Lynx Go / LynxExplorer, which can't load the native camera. The capture
        button below uses the mock adapter; a live camera needs a custom iOS/Android host. See
        docs/lynx-explorer.md.
      </text>
    </view>

    <camera-view
      v-if="cameraInstallStatus.ok && cameraActive"
      id="camera"
      :active="true"
      :facing="facing"
      resize-mode="cover"
      class="cameraView"
      @ready="verifyCameraViewBridge"
      @error="onCameraViewError"
      @recordingstarted="controlStatus = 'recordingStarted event'"
      @recordingfinished="onRecordingFinished"
    />

    <view class="preview">
      <image
        v-if="capturedPhotoPreviewSource"
        :src="capturedPhotoPreviewSource"
        class="previewImage"
        mode="aspectFit"
      />
      <text v-else class="previewText">{{ capturedPhotoLabel }}</text>
    </view>

    <view class="button" @tap="cameraInstallStatus.ok ? captureEmbeddedCamera() : captureSystemCamera()">
      <text class="buttonText">
        {{ busy ? 'Working...' : cameraInstallStatus.ok ? 'Capture embedded photo' : 'Capture mock photo' }}
      </text>
    </view>

    <!-- Session controls — drive the full CameraViewMethods surface (recording,
         zoom, torch, focus) against the live view or the mock. -->
    <text class="sectionHeader">
      Session controls ({{ cameraInstallStatus.ok ? 'live camera-view' : 'mock' }}) — zoom {{ zoom }}x, torch
      {{ torch }}: {{ controlStatus }}
    </text>
    <view class="secondaryButton" :style="{ background: recording ? '#c92a2a' : '#333333' }" @tap="toggleRecording">
      <text class="secondaryButtonText">{{ recording ? 'Stop recording' : 'Start recording (audio)' }}</text>
    </view>
    <view class="secondaryButton" @tap="nudgeZoom(1)">
      <text class="secondaryButtonText">Zoom in (+1x)</text>
    </view>
    <view class="secondaryButton" @tap="nudgeZoom(-1)">
      <text class="secondaryButtonText">Zoom out (-1x)</text>
    </view>
    <view class="secondaryButton" @tap="toggleTorch">
      <text class="secondaryButtonText">Turn torch {{ torch === 'on' ? 'off' : 'on' }}</text>
    </view>
    <view class="secondaryButton" @tap="focusCenter">
      <text class="secondaryButtonText">Focus center</text>
    </view>
    <text v-if="lastVideo" class="meta">Last video: {{ lastVideo.path }} ({{ lastVideo.durationMs ?? 0 }}ms)</text>

    <template v-if="cameraInstallStatus.ok">
      <view class="secondaryButton" @tap="toggleFacing">
        <text class="secondaryButtonText">Switch to {{ facing === 'back' ? 'front' : 'back' }}</text>
      </view>
      <view class="secondaryButton" @tap="cameraActive = !cameraActive">
        <text class="secondaryButtonText">{{ cameraActive ? 'Close camera' : 'Reopen camera' }}</text>
      </view>
      <view class="secondaryButton" @tap="captureSystemCamera">
        <text class="secondaryButtonText">Open system camera</text>
      </view>
    </template>

    <view v-if="capturedPhoto" class="secondaryButton" :style="{ opacity: props.uploadPhoto ? 1 : 0.55 }" @tap="uploadCapturedPhoto">
      <text class="secondaryButtonText">
        {{ props.uploadPhoto ? 'Upload captured photo' : 'Photo ready — pass uploadPhoto to upload' }}
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue-lynx'
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

const props = defineProps<{ uploadPhoto?: (photo: PhotoFile) => Promise<void> }>()

const cameraInstallStatus = getCameraInstallStatus()
const cameraModule: CameraModuleClient = createCameraModule({ optional: true }) ?? createMockCameraModule()

const busy = ref(false)
const cameraActive = ref(true)
const facing = ref<TargetCameraPosition>('back')
const cameraViewStatus = ref(cameraInstallStatus.ok ? 'Waiting for camera-view ready' : 'Mock mode')
const permission = ref('unknown')
const cameraName = ref('unknown')
const capturedPhoto = ref<PhotoFile | null>(null)
const error = ref<string | null>(null)

// Session controls (0.3) run against the live camera-view when native is present,
// or the mock adapter otherwise — both implement CameraSessionMethods, so the same
// buttons drive either. Recording/zoom/torch/focus are real on the mock, so they're
// exercisable end-to-end in Lynx Go without a device.
const session: CameraSessionMethods = cameraInstallStatus.ok ? createCameraViewHandle('#camera') : cameraModule
const recording = ref(false)
const lastVideo = ref<VideoFile | null>(null)
const zoom = ref(1)
const torch = ref<TorchMode>('off')
const controlStatus = ref('idle')

const status = computed(() => {
  if (error.value) return error.value
  if (capturedPhoto.value) return cameraInstallStatus.ok ? 'Photo captured' : 'Mock photo captured'
  return 'Ready'
})

const capturedPhotoLabel = computed(() => {
  if (!capturedPhoto.value) return 'No photo yet'
  return `${capturedPhoto.value.width ?? 0} x ${capturedPhoto.value.height ?? 0} ${capturedPhoto.value.mime ?? 'image'}`
})

// Mock/web previews display base64 (no real file behind the path); native
// captures would display `file://${path}` instead. See docs/output-transport.md.
const capturedPhotoPreviewSource = computed(() => {
  if (!capturedPhoto.value?.base64) return null
  return `data:${capturedPhoto.value.mime ?? 'image/jpeg'};base64,${capturedPhoto.value.base64}`
})

onMounted(async () => {
  try {
    const permissions = await cameraModule.getPermissions()
    const devices = await cameraModule.getAvailableCameraDevices()
    permission.value = permissions.camera
    cameraName.value = devices[0]?.localizedName ?? 'No camera'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

function toggleFacing() {
  facing.value = facing.value === 'back' ? 'front' : 'back'
}

function onCameraViewError(event: { detail?: { message?: string } }) {
  error.value = event.detail?.message ?? 'camera-view failed'
}

async function captureSystemCamera() {
  busy.value = true
  error.value = null
  try {
    capturedPhoto.value = await cameraModule.capturePhoto({ includeBase64: true, maxDimension: 1600 })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function captureEmbeddedCamera() {
  busy.value = true
  error.value = null
  try {
    capturedPhoto.value = await createCameraViewHandle('#camera').capturePhoto({
      includeBase64: true,
      maxDimension: 1600,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function verifyCameraViewBridge() {
  try {
    const pingResult = await createCameraViewHandle('#camera').ping()
    cameraViewStatus.value = pingResult.ok ? 'camera-view ready; ping OK' : 'camera-view returned an invalid ping'
  } catch (e) {
    cameraViewStatus.value = e instanceof Error ? e.message : String(e)
  }
}

async function uploadCapturedPhoto() {
  if (!capturedPhoto.value || !props.uploadPhoto) return
  busy.value = true
  error.value = null
  try {
    await props.uploadPhoto(capturedPhoto.value)
    cameraViewStatus.value = 'Upload complete'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

function onRecordingFinished(event: { detail?: { file?: VideoFile } }) {
  if (event.detail?.file) lastVideo.value = event.detail.file
}

async function toggleRecording() {
  try {
    if (recording.value) {
      const video = await session.stopRecording()
      recording.value = false
      lastVideo.value = video
      controlStatus.value = `recorded ${video.durationMs ?? 0}ms`
    } else {
      await session.startRecording({ enableAudio: true })
      recording.value = true
      controlStatus.value = 'recording…'
    }
  } catch (e) {
    recording.value = false
    controlStatus.value = toMessage(e)
  }
}

async function nudgeZoom(delta: number) {
  const next = Math.max(1, Math.min(8, zoom.value + delta))
  try {
    await session.setZoom(next)
    zoom.value = next
    controlStatus.value = `zoom ${next}x`
  } catch (e) {
    controlStatus.value = toMessage(e)
  }
}

async function toggleTorch() {
  const next: TorchMode = torch.value === 'on' ? 'off' : 'on'
  try {
    await session.setTorch(next)
    torch.value = next
    controlStatus.value = `torch ${next}`
  } catch (e) {
    controlStatus.value = toMessage(e)
  }
}

async function focusCenter() {
  try {
    await session.focusAtPoint({ x: 0.5, y: 0.5 })
    controlStatus.value = 'focused center'
  } catch (e) {
    controlStatus.value = toMessage(e)
  }
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
</script>

<style scoped>
.screen {
  width: 100%;
  min-height: 100%;
  padding: 24px;
  background: #111111;
}

.title {
  color: #ffffff;
  font-size: 28px;
  font-weight: 700;
}

.badge {
  margin-top: 12px;
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 4px;
}

.badgeNative {
  background: #2f9e44;
}

.badgeMock {
  background: #e8590c;
}

.badgeText {
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
}

.meta,
.status {
  margin-top: 12px;
  color: #d7d7d7;
  font-size: 16px;
}

.sectionHeader {
  margin-top: 12px;
  color: #8ab4f8;
  font-size: 16px;
  font-weight: 700;
}

.installBox {
  margin-top: 16px;
  padding: 12px;
  background: #2b1a12;
  border-radius: 8px;
}

.installText {
  color: #ffb38a;
  font-size: 12px;
}

.cameraView {
  margin-top: 24px;
  width: 100%;
  height: 320px;
  border-radius: 8px;
}

.preview {
  margin-top: 24px;
  width: 100%;
  height: 280px;
  align-items: center;
  justify-content: center;
  background: #222222;
  border-radius: 8px;
  overflow: hidden;
}

.previewImage {
  width: 100%;
  height: 100%;
}

.previewText {
  color: #ffffff;
  font-size: 18px;
}

.button {
  margin-top: 24px;
  height: 56px;
  align-items: center;
  justify-content: center;
  background: #f7c948;
  border-radius: 8px;
}

.buttonText {
  color: #111111;
  font-size: 17px;
  font-weight: 700;
}

.secondaryButton {
  margin-top: 12px;
  height: 48px;
  align-items: center;
  justify-content: center;
  background: #333333;
  border-radius: 8px;
}

.secondaryButtonText {
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
}
</style>
