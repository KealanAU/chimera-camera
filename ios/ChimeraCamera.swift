import Foundation
import Lynx

/// One-call registration for host apps.
///
/// `<camera-view>` needs nothing here — it self-registers from
/// `ChimeraCameraView.m` via `LYNX_LAZY_REGISTER_UI("camera-view")`. Lynx ships
/// lazy-register macros for UI, shadow nodes, and renderer hosts but none for
/// native modules, so `CameraModule` has to be registered explicitly and this is
/// the one line that does it.
///
/// Registers on `LynxEnv.sharedInstance().config`, the global config, so every
/// `LynxView` built afterwards resolves the module. Call it after LynxEnv is
/// initialized:
///
/// ```swift
/// _ = LynxEnv.sharedInstance()
/// ChimeraCamera.register()
/// ```
///
/// A host that builds its own per-view `LynxConfig` (rather than relying on the
/// global one) bypasses this and must still call
/// `config.register(ChimeraCameraModule.self)` on that instance — see
/// `example/host-ios`, which does exactly that because it needs a custom
/// template provider.
@objc(ChimeraCamera)
public final class ChimeraCamera: NSObject {
  /// Registers `CameraModule` globally. Idempotent in practice: re-registering
  /// the same name replaces the entry rather than accumulating.
  @objc public static func register() {
    // Module name comes from ChimeraCameraModule.name ("CameraModule"), which is
    // what NativeModules.CameraModule resolves against on the JS side.
    LynxEnv.sharedInstance().config.register(ChimeraCameraModule.self)
  }
}
