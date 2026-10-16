// swift-tools-version:6.2
import PackageDescription

let package = Package(
    name: "Still",
    platforms: [
        .macOS(.v26)
    ],
    dependencies: [
        // The shared domain core, cache, outbox, and sync engine. The iOS app
        // uses the same package through StillBridge.
        .package(path: "../StillCore"),
    ],
    targets: [
        // The Mac app's own layer: the view model, the cache mapping, and the
        // pieces the one-way SQLite importer still needs (SQLiteDatabase,
        // PossessionsRepository, ImageStore, BackupManager). Hominem is the
        // source of truth; the cache and the outbox live in StillCore.
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
                .product(name: "StillCore", package: "StillCore"),
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
