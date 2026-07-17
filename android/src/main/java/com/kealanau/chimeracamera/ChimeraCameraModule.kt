package com.kealanau.chimeracamera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import androidx.core.content.ContextCompat
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxModule
import com.lynx.react.bridge.Callback
import com.lynx.react.bridge.JavaOnlyArray
import com.lynx.react.bridge.JavaOnlyMap
import com.lynx.react.bridge.ReadableMap

/**
 * UNVERIFIED FIRST CUT. Written to match docs/native-contract.md and the iOS
 * ChimeraCameraModule.swift; not yet compiled or run. Before shipping: confirm
 * the Lynx Android module/UI API (class + annotation names can vary by Lynx
 * release) and verify the ChimeraProxyActivity result wiring on an emulator.
 *
 * Mirrors the iOS CameraModule surface: version, permissions, device discovery,
 * system-camera capture, and photo-library pick. Method names must stay in sync
 * with the JS NativeCameraModuleShape and requiredNativeMethods.
 */
class ChimeraCameraModule(context: Context) : LynxModule(context) {

    private val appContext: Context = context.applicationContext

    @LynxMethod
    fun getChimeraCameraNativeVersion(callback: Callback) {
        callback.invoke(NATIVE_VERSION)
    }

    @LynxMethod
    fun getPermissions(callback: Callback) {
        val result = JavaOnlyMap()
        result.putString("camera", permissionStatus(Manifest.permission.CAMERA))
        result.putString("microphone", permissionStatus(Manifest.permission.RECORD_AUDIO))
        callback.invoke(result)
    }

    @LynxMethod
    fun requestCameraPermission(callback: Callback) {
        requestPermission(Manifest.permission.CAMERA, callback)
    }

    @LynxMethod
    fun requestMicrophonePermission(callback: Callback) {
        requestPermission(Manifest.permission.RECORD_AUDIO, callback)
    }

    @LynxMethod
    fun getAvailableCameraDevices(callback: Callback) {
        try {
            val manager = appContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val devices = JavaOnlyArray()
            for (id in manager.cameraIdList) {
                val characteristics = manager.getCameraCharacteristics(id)
                devices.pushMap(describeDevice(id, characteristics))
            }
            callback.invoke(devices)
        } catch (error: Throwable) {
            callback.invoke(errorResult("camera/unavailable", error.message ?: "Could not enumerate cameras."))
        }
    }

    @LynxMethod
    fun capturePhoto(options: ReadableMap, callback: Callback) {
        // System-camera capture opens the OS camera UI, like iOS's
        // UIImagePickerController. Runs through a transparent proxy activity so
        // the module needs no host-forwarded onActivityResult.
        ChimeraProxyActivity.start(appContext, ChimeraProxyActivity.MODE_CAPTURE, options, callback)
    }

    @LynxMethod
    fun pickPhoto(options: ReadableMap, callback: Callback) {
        ChimeraProxyActivity.start(appContext, ChimeraProxyActivity.MODE_PICK, options, callback)
    }

    private fun requestPermission(permission: String, callback: Callback) {
        if (hasPermission(permission)) {
            callback.invoke(permissionStatus(permission))
            return
        }
        ChimeraProxyActivity.requestPermission(appContext, permission) {
            callback.invoke(permissionStatus(permission))
        }
    }

    private fun hasPermission(permission: String): Boolean =
        ContextCompat.checkSelfPermission(appContext, permission) == PackageManager.PERMISSION_GRANTED

    // Android has no "restricted"/"not-determined" split; map to the JS
    // PermissionStatus union as authorized/denied.
    private fun permissionStatus(permission: String): String =
        if (hasPermission(permission)) "authorized" else "denied"

    private fun describeDevice(id: String, characteristics: CameraCharacteristics): JavaOnlyMap {
        val map = JavaOnlyMap()
        map.putString("id", id)
        map.putString("localizedName", "Camera $id")
        map.putString("position", lensPosition(characteristics))
        val maxZoom = characteristics.get(CameraCharacteristics.SCALER_AVAILABLE_MAX_DIGITAL_ZOOM) ?: 1f
        map.putDouble("minZoom", 1.0)
        map.putDouble("maxZoom", maxZoom.toDouble())
        val flash = characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) ?: false
        map.putBoolean("hasFlash", flash)
        map.putBoolean("hasTorch", flash)
        val afModes = characteristics.get(CameraCharacteristics.CONTROL_AF_AVAILABLE_MODES)
        map.putBoolean("supportsFocusMetering", afModes != null && afModes.isNotEmpty())
        return map
    }

    private fun lensPosition(characteristics: CameraCharacteristics): String =
        when (characteristics.get(CameraCharacteristics.LENS_FACING)) {
            CameraCharacteristics.LENS_FACING_FRONT -> "front"
            CameraCharacteristics.LENS_FACING_BACK -> "back"
            CameraCharacteristics.LENS_FACING_EXTERNAL -> "external"
            else -> "unspecified"
        }

    companion object {
        const val NATIVE_VERSION = "0.2.0-alpha.0"

        fun errorResult(code: String, message: String): JavaOnlyMap {
            val error = JavaOnlyMap()
            error.putString("code", code)
            error.putString("message", message)
            val wrapper = JavaOnlyMap()
            wrapper.putMap("error", error)
            return wrapper
        }
    }
}
