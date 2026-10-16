import SwiftUI
import StillMacCore

struct PossessionDetailView: View {
    @Environment(PossessionsStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let possession: Possession
    let startsInEditMode: Bool
    @State private var draft = Possession(id: "")
    @State private var showingImagePicker = false
    @State private var showDeleteConfirm = false

    init(possession: Possession, startsInEditMode: Bool = false) {
        self.possession = possession
        self.startsInEditMode = startsInEditMode
        _draft = State(initialValue: possession)
    }

    private var isEditing: Bool { store.inlineEditingID == possession.id }
    private var isNew: Bool { !store.possessions.contains { $0.id == possession.id } }
    private var currentPossession: Possession {
        store.possessions.first { $0.id == possession.id } ?? possession
    }

    var body: some View {
        Group {
            if isEditing {
                editor
            } else {
                readScroll
            }
        }
        .background(Color.primary.opacity(0.02))
        .glassEffect(.regular, in: .rect(cornerRadius: 0))
        .onAppear {
            draft = possession
            if startsInEditMode {
                store.beginInlineEditing(possession)
            }
        }
        .onChange(of: possession.id) {
            draft = store.possessions.first { $0.id == possession.id } ?? possession
        }
        .onChange(of: store.inlineEditingID) { _, newID in
            if newID == possession.id {
                draft = store.possessions.first { $0.id == possession.id } ?? possession
            }
        }
        .fileImporter(
            isPresented: $showingImagePicker,
            allowedContentTypes: [.image, .png, .jpeg, .heic],
            allowsMultipleSelection: true
        ) { result in
            switch result {
            case .success(let urls):
                for url in urls {
                    do {
                        try store.addImage(to: possession.id, from: url)
                    } catch {
                        store.errorMessage = error.localizedDescription
                        break
                    }
                }
            case .failure(let error):
                store.errorMessage = error.localizedDescription
            }
        }
        .confirmationDialog(
            "Delete this possession?",
            isPresented: $showDeleteConfirm
        ) {
            Button("Delete", role: .destructive) {
                do {
                    try store.delete(possession)
                    store.closeModal()
                } catch {
                    store.errorMessage = error.localizedDescription
                }
            }
        } message: {
            Text("This cannot be undone. A database backup is created first.")
        }
        .toolbar {
            if isEditing {
                ToolbarItem(placement: .destructiveAction) {
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                    .help("Delete this possession")
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Cancel") {
                        if isNew {
                            store.closeModal()
                        } else {
                            store.endInlineEditing()
                        }
                    }
                        .keyboardShortcut(.cancelAction)
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Save") { save() }
                        .keyboardShortcut(.defaultAction)
                        .buttonStyle(.borderedProminent)
                }
            } else {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        store.closeModal()
                        dismiss()
                    }
                    .keyboardShortcut(.cancelAction)
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        store.beginInlineEditing(possession)
                    } label: {
                        Label("Edit", systemImage: "pencil")
                    }
                    .keyboardShortcut("e")
                    .help("Edit this possession")
                }
            }
        }
    }

    private func save() {
        let wasNew = !store.possessions.contains { $0.id == possession.id }
        guard !draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            store.errorMessage = "Name is required."
            return
        }
        do {
            try store.save(draft)
            if wasNew {
                store.closeModal()
            } else {
                store.endInlineEditing()
            }
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }

    private func removeImage(at path: String) {
        do {
            try store.removeImage(from: draft, at: path)
            draft.imageUrl = draft.imagePaths.filter { $0 != path }.joined(separator: ", ")
        } catch {
            store.errorMessage = error.localizedDescription
        }
    }

    // MARK: - Read mode

    private var readScroll: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                Divider()
                imageSection
                Divider()
                metadataGrid
                if !currentPossession.notes.isEmpty {
                    Divider()
                    notesSection
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top) {
                Text(currentPossession.name)
                    .font(.largeTitle.weight(.bold))
                    .textSelection(.enabled)
                Spacer()
                StatusBadge(status: currentPossession.statusValue)
                if currentPossession.isArchived {
                    Label("Archived", systemImage: "archivebox")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            if !currentPossession.displaySubtitle.isEmpty {
                Text(currentPossession.displaySubtitle)
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var imageSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Images", systemImage: "photo.on.rectangle.angled")
                    .font(.headline)
                Spacer()
                Button {
                    showingImagePicker = true
                } label: {
                    Label("Add Images…", systemImage: "plus")
                }
            }

            let paths = currentPossession.imagePaths
            if paths.isEmpty {
                Button {
                    showingImagePicker = true
                } label: {
                    VStack(spacing: 10) {
                        Image(systemName: "photo.badge.plus")
                            .font(.system(size: 36))
                        Text("Add images")
                            .font(.callout)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 160)
                    .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 14))
                    .overlay {
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(style: StrokeStyle(lineWidth: 1, dash: [6]))
                            .foregroundStyle(.secondary.opacity(0.4))
                    }
                }
                .buttonStyle(.plain)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 12) {
                        ForEach(paths, id: \.self) { path in
                            if ImageStore.imageExists(at: path) {
                                PossessionImage(path: path)
                                    .frame(width: 180, height: 160)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                        }
                    }
                }
            }
        }
    }

    private var metadataGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 16)], spacing: 16) {
            DetailRow(label: "Brand", value: currentPossession.brand)
            DetailRow(label: "Model", value: currentPossession.model)
            DetailRow(label: "Category", value: currentPossession.category)
            DetailRow(label: "Sub-Category", value: currentPossession.subCategory)
            DetailRow(label: "Acquired", value: currentPossession.acquiredDate)
            DetailRow(label: "Retired", value: currentPossession.retiredDate)
            DetailRow(label: "Price", value: currentPossession.price)
            DetailRow(label: "Sell Price", value: currentPossession.sellPrice)
            DetailRow(label: "Net Value", value: currentPossession.netValue)
            DetailRow(label: "Serial Number", value: currentPossession.serialNumber)
            DetailRow(label: "Size", value: currentPossession.size)
            DetailRow(label: "Color", value: currentPossession.color)
            DetailRow(label: "Placement", value: currentPossession.placement)
            DetailRow(label: "Artist", value: currentPossession.artist)
            DetailRow(label: "Daily Cost", value: currentPossession.dailyCost)
            DetailRow(label: "Days Owned", value: currentPossession.daysOwned)
            DetailRow(label: "Amount", value: currentPossession.amount)
            DetailRow(label: "Amount Unit", value: currentPossession.amountUnit)
            DetailRow(label: "Type", value: currentPossession.possessionType)
            DetailRow(label: "Source", value: currentPossession.sourceTable)
            DetailRow(label: "Source Row", value: currentPossession.sourceRowID)
        }
    }

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Notes", systemImage: "note.text")
                .font(.headline)
            Text(currentPossession.notes)
                .textSelection(.enabled)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.white.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
        }
    }

    // MARK: - Edit mode

    private var editor: some View {
        Form {
            Section("Images") {
                HStack {
                    Button {
                        showingImagePicker = true
                    } label: {
                        Label("Add Images…", systemImage: "plus")
                    }
                    Spacer()
                    Text("\(draft.imagePaths.count) image(s)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                let paths = draft.imagePaths
                if paths.isEmpty {
                    Text("No images yet.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(paths, id: \.self) { path in
                                if ImageStore.imageExists(at: path) {
                                    PossessionImage(path: path)
                                        .frame(width: 140, height: 120)
                                        .clipShape(RoundedRectangle(cornerRadius: 10))
                                        .overlay(alignment: .topTrailing) {
                                            Button {
                                                removeImage(at: path)
                                            } label: {
                                                Image(systemName: "xmark.circle.fill")
                                                    .font(.system(size: 18))
                                                    .symbolRenderingMode(.hierarchical)
                                            }
                                            .buttonStyle(.plain)
                                            .accessibilityLabel("Remove image")
                                            .padding(6)
                                            .help("Remove image")
                                        }
                                }
                            }
                        }
                    }
                }
            }
            Section("Identity") {
                TextField("Name", text: $draft.name)
                TextField("Brand", text: $draft.brand)
                TextField("Model", text: $draft.model)
            }
            Section("Classification") {
                Picker("Status", selection: Binding<Status?>(
                    get: { draft.statusValue },
                    set: { draft.statusValue = $0 }
                )) {
                    Text("— None —").tag(Status?.none)
                    ForEach(Status.allCases) { status in
                        Text(status.displayName).tag(status as Status?)
                    }
                }
                Toggle("Archived", isOn: $draft.isArchived)
                Picker("Category", selection: Binding<String>(
                    get: { draft.categoryID ?? "" },
                    set: { id in
                        draft.categoryID = id.isEmpty ? nil : id
                        draft.categoryName = store.managedCategories.first { $0.id == id }?.name ?? draft.categoryName
                    }
                )) {
                    Text("— None —").tag("")
                    ForEach(store.managedCategories) { category in
                        Text(category.name).tag(category.id)
                    }
                }
                TextField("New Category", text: $draft.categoryName)
                TextField("Sub-Category", text: $draft.subCategory)
                TextField("Type", text: $draft.possessionType)
                TextField("Artist", text: $draft.artist)
            }
            Section("Dates & Pricing") {
                TextField("Acquired Date (YYYY-MM-DD)", text: $draft.acquiredDate)
                TextField("Retired Date", text: $draft.retiredDate)
                TextField("Price", text: $draft.price)
                TextField("Sell Price", text: $draft.sellPrice)
                TextField("Net Value", text: $draft.netValue)
                TextField("Daily Cost", text: $draft.dailyCost)
                TextField("Days Owned", text: $draft.daysOwned)
            }
            Section("Details") {
                TextField("Serial Number", text: $draft.serialNumber)
                TextField("Size", text: $draft.size)
                TextField("Color", text: $draft.color)
                TextField("Placement", text: $draft.placement)
                TextField("Amount", text: $draft.amount)
                TextField("Amount Unit", text: $draft.amountUnit)
            }
            Section("Links") {
                TextField("URL", text: $draft.url)
            }
            Section("Source") {
                TextField("Source Table", text: $draft.sourceTable)
                TextField("Source Row ID", text: $draft.sourceRowID)
            }
            Section("Metadata (JSON)") {
                TextEditor(text: $draft.metadata)
                    .font(.system(.body, design: .monospaced))
                    .frame(minHeight: 100)
            }
            Section("Notes") {
                TextEditor(text: $draft.notes)
                    .frame(minHeight: 80)
            }
        }
        .formStyle(.grouped)
    }
}

struct DetailRow: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value.isEmpty ? "—" : value)
                .font(.body)
                .textSelection(.enabled)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 10))
    }
}
