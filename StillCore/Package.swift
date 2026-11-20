// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "StillCore",
  platforms: [.iOS(.v17), .macOS(.v14)],
  products: [.library(name: "StillCore", targets: ["StillCore"])],
  dependencies: [
    // The Hominem sign-in client (email code, Keychain session), shared with the other apps. Now
    // lives in the hominem-swift monorepo alongside GeoCore, WalksCore, and the other shared packages.
    .package(
      url: "https://github.com/ponti-studios/hominem-swift", from: "0.1.0"),
  ],
  targets: [
    .target(
      name: "StillCore",
      dependencies: [
        .product(name: "HominemAuth", package: "hominem-swift"),
      ]),
    .testTarget(name: "StillCoreTests", dependencies: ["StillCore"]),
  ],
  swiftLanguageModes: [.v5]
)
