import AVFoundation
import Foundation
import Lynx
import Photos
import UIKit

@objcMembers
public final class ChimeraCameraModule: NSObject, LynxModule {
    private static let nativeVersion = "0.0.2"

    public static var name: String { "CameraModule" }

    public static var methodLookup: [String: String] {
        [
            "getChimeraCameraNativeVersion": NSStringFromSelector(#selector(getChimeraCameraNativeVersion(_:))),
            "getPermissions": NSStringFromSelector(#selector(getPermissions(_:))),
            "requestCameraPermission": NSStringFromSelector(#selector(requestCameraPermission(_:))),
            "requestMicrophonePermission": NSStringFromSelector(#selector(requestMicrophonePermission(_:))),
            "getAvailableCameraDevices": NSStringFromSelector(#selector(getAvailableCameraDevices(_:))),
            "capturePhoto": NSStringFromSelector(#selector(capturePhoto(_:callback:))),
            "pickPhoto": NSStringFromSelector(#selector(pickPhoto(_:callback:))),
            "saveToLibrary": NSStringFromSelector(#selector(saveToLibrary(_:callback:))),
        ]
    }

    public override required init() {
        super.init()
    }

    public required init(param: Any) {
        super.init()
    }

    public func getChimeraCameraNativeVersion(_ callback: @escaping LynxCallbackBlock) {
        callback(Self.nativeVersion)
    }

    public func getPermissions(_ callback: @escaping LynxCallbackBlock) {
        callback([
            "camera": permissionStatus(for: .video),
            "microphone": permissionStatus(for: .audio),
        ])
    }

    public func requestCameraPermission(_ callback: @escaping LynxCallbackBlock) {
        requestPermission(for: .video, callback: callback)
    }

    public func requestMicrophonePermission(_ callback: @escaping LynxCallbackBlock) {
        requestPermission(for: .audio, callback: callback)
    }

    public func getAvailableCameraDevices(_ callback: @escaping LynxCallbackBlock) {
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: [
                .builtInWideAngleCamera,
                .builtInUltraWideCamera,
                .builtInTelephotoCamera,
                .builtInDualCamera,
                .builtInDualWideCamera,
                .builtInTripleCamera,
            ],
            mediaType: .video,
            position: .unspecified
        )

        callback(discovery.devices.map { device in
            [
                "id": device.uniqueID,
                "localizedName": device.localizedName,
                "deviceType": cameraDeviceType(device.deviceType),
                "position": cameraPosition(device.position),
                "minZoom": device.minAvailableVideoZoomFactor,
                "maxZoom": device.maxAvailableVideoZoomFactor,
                "hasFlash": device.hasFlash,
                "hasTorch": device.hasTorch,
                "supportsFocusMetering": device.isFocusPointOfInterestSupported,
            ]
        })
    }

    /// `enableShutterSound` from the JS adapter is ignored on purpose: the
    /// system camera UI owns its shutter sound.
    public func capturePhoto(_ options: [String: Any], callback: @escaping LynxCallbackBlock) {
        DispatchQueue.main.async {
            SystemCameraCapture.present(options: options, source: .camera) { callback($0) }
        }
    }

    /// Picks an existing photo from the library through the system picker.
    /// Same result shape as `capturePhoto` (temp-file path, opt-in base64); no
    /// photo-library permission is needed for picker-mediated access.
    public func pickPhoto(_ options: [String: Any], callback: @escaping LynxCallbackBlock) {
        DispatchQueue.main.async {
            SystemCameraCapture.present(options: options, source: .photoLibrary) { callback($0) }
        }
    }

    /// Saves a captured photo/video temp file to Photos. Needs the add-only
    /// photo-library permission (`NSPhotoLibraryAddUsageDescription` in Info.plist);
    /// requested here at save time. Photo vs. video is inferred from the extension.
    public func saveToLibrary(_ options: [String: Any], callback: @escaping LynxCallbackBlock) {
        guard let path = options["path"] as? String, !path.isEmpty else {
            callback(Self.errorResult("library/write-failed", "No file path was provided to save."))
            return
        }
        let url = URL(fileURLWithPath: path)
        let isVideo = ["mov", "mp4", "m4v"].contains(url.pathExtension.lowercased())

        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                DispatchQueue.main.async {
                    callback(Self.errorResult(
                        "library/permission-denied",
                        "Photo library add permission is required to save. Add NSPhotoLibraryAddUsageDescription to Info.plist."))
                }
                return
            }
            PHPhotoLibrary.shared().performChanges {
                if isVideo {
                    PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: url)
                } else {
                    PHAssetChangeRequest.creationRequestForAssetFromImage(atFileURL: url)
                }
            } completionHandler: { success, error in
                DispatchQueue.main.async {
                    if success {
                        callback([:])
                    } else {
                        callback(Self.errorResult(
                            "library/write-failed", error?.localizedDescription ?? "Could not save to the photo library."))
                    }
                }
            }
        }
    }

    private static func errorResult(_ code: String, _ message: String) -> [String: Any] {
        ["error": ["code": code, "message": message]]
    }

    private func requestPermission(for mediaType: AVMediaType, callback: @escaping LynxCallbackBlock) {
        AVCaptureDevice.requestAccess(for: mediaType) { _ in
            // AVFoundation calls back on an arbitrary queue; Lynx callbacks expect main.
            DispatchQueue.main.async {
                callback(self.permissionStatus(for: mediaType))
            }
        }
    }

    private func permissionStatus(for mediaType: AVMediaType) -> String {
        switch AVCaptureDevice.authorizationStatus(for: mediaType) {
        case .notDetermined:
            return "not-determined"
        case .authorized:
            return "authorized"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        @unknown default:
            return "denied"
        }
    }

    private func cameraPosition(_ position: AVCaptureDevice.Position) -> String {
        switch position {
        case .front:
            return "front"
        case .back:
            return "back"
        case .unspecified:
            return "unspecified"
        @unknown default:
            return "unspecified"
        }
    }

    private func cameraDeviceType(_ type: AVCaptureDevice.DeviceType) -> String {
        switch type {
        case .builtInWideAngleCamera: return "wide-angle"
        case .builtInUltraWideCamera: return "ultra-wide"
        case .builtInTelephotoCamera: return "telephoto"
        case .builtInDualCamera: return "dual"
        case .builtInDualWideCamera: return "dual-wide"
        case .builtInTripleCamera: return "triple"
        default: return "unknown"
        }
    }
}

private final class SystemCameraCapture: NSObject, UIImagePickerControllerDelegate,
    UINavigationControllerDelegate {
    /// One capture at a time. UIKit silently refuses a second full-screen
    /// present, which would strand that capture's callback forever.
    private static var current: SystemCameraCapture?

    private let quality: CGFloat
    private let includeBase64: Bool
    private let maxDimension: CGFloat?
    private var completion: (([String: Any]) -> Void)?

    private init(options: [String: Any], completion: @escaping ([String: Any]) -> Void) {
        self.quality = CGFloat(
            (options["quality"] as? NSNumber)?.doubleValue
                ?? (options["jpegQuality"] as? NSNumber)?.doubleValue
                ?? 0.9)
        self.includeBase64 = (options["includeBase64"] as? NSNumber)?.boolValue ?? false
        self.maxDimension = (options["maxDimension"] as? NSNumber).map { CGFloat($0.doubleValue) }
        self.completion = completion
    }

    static func present(
        options: [String: Any],
        source: UIImagePickerController.SourceType,
        completion: @escaping ([String: Any]) -> Void
    ) {
        guard current == nil else {
            completion(errorResult("capture/in-progress", "Another capture is already in progress."))
            return
        }
        guard UIImagePickerController.isSourceTypeAvailable(source) else {
            completion(errorResult("camera/unavailable", "Camera is not available on this device."))
            return
        }
        guard let presentingViewController = topViewController() else {
            completion(errorResult("camera/no-presenter", "Could not find a view controller to present the camera."))
            return
        }

        let capture = SystemCameraCapture(options: options, completion: completion)
        current = capture

        let picker = UIImagePickerController()
        picker.sourceType = source
        if source == .camera {
            let facing = (options["facing"] as? String) ?? "back"
            picker.cameraDevice =
                facing == "front" && UIImagePickerController.isCameraDeviceAvailable(.front)
                ? .front : .rear
            switch options["flash"] as? String {
            case "on": picker.cameraFlashMode = .on
            case "auto": picker.cameraFlashMode = .auto
            default: picker.cameraFlashMode = .off
            }
        }
        picker.delegate = capture

        var presented = false
        presentingViewController.present(picker, animated: true) { presented = true }
        // UIKit refuses a presentation silently (presenter mid-transition,
        // another modal already up): no delegate would ever fire. Fail the JS
        // promise instead of hanging it.
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            if !presented {
                capture.finish(errorResult("camera/present-failed", "Could not present the system camera UI."))
            }
        }
    }

    func imagePickerController(_ picker: UIImagePickerController,
                               didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        picker.dismiss(animated: true)

        guard var image = info[.originalImage] as? UIImage else {
            finish(Self.errorResult("capture/encode-failed", "Could not read captured image."))
            return
        }
        if let maxDimension {
            image = Self.downscale(image, longestSide: maxDimension)
        }
        guard let data = image.jpegData(compressionQuality: quality) else {
            finish(Self.errorResult("capture/encode-failed", "Could not encode captured image."))
            return
        }

        let path = NSTemporaryDirectory().appending("chimera-camera-\(UUID().uuidString).jpg")
        do {
            try data.write(to: URL(fileURLWithPath: path), options: .atomic)
        } catch {
            finish(Self.errorResult("capture/write-failed", error.localizedDescription))
            return
        }

        var result: [String: Any] = [
            "path": path,
            "width": Int(image.size.width * image.scale),
            "height": Int(image.size.height * image.scale),
            "orientation": "up",
            "mime": "image/jpeg",
        ]
        if includeBase64 {
            result["base64"] = data.base64EncodedString()
        }
        finish(result)
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        finish(Self.errorResult("capture/cancelled", "Capture cancelled."))
    }

    /// Single exit: releases the in-flight slot and guarantees the JS callback
    /// fires exactly once, whichever of delegate/timeout gets here first.
    private func finish(_ result: [String: Any]) {
        guard let completion else { return }
        self.completion = nil
        Self.current = nil
        completion(result)
    }

    private static func errorResult(_ code: String, _ message: String) -> [String: Any] {
        ["error": ["code": code, "message": message]]
    }

    private static func downscale(_ image: UIImage, longestSide: CGFloat) -> UIImage {
        let pixelWidth = image.size.width * image.scale
        let pixelHeight = image.size.height * image.scale
        let longest = max(pixelWidth, pixelHeight)
        guard longest > longestSide else { return image }
        let ratio = longestSide / longest
        let size = CGSize(width: (pixelWidth * ratio).rounded(), height: (pixelHeight * ratio).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        // foregroundInactive too: cold-start captures race scene activation.
        let scene = scenes.first { $0.activationState == .foregroundActive }
            ?? scenes.first { $0.activationState == .foregroundInactive }
        var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}
