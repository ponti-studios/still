import Foundation
import Testing
@testable import StillMacCore

@Suite("Possessions model and sorting")
struct PossessionsTests {
    @Test("currency parsing accepts symbols and separators")
    func currencyParsing() {
        var possession = Possession(id: "1")
        possession.price = "$1,234.50"
        #expect(possession.priceValue == 1234.5)
    }

    @Test("UUID v7 has the expected version and variant")
    func uuidVersion() {
        let uuid = UUIDv7.generate()
        #expect(uuid.count == 36)
        #expect(uuid.split(separator: "-")[2].first == "7")
        #expect(["8", "9", "a", "b"].contains(uuid.split(separator: "-")[3].first))
    }

    @Test("archive is stored separately from lifecycle status")
    func archiveIsSeparateFromStatus() throws {
        let db = try SQLiteDatabase(path: ":memory:")
        let repository = PossessionsRepository(db: db)
        try repository.createEmptySchema()

        var possession = Possession(id: "archive-test")
        possession.name = "Archived item"
        possession.status = Status.owned.rawValue
        possession.isArchived = true
        try repository.upsert(possession)

        let fetched = try repository.fetchAll()
        #expect(fetched.first?.status == Status.owned.rawValue)
        #expect(fetched.first?.isArchived == true)
    }

    @Test("normalized schema stores archive, typed money, dates, and ordered assets")
    func normalizedRowsRoundTrip() throws {
        let db = try SQLiteDatabase(path: ":memory:")
        let repository = PossessionsRepository(db: db)
        try repository.createEmptySchema()
        var possession = Possession(id: "normalized-test")
        possession.name = "Normalized item"
        possession.status = Status.owned.rawValue
        possession.isArchived = true
        possession.price = "$12.34"
        possession.acquiredDate = "2020-12-21"
        possession.imageAssets = [
            PossessionImageAsset(id: "image-1", possessionID: possession.id, path: "one.jpg", displayOrder: 0),
            PossessionImageAsset(id: "image-2", possessionID: possession.id, path: "two.png", displayOrder: 1),
        ]
        try repository.upsert(possession)

        let fetched = try repository.fetchAll()
        #expect(fetched.first?.isArchived == true)
        #expect(fetched.first?.status == Status.owned.rawValue)
        #expect(fetched.first?.priceCents == 1234)
        #expect(fetched.first?.acquiredDate == "2020-12-21")
        #expect(fetched.first?.imagePaths == ["one.jpg", "two.png"])
        #expect(fetched.first?.imageAssets.count == 2)
    }

    @Test("categories use one managed record regardless of case")
    func categoriesAreManaged() throws {
        let db = try SQLiteDatabase(path: ":memory:")
        let repository = PossessionsRepository(db: db)
        try repository.createEmptySchema()

        var first = Possession(id: "category-1")
        first.name = "First"
        first.category = " Accessories "
        try repository.upsert(first)

        var second = Possession(id: "category-2")
        second.name = "Second"
        second.category = "accessories"
        try repository.upsert(second)

        let categories = try repository.fetchAll().map(\.category)
        #expect(categories == ["Accessories", "Accessories"])
        #expect(try repository.fetchCategories().count == 1)
    }

    @Test("backup restore brings back the database and asset sidecar")
    func backupRestoreRoundTrip() throws {
        let fileManager = FileManager.default
        let root = fileManager.temporaryDirectory.appendingPathComponent("possessions-backup-test-\(UUIDv7.generate())", isDirectory: true)
        try fileManager.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: root) }

        let sourceURL = root.appendingPathComponent("source.db")
        let sourceRepository = PossessionsRepository(db: try SQLiteDatabase(path: sourceURL.path))
        try sourceRepository.createEmptySchema()
        var possession = Possession(id: "backup-test")
        possession.name = "Restorable item"
        try sourceRepository.upsert(possession)

        let backupURL = try BackupManager.snapshot(databaseURL: sourceURL)
        let backupAssetsURL = backupURL.deletingPathExtension().appendingPathExtension("assets")
        if fileManager.fileExists(atPath: backupAssetsURL.path) {
            try fileManager.removeItem(at: backupAssetsURL)
        }
        try fileManager.createDirectory(at: backupAssetsURL, withIntermediateDirectories: true)
        try Data("asset".utf8).write(to: backupAssetsURL.appendingPathComponent("marker.txt"))

        let restoredURL = root.appendingPathComponent("restored.db")
        let restoredAssetsURL = root.appendingPathComponent("restored-assets", isDirectory: true)
        try BackupManager.restore(databaseBackupURL: backupURL, to: restoredURL, assetsAt: restoredAssetsURL)

        let restoredRepository = PossessionsRepository(db: try SQLiteDatabase(path: restoredURL.path))
        try restoredRepository.migrateSchema()
        #expect(try restoredRepository.fetchAll().first?.name == "Restorable item")
        #expect(fileManager.fileExists(atPath: restoredAssetsURL.appendingPathComponent("marker.txt").path))
    }
}
