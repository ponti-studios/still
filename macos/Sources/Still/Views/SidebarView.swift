import SwiftUI
import StillMacCore

enum SidebarSelection: Hashable {
    case all
    case status(Status)
    case archived
    case category(String)
}

struct SidebarView: View {
    @Environment(PossessionsStore.self) private var store
    @State private var selection: SidebarSelection = .all

    private var selectionBinding: Binding<SidebarSelection> {
        Binding(
            get: { selection },
            set: { newValue in
                selection = newValue
                switch newValue {
                case .all:
                    store.statusFilter = nil
                    store.categoryFilter = nil
                    store.archiveFilter = nil
                case .status(let status):
                    store.statusFilter = status
                    store.categoryFilter = nil
                    store.archiveFilter = nil
                case .archived:
                    store.statusFilter = nil
                    store.categoryFilter = nil
                    store.archiveFilter = true
                case .category(let category):
                    store.statusFilter = nil
                    store.categoryFilter = category
                    store.archiveFilter = nil
                }
            }
        )
    }

    var body: some View {
        List(selection: selectionBinding) {
            Section {
                Label("All Possessions", systemImage: "shippingbox")
                    .tag(SidebarSelection.all)
            }
            Section("Status") {
                ForEach(store.statusCounts, id: \.0) { status, count in
                    HStack {
                        Image(systemName: status.systemImage)
                            .foregroundStyle(.blue)
                            .frame(width: 18)
                        Text(status.displayName)
                        Spacer()
                        Text("\(count)")
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    .tag(SidebarSelection.status(status))
                }
            }
            Section("Archive") {
                HStack {
                    Image(systemName: "archivebox")
                        .foregroundStyle(.secondary)
                        .frame(width: 18)
                    Text("Archived")
                    Spacer()
                    Text("\(store.archivedCount)")
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
                .tag(SidebarSelection.archived)
            }
            Section("Categories") {
                ForEach(store.categories, id: \.self) { category in
                    HStack {
                        Image(systemName: "tag")
                            .frame(width: 18)
                        Text(category)
                        Spacer()
                        Text("\(store.count(for: category))")
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }
                    .tag(SidebarSelection.category(category))
                }
            }
        }
        .listStyle(.sidebar)
        .navigationSplitViewColumnWidth(min: 210, ideal: 250, max: 320)
        .safeAreaInset(edge: .bottom) {
            if !APIEndpoint.isProduction || !store.syncStatus.label.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    if !APIEndpoint.isProduction {
                        HStack(spacing: 6) {
                            Image(systemName: "hammer")
                            Text("Development API: \(APIEndpoint.label)")
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    }
                    if !store.syncStatus.label.isEmpty {
                        HStack(spacing: 6) {
                            Image(systemName: store.syncStatus.symbol)
                            Text(store.syncStatus.label)
                                .lineLimit(1)
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.ultraThinMaterial)
            }
        }
    }
}
