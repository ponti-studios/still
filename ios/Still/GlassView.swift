import SwiftUI

/// The one glass surface: Liquid Glass on iOS 26, thin material below.
/// Everything else stays opaque — glass is a highlight, not a theme.
private struct GlassPanel: View {
  var cornerRadius: CGFloat

  var body: some View {
    if #available(iOS 26.0, *) {
      Color.clear
        .glassEffect(.regular.interactive(), in: .rect(cornerRadius: cornerRadius))
    } else {
      Color.clear
        .background(.thinMaterial, in: .rect(cornerRadius: cornerRadius))
    }
  }
}

/// A transparent UIView hosting the glass panel, sized by its RN parent.
@objc(GlassView)
final class GlassView: UIView {
  @objc var cornerRadius: CGFloat = 20 {
    didSet { rebuild() }
  }

  private var hosting: UIHostingController<GlassPanel>?

  override init(frame: CGRect) {
    super.init(frame: frame)
    backgroundColor = .clear
    isOpaque = false
    rebuild()
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { nil }

  private func rebuild() {
    hosting?.view.removeFromSuperview()
    hosting = nil
    let controller = UIHostingController(rootView: GlassPanel(cornerRadius: cornerRadius))
    controller.view.backgroundColor = .clear
    controller.view.isOpaque = false
    controller.view.translatesAutoresizingMaskIntoConstraints = false
    addSubview(controller.view)
    NSLayoutConstraint.activate([
      controller.view.leadingAnchor.constraint(equalTo: leadingAnchor),
      controller.view.trailingAnchor.constraint(equalTo: trailingAnchor),
      controller.view.topAnchor.constraint(equalTo: topAnchor),
      controller.view.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
    hosting = controller
  }
}

@objc(GlassViewManager)
final class GlassViewManager: RCTViewManager {
  override func view() -> UIView {
    GlassView()
  }
}
