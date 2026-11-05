import Foundation
import Testing
@testable import StillMacCore

@Suite("Cache mapping")
struct PossessionCacheTests {
    @Test("every status value in the shared table maps onto the lifecycle")
    func statusTable() {
        // Mirrors docs/status-category-mapping.md. Keep in step with Hominem's
        // status.ts and src/core/mapping.ts.
        let rows: [(String?, Bool, Status, Bool)] = [
            ("wishlist", false, .wanted, false),
            ("planned", false, .planned, false),
            ("ordered", false, .ordered, false),
            ("delivered", false, .delivered, false),
            ("owned", false, .owned, false),
            ("in_use", false, .owned, false),
            ("retired", true, .owned, true),
            ("disposed", true, .owned, true),
            ("donated", true, .owned, true),
            ("sold", true, .owned, true),
            (nil, false, .owned, false),
            ("an_owners_own_value", false, .owned, false),
        ]
        for (stored, archived, status, isArchived) in rows {
            #expect(PossessionStatusMapping.lifecycle(status: stored, isArchived: archived) == status)
            #expect(PossessionStatusMapping.isArchived(status: stored, isArchived: archived) == isArchived)
        }
    }

    @Test("a legacy end state reads as archived, never hidden")
    func legacyEndStateRow() {
        let row: [String: Any] = ["id": "1", "name": "Old one", "status": "disposed", "isArchived": true]
        let possession = PossessionCache.possession(from: row)
        #expect(possession.isArchived)
        #expect(possession.statusValue == .owned)
        #expect(possession.name == "Old one")
    }

    @Test("a partial optimistic row still renders")
    func partialRow() {
        let possession = PossessionCache.possession(from: ["id": "new-1", "name": "Just made"])
        #expect(possession.id == "new-1")
        #expect(possession.name == "Just made")
        #expect(possession.statusValue == .owned)
        #expect(possession.isArchived == false)
        #expect(possession.imagePaths.isEmpty)
    }

    @Test("a possession round-trips through the write payload and back")
    func roundTrip() throws {
        var possession = Possession(id: "st-1")
        possession.name = "Camera"
        possession.categoryName = "Photography"
        possession.brand = "Leica"
        possession.statusValue = .delivered
        possession.isArchived = false
        possession.priceCents = 250_000
        possession.sellPriceCents = 180_000
        possession.acquiredDate = "2020-12-21"
        possession.artist = "Ansel"
        possession.possessionType = "Equipment"
        possession.netValueCents = 200_000
        possession.dailyCostCents = 55
        possession.daysOwnedValue = 400
        possession.amountValue = 2.5
        possession.amountUnit = "kg"
        possession.sourceTable = "warehouse"
        possession.sourceRowID = "42"
        possession.imageUrl = "/tmp/a.jpg, /tmp/b.jpg"

        let payload = try PossessionCache.writePayload(for: possession)
        #expect(payload["status"] as? String == "delivered")
        #expect(payload["isArchived"] as? Bool == false)
        #expect(payload["category"] as? String == "Photography")
        #expect(payload["brand"] as? String == "Leica")
        #expect(payload["priceCents"] as? Int64 == 250_000)
        #expect(payload["sellPriceCents"] as? Int64 == 180_000)
        #expect(payload["acquiredDate"] as? String == "2020-12-21")

        // The API echoes the id back on the row; everything else comes from the payload.
        var row = payload
        row["id"] = "st-1"

        let decoded = PossessionCache.possession(from: row)
        #expect(decoded.id == "st-1")
        #expect(decoded.name == "Camera")
        #expect(decoded.categoryName == "Photography")
        #expect(decoded.brand == "Leica")
        #expect(decoded.statusValue == .delivered)
        #expect(decoded.isArchived == false)
        #expect(decoded.priceCents == 250_000)
        #expect(decoded.sellPriceCents == 180_000)
        #expect(decoded.acquiredDate == "2020-12-21")
        #expect(decoded.artist == "Ansel")
        #expect(decoded.possessionType == "Equipment")
        #expect(decoded.netValueCents == 200_000)
        #expect(decoded.dailyCostCents == 55)
        #expect(decoded.daysOwnedValue == 400)
        #expect(decoded.amountValue == 2.5)
        #expect(decoded.amountUnit == "kg")
        #expect(decoded.sourceTable == "warehouse")
        #expect(decoded.sourceRowID == "42")
        #expect(decoded.imagePaths == ["/tmp/a.jpg", "/tmp/b.jpg"])
    }

    @Test("archiving keeps the lifecycle and sets the flag")
    func archiving() throws {
        var possession = Possession(id: "st-2")
        possession.name = "Sold it"
        possession.statusValue = .owned
        possession.isArchived = true

        let payload = try PossessionCache.writePayload(for: possession)
        #expect(payload["status"] as? String == "owned")
        #expect(payload["isArchived"] as? Bool == true)
    }

    @Test("empty fields are cleared rather than written as empty strings")
    func clearing() throws {
        var possession = Possession(id: "st-3")
        possession.name = "Bare"
        possession.brand = ""

        let payload = try PossessionCache.writePayload(for: possession)
        #expect(payload["brand"] is NSNull)
        #expect(payload["category"] is NSNull)
        #expect(payload["priceCents"] is NSNull)
        let metadata = payload["metadata"] as? [String: Any] ?? [:]
        #expect(metadata["artist"] == nil)
        #expect(metadata["imageUrl"] == nil)
    }

    @Test("metadata that is not a JSON object is refused, never silently dropped")
    func invalidMetadata() {
        var possession = Possession(id: "st-4")
        possession.name = "Bad metadata"
        possession.metadata = "[1, 2, 3]"
        #expect(throws: PossessionCache.Failure.self) {
            _ = try PossessionCache.writePayload(for: possession)
        }
    }

    @Test("unknown metadata keys survive an edit; the form fields own their own keys")
    func unknownMetadataKeysSurvive() throws {
        var possession = Possession(id: "st-5")
        possession.name = "Imported"
        possession.metadata = #"{"vendor": "Acme", "importedFrom": "warehouse", "sourceRowId": "42"}"#
        possession.sourceTable = "warehouse"
        possession.sourceRowID = "42"

        let payload = try PossessionCache.writePayload(for: possession)
        let metadata = payload["metadata"] as? [String: Any] ?? [:]
        #expect(metadata["vendor"] as? String == "Acme")
        #expect(metadata["importedFrom"] as? String == "warehouse")
        #expect(metadata["sourceRowId"] as? String == "42")
    }

    @Test("managed categories come from the payload, in-use ones as the fallback")
    func categories() {
        let payload: [String: Any] = [
            "categories": [
                ["id": "c1", "name": "Photography"],
                ["id": "c2", "name": "Audio"],
            ]
        ]
        #expect(PossessionCache.categories(from: payload).map(\.name) == ["Photography", "Audio"])
        #expect(PossessionCache.categories(from: [:]).isEmpty)

        var first = Possession(id: "a")
        first.categoryName = "Tech"
        var second = Possession(id: "b")
        second.categoryName = "tech"
        var blank = Possession(id: "c")
        blank.categoryName = "  "
        #expect(PossessionCache.categories(inUse: [first, second, blank]).map(\.name) == ["Tech"])
    }
}
