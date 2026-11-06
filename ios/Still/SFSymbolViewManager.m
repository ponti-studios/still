#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(SFSymbolViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(name, NSString)
RCT_EXPORT_VIEW_PROPERTY(pointSize, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(weight, NSString)
RCT_EXPORT_VIEW_PROPERTY(color, UIColor)

@end
