import AVFoundation
import Foundation
import Lynx
import UIKit

@objcMembers
public final class LynxCameraModule: NSObject, LynxModule {
    private static let nativeVersion = "0.1.0-alpha.0"

    public static var name: String { "CameraModule" }

    public static var methodLookup: [String: String] {
        [
            "getLynxCameraNativeVersion": NSStringFromSelector(#selector(getLynxCameraNativeVersion(_:))),
            "getPermissions": NSStringFromSelector(#selector(getPermissions(_:))),
            "requestCameraPermission": NSStringFromSelector(#selector(requestCameraPermission(_:))),
            "requestMicrophonePermission": NSStringFromSelector(#selector(requestMicrophonePermission(_:))),
            "getAvailableCameraDevices": NSStringFromSelector(#selector(getAvailableCameraDevices(_:))),
            "capturePhoto": NSStringFromSelector(#selector(capturePhoto(_:callback:))),
        ]
    }

    public override required init() {
        super.init()
    }

    public required init(param: Any) {
        super.init()
    }

    public func getLynxCameraNativeVersion(_ callback: @escaping LynxCallbackBlock) {
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
                "position": cameraPosition(device.position),
                "minZoom": device.minAvailableVideoZoomFactor,
                "maxZoom": device.maxAvailableVideoZoomFactor,
                "hasFlash": device.hasFlash,
                "hasTorch": device.hasTorch,
                "supportsFocusMetering": device.isFocusPointOfInterestSupported,
            ]
        })
    }

    public func capturePhoto(_ options: [String: Any], callback: @escaping LynxCallbackBlock) {
        let quality = (options["quality"] as? NSNumber)?.doubleValue
            ?? (options["jpegQuality"] as? NSNumber)?.doubleValue
            ?? 0.9
        let facing = (options["facing"] as? String) ?? "back"

        DispatchQueue.main.async {
            SystemCameraCapture.present(quality: CGFloat(quality), facing: facing) { result in
                callback(result)
            }
        }
    }

    private func requestPermission(for mediaType: AVMediaType, callback: @escaping LynxCallbackBlock) {
        AVCaptureDevice.requestAccess(for: mediaType) { _ in
            callback(self.permissionStatus(for: mediaType))
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
}

private final class SystemCameraCapture: NSObject, UIImagePickerControllerDelegate,
    UINavigationControllerDelegate {
    private let quality: CGFloat
    private let completion: ([String: Any]) -> Void
    private var retainSelf: SystemCameraCapture?

    private init(quality: CGFloat, completion: @escaping ([String: Any]) -> Void) {
        self.quality = quality
        self.completion = completion
    }

    static func present(quality: CGFloat, facing: String, completion: @escaping ([String: Any]) -> Void) {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
            completion(["error": ["code": "camera/unavailable", "message": "Camera is not available on this device."]])
            return
        }

        guard let presentingViewController = topViewController() else {
            completion(["error": ["code": "camera/no-presenter", "message": "Could not find a view controller to present the camera."]])
            return
        }

        let capture = SystemCameraCapture(quality: quality, completion: completion)
        capture.retainSelf = capture

        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraDevice = facing == "front" ? .front : .rear
        picker.delegate = capture

        presentingViewController.present(picker, animated: true)
    }

    func imagePickerController(_ picker: UIImagePickerController,
                               didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        defer { retainSelf = nil }
        picker.dismiss(animated: true)

        guard let image = info[.originalImage] as? UIImage,
              let data = image.jpegData(compressionQuality: quality) else {
            completion(["error": ["code": "capture/encode-failed", "message": "Could not encode captured image."]])
            return
        }

        completion([
            "path": "memory://lynx-camera/capture.jpg",
            "width": Int(image.size.width * image.scale),
            "height": Int(image.size.height * image.scale),
            "orientation": "up",
            "mime": "image/jpeg",
            "base64": data.base64EncodedString(),
        ])
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        defer { retainSelf = nil }
        picker.dismiss(animated: true)
        completion(["error": ["code": "capture/cancelled", "message": "Capture cancelled."]])
    }

    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .first { $0.activationState == .foregroundActive } as? UIWindowScene
        var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}
