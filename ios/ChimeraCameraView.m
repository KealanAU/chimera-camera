#import "ChimeraCameraView.h"

#import <AVFoundation/AVFoundation.h>
#import <Lynx/LynxComponentRegistry.h>
#import <Lynx/LynxEvent.h>
#import <Lynx/LynxEventEmitter.h>
#import <Lynx/LynxPropsProcessor.h>
#import <Lynx/LynxUIMethodProcessor.h>

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

@interface ChimeraCameraView () <AVCaptureFileOutputRecordingDelegate>
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
  BOOL _captureInProgress;

  // Recording state (0.3, UNVERIFIED). Added lazily on first startRecording so
  // the device-proven photo path is untouched for callers that never record.
  AVCaptureMovieFileOutput *_movieOutput;
  AVCaptureDeviceInput *_audioInput;
  BOOL _recording;
  LynxUIMethodCallbackBlock _pendingStopCallback;
}

LYNX_LAZY_REGISTER_UI("camera-view")

- (UIView *)createView {
  _facing = @"back";
  _sessionQueue = dispatch_queue_create("com.kealanau.chimera-camera.session", DISPATCH_QUEUE_SERIAL);

  ChimeraCameraPreviewView *view = [[ChimeraCameraPreviewView alloc] init];
  view.backgroundColor = [UIColor blackColor];
  view.clipsToBounds = YES;
  view.previewLayer.videoGravity = AVLayerVideoGravityResizeAspectFill;

  NSNotificationCenter *notifications = NSNotificationCenter.defaultCenter;
  [notifications addObserver:self
                     selector:@selector(applicationDidEnterBackground:)
                         name:UIApplicationDidEnterBackgroundNotification
                       object:nil];
  [notifications addObserver:self
                     selector:@selector(applicationWillEnterForeground:)
                         name:UIApplicationWillEnterForegroundNotification
                       object:nil];
  return view;
}

- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
  AVCaptureSession *session = _session;
  if (session && _sessionQueue) {
    dispatch_async(_sessionQueue, ^{
      if (session.isRunning) {
        [session stopRunning];
      }
    });
  }
}

- (void)applicationDidEnterBackground:(NSNotification *)notification {
  dispatch_async(_sessionQueue, ^{
    if (self->_session.isRunning) {
      [self->_session stopRunning];
    }
    self->_readyDeviceId = nil;
  });
}

- (void)applicationWillEnterForeground:(NSNotification *)notification {
  [self syncSession];
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
  BOOL includeBase64 = [params[@"includeBase64"] boolValue];
  CGFloat maxDimension = [params[@"maxDimension"] doubleValue];

  dispatch_async(_sessionQueue, ^{
    if (!self->_photoOutput || !self->_session.isRunning) {
      callback(kUIMethodInvalidStateError, @{
        @"code" : @"capture/not-active",
        @"message" : @"camera-view is not active; set active={true} and wait for the ready event."
      });
      return;
    }
    if (self->_captureInProgress) {
      callback(kUIMethodInvalidStateError, @{
        @"code" : @"capture/in-progress",
        @"message" : @"Another camera-view capture is already in progress."
      });
      return;
    }
    self->_captureInProgress = YES;

    AVCaptureConnection *connection = [self->_photoOutput connectionWithMediaType:AVMediaTypeVideo];
    if (connection.isVideoOrientationSupported) {
      // Portrait-only until host orientation support lands.
      connection.videoOrientation = AVCaptureVideoOrientationPortrait;
    }

    AVCapturePhotoSettings *settings = [AVCapturePhotoSettings photoSettingsWithFormat:@{
      AVVideoCodecKey : AVVideoCodecTypeJPEG,
      AVVideoCompressionPropertiesKey : @{AVVideoQualityKey : @(quality)}
    }];

    ChimeraCameraPhotoDelegate *delegate =
        [[ChimeraCameraPhotoDelegate alloc] initWithCompletion:^(NSData *data, NSError *error) {
          dispatch_async(self->_sessionQueue, ^{
            self->_captureInProgress = NO;
            if (!data) {
              callback(kUIMethodOperationError, @{
                @"code" : @"capture/failed",
                @"message" : error.localizedDescription ?: @"Photo capture failed."
              });
              return;
            }

            UIImage *image = [UIImage imageWithData:data];
            NSData *resultData = data;
            CGFloat width = image.size.width * image.scale;
            CGFloat height = image.size.height * image.scale;
            CGFloat longestSide = MAX(width, height);
            if (maxDimension > 0 && longestSide > maxDimension) {
              CGFloat ratio = maxDimension / longestSide;
              CGSize targetSize = CGSizeMake(round(width * ratio), round(height * ratio));
              UIGraphicsImageRendererFormat *format = [[UIGraphicsImageRendererFormat alloc] init];
              format.scale = 1;
              image = [[[UIGraphicsImageRenderer alloc] initWithSize:targetSize format:format]
                  imageWithActions:^(UIGraphicsImageRendererContext *context) {
                    [image drawInRect:(CGRect){.origin = CGPointZero, .size = targetSize}];
                  }];
              resultData = UIImageJPEGRepresentation(image, quality);
            }

            NSString *path = [NSTemporaryDirectory()
                stringByAppendingPathComponent:[NSString stringWithFormat:@"chimera-camera-%@.jpg",
                                                                          NSUUID.UUID.UUIDString]];
            NSError *writeError;
            if (![resultData writeToFile:path options:NSDataWritingAtomic error:&writeError]) {
              callback(kUIMethodOperationError, @{
                @"code" : @"capture/write-failed",
                @"message" : writeError.localizedDescription ?: @"Could not write the captured photo."
              });
              return;
            }

            NSMutableDictionary *result = [@{
              @"path" : path,
              @"width" : @((NSInteger)(image.size.width * image.scale)),
              @"height" : @((NSInteger)(image.size.height * image.scale)),
              @"orientation" : @"up",
              @"mime" : @"image/jpeg",
            } mutableCopy];
            if (includeBase64) {
              result[@"base64"] = [resultData base64EncodedStringWithOptions:0];
            }
            callback(kUIMethodSuccess, result);
          });
        }];

    [self->_photoOutput capturePhotoWithSettings:settings delegate:delegate];
  });
}

#pragma mark - View-session controls (0.3, UNVERIFIED)

// The methods below (zoom/torch/focus and recording) are the 0.3 session
// controls. They match docs/native-contract.md but have NOT been compiled or run
// on a device — the preview/photo path above remains the device-proven surface.
// All device configuration runs on _sessionQueue, like capture.

LYNX_UI_METHOD(setZoom) {
  double value = [params[@"value"] doubleValue];
  dispatch_async(_sessionQueue, ^{
    AVCaptureDevice *device = self->_input.device;
    if (!device || !self->_session.isRunning) {
      callback(kUIMethodInvalidStateError, @{
        @"code" : @"capture/not-active",
        @"message" : @"camera-view is not active; set active={true} and wait for the ready event."
      });
      return;
    }
    // Contract: clamp rather than reject. iOS min zoom factor is 1.0.
    CGFloat maxZoom = device.activeFormat.videoMaxZoomFactor;
    CGFloat clamped = MIN(MAX((CGFloat)value, (CGFloat)1.0), maxZoom);
    NSError *error;
    if ([device lockForConfiguration:&error]) {
      device.videoZoomFactor = clamped;
      [device unlockForConfiguration];
      callback(kUIMethodSuccess, @{});
    } else {
      callback(kUIMethodOperationError, @{
        @"code" : @"camera/native-error",
        @"message" : error.localizedDescription ?: @"Could not set zoom."
      });
    }
  });
}

LYNX_UI_METHOD(setTorch) {
  BOOL on = [params[@"mode"] isEqualToString:@"on"];
  AVCaptureTorchMode mode = on ? AVCaptureTorchModeOn : AVCaptureTorchModeOff;
  dispatch_async(_sessionQueue, ^{
    AVCaptureDevice *device = self->_input.device;
    if (!device || !self->_session.isRunning) {
      callback(kUIMethodInvalidStateError, @{
        @"code" : @"capture/not-active",
        @"message" : @"camera-view is not active; set active={true} and wait for the ready event."
      });
      return;
    }
    if (!device.hasTorch || ![device isTorchModeSupported:mode]) {
      callback(kUIMethodOperationError, @{
        @"code" : @"camera/unsupported",
        @"message" : @"This camera has no controllable torch."
      });
      return;
    }
    NSError *error;
    if ([device lockForConfiguration:&error]) {
      device.torchMode = mode;
      [device unlockForConfiguration];
      callback(kUIMethodSuccess, @{});
    } else {
      callback(kUIMethodOperationError, @{
        @"code" : @"camera/native-error",
        @"message" : error.localizedDescription ?: @"Could not set torch."
      });
    }
  });
}

LYNX_UI_METHOD(focusAtPoint) {
  // Point arrives in preview space (0..1). A fuller impl would map it through
  // previewLayer captureDevicePointOfInterestForPoint: for exact device coords;
  // the first cut passes it through, which is close for portrait.
  CGPoint point = CGPointMake([params[@"x"] doubleValue], [params[@"y"] doubleValue]);
  dispatch_async(_sessionQueue, ^{
    AVCaptureDevice *device = self->_input.device;
    if (!device || !self->_session.isRunning) {
      callback(kUIMethodInvalidStateError, @{
        @"code" : @"capture/not-active",
        @"message" : @"camera-view is not active; set active={true} and wait for the ready event."
      });
      return;
    }
    if (!device.isFocusPointOfInterestSupported && !device.isExposurePointOfInterestSupported) {
      callback(kUIMethodOperationError, @{
        @"code" : @"camera/unsupported",
        @"message" : @"Focus at point is not supported by this camera."
      });
      return;
    }
    NSError *error;
    if ([device lockForConfiguration:&error]) {
      if (device.isFocusPointOfInterestSupported) {
        device.focusPointOfInterest = point;
        if ([device isFocusModeSupported:AVCaptureFocusModeAutoFocus]) {
          device.focusMode = AVCaptureFocusModeAutoFocus;
        }
      }
      if (device.isExposurePointOfInterestSupported) {
        device.exposurePointOfInterest = point;
        if ([device isExposureModeSupported:AVCaptureExposureModeContinuousAutoExposure]) {
          device.exposureMode = AVCaptureExposureModeContinuousAutoExposure;
        }
      }
      [device unlockForConfiguration];
      callback(kUIMethodSuccess, @{});
    } else {
      callback(kUIMethodOperationError, @{
        @"code" : @"camera/native-error",
        @"message" : error.localizedDescription ?: @"Could not set focus."
      });
    }
  });
}

LYNX_UI_METHOD(startRecording) {
  BOOL enableAudio = [params[@"enableAudio"] boolValue];
  double maxDurationMs = [params[@"maxDurationMs"] doubleValue];
  long long maxFileSizeBytes = [params[@"maxFileSizeBytes"] longLongValue];
  dispatch_async(_sessionQueue, ^{
    if (!self->_session.isRunning || !self->_input) {
      callback(kUIMethodInvalidStateError, @{
        @"code" : @"capture/not-active",
        @"message" : @"camera-view is not active; set active={true} and wait for the ready event."
      });
      return;
    }
    if (self->_recording) {
      callback(kUIMethodInvalidStateError, @{
        @"code" : @"recording/in-progress",
        @"message" : @"A recording is already in progress."
      });
      return;
    }
    if (enableAudio &&
        [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio] != AVAuthorizationStatusAuthorized) {
      callback(kUIMethodOperationError, @{
        @"code" : @"camera/permission-denied",
        @"message" : @"Microphone permission is required for audio recording; request it via CameraModule."
      });
      return;
    }

    // NOTE: movie output needs a preset the Photo preset does not provide, so the
    // session switches to High here and is NOT restored afterwards — a fuller
    // impl would restore the Photo preset or use AVAssetWriter for true
    // simultaneous photo+video.
    [self->_session beginConfiguration];
    if (![self->_session.sessionPreset isEqualToString:AVCaptureSessionPresetHigh] &&
        [self->_session canSetSessionPreset:AVCaptureSessionPresetHigh]) {
      self->_session.sessionPreset = AVCaptureSessionPresetHigh;
    }
    if (!self->_movieOutput) {
      AVCaptureMovieFileOutput *movieOutput = [[AVCaptureMovieFileOutput alloc] init];
      if ([self->_session canAddOutput:movieOutput]) {
        [self->_session addOutput:movieOutput];
        self->_movieOutput = movieOutput;
      }
    }
    if (enableAudio && !self->_audioInput) {
      AVCaptureDevice *mic = [AVCaptureDevice defaultDeviceWithMediaType:AVMediaTypeAudio];
      NSError *audioError;
      AVCaptureDeviceInput *audioInput =
          mic ? [AVCaptureDeviceInput deviceInputWithDevice:mic error:&audioError] : nil;
      if (audioInput && [self->_session canAddInput:audioInput]) {
        [self->_session addInput:audioInput];
        self->_audioInput = audioInput;
      }
    }
    [self->_session commitConfiguration];

    if (!self->_movieOutput) {
      callback(kUIMethodOperationError, @{
        @"code" : @"recording/failed",
        @"message" : @"Could not configure the movie output."
      });
      return;
    }

    // Best-effort native limits, matching Android's setDurationLimit/setFileSizeLimit.
    // Hitting either stops recording as if stopRecording() were called.
    self->_movieOutput.maxRecordedDuration =
        maxDurationMs > 0 ? CMTimeMakeWithSeconds(maxDurationMs / 1000.0, 600) : kCMTimePositiveInfinity;
    self->_movieOutput.maxRecordedFileSize = maxFileSizeBytes > 0 ? maxFileSizeBytes : 0;

    AVCaptureConnection *connection = [self->_movieOutput connectionWithMediaType:AVMediaTypeVideo];
    if (connection.isVideoOrientationSupported) {
      connection.videoOrientation = AVCaptureVideoOrientationPortrait;
    }

    NSString *path = [NSTemporaryDirectory()
        stringByAppendingPathComponent:[NSString stringWithFormat:@"chimera-camera-%@.mov",
                                                                  NSUUID.UUID.UUIDString]];
    self->_recording = YES;
    [self->_movieOutput startRecordingToOutputFileURL:[NSURL fileURLWithPath:path] recordingDelegate:self];
    // Resolve now; recordingStarted fires from the delegate once the file opens.
    callback(kUIMethodSuccess, @{});
  });
}

LYNX_UI_METHOD(stopRecording) {
  dispatch_async(_sessionQueue, ^{
    if (!self->_recording || !self->_movieOutput.isRecording) {
      callback(kUIMethodInvalidStateError, @{
        @"code" : @"recording/not-active",
        @"message" : @"No recording is in progress."
      });
      return;
    }
    self->_pendingStopCallback = [callback copy];
    [self->_movieOutput stopRecording];
  });
}

#pragma mark - Session

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

#pragma mark - AVCaptureFileOutputRecordingDelegate (0.3, UNVERIFIED)

- (void)captureOutput:(AVCaptureFileOutput *)output
    didStartRecordingToOutputFileAtURL:(NSURL *)fileURL
                       fromConnections:(NSArray<AVCaptureConnection *> *)connections {
  [self emitEvent:@"recordingStarted" detail:@{@"path" : fileURL.path}];
}

- (void)captureOutput:(AVCaptureFileOutput *)output
    didFinishRecordingToOutputFileAtURL:(NSURL *)outputFileURL
                        fromConnections:(NSArray<AVCaptureConnection *> *)connections
                                  error:(NSError *)error {
  dispatch_async(_sessionQueue, ^{
    self->_recording = NO;
    LynxUIMethodCallbackBlock stop = self->_pendingStopCallback;
    self->_pendingStopCallback = nil;

    // AVFoundation reports a normal stop as an "error" whose userInfo still flags
    // the file as finished successfully.
    BOOL success = (error == nil) || [error.userInfo[AVErrorRecordingSuccessfullyFinishedKey] boolValue];
    if (!success) {
      if (stop) {
        stop(kUIMethodOperationError, @{
          @"code" : @"recording/failed",
          @"message" : error.localizedDescription ?: @"Recording failed."
        });
      }
      return;
    }

    unsigned long long sizeBytes =
        [[NSFileManager.defaultManager attributesOfItemAtPath:outputFileURL.path error:nil] fileSize];
    Float64 seconds = CMTimeGetSeconds([[AVURLAsset assetWithURL:outputFileURL] duration]);
    NSInteger durationMs = (isnan(seconds) || seconds < 0) ? 0 : (NSInteger)(seconds * 1000.0);

    NSDictionary *file = @{
      @"path" : outputFileURL.path,
      @"durationMs" : @(durationMs),
      @"sizeBytes" : @(sizeBytes),
    };
    if (stop) {
      stop(kUIMethodSuccess, file);
    }
    [self emitEvent:@"recordingFinished" detail:@{@"file" : file}];
  });
}

@end
