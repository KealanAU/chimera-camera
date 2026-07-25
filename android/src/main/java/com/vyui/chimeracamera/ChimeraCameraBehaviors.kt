package com.vyui.chimeracamera

import com.lynx.tasm.behavior.Behavior
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.ui.LynxUI

/**
 * UI registration for the `camera-view` element. Unlike iOS (which self-registers
 * via LYNX_LAZY_REGISTER_UI), Lynx Android hosts register behaviors explicitly.
 *
 * Most hosts want [ChimeraCamera.register], which registers these globally
 * alongside the native module. Use this list directly only to scope the element
 * to one `LynxViewBuilder` (see android/README.md).
 */
object ChimeraCameraBehaviors {
    fun behaviors(): List<Behavior> = listOf(
        object : Behavior("camera-view") {
            override fun createUI(context: LynxContext): LynxUI<*> = ChimeraCameraView(context)
        },
    )
}
