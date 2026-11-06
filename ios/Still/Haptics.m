#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(Haptics, NSObject)

RCT_EXTERN_METHOD(impact:(NSString *)style resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(notify:(NSString *)type resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(select:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)

@end
