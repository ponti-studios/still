import UIKit

// A "scene" is one window of the app on iOS 13+. This delegate is called when the window is
// created. Here the window is handed to React Native, which draws the UI inside it. iOS 27
// kills apps at launch without scene adoption, so this file is what lets Still start there.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else {
      assertionFailure("Unable to connect the Still React Native scene.")
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    factory.startReactNative(
      withModuleName: "Still",
      in: window,
      launchOptions: nil
    )
  }
}
