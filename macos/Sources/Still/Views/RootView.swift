import SwiftUI
import AppKit
import StillMacCore
import StillCore

struct RootView: View {
    @Environment(PossessionsStore.self) private var store
    @EnvironmentObject private var account: StillAccount
    @Environment(\.scenePhase) private var scenePhase

    private var isSignedIn: Bool { account.state.email != nil }

    var body: some View {
        NavigationSplitView {
            SidebarView()
        } detail: {
            if !account.state.ready {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if isSignedIn {
                PossessionsListView()
            } else {
                SignInView()
            }
        }
        .navigationTitle("Still")
        .toolbar {
            if isSignedIn {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        store.beginEditing(store.newPossession())
                    } label: {
                        Label("New Possession", systemImage: "plus")
                    }
                    .keyboardShortcut("n")
                    .help("Create a new possession")
                }
                ToolbarItem(placement: .automatic) {
                    Button {
                        store.syncNow()
                    } label: {
                        Label("Sync Now", systemImage: "arrow.clockwise")
                    }
                    .disabled(store.syncStatus.isBusy)
                    .help("Send your changes and pull the latest from Hominem")
                }
            }
            ToolbarItem(placement: .automatic) {
                AccountMenu()
            }
        }
        .task {
            // Confirm a previously saved session, then show the cache and sync.
            await account.start()
            store.reload()
            if isSignedIn {
                await store.refresh()
            }
        }
        .onChange(of: account.state.email) { _, newEmail in
            if newEmail == nil {
                store.reset()
            } else {
                store.reload()
                Task { await store.refresh() }
            }
        }
        .onChange(of: scenePhase) { _, phase in
            // Coming back to the app is a good moment to catch up.
            if phase == .active, isSignedIn {
                Task { await store.refresh() }
            }
        }
        .sheet(item: Binding(
            get: { store.route },
            set: { if $0 == nil { store.closeModal() } }
        )) { route in modalContent(for: route) }
        .alert("Still", isPresented: Binding(
            get: { store.alertMessage != nil },
            set: { if !$0 { store.clearAlert() } }
        )) {
            Button("OK") { store.clearAlert() }
        } message: {
            Text(store.alertMessage ?? "")
        }
    }

    @ViewBuilder
    private func modalContent(for route: PossessionRoute) -> some View {
        switch route {
        case .detail(let possession):
            PossessionDetailView(possession: possession)
                .frame(minWidth: 720, minHeight: 680)
        case .new(let possession):
            PossessionDetailView(possession: possession, startsInEditMode: true)
                .frame(minWidth: 720, minHeight: 680)
        }
    }
}
