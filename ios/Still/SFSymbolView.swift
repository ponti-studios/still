import React
import UIKit

/// A true SF Symbol rendered natively: multicolor and variable weights work,
/// emoji never ships. Weight falls back to regular for unknown values.
@objc(SFSymbolView)
final class SFSymbolView: UIView {
  private let imageView = UIImageView()

  @objc var name: NSString = "" { didSet { updateSymbol() } }
  @objc var pointSize: CGFloat = 17 { didSet { updateSymbol() } }
  @objc var weight: NSString = "regular" { didSet { updateSymbol() } }
  @objc var color: UIColor? { didSet { imageView.tintColor = color } }

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .clear
    imageView.contentMode = .scaleAspectFit
    addSubview(imageView)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { nil }

  override func layoutSubviews() {
    super.layoutSubviews()
    imageView.frame = bounds
  }

  private func updateSymbol() {
    let symbol = String(name)
    guard !symbol.isEmpty else {
      imageView.image = nil
      return
    }
    let configuration = UIImage.SymbolConfiguration(pointSize: pointSize, weight: Self.symbolWeight(String(weight)))
    imageView.image = UIImage(systemName: symbol, withConfiguration: configuration)
  }

  private static func symbolWeight(_ value: String) -> UIImage.SymbolWeight {
    switch value {
    case "ultralight": return .ultraLight
    case "thin": return .thin
    case "light": return .light
    case "medium": return .medium
    case "semibold": return .semibold
    case "bold": return .bold
    case "heavy": return .heavy
    case "black": return .black
    default: return .regular
    }
  }
}

@objc(SFSymbolViewManager)
final class SFSymbolViewManager: RCTViewManager {
  override func view() -> UIView {
    SFSymbolView()
  }
}
