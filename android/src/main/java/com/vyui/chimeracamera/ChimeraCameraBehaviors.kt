package com.vyui.chimeracamera

import com.lynx.tasm.behavior.Behavior
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.behavior.ui.LynxUI

/**
 * UI registration for the `camera-view` element. Unlike iOS (which self-registers
 * via LYNX_LAZY_REGISTER_UI), Lynx Android hosts register behaviors explicitly.
 * Add these to your LynxViewBuilder, and register ChimeraCameraModule alongside
 * (see android/README.md).
 */
object ChimeraCameraBehaviors {
    fun behaviors(): List<Behavior> = listOf(
        object : Behavior("camera-view") {
            override fun createUI(context: LynxContext): LynxUI<*> = ChimeraCameraView(context)
        },
    )
}
