import UIKit

/// Taps you can feel: impact, notification, and selection feedback.
/// Fire-and-forget from JS; everything hops to the main thread here.
@objc(Haptics)
final class Haptics: NSObject {
  @objc func impact(
    _ style: NSString,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      UIImpactFeedbackGenerator(style: Self.impactStyle(String(style))).impactOccurred()
      resolve(NSNull())
    }
  }

  @objc func notify(
    _ type: NSString,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      UINotificationFeedbackGenerator().notificationOccurred(Self.notificationType(String(type)))
      resolve(NSNull())
    }
  }

  @objc func select(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      UISelectionFeedbackGenerator().selectionChanged()
      resolve(NSNull())
    }
  }

  private static func impactStyle(_ value: String) -> UIImpactFeedbackGenerator.FeedbackStyle {
    switch value {
    case "light": return .light
    case "heavy": return .heavy
    case "soft": return .soft
    case "rigid": return .rigid
    default: return .medium
    }
  }

  private static func notificationType(_ value: String) -> UINotificationFeedbackGenerator.FeedbackType {
    switch value {
    case "success": return .success
    case "warning": return .warning
    case "error": return .error
    default: return .success
    }
  }
}
