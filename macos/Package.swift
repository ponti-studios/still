// swift-tools-version:6.2
import PackageDescription

let package = Package(
    name: "Still",
    platforms: [
        .macOS(.v26)
    ],
    dependencies: [
        .package(url: "https://github.com/charlesponti/HominemAuth.git", .upToNextMinor(from: "0.2.0"))
    ],
    targets: [
        // Domain layer: models, persistence, services. UI-independent and reusable.
        // Retires in favour of the shared StillCore once the Mac app runs on it
        // (docs/cross-platform-merge.md, task 008).
        .target(
            name: "StillMacCore",
            path: "Sources/StillMacCore",
            linkerSettings: [
                .linkedLibrary("sqlite3")
            ]
        ),
        // Presentation layer: SwiftUI app shell and views.
        .executableTarget(
            name: "Still",
            dependencies: [
                "StillMacCore",
                .product(name: "HominemAuth", package: "HominemAuth"),
                .product(name: "HominemAuthUI", package: "HominemAuth"),
            ],
            path: "Sources/Still"
        ),
        .testTarget(
            name: "StillMacCoreTests",
            dependencies: ["StillMacCore"],
            path: "Tests/StillMacCoreTests"
        )
    ]
)
