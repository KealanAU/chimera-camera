#import "ChimeraCameraView.h"

#import <AVFoundation/AVFoundation.h>
#import <Lynx/LynxComponentRegistry.h>
#import <Lynx/LynxEvent.h>
#import <Lynx/LynxEventEmitter.h>
#import <Lynx/LynxPropsProcessor.h>
#import <Lynx/LynxUIMethodProcessor.h>

/// UIView backed by an AVCaptureVideoPreviewLayer, so the preview always
/// tracks the view's bounds without manual frame syncing.
@interface ChimeraCameraPreviewView : UIView
@property(nonatomic, readonly) AVCaptureVideoPreviewLayer *previewLayer;
@end

@implementation ChimeraCameraPreviewView
+ (Class)layerClass {
  return [AVCaptureVideoPreviewLayer class];
}
- (AVCaptureVideoPreviewLayer *)previewLayer {
  return (AVCaptureVideoPreviewLayer *)self.layer;
}
@end

/// AVCapturePhotoOutput does not retain its delegate; this retains itself
/// until the capture completes (same pattern as SystemCameraCapture).
@interface ChimeraCameraPhotoDelegate : NSObject <AVCapturePhotoCaptureDelegate>
- (instancetype)initWithCompletion:(void (^)(NSData *_Nullable data, NSError *_Nullable error))completion;
@end

@implementation ChimeraCameraPhotoDelegate {
  void (^_completion)(NSData *_Nullable, NSError *_Nullable);
  ChimeraCameraPhotoDelegate *_retainSelf;
}

- (instancetype)initWithCompletion:(void (^)(NSData *_Nullable, NSError *_Nullable))completion {
  if (self = [super init]) {
    _completion = [completion copy];
    _retainSelf = self;
  }
  return self;
}

- (void)captureOutput:(AVCapturePhotoOutput *)output
    didFinishProcessingPhoto:(AVCapturePhoto *)photo
                       error:(NSError *)error {
  _completion(error ? nil : photo.fileDataRepresentation, error);
  _retainSelf = nil;
}

@end

@implementation ChimeraCameraView {
  NSString *_facing;
  BOOL _active;
  NSString *_resizeMode;

  // Session state below is only touched on _sessionQueue.
  dispatch_queue_t _sessionQueue;
  AVCaptureSession *_session;
  AVCaptureDeviceInput *_input;
  AVCapturePhotoOutput *_photoOutput;
  NSString *_readyDeviceId;
}

LYNX_LAZY_REGISTER_UI("camera-view")

- (UIView *)createView {
  _facing = @"back";
  _sessionQueue = dispatch_queue_create("com.kealanau.chimera-camera.session", DISPATCH_QUEUE_SERIAL);

  ChimeraCameraPreviewView *view = [[ChimeraCameraPreviewView alloc] init];
  view.backgroundColor = [UIColor blackColor];
  view.clipsToBounds = YES;
  view.previewLayer.videoGravity = AVLayerVideoGravityResizeAspectFill;
  return view;
}

- (void)dealloc {
  AVCaptureSession *session = _session;
  if (session && _sessionQueue) {
    dispatch_async(_sessionQueue, ^{
      if (session.isRunning) {
        [session stopRunning];
      }
    });
  }
}

LYNX_PROP_SETTER("facing", setFacing, NSString *) {
  _facing = value ?: @"back";
  [self syncSession];
}

LYNX_PROP_SETTER("active", setActive, BOOL) {
  _active = value;
  [self syncSession];
}

LYNX_PROP_SETTER("resizeMode", setResizeMode, NSString *) {
  _resizeMode = value;
  ((ChimeraCameraPreviewView *)self.view).previewLayer.videoGravity =
      [value isEqualToString:@"contain"] ? AVLayerVideoGravityResizeAspect
                                         : AVLayerVideoGravityResizeAspectFill;
}

LYNX_UI_METHOD(ping) {
  callback(kUIMethodSuccess, @{@"ok" : @YES});
}

LYNX_UI_METHOD(capturePhoto) {
  double quality = 0.9;
  NSNumber *rawQuality = params[@"quality"];
  if ([rawQuality isKindOfClass:[NSNumber class]]) {
    quality = MIN(MAX(rawQuality.doubleValue, 0.0), 1.0);
  }
  // Opt-in: base64 costs MBs across the bridge, but JS can't read the temp
  // file, so upload pipelines fed from JS need it until native upload exists.
  BOOL includeBase64 = [params[@"includeBase64"] boolValue];

  dispatch_async(_sessionQueue, ^{
    if (!self->_photoOutput || !self->_session.isRunning) {
      callback(kUIMethodInvalidStateError, @{
        @"code" : @"capture/not-active",
        @"message" : @"camera-view is not active; set active={true} and wait for the ready event."
      });
      return;
    }

    AVCaptureConnection *connection = [self->_photoOutput connectionWithMediaType:AVMediaTypeVideo];
    if (connection.isVideoOrientationSupported) {
      // ponytail: portrait-locked hosts only; read UIDevice orientation here
      // if a landscape host ever consumes this.
      connection.videoOrientation = AVCaptureVideoOrientationPortrait;
    }

    AVCapturePhotoSettings *settings = [AVCapturePhotoSettings photoSettingsWithFormat:@{
      AVVideoCodecKey : AVVideoCodecTypeJPEG,
      AVVideoCompressionPropertiesKey : @{AVVideoQualityKey : @(quality)}
    }];

    ChimeraCameraPhotoDelegate *delegate =
        [[ChimeraCameraPhotoDelegate alloc] initWithCompletion:^(NSData *data, NSError *error) {
          if (!data) {
            callback(kUIMethodOperationError, @{
              @"code" : @"capture/failed",
              @"message" : error.localizedDescription ?: @"Photo capture failed."
            });
            return;
          }

          NSString *path = [NSTemporaryDirectory()
              stringByAppendingPathComponent:[NSString stringWithFormat:@"chimera-camera-%@.jpg",
                                                                        NSUUID.UUID.UUIDString]];
          NSError *writeError;
          if (![data writeToFile:path options:NSDataWritingAtomic error:&writeError]) {
            callback(kUIMethodOperationError, @{
              @"code" : @"capture/write-failed",
              @"message" : writeError.localizedDescription ?: @"Could not write the captured photo."
            });
            return;
          }

          UIImage *image = [UIImage imageWithData:data];
          NSMutableDictionary *result = [@{
            @"path" : path,
            @"width" : @((NSInteger)(image.size.width * image.scale)),
            @"height" : @((NSInteger)(image.size.height * image.scale)),
            @"orientation" : @"up",
            @"mime" : @"image/jpeg",
          } mutableCopy];
          if (includeBase64) {
            result[@"base64"] = [data base64EncodedStringWithOptions:0];
          }
          callback(kUIMethodSuccess, result);
        }];

    [self->_photoOutput capturePhotoWithSettings:settings delegate:delegate];
  });
}

#pragma mark - Session

/// Snapshot props on the caller thread, then reconcile the capture session on
/// the session queue. Idempotent, so every prop change can just call it.
- (void)syncSession {
  BOOL active = _active;
  NSString *facing = [_facing copy];
  dispatch_async(_sessionQueue, ^{
    [self syncSessionOnQueueWithActive:active facing:facing];
  });
}

- (void)syncSessionOnQueueWithActive:(BOOL)active facing:(NSString *)facing {
  if (!active) {
    if (self->_session.isRunning) {
      [self->_session stopRunning];
    }
    self->_readyDeviceId = nil;
    return;
  }

  switch ([AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeVideo]) {
    case AVAuthorizationStatusAuthorized: {
      break;
    }
    case AVAuthorizationStatusNotDetermined: {
      [AVCaptureDevice requestAccessForMediaType:AVMediaTypeVideo
                               completionHandler:^(BOOL granted) {
                                 dispatch_async(dispatch_get_main_queue(), ^{
                                   [self syncSession];
                                 });
                               }];
      return;
    }
    default: {
      [self emitEvent:@"error"
               detail:@{
                 @"code" : @"camera/permission-denied",
                 @"message" : @"Camera permission is denied; request it via CameraModule first."
               }];
      return;
    }
  }

  if (!self->_session) {
    self->_session = [[AVCaptureSession alloc] init];
    self->_session.sessionPreset = AVCaptureSessionPresetPhoto;
    self->_photoOutput = [[AVCapturePhotoOutput alloc] init];
    if ([self->_session canAddOutput:self->_photoOutput]) {
      [self->_session addOutput:self->_photoOutput];
    }
    AVCaptureSession *session = self->_session;
    dispatch_async(dispatch_get_main_queue(), ^{
      ((ChimeraCameraPreviewView *)self.view).previewLayer.session = session;
    });
  }

  AVCaptureDevicePosition position = [facing isEqualToString:@"front"]
                                         ? AVCaptureDevicePositionFront
                                         : AVCaptureDevicePositionBack;
  if (!self->_input || self->_input.device.position != position) {
    AVCaptureDevice *device =
        [AVCaptureDevice defaultDeviceWithDeviceType:AVCaptureDeviceTypeBuiltInWideAngleCamera
                                           mediaType:AVMediaTypeVideo
                                            position:position];
    NSError *error;
    AVCaptureDeviceInput *input =
        device ? [AVCaptureDeviceInput deviceInputWithDevice:device error:&error] : nil;

    [self->_session beginConfiguration];
    if (self->_input) {
      [self->_session removeInput:self->_input];
      self->_input = nil;
    }
    if (input && [self->_session canAddInput:input]) {
      [self->_session addInput:input];
      self->_input = input;
    }
    [self->_session commitConfiguration];

    if (!self->_input) {
      [self emitEvent:@"error"
               detail:@{
                 @"code" : @"camera/unavailable",
                 @"message" : error.localizedDescription
                     ?: [NSString stringWithFormat:@"No %@ camera on this device.", facing]
               }];
      return;
    }
  }

  if (!self->_session.isRunning) {
    [self->_session startRunning];
  }

  NSString *deviceId = self->_input.device.uniqueID;
  if (![deviceId isEqualToString:self->_readyDeviceId]) {
    self->_readyDeviceId = deviceId;
    [self emitEvent:@"ready" detail:@{@"deviceId" : deviceId}];
  }
}

- (void)emitEvent:(NSString *)name detail:(NSDictionary *)detail {
  dispatch_async(dispatch_get_main_queue(), ^{
    LynxDetailEvent *event = [[LynxDetailEvent alloc] initWithName:name
                                                        targetSign:[self sign]
                                                            detail:detail];
    [self.context.eventEmitter dispatchCustomEvent:event];
  });
}

@end
