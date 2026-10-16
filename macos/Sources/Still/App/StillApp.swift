import Foundation
import SwiftUI
import AppKit
import StillMacCore
import HominemAuth
import HominemAuthUI

@main
struct StillApp: App {
    @State private var store = PossessionsStore()
    @State private var authController: AuthController

    init() {
        // Hominem API auth: production unless HOMINEM_API_URL points somewhere else (a local or
        // portless dev API). The session has its own Keychain entry, like the other apps.
        let baseURL = ProcessInfo.processInfo.environment["HOMINEM_API_URL"]
            .flatMap(URL.init(string:))
            ?? AuthConfiguration.production.baseURL
        _authController = State(
            wrappedValue: AuthController(
                configuration: AuthConfiguration(
                    baseURL: baseURL, keychainService: "io.ponti.still.hominem"))
        )
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environment(authController)
                .frame(minWidth: 1100, minHeight: 700)
                .task {
                    // Confirm a previously stored session against the API.
                    await authController.refreshSession()
                    // Default: open the user's warehouse.db if present, else a fresh DB.
                    if !store.isOpen {
                        do {
                            try openDefaultDatabase()
                        } catch {
                            store.errorMessage = error.localizedDescription
                        }
                    }
                }
        }
        .windowStyle(.hiddenTitleBar)
        .windowToolbarStyle(.unified(showsTitle: false))
        .commands {
            CommandGroup(after: .newItem) {
                Button("New Possession") {
                    store.beginEditing(store.newPossession())
                }
                .keyboardShortcut("n", modifiers: [.command, .shift])
            }
            CommandGroup(after: .saveItem) {
                Button("Backup Database…") {
                    store.manualBackup()
                }
            }
        }
    }

    private func openDefaultDatabase() throws {
        // Order: last-used path (UserDefaults) -> ~/.hominem/warehouse.db -> fresh App Support DB.
        let defaults = UserDefaults.standard
        if let lastPath = defaults.string(forKey: "lastDatabasePath"),
           FileManager.default.fileExists(atPath: lastPath) {
            try store.open(url: URL(fileURLWithPath: lastPath))
            return
        }

        let hominemPath = NSHomeDirectory() + "/.hominem/warehouse.db"
        if FileManager.default.fileExists(atPath: hominemPath) {
            try store.open(url: URL(fileURLWithPath: hominemPath))
            return
        }

        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        // The local SQLite store keeps its original folder and file name so an
        // existing database still opens. The one-way import onto Hominem retires
        // it (docs/cross-platform-merge.md, tasks 008–009).
        let dir = appSupport.appendingPathComponent("Possessions", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent("possessions.db")
        try store.openNewDatabase(url: url)
    }
}
