package com.vyui.chimeracamera

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import com.lynx.react.bridge.JavaOnlyMap
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.roundToInt

/**
 * Shared JPEG post-processing so the module capture/pick path and the CameraX
 * view capture produce an identical PhotoFile shape (see docs/native-contract.md):
 * bare filesystem path, integer pixel width/height, orientation "up",
 * mime "image/jpeg", and opt-in base64.
 */
object PhotoEncoder {

    fun clampQuality(value: Double): Double = if (value.isNaN()) 0.9 else value.coerceIn(0.0, 1.0)

    /** Downscales in place when needed, then returns the normalized PhotoFile map. */
    fun encode(file: File, quality: Double, includeBase64: Boolean, maxDimension: Int): JavaOnlyMap {
        var bitmap = BitmapFactory.decodeFile(file.absolutePath)
            ?: throw IllegalStateException("Could not read captured image.")
        val longest = maxOf(bitmap.width, bitmap.height)
        if (maxDimension > 0 && longest > maxDimension) {
            val ratio = maxDimension.toDouble() / longest
            bitmap = Bitmap.createScaledBitmap(
                bitmap,
                (bitmap.width * ratio).roundToInt(),
                (bitmap.height * ratio).roundToInt(),
                true,
            )
            val bytes = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, (quality * 100).toInt(), bytes)
            file.writeBytes(bytes.toByteArray())
        }

        val result = JavaOnlyMap()
        result.putString("path", file.absolutePath)
        result.putInt("width", bitmap.width)
        result.putInt("height", bitmap.height)
        result.putString("orientation", "up")
        result.putString("mime", "image/jpeg")
        if (includeBase64) {
            result.putString("base64", Base64.encodeToString(file.readBytes(), Base64.NO_WRAP))
        }
        return result
    }
}
