import SwiftUI
import StillMacCore

struct PossessionsListView: View {
    @Environment(PossessionsStore.self) private var store
    @State private var displayMode: DisplayMode = .grid

    enum DisplayMode: String, CaseIterable {
        case grid, list
    }

    private let gridColumns = [
        GridItem(.adaptive(minimum: 200, maximum: 280), spacing: 16)
    ]

    var body: some View {
        @Bindable var store = store
        VStack(spacing: 0) {
            toolbarBar
            Divider()
            if store.filteredPossessions.isEmpty {
                ContentUnavailableView(
                    store.possessions.isEmpty ? "No Possessions" : "No Results",
                    systemImage: store.possessions.isEmpty ? "shippingbox" : "magnifyingglass",
                    description: Text(store.possessions.isEmpty ? "Add your first possession." : "Try adjusting your filters.")
                )
            } else {
                switch displayMode {
                case .grid:
                    grid
                case .list:
                    table
                }
            }
        }
        .background(Color.primary.opacity(0.03))
        .glassEffect(.regular, in: .rect(cornerRadius: 0))
    }

    private var toolbarBar: some View {
        @Bindable var store = store
        return HStack(spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search name, brand, notes…", text: $store.searchText)
                    .textFieldStyle(.plain)
                if !store.searchText.isEmpty {
                    Button {
                        store.searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(8)
            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
            .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 10))

            Spacer()

            Menu {
                Picker("Sort By", selection: $store.sortField) {
                    ForEach(SortField.allCases) { field in
                        Text(field.displayName).tag(field)
                    }
                }
                Button(store.sortAscending ? "Ascending" : "Descending") {
                    store.sortAscending.toggle()
                }
            } label: {
                Label("Sort", systemImage: "arrow.up.arrow.down")
            }
            .menuStyle(.borderlessButton)

            Picker("Display mode", selection: $displayMode) {
                Image(systemName: "square.grid.2x2")
                    .accessibilityLabel("Grid")
                    .tag(DisplayMode.grid)
                Image(systemName: "list.bullet")
                    .accessibilityLabel("List")
                    .tag(DisplayMode.list)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .frame(width: 90)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
    }

    private var grid: some View {
        ScrollView {
            LazyVGrid(columns: gridColumns, spacing: 16) {
                ForEach(store.filteredPossessions) { possession in
                    Button {
                            store.openDetail(possession)
                        } label: {
                            PossessionCard(possession: possession, isSelected: store.selectedID == possession.id)
                        }
                        .buttonStyle(.plain)
                        .contextMenu {
                            Button("Edit…") { store.beginInlineEditing(possession) }
                            Button("Duplicate") { duplicate(possession) }
                            Divider()
                            Button("Delete", role: .destructive) { delete(possession) }
                        }
                }
            }
            .padding(16)
        }
    }

    private var table: some View {
        Table(store.filteredPossessions, selection: Binding(
            get: {
                Set(store.selectedID.map { [$0] } ?? [])
            },
            set: { newValue in
                if let id = newValue.first {
                    if let possession = store.possessions.first(where: { $0.id == id }) {
                        // Let NSTableView finish its selection transaction before
                        // presenting the sheet; synchronous routing triggers a
                        // reentrant delegate callback on macOS.
                        Task { @MainActor in
                            store.openDetail(possession)
                        }
                    }
                } else {
                    store.select(id: nil)
                }
            }
        )) {
            TableColumn("Name") { p in
                Text(p.name).lineLimit(1)
            }
            TableColumn("Brand") { p in
                Text(p.brand).foregroundStyle(.secondary).lineLimit(1)
            }
            TableColumn("Status") { p in
                StatusBadge(status: p.statusValue)
            }
            TableColumn("Acquired") { p in
                Text(p.acquiredDate).foregroundStyle(.secondary)
            }
            TableColumn("Price") { p in
                Text(p.price.isEmpty ? "—" : p.price)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
            }
        }
        .contextMenu(forSelectionType: String.self) { ids in
            if let id = ids.first, let p = store.possessions.first(where: { $0.id == id }) {
                Button("Edit…") { store.beginInlineEditing(p) }
                Button("Delete", role: .destructive) { delete(p) }
            }
        }
    }

    private func duplicate(_ possession: Possession) {
        var copy = possession
        copy.id = UUIDv7.generate()
        copy.name = possession.name + " (copy)"
        copy.serialNumber = ""
        do {
            try store.save(copy)
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }

    private func delete(_ possession: Possession) {
        do {
            try store.delete(possession)
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }
}
