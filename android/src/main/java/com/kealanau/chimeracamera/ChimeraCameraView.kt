package com.kealanau.chimeracamera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import com.lynx.react.bridge.Callback
import com.lynx.react.bridge.JavaOnlyMap
import com.lynx.react.bridge.ReadableMap
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.LynxProp
import com.lynx.tasm.behavior.LynxUIMethod
import com.lynx.tasm.behavior.ui.LynxUI
import com.lynx.tasm.event.LynxDetailEvent
import java.io.File
import java.util.UUID

/**
 * UNVERIFIED FIRST CUT. Written to match docs/native-contract.md and the iOS
 * ChimeraCameraView.m; not yet compiled or run. Verify the Lynx Android UI API
 * (LynxUI base class, @LynxProp/@LynxUIMethod signatures, event emitter) and the
 * CameraX lifecycle binding on an emulator.
 *
 * A CameraX-backed `camera-view` element. Owns its own LifecycleRegistry because
 * a Lynx UI is not a LifecycleOwner. Implements the same minimal surface as iOS:
 * active/facing/resizeMode props, ping(), capturePhoto(), and ready/error events.
 * The 0.3 view-session controls (zoom/torch/focus) and video recording are now
 * implemented below — also UNVERIFIED, matching iOS ChimeraCameraView.m.
 */
class ChimeraCameraView(context: LynxContext) : LynxUI<PreviewView>(context), LifecycleOwner {

    private val lifecycleRegistry = LifecycleRegistry(this)
    private var active = false
    private var facing = "back"
    private var imageCapture: ImageCapture? = null
    private var camera: Camera? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var activeRecording: Recording? = null
    private var stopCallback: Callback? = null
    private var readyDeviceId: String? = null
    private var captureInProgress = false

    override fun getLifecycle(): Lifecycle = lifecycleRegistry

    override fun createView(context: Context): PreviewView {
        lifecycleRegistry.currentState = Lifecycle.State.CREATED
        return PreviewView(context).apply {
            scaleType = PreviewView.ScaleType.FILL_CENTER
        }
    }

    @LynxProp(name = "active")
    fun setActive(value: Boolean) {
        active = value
        syncSession()
    }

    @LynxProp(name = "facing")
    fun setFacing(value: String?) {
        facing = value ?: "back"
        syncSession()
    }

    @LynxProp(name = "resizeMode")
    fun setResizeMode(value: String?) {
        view.scaleType =
            if (value == "contain") PreviewView.ScaleType.FIT_CENTER else PreviewView.ScaleType.FILL_CENTER
    }

    @LynxUIMethod
    fun ping(params: ReadableMap, callback: Callback) {
        val ok = JavaOnlyMap()
        ok.putBoolean("ok", true)
        callback.invoke(0, ok)
    }

    @LynxUIMethod
    fun capturePhoto(params: ReadableMap, callback: Callback) {
        val capture = imageCapture
        if (!active || capture == null) {
            callback.invoke(1, failDetail("capture/not-active", "camera-view is not active; set active={true} and wait for the ready event."))
            return
        }
        if (captureInProgress) {
            callback.invoke(1, failDetail("capture/in-progress", "Another camera-view capture is already in progress."))
            return
        }
        captureInProgress = true

        val quality = PhotoEncoder.clampQuality(if (params.hasKey("quality")) params.getDouble("quality") else 0.9)
        val includeBase64 = params.hasKey("includeBase64") && params.getBoolean("includeBase64")
        val maxDimension = if (params.hasKey("maxDimension")) params.getDouble("maxDimension").toInt() else 0
        // Flash belongs to the capture, not the session: it fires with the shutter
        // and leaves the preview dark (that's what setTorch is for). AUTO hands the
        // decision to the OS scene metering. No-ops on devices without a flash unit.
        capture.flashMode = when (if (params.hasKey("flash")) params.getString("flash") else "off") {
            "on" -> ImageCapture.FLASH_MODE_ON
            "auto" -> ImageCapture.FLASH_MODE_AUTO
            else -> ImageCapture.FLASH_MODE_OFF
        }

        val file = File(view.context.cacheDir, "chimera-camera-${UUID.randomUUID()}.jpg")
        val output = ImageCapture.OutputFileOptions.Builder(file).build()
        capture.takePicture(
            output,
            ContextCompat.getMainExecutor(view.context),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(results: ImageCapture.OutputFileResults) {
                    captureInProgress = false
                    try {
                        callback.invoke(0, PhotoEncoder.encode(file, quality, includeBase64, maxDimension))
                    } catch (error: Throwable) {
                        callback.invoke(1, failDetail("capture/write-failed", error.message ?: "Could not write the captured photo."))
                    }
                }

                override fun onError(exception: ImageCaptureException) {
                    captureInProgress = false
                    callback.invoke(1, failDetail("capture/failed", exception.message ?: "Photo capture failed."))
                }
            },
        )
    }

    @LynxUIMethod
    fun setZoom(params: ReadableMap, callback: Callback) {
        val cam = camera
        if (!active || cam == null) {
            callback.invoke(1, notActive())
            return
        }
        // Contract: clamp rather than reject.
        val value = if (params.hasKey("value")) params.getDouble("value").toFloat() else 1f
        val zoomState = cam.cameraInfo.zoomState.value
        val min = zoomState?.minZoomRatio ?: 1f
        val max = zoomState?.maxZoomRatio ?: 1f
        cam.cameraControl.setZoomRatio(value.coerceIn(min, max))
        callback.invoke(0, JavaOnlyMap())
    }

    @LynxUIMethod
    fun setTorch(params: ReadableMap, callback: Callback) {
        val cam = camera
        if (!active || cam == null) {
            callback.invoke(1, notActive())
            return
        }
        if (!cam.cameraInfo.hasFlashUnit()) {
            callback.invoke(1, failDetail("camera/unsupported", "This camera has no controllable torch."))
            return
        }
        val on = params.hasKey("mode") && params.getString("mode") == "on"
        cam.cameraControl.enableTorch(on)
        callback.invoke(0, JavaOnlyMap())
    }

    @LynxUIMethod
    fun setExposureBias(params: ReadableMap, callback: Callback) {
        val cam = camera
        if (!active || cam == null) {
            callback.invoke(1, notActive())
            return
        }
        // Bias arrives in EV; CameraX takes a compensation index (EV / step).
        // Contract: clamp to the supported range rather than reject.
        val bias = if (params.hasKey("bias")) params.getDouble("bias").toFloat() else 0f
        val state = cam.cameraInfo.exposureState
        val step = state.exposureCompensationStep
        val range = state.exposureCompensationRange
        val index = if (step.toFloat() != 0f) Math.round(bias / step.toFloat()) else 0
        cam.cameraControl.setExposureCompensationIndex(index.coerceIn(range.lower, range.upper))
        callback.invoke(0, JavaOnlyMap())
    }

    @LynxUIMethod
    fun focusAtPoint(params: ReadableMap, callback: Callback) {
        val cam = camera
        if (!active || cam == null) {
            callback.invoke(1, notActive())
            return
        }
        // Point arrives in preview space (0..1); scale into PreviewView coords.
        val x = (if (params.hasKey("x")) params.getDouble("x").toFloat() else 0.5f) * view.width
        val y = (if (params.hasKey("y")) params.getDouble("y").toFloat() else 0.5f) * view.height
        val action = FocusMeteringAction.Builder(view.meteringPointFactory.createPoint(x, y)).build()
        if (!cam.cameraInfo.isFocusMeteringSupported(action)) {
            callback.invoke(1, failDetail("camera/unsupported", "Focus at point is not supported by this camera."))
            return
        }
        cam.cameraControl.startFocusAndMetering(action)
        callback.invoke(0, JavaOnlyMap())
    }

    @LynxUIMethod
    fun startRecording(params: ReadableMap, callback: Callback) {
        val recorderCapture = videoCapture
        if (!active || recorderCapture == null) {
            callback.invoke(1, notActive())
            return
        }
        if (activeRecording != null) {
            callback.invoke(1, failDetail("recording/in-progress", "A recording is already in progress."))
            return
        }
        val enableAudio = params.hasKey("enableAudio") && params.getBoolean("enableAudio")
        if (enableAudio &&
            ContextCompat.checkSelfPermission(view.context, Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            callback.invoke(
                1,
                failDetail(
                    "camera/permission-denied",
                    "Microphone permission is required for audio recording; request it via CameraModule.",
                ),
            )
            return
        }

        val file = File(view.context.cacheDir, "chimera-camera-${UUID.randomUUID()}.mp4")
        val builder = FileOutputOptions.Builder(file)
        if (params.hasKey("maxFileSizeBytes")) builder.setFileSizeLimit(params.getDouble("maxFileSizeBytes").toLong())
        if (params.hasKey("maxDurationMs")) builder.setDurationLimitMillis(params.getDouble("maxDurationMs").toLong())

        var pending = recorderCapture.output.prepareRecording(view.context, builder.build())
        if (enableAudio) pending = pending.withAudioEnabled()

        activeRecording = pending.start(ContextCompat.getMainExecutor(view.context)) { event ->
            when (event) {
                is VideoRecordEvent.Start -> emitRecordingStarted(file.absolutePath)
                is VideoRecordEvent.Finalize -> {
                    activeRecording = null
                    val cb = stopCallback
                    stopCallback = null
                    // A reached size/duration limit is a normal stop with a usable file.
                    val ok = !event.hasError() ||
                        event.error == VideoRecordEvent.Finalize.ERROR_FILE_SIZE_LIMIT_REACHED ||
                        event.error == VideoRecordEvent.Finalize.ERROR_DURATION_LIMIT_REACHED
                    if (!ok) {
                        cb?.invoke(1, failDetail("recording/failed", event.cause?.message ?: "Recording failed."))
                    } else {
                        val videoFile = videoFileMap(
                            file.absolutePath,
                            event.recordingStats.recordedDurationNanos / 1_000_000,
                            file.length(),
                        )
                        cb?.invoke(0, videoFile)
                        emitRecordingFinished(videoFile)
                    }
                }
            }
        }
        callback.invoke(0, JavaOnlyMap())
    }

    @LynxUIMethod
    fun stopRecording(params: ReadableMap, callback: Callback) {
        val recording = activeRecording
        if (recording == null) {
            callback.invoke(1, failDetail("recording/not-active", "No recording is in progress."))
            return
        }
        // Finalize resolves this callback and emits recordingFinished.
        stopCallback = callback
        recording.stop()
    }

    private fun syncSession() {
        if (!active) {
            lifecycleRegistry.currentState = Lifecycle.State.CREATED
            readyDeviceId = null
            camera = null
            videoCapture = null
            return
        }
        val providerFuture = ProcessCameraProvider.getInstance(view.context)
        providerFuture.addListener({
            try {
                bindSession(providerFuture.get())
            } catch (error: Throwable) {
                emitEvent("error", "camera/unavailable", error.message ?: "Could not start the camera.")
            }
        }, ContextCompat.getMainExecutor(view.context))
    }

    private fun bindSession(provider: ProcessCameraProvider) {
        val selector =
            if (facing == "front") CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA
        val preview = Preview.Builder().build().also { it.setSurfaceProvider(view.surfaceProvider) }
        val capture = ImageCapture.Builder().build()

        provider.unbindAll()
        val recorder = Recorder.Builder().build()
        val videoCap = VideoCapture.withOutput(recorder)
        var boundVideo = true
        val camera = try {
            // Preview + ImageCapture + VideoCapture is supported on most modern
            // devices; where it is not, fall back to photo-only so capture still
            // works (recording then reports capture/not-active until a supported
            // device is used).
            provider.bindToLifecycle(this, selector, preview, capture, videoCap)
        } catch (videoError: Throwable) {
            boundVideo = false
            try {
                provider.bindToLifecycle(this, selector, preview, capture)
            } catch (error: Throwable) {
                emitEvent("error", "camera/unavailable", error.message ?: "No $facing camera on this device.")
                return
            }
        }
        imageCapture = capture
        this.camera = camera
        videoCapture = if (boundVideo) videoCap else null
        lifecycleRegistry.currentState = Lifecycle.State.RESUMED

        // CameraX has no stable per-device id here; use the facing as the id so
        // the ready event still fires exactly once per (re)bind, like iOS.
        val deviceId = if (camera.cameraInfo.lensFacing == CameraSelector.LENS_FACING_FRONT) "front" else "back"
        if (deviceId != readyDeviceId) {
            readyDeviceId = deviceId
            emitEvent("ready", deviceId)
        }
    }

    private fun emitEvent(name: String, deviceId: String) {
        val event = LynxDetailEvent(sign, name)
        event.addDetail("deviceId", deviceId)
        lynxContext.eventEmitter.sendCustomEvent(event)
    }

    private fun emitEvent(name: String, code: String, message: String) {
        val event = LynxDetailEvent(sign, name)
        event.addDetail("code", code)
        event.addDetail("message", message)
        lynxContext.eventEmitter.sendCustomEvent(event)
    }

    private fun emitRecordingStarted(path: String) {
        val event = LynxDetailEvent(sign, "recordingStarted")
        event.addDetail("path", path)
        lynxContext.eventEmitter.sendCustomEvent(event)
    }

    private fun emitRecordingFinished(file: JavaOnlyMap) {
        val event = LynxDetailEvent(sign, "recordingFinished")
        event.addDetail("file", file)
        lynxContext.eventEmitter.sendCustomEvent(event)
    }

    private fun videoFileMap(path: String, durationMs: Long, sizeBytes: Long): JavaOnlyMap {
        val map = JavaOnlyMap()
        map.putString("path", path)
        map.putDouble("durationMs", durationMs.toDouble())
        map.putDouble("sizeBytes", sizeBytes.toDouble())
        return map
    }

    private fun failDetail(code: String, message: String): JavaOnlyMap {
        val detail = JavaOnlyMap()
        detail.putString("code", code)
        detail.putString("message", message)
        return detail
    }

    private fun notActive(): JavaOnlyMap =
        failDetail("capture/not-active", "camera-view is not active; set active={true} and wait for the ready event.")

}
