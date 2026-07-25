package com.vyui.chimeracamera

import com.lynx.tasm.LynxEnv

/**
 * One-call registration for host apps.
 *
 * Registers both surfaces globally on [LynxEnv]: the `CameraModule` native module
 * and the `camera-view` element. Registering behaviors globally — rather than per
 * `LynxViewBuilder`, which is what the older docs described — means a host with
 * several LynxViews wires this once instead of at every construction site.
 *
 * Call after the host has initialized Lynx, since [LynxEnv.inst] expects
 * `init()` to have run:
 *
 * ```kotlin
 * LynxEnv.inst().init(this, null, null, null)
 * ChimeraCamera.register()
 * ```
 *
 * Deliberately not wired to a ContentProvider or androidx.startup Initializer:
 * both run before `Application.onCreate`, so they would fire ahead of the host's
 * `LynxEnv.inst().init()` and fail at launch. The host owns the ordering.
 */
object ChimeraCamera {
    @JvmStatic
    fun register() {
        val env = LynxEnv.inst()
        env.registerModule("CameraModule", ChimeraCameraModule::class.java)
        env.addBehaviors(ChimeraCameraBehaviors.behaviors())
    }
}
