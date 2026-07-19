<!--
  Vue Lynx port of CameraDemo.tsx. Drives the SAME native `camera-view` element
  and `createCameraViewHandle` contract as the ReactLynx demo, with no React
  dependency — the 0.3 framework-portability proof.

  UNVERIFIED: written against the pre-alpha Vue Lynx toolchain
  (`npm create vue-lynx@latest`); not yet built or run. Native-element event
  bindings use Vue Lynx's `@event` convention (maps to the native `bind<event>`,
  same as `@tap` -> `bindtap`).
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
      <text class="installText">{{ cameraInstallStatus.message }}</text>
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
import { computed, onMounted, ref } from 'vue'
import {
  createCameraModule,
  createCameraViewHandle,
  getCameraInstallStatus,
  type CameraModuleClient,
  type PhotoFile,
  type TargetCameraPosition,
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
