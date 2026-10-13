// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "StillCore",
  platforms: [.iOS(.v15), .macOS(.v12)],
  products: [.library(name: "StillCore", targets: ["StillCore"])],
  dependencies: [
    // The Hominem sign-in client (email code, Keychain session), shared with Thames.
    .package(url: "https://github.com/charlesponti/HominemAuth.git", from: "0.1.0"),
  ],
  targets: [
    .target(
      name: "StillCore",
      dependencies: [
        .product(name: "HominemAuth", package: "HominemAuth"),
      ]),
    .testTarget(name: "StillCoreTests", dependencies: ["StillCore"]),
  ],
  swiftLanguageModes: [.v5]
)
