import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
#if DEBUG
    // Point React Native's own settings at Still's Metro too. The bundle URL below is built by
    // hand, but the inspector and packager checks ask shared settings, which otherwise probe the
    // compiled-in 8081: the probe fails and shows a warning on every launch.
    if let hostPort = ReactNativeDelegate.metroHostPort() {
      RCTBundleURLProvider.sharedSettings().jsLocation = hostPort
    }
#endif
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    return true
  }

  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(
      name: "Default Configuration",
      sessionRole: connectingSceneSession.role
    )
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

#if DEBUG
  /// Still's Metro as `host:port`, from Info.plist plus the optional bundled `ip.txt`.
  static func metroHostPort() -> String? {
    guard let port = Bundle.main.object(forInfoDictionaryKey: "StillMetroPort") as? String,
      !port.isEmpty
    else { return nil }
    let ip = Bundle.main.path(forResource: "ip", ofType: "txt")
      .flatMap { try? String(contentsOfFile: $0, encoding: .utf8) }?
      .trimmingCharacters(in: .whitespacesAndNewlines)
    return "\(ip ?? "localhost"):\(port)"
  }
#endif

  override func bundleURL() -> URL? {
#if DEBUG
    // React Native's own Metro port is compiled into its prebuilt binary (8081, which other projects on
    // this machine use), so Still points the app at its own port instead. It builds that address itself
    // rather than asking React Native, which quietly falls back to 8081 when its own port isn't answering,
    // and then loads whichever other project's Metro is running there.
    if let hostPort = Self.metroHostPort() {
      return RCTBundleURLProvider.jsBundleURL(
        forBundleRoot: "index", packagerHost: hostPort, enableDev: true,
        enableMinification: false, inlineSourceMap: false)
    }
    let settings = RCTBundleURLProvider.sharedSettings()
    return settings.jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
