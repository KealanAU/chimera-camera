#import <Lynx/LynxUI.h>

NS_ASSUME_NONNULL_BEGIN

/// Native `<camera-view>` element (contract: V1.md): an embedded AVFoundation
/// live preview that Lynx UI can layer over.
///
///   - props: `active` (session on/off), `facing` ("back"/"front"),
///     `resizeMode` ("cover"/"contain"),
///   - events: `ready` `{ deviceId }` when the preview is live,
///     `error` `{ code, message }`,
///   - methods: `ping()` -> `{ ok: true }` (bridge check), `capturePhoto()`
///     -> writes a JPEG to a temp file and returns `{ path, width, height,
///     orientation, mime }`.
///
/// The element registers itself as `camera-view` via LYNX_LAZY_REGISTER_UI
/// when this file is compiled into the host target. Frontend usage:
///
///   <camera-view id="camera" active={true} bindready={onReady} />
///
/// and from JavaScript:
///
///   const camera = createCameraViewHandle('#camera')
///   const photo = await camera.capturePhoto({ quality: 0.9 })
///
/// Recording, zoom, torch, and tap-to-focus are not implemented yet (M5).
@interface LynxCameraView : LynxUI <UIView *>
@end

NS_ASSUME_NONNULL_END
