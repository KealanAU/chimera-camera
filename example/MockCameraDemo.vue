<template>
  <view class="screen">
    <text class="title">Chimera Camera Demo</text>

    <view class="badge" :class="install.ok ? 'badgeNative' : 'badgeMock'">
      <text class="badgeText">{{ install.ok ? 'NATIVE CAMERA' : 'MOCK ADAPTER' }}</text>
    </view>

    <text class="meta">Install: {{ install.code }}</text>
    <text class="meta">Camera: {{ cameraName }}</text>
    <text class="meta">Permission: {{ permission }}</text>
    <text class="status">{{ status }}</text>

    <!-- On Lynx Go / LynxExplorer the native module can't exist; say so on
         screen, because console logs are invisible without Lynx DevTool. -->
    <view v-if="!install.ok" class="installBox">
      <text class="installText">{{ install.message }}</text>
    </view>

    <view class="preview">
      <image v-if="photoSrc" :src="photoSrc" class="previewImage" mode="aspectFit" />
      <text v-else class="previewText">{{ photoLabel }}</text>
    </view>

    <view class="button" @tap="capture">
      <text class="buttonText">{{ busy ? 'Capturing...' : 'Capture photo' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  createCameraAdapter,
  getCameraInstallStatus,
  type CameraAdapter,
  type PhotoFile,
} from '@kealanau/chimera-camera'
import { createMockCameraModule } from '@kealanau/chimera-camera/mock'

// The pattern for hosts like Lynx Go / LynxExplorer: check the install
// status first, use the real adapter when it exists, and fall back to the
// mock loudly (badge + status box) instead of silently.
const install = getCameraInstallStatus()
const camera: CameraAdapter = createCameraAdapter({ optional: true }) ?? createMockCameraModule()

const busy = ref(false)
const permission = ref('unknown')
const cameraName = ref('unknown')
const photo = ref<PhotoFile | null>(null)
const error = ref<string | null>(null)

const status = computed(() => {
  if (error.value) return error.value
  if (photo.value) return install.ok ? 'Photo captured' : 'Mock photo captured'
  return 'Ready'
})

const photoLabel = computed(() => {
  if (!photo.value) return 'No photo yet'
  return `${photo.value.width ?? 0} x ${photo.value.height ?? 0} ${photo.value.mime ?? 'image'}`
})

const photoSrc = computed(() => {
  if (!photo.value?.base64) return null
  return `data:${photo.value.mime ?? 'image/jpeg'};base64,${photo.value.base64}`
})

onMounted(async () => {
  try {
    const permissions = await camera.getPermissions()
    const devices = await camera.getAvailableCameraDevices()
    permission.value = permissions.camera
    cameraName.value = devices[0]?.localizedName ?? 'No camera'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

async function capture() {
  busy.value = true
  error.value = null
  try {
    photo.value = await camera.capturePhoto()
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
</style>
