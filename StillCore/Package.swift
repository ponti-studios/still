// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "StillCore",
  platforms: [.iOS(.v17), .macOS(.v14)],
  products: [.library(name: "StillCore", targets: ["StillCore"])],
  dependencies: [
    // The Hominem sign-in client (email code, Keychain session), shared with the other apps. Pinned
    // to one minor version: a 0.x minor release can change the API.
    .package(
      url: "https://github.com/charlesponti/HominemAuth.git", .upToNextMinor(from: "0.2.0")),
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
