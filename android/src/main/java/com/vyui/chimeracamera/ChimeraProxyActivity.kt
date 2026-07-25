package com.vyui.chimeracamera

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import androidx.core.app.ActivityCompat
import androidx.core.content.FileProvider
import com.lynx.react.bridge.Callback
import com.lynx.react.bridge.ReadableMap
import java.io.File
import java.util.UUID

/**
 * UNVERIFIED, and the least-verified file in this module: it is the Activity-
 * scoped glue for operations a Lynx module cannot do itself — runtime permission
 * requests and the system camera/picker intents. The camera-view path
 * (ChimeraCameraView) needs none of this and is the primary emulator target.
 *
 * Transparent activity started from the application context so the module needs
 * no host-forwarded onActivityResult. State is static and single-in-flight,
 * matching the iOS "one capture at a time" guard. Verify the FileProvider
 * authority and manifest entries (see android/README.md) before relying on it.
 */
class ChimeraProxyActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        when (intent.getStringExtra(EXTRA_MODE)) {
            MODE_PERMISSION -> {
                val permission = intent.getStringExtra(EXTRA_PERMISSION) ?: return finishNow()
                ActivityCompat.requestPermissions(this, arrayOf(permission), REQUEST_PERMISSION)
            }
            MODE_CAPTURE -> {
                outputFile = File(cacheDir, "chimera-camera-${UUID.randomUUID()}.jpg")
                val uri = FileProvider.getUriForFile(this, "$packageName.chimeracamera.fileprovider", outputFile!!)
                val capture = Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, uri)
                capture.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                startActivityForResult(capture, REQUEST_CAPTURE)
            }
            MODE_PICK -> {
                val pick = Intent(Intent.ACTION_GET_CONTENT).setType("image/*")
                startActivityForResult(pick, REQUEST_PICK)
            }
            else -> finishNow()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        pendingPermissionResult?.invoke()
        clearAndFinish()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (resultCode != RESULT_OK) {
            resolveError("capture/cancelled", "Capture cancelled.")
            return
        }
        try {
            val file = when (requestCode) {
                REQUEST_CAPTURE -> outputFile ?: throw IllegalStateException("No capture output file.")
                REQUEST_PICK -> copyToCache(data?.data ?: throw IllegalStateException("No picked image."))
                else -> throw IllegalStateException("Unknown request.")
            }
            val options = pendingOptions
            val quality = PhotoEncoder.clampQuality(if (options?.hasKey("quality") == true) options.getDouble("quality") else 0.9)
            val includeBase64 = options?.hasKey("includeBase64") == true && options.getBoolean("includeBase64")
            val maxDimension = if (options?.hasKey("maxDimension") == true) options.getDouble("maxDimension").toInt() else 0
            pendingCallback?.invoke(PhotoEncoder.encode(file, quality, includeBase64, maxDimension))
        } catch (error: Throwable) {
            resolveError("capture/encode-failed", error.message ?: "Could not read captured image.")
            return
        }
        clearAndFinish()
    }

    private fun copyToCache(uri: Uri): File {
        val file = File(cacheDir, "chimera-camera-${UUID.randomUUID()}.jpg")
        contentResolver.openInputStream(uri).use { input ->
            file.outputStream().use { output -> input?.copyTo(output) }
        }
        return file
    }

    private fun resolveError(code: String, message: String) {
        pendingCallback?.invoke(ChimeraCameraModule.errorResult(code, message))
        clearAndFinish()
    }

    private fun clearAndFinish() {
        pendingCallback = null
        pendingOptions = null
        pendingPermissionResult = null
        outputFile = null
        finishNow()
    }

    private fun finishNow() {
        finish()
        overridePendingTransition(0, 0)
    }

    companion object {
        const val MODE_CAPTURE = "capture"
        const val MODE_PICK = "pick"
        private const val MODE_PERMISSION = "permission"
        private const val EXTRA_MODE = "mode"
        private const val EXTRA_PERMISSION = "permission"
        private const val REQUEST_PERMISSION = 4901
        private const val REQUEST_CAPTURE = 4902
        private const val REQUEST_PICK = 4903

        // Single in-flight, like the iOS SystemCameraCapture.current guard.
        private var pendingCallback: Callback? = null
        private var pendingOptions: ReadableMap? = null
        private var pendingPermissionResult: (() -> Unit)? = null
        private var outputFile: File? = null

        fun start(context: Context, mode: String, options: ReadableMap, callback: Callback) {
            if (pendingCallback != null) {
                callback.invoke(ChimeraCameraModule.errorResult("capture/in-progress", "Another capture is already in progress."))
                return
            }
            pendingCallback = callback
            pendingOptions = options
            launch(context, mode, null)
        }

        fun requestPermission(context: Context, permission: String, onResult: () -> Unit) {
            pendingPermissionResult = onResult
            launch(context, MODE_PERMISSION, permission)
        }

        private fun launch(context: Context, mode: String, permission: String?) {
            val intent = Intent(context, ChimeraProxyActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra(EXTRA_MODE, mode)
            if (permission != null) intent.putExtra(EXTRA_PERMISSION, permission)
            context.startActivity(intent)
        }
    }
}
