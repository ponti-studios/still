import Foundation
import Observation
import AppKit
import StillMacCore

/// Disambiguates our managed category record from Foundation's `Category`
/// (file-type category), which is also visible through SwiftUI/AppKit.
typealias Category = StillMacCore.Category

enum SortField: String, CaseIterable, Identifiable {
    case name = "name"
    case acquiredDate = "acquired_date"
    case price = "price"
    case brand = "brand"
    case category = "category"
    case daysOwned = "days_owned"
    case status = "status"

    var id: String { rawValue }
    var displayName: String {
        switch self {
        case .name: return "Name"
        case .acquiredDate: return "Acquired"
        case .price: return "Price"
        case .brand: return "Brand"
        case .category: return "Category"
        case .daysOwned: return "Days Owned"
        case .status: return "Status"
        }
    }
}

enum PossessionRoute: Identifiable {
    case detail(Possession)
    case new(Possession)

    var id: String {
        switch self {
        case .detail(let possession): return "detail-\(possession.id)"
        case .new: return "new"
        }
    }
}

@MainActor
@Observable
final class PossessionsStore {
    var databaseURL: URL?
    private(set) var possessions: [Possession] = []
    private(set) var managedCategories: [Category] = []
    private(set) var selectedID: String?

    var searchText = ""
    var statusFilter: Status? = nil
    var categoryFilter: String? = nil
    var archiveFilter: Bool? = nil
    var sortField: SortField = .name
    var sortAscending = true

    var errorMessage: String?
    var isOpen = false
    var lastBackupURL: URL?
    var inlineEditingID: String?
    var route: PossessionRoute?

    func beginEditing(_ possession: Possession) {
        route = .new(possession)
    }

    func endEditing() {
        closeModal()
    }

    func beginInlineEditing(_ possession: Possession) {
        inlineEditingID = possession.id
        if possessions.contains(where: { $0.id == possession.id }) {
            selectedID = possession.id
            route = .detail(possession)
        }
    }

    func endInlineEditing() {
        inlineEditingID = nil
        closeModal()
    }

    func openDetail(_ possession: Possession) {
        selectedID = possession.id
        route = .detail(possession)
    }

    func closeModal() {
        route = nil
        inlineEditingID = nil
        selectedID = nil
    }

    private var repository: PossessionsRepository?
    private var backedUpThisSession = false

    var selectedPossession: Possession? {
        guard let selectedID else { return nil }
        return possessions.first { $0.id == selectedID }
    }

    var categories: [String] {
        managedCategories.map(\.name)
    }

    var statusCounts: [(Status, Int)] {
        var counts: [Status: Int] = [:]
        for p in possessions {
            if let raw = p.status, let status = Status(rawValue: raw) {
                counts[status, default: 0] += 1
            }
        }
        return Status.allCases.compactMap { status in
            guard let count = counts[status], count > 0 else { return nil }
            return (status, count)
        }
    }

    var archivedCount: Int {
        possessions.filter(\.isArchived).count
    }

    func count(for category: String) -> Int {
        possessions.filter { $0.category.trimmingCharacters(in: .whitespaces) == category }.count
    }

    var filteredPossessions: [Possession] {
        var result = possessions

        if let statusFilter {
            result = result.filter { $0.status == statusFilter.rawValue }
        }
        if let archiveFilter {
            result = result.filter { $0.isArchived == archiveFilter }
        }
        if let categoryFilter {
            result = result.filter { $0.category.trimmingCharacters(in: .whitespaces) == categoryFilter }
        }
        let query = searchText.trimmingCharacters(in: .whitespaces).lowercased()
        if !query.isEmpty {
            result = result.filter { p in
                let haystack = [p.name, p.brand, p.model, p.category, p.subCategory, p.notes, p.serialNumber]
                    .map { $0.lowercased() }
                    .joined(separator: " ")
                return haystack.contains(query)
            }
        }

        result.sort { lhs, rhs in
            let comparison: ComparisonResult
            switch sortField {
            case .name: comparison = lhs.name.localizedCaseInsensitiveCompare(rhs.name)
            case .brand: comparison = lhs.brand.localizedCaseInsensitiveCompare(rhs.brand)
            case .category: comparison = lhs.category.localizedCaseInsensitiveCompare(rhs.category)
            case .acquiredDate:
                comparison = compare((lhs.acquiredDate, lhs.name), (rhs.acquiredDate, rhs.name))
            case .daysOwned:
                let l = Int(lhs.daysOwned) ?? Int(lhs.daysOwned.replacingOccurrences(of: ",", with: "")) ?? 0
                let r = Int(rhs.daysOwned) ?? Int(rhs.daysOwned.replacingOccurrences(of: ",", with: "")) ?? 0
                comparison = l == r ? lhs.name.localizedCaseInsensitiveCompare(rhs.name) : (l < r ? .orderedAscending : .orderedDescending)
            case .price:
                let l = lhs.priceValue ?? -1, r = rhs.priceValue ?? -1
                comparison = l == r ? lhs.name.localizedCaseInsensitiveCompare(rhs.name) : (l < r ? .orderedAscending : .orderedDescending)
            case .status:
                comparison = (lhs.status ?? "").localizedCaseInsensitiveCompare(rhs.status ?? "")
            }
            if comparison == .orderedSame { return lhs.id < rhs.id }
            return sortAscending ? comparison == .orderedAscending : comparison == .orderedDescending
        }
        return result
    }

    private func compare(_ lhs: (String, String), _ rhs: (String, String)) -> ComparisonResult {
        let first = lhs.0.localizedCaseInsensitiveCompare(rhs.0)
        return first == .orderedSame ? lhs.1.localizedCaseInsensitiveCompare(rhs.1) : first
    }

    // MARK: - Database lifecycle

    func open(url: URL) throws {
        do {
            let db = try SQLiteDatabase(path: url.path)
            guard try db.hasTable("possessions") else {
                throw DatabaseError.schemaMissing
            }
            let candidateRepository = PossessionsRepository(db: db)
            try candidateRepository.migrateSchema()
            try candidateRepository.validateSchema()
            repository = candidateRepository
            databaseURL = url
            isOpen = true
            backedUpThisSession = false
            try reload()
            errorMessage = nil
        } catch {
            errorMessage = "Could not open \(url.lastPathComponent): \(error.localizedDescription)"
            throw error
        }
    }

    func openNewDatabase(url: URL) throws {
        let db = try SQLiteDatabase(path: url.path)
        let newRepository = PossessionsRepository(db: db)
        try newRepository.createEmptySchema()
        repository = newRepository
        databaseURL = url
        isOpen = true
        backedUpThisSession = false
        try reload()
        errorMessage = nil
    }

    func reload() throws {
        guard let repository else { return }
        possessions = try repository.fetchAll()
        managedCategories = try repository.fetchCategories()
        if let selectedID, !possessions.contains(where: { $0.id == selectedID }) {
            self.selectedID = nil
        }
        if let inlineEditingID, !possessions.contains(where: { $0.id == inlineEditingID }) {
            self.inlineEditingID = nil
        }
    }

    func select(_ possession: Possession?) {
        selectedID = possession?.id
    }

    func select(id: String?) {
        selectedID = id
    }

    func newPossession() -> Possession {
        Possession(id: UUIDv7.generate())
    }

    // MARK: - Mutations (with automatic backup before first write per session)

    private func backupIfNeeded() throws {
        guard !backedUpThisSession, let databaseURL else { return }
        let url = try BackupManager.snapshot(databaseURL: databaseURL)
        lastBackupURL = url
        backedUpThisSession = true
    }

    func save(_ possession: Possession) throws {
        guard let repository else { throw DatabaseError.schemaMissing }
        do {
            try backupIfNeeded()
            try repository.upsert(possession)
            try reload()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    func delete(_ possession: Possession) throws {
        guard let repository else { throw DatabaseError.schemaMissing }
        do {
            try backupIfNeeded()
            try repository.delete(id: possession.id)
            if selectedID == possession.id { selectedID = nil }
            if inlineEditingID == possession.id { inlineEditingID = nil }
            try reload()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
            throw error
        }
    }

    func manualBackup() {
        guard let databaseURL else { return }
        do {
            let url = try BackupManager.snapshot(databaseURL: databaseURL)
            lastBackupURL = url
            errorMessage = nil
        } catch {
            errorMessage = "Backup failed: \(error.localizedDescription)"
        }
    }

    func addImage(to possessionID: String, from sourceURL: URL) throws {
        guard let index = possessions.firstIndex(where: { $0.id == possessionID }) else { return }
        let path = try ImageStore.importImage(from: sourceURL, into: possessionID)
        var updated = possessions[index]
        var assets = updated.imageAssets
        if assets.isEmpty {
            assets = updated.imagePaths.enumerated().map { order, existingPath in
                PossessionImageAsset(
                    id: UUIDv7.generate(),
                    possessionID: possessionID,
                    path: existingPath,
                    displayOrder: order,
                    originalFilename: URL(fileURLWithPath: existingPath).lastPathComponent
                )
            }
        }
        assets.append(PossessionImageAsset(
            id: UUIDv7.generate(),
            possessionID: possessionID,
            path: path,
            displayOrder: assets.count,
            originalFilename: sourceURL.lastPathComponent
        ))
        updated.imageAssets = assets
        updated.imageUrl = assets.map(\.path).joined(separator: ", ")
        do {
            try save(updated)
        } catch {
            try? ImageStore.removeImage(at: path, for: possessionID)
            throw error
        }
    }

    func removeImage(from possession: Possession, at path: String) throws {
        var updated = possession
        updated.imageAssets = updated.imageAssets.filter { $0.path != path }
        updated.imageUrl = updated.imagePaths.filter { $0 != path }.joined(separator: ", ")
        try save(updated)
        try ImageStore.removeImage(at: path, for: possession.id)
    }
}
