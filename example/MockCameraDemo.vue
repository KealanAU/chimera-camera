<template>
  <view class="screen">
    <text class="title">Lynx Camera Mock</text>
    <text class="meta">Camera: {{ cameraName }}</text>
    <text class="meta">Permission: {{ permission }}</text>
    <text class="status">{{ status }}</text>

    <view class="preview">
      <text class="previewText">{{ photoLabel }}</text>
    </view>

    <view class="button" @tap="capture">
      <text class="buttonText">{{ busy ? 'Capturing...' : 'Capture mock photo' }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createCameraAdapter, type CameraAdapter, type PhotoFile } from '@kealanau/lynx-camera'
import { createMockCameraModule } from '@kealanau/lynx-camera/mock'

const camera: CameraAdapter = createCameraAdapter({ mock: true }) ?? createMockCameraModule()

const busy = ref(false)
const permission = ref('unknown')
const cameraName = ref('unknown')
const photo = ref<PhotoFile | null>(null)
const error = ref<string | null>(null)

const status = computed(() => {
  if (error.value) return error.value
  if (photo.value) return 'Mock photo captured'
  return 'Ready'
})

const photoLabel = computed(() => {
  if (!photo.value) return 'No photo yet'
  return `${photo.value.width ?? 0} x ${photo.value.height ?? 0} ${photo.value.mime ?? 'image'}`
})

onMounted(async () => {
  const permissions = await camera.getPermissions()
  const devices = await camera.getAvailableCameraDevices()
  permission.value = permissions.camera
  cameraName.value = devices[0]?.localizedName ?? 'No camera'
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

.meta,
.status {
  margin-top: 12px;
  color: #d7d7d7;
  font-size: 16px;
}

.preview {
  margin-top: 24px;
  width: 100%;
  height: 280px;
  align-items: center;
  justify-content: center;
  background: #222222;
  border-radius: 8px;
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
