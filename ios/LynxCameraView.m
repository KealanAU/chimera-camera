#import "LynxCameraView.h"

#import <Lynx/LynxComponentRegistry.h>
#import <Lynx/LynxEvent.h>
#import <Lynx/LynxEventEmitter.h>
#import <Lynx/LynxPropsProcessor.h>
#import <Lynx/LynxUIMethodProcessor.h>

@implementation LynxCameraView {
  NSString *_facing;
  BOOL _active;
  BOOL _readyEventSent;
}

LYNX_LAZY_REGISTER_UI("camera-view")

- (UIView *)createView {
  UIView *view = [[UIView alloc] init];
  view.backgroundColor = [UIColor blackColor];
  view.clipsToBounds = YES;

  UILabel *label = [[UILabel alloc] init];
  label.text = @"camera-view (bridge spike)";
  label.textColor = [UIColor whiteColor];
  label.font = [UIFont monospacedSystemFontOfSize:12 weight:UIFontWeightRegular];
  label.translatesAutoresizingMaskIntoConstraints = NO;
  [view addSubview:label];
  [NSLayoutConstraint activateConstraints:@[
    [label.centerXAnchor constraintEqualToAnchor:view.centerXAnchor],
    [label.centerYAnchor constraintEqualToAnchor:view.centerYAnchor],
  ]];

  return view;
}

LYNX_PROP_SETTER("facing", setFacing, NSString *) {
  _facing = value ?: @"back";
}

LYNX_PROP_SETTER("active", setActive, BOOL) {
  _active = value;
  if (_active) {
    [self sendReadyEventIfNeeded];
  }
}

LYNX_UI_METHOD(ping) {
  callback(kUIMethodSuccess, @{@"ok" : @YES});
}

- (void)sendReadyEventIfNeeded {
  if (_readyEventSent) {
    return;
  }
  _readyEventSent = YES;

  // Spike placeholder: V1 will report the real capture device id here.
  LynxDetailEvent *event = [[LynxDetailEvent alloc] initWithName:@"ready"
                                                      targetSign:[self sign]
                                                          detail:@{@"deviceId" : @"camera-view-spike"}];
  [self.context.eventEmitter dispatchCustomEvent:event];
}

@end
