#import <Lynx/LynxUI.h>

NS_ASSUME_NONNULL_BEGIN

/// Bridge-spike native element for `<camera-view>` (see V1.md).
///
/// This intentionally renders a placeholder instead of a camera preview. Its
/// job is to prove the Lynx view bridge end to end:
///   - props flow from JavaScript into native (`facing`, `active`),
///   - JavaScript can call a native view method (`ping()` -> `{ ok: true }`),
///   - native can emit a detail event back to JavaScript (`ready`, fired the
///     first time `active` becomes true).
///
/// The element registers itself as `camera-view` via LYNX_LAZY_REGISTER_UI
/// when this file is compiled into the host target. Frontend usage:
///
///   <camera-view id="camera" active={true} bindready={onReady} />
///
/// and from JavaScript:
///
///   const camera = createCameraViewHandle('#camera')
///   await camera.ping() // { ok: true }
@interface LynxCameraView : LynxUI <UIView *>
@end

NS_ASSUME_NONNULL_END
