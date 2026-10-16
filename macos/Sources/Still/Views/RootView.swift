import SwiftUI
import AppKit
import StillMacCore
import HominemAuthUI

struct RootView: View {
    @Environment(PossessionsStore.self) private var store
    @Environment(AuthController.self) private var authController
    @State private var showOpenPanel = false
    @State private var showRestorePanel = false
    @State private var pendingRestoreURL: URL?

    var body: some View {
        NavigationSplitView {
            SidebarView()
        } detail: {
            if store.isOpen {
                PossessionsListView()
            } else {
                EmptyStateView()
            }
        }
        .navigationTitle(store.databaseURL?.lastPathComponent ?? "Possessions")
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Menu {
                    Button {
                        showOpenPanel = true
                    } label: {
                        Label("Open Database…", systemImage: "folder")
                    }
                    Button {
                        showRestorePanel = true
                    } label: {
                        Label("Restore Database…", systemImage: "arrow.counterclockwise")
                    }
                } label: {
                    Label("Database", systemImage: "cylinder")
                }
                .help("Open or restore a warehouse database")
            }
            if store.isOpen {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        store.beginEditing(store.newPossession())
                    } label: {
                        Label("New Possession", systemImage: "plus")
                    }
                    .keyboardShortcut("n")
                    .help("Create a new possession")
                }
            }
            ToolbarItem(placement: .automatic) {
                AuthStatusControl(controller: authController)
            }
        }
        .fileImporter(
            isPresented: $showOpenPanel,
            allowedContentTypes: [.database, .data],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                do {
                    try store.open(url: url)
                    UserDefaults.standard.set(url.path, forKey: "lastDatabasePath")
                } catch {
                    // store.errorMessage already set
                }
            case .failure(let error):
                store.errorMessage = error.localizedDescription
            }
        }
        .fileImporter(
            isPresented: $showRestorePanel,
            allowedContentTypes: [.database, .data],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                pendingRestoreURL = urls.first
            case .failure(let error):
                store.errorMessage = error.localizedDescription
            }
        }
        .confirmationDialog(
            "Restore Database?",
            isPresented: Binding(
                get: { pendingRestoreURL != nil },
                set: { if !$0 { pendingRestoreURL = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Choose Destination…") {
                chooseRestoreDestination()
            }
            Button("Cancel", role: .cancel) {
                pendingRestoreURL = nil
            }
        } message: {
            Text("This creates a new restored database and imports its image assets. Your currently open database is not replaced.")
        }
        .sheet(item: Binding(
            get: { store.route },
            set: { if $0 == nil { store.closeModal() } }
        )) { route in modalContent(for: route) }
        .alert("Database Error", isPresented: Binding(
            get: { store.errorMessage != nil },
            set: { if !$0 { store.errorMessage = nil } }
        )) {
            Button("OK") { store.errorMessage = nil }
        } message: {
            Text(store.errorMessage ?? "")
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

    private func chooseRestoreDestination() {
        guard let backupURL = pendingRestoreURL else { return }
        let panel = NSSavePanel()
        panel.title = "Restore Database"
        panel.message = "Choose where to create the restored database."
        panel.allowedContentTypes = [.database]
        panel.nameFieldStringValue = backupURL.deletingPathExtension().lastPathComponent + "-restored.db"
        panel.canCreateDirectories = true
        panel.begin { response in
            guard response == .OK, let destinationURL = panel.url else { return }
            do {
                try BackupManager.restore(
                    databaseBackupURL: backupURL,
                    to: destinationURL,
                    assetsAt: ImageStore.rootDirectory
                )
                try store.open(url: destinationURL)
                UserDefaults.standard.set(destinationURL.path, forKey: "lastDatabasePath")
                pendingRestoreURL = nil
            } catch {
                store.errorMessage = "Could not restore the database: \(error.localizedDescription)"
            }
        }
    }
}

struct EmptyStateView: View {
    var body: some View {
        ContentUnavailableView(
            "No Database Open",
            systemImage: "shippingbox",
            description: Text("Open your warehouse database to view possessions.")
        )
    }
}
