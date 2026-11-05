import Foundation
import SwiftUI
import AppKit
import StillMacCore
import StillCore

@main
struct StillApp: App {
    @StateObject private var account: StillAccount
    @State private var store: PossessionsStore

    init() {
        // Hominem API auth: production unless HOMINEM_API_URL points somewhere else (a local or
        // portless dev API). The session is the shared StillCore one, in the same Keychain entry
        // the iOS app uses, so both platforms sign in as the same account.
        let account = StillAccount(service: HominemAccountService(baseURL: APIEndpoint.baseURL))
        _account = StateObject(wrappedValue: account)
        _store = State(wrappedValue: PossessionsStore(account: account))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .environmentObject(account)
                .frame(minWidth: 1100, minHeight: 700)
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
                Button("Sync Now") {
                    store.syncNow()
                }
                .keyboardShortcut("r")
            }
        }
    }
}
