import Foundation
import Observation
import AppKit
import StillMacCore
import StillCore

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

/// How the library is getting on with Hominem, in the words the footer shows.
/// Same vocabulary as the iOS app.
enum SyncStatus: Equatable {
    case idle
    case saved
    case syncing(Int)
    case waiting(Int)
    case offline

    var label: String {
        switch self {
        case .idle: return ""
        case .saved: return "All changes saved"
        case .syncing(let count): return count > 0 ? "\(count) change\(count == 1 ? "" : "s") syncing…" : "Syncing…"
        case .waiting(let count): return "\(count) waiting — offline"
        case .offline: return "Offline — showing saved data"
        }
    }

    var symbol: String {
        switch self {
        case .idle: return "circle"
        case .saved: return "checkmark.circle"
        case .syncing: return "arrow.triangle.2.circlepath"
        case .waiting, .offline: return "exclamationmark.icloud"
        }
    }

    var isBusy: Bool {
        if case .syncing = self { return true }
        return false
    }
}

/// The Mac library, read from and written through the shared StillCore cache and
/// outbox. Hominem is the source of truth: reads render the cache, writes queue
/// an op and apply it locally at once, and a sync sends the queue and pulls the
/// delta. The SQLite database is no longer written at runtime (the one-way
/// importer still reads it).
@MainActor
@Observable
final class PossessionsStore {
    private(set) var possessions: [Possession] = []
    private(set) var managedCategories: [Category] = []
    private(set) var selectedID: String?
    private(set) var syncStatus: SyncStatus = .idle

    var searchText = ""
    var statusFilter: Status? = nil
    var categoryFilter: String? = nil
    var archiveFilter: Bool? = nil
    var sortField: SortField = .name
    var sortAscending = true

    var errorMessage: String?
    var notice: String?
    var inlineEditingID: String?
    var route: PossessionRoute?

    /// The alert shows a failure if there is one, otherwise the calm notice.
    var alertMessage: String? { errorMessage ?? notice }

    private let account: StillAccount
    private var isSyncing = false
    private var needsAnotherSync = false

    init(account: StillAccount) {
        self.account = account
    }

    func clearAlert() {
        errorMessage = nil
        notice = nil
    }

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

    var selectedPossession: Possession? {
        guard let selectedID else { return nil }
        return possessions.first { $0.id == selectedID }
    }

    var categories: [String] {
        managedCategories.map(\.name)
    }

    var statusCounts: [(Status, Int)] {
        var counts: [Status: Int] = [:]
        for p in possessions where !p.isArchived {
            if let status = p.statusValue {
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
            result = result.filter { !$0.isArchived && $0.status == statusFilter.rawValue }
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
                let l = lhs.daysOwnedValue ?? -1, r = rhs.daysOwnedValue ?? -1
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

    // MARK: - Library

    /// Renders the cached library without touching the network.
    func reload() {
        let payload = account.readLibrary()
        possessions = (payload["possessions"] as? [[String: Any]] ?? [])
            .map(PossessionCache.possession(from:))
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        let managed = PossessionCache.categories(from: payload)
        // Until the categories endpoint lands, the sidebar shows what the items use.
        managedCategories = managed.isEmpty ? PossessionCache.categories(inUse: possessions) : managed
        if let selectedID, !possessions.contains(where: { $0.id == selectedID }) {
            self.selectedID = nil
        }
        if let inlineEditingID, !possessions.contains(where: { $0.id == inlineEditingID }) {
            self.inlineEditingID = nil
        }
    }

    /// Empties the library on sign out, so nothing of the previous account lingers.
    func reset() {
        possessions = []
        managedCategories = []
        selectedID = nil
        inlineEditingID = nil
        route = nil
        syncStatus = .idle
    }

    /// Flushes the outbox and pulls the delta, then renders the cache. Offline is
    /// an ordinary answer: the queue is kept and the cache still shows. An edit
    /// made while a sync is running sets a flag and is picked up in the same call,
    /// so nothing waits for the next sync point.
    func refresh() async {
        guard account.state.email != nil else {
            reset()
            return
        }
        if isSyncing {
            needsAnotherSync = true
            return
        }
        isSyncing = true
        syncStatus = .syncing(account.pendingCount())
        var passes = 0
        repeat {
            needsAnotherSync = false
            await performSync()
            passes += 1
        } while needsAnotherSync && passes < 3
        isSyncing = false
    }

    private func performSync() async {
        do {
            _ = try await account.syncLibrary()
            reload()
            errorMessage = nil
            let notices = account.takeNotices()
            if !notices.isEmpty { notice = notices.joined(separator: "\n") }
            let pending = account.pendingCount()
            syncStatus = pending > 0 ? .syncing(pending) : .saved
        } catch {
            reload()
            let pending = account.pendingCount()
            syncStatus = pending > 0 ? .waiting(pending) : .offline
            if (error as? StillProblem) == .signedOut {
                reset()
            }
        }
    }

    /// The primary "sync now" action (⌘R).
    func syncNow() {
        Task { await refresh() }
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

    // MARK: - Mutations (queued through the shared outbox)

    /// Queues a create or an update and applies it to the cache at once, so the
    /// edit shows even offline. Throws only when the edit itself cannot be built
    /// (bad metadata JSON); a network problem is not a save failure.
    func save(_ possession: Possession) throws {
        let payload = try PossessionCache.writePayload(for: possession)
        let exists = possessions.contains { $0.id == possession.id }
        _ = account.enqueue(
            entity: "possession",
            kind: exists ? "update" : "create",
            entityId: possession.id,
            payload: Self.json(payload))
        reload()
        errorMessage = nil
        syncNow()
    }

    func delete(_ possession: Possession) throws {
        _ = account.enqueue(
            entity: "possession", kind: "delete", entityId: possession.id, payload: "{}")
        if selectedID == possession.id { selectedID = nil }
        if inlineEditingID == possession.id { inlineEditingID = nil }
        reload()
        errorMessage = nil
        syncNow()
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

    private static func json(_ payload: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(
            withJSONObject: payload, options: [.withoutEscapingSlashes])
        else { return "{}" }
        return String(data: data, encoding: .utf8) ?? "{}"
    }
}
