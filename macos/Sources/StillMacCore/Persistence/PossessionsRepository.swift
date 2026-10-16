import Foundation

public struct PossessionsRepository {
    public let db: SQLiteDatabase

    static let columns: [String] = [
        "id", "name", "brand", "model", "category_id", "sub_category", "status", "is_archived",
        "acquired_date", "retired_date", "price_cents", "sell_price_cents", "net_value_cents",
        "url", "notes", "serial_number", "size", "color", "placement", "artist", "daily_cost_cents",
        "days_owned", "amount", "amount_unit", "possession_type",
    ]

    public init(db: SQLiteDatabase) {
        self.db = db
    }

    public func fetchAll() throws -> [Possession] {
        let rows = try db.query("""
            SELECT p.*, c.name AS category_name, pr.source_table, pr.source_row_id, pr.metadata_json
            FROM possessions p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN possession_provenance pr ON pr.possession_id = p.id
            ORDER BY p.name COLLATE NOCASE, p.id
            """)
        var possessions: [Possession] = rows.compactMap { row in
            guard let id = row["id"] as? String, let name = row["name"] as? String else { return nil }
            var possession = Possession(id: id)
            possession.name = name
            possession.brand = Self.stringValue(row["brand"])
            possession.model = Self.stringValue(row["model"])
            possession.categoryID = Self.optionalString(row["category_id"])
            possession.categoryName = Self.stringValue(row["category_name"])
            possession.subCategory = Self.stringValue(row["sub_category"])
            possession.status = Self.optionalString(row["status"])
            possession.isArchived = Self.boolValue(row["is_archived"])
            possession.acquiredOn = Self.localDate(row["acquired_date"])
            possession.retiredOn = Self.localDate(row["retired_date"])
            possession.priceCents = Self.optionalInt(row["price_cents"])
            possession.sellPriceCents = Self.optionalInt(row["sell_price_cents"])
            possession.netValueCents = Self.optionalInt(row["net_value_cents"])
            possession.url = Self.stringValue(row["url"])
            possession.notes = Self.stringValue(row["notes"])
            possession.serialNumber = Self.stringValue(row["serial_number"])
            possession.size = Self.stringValue(row["size"])
            possession.color = Self.stringValue(row["color"])
            possession.placement = Self.stringValue(row["placement"])
            possession.artist = Self.stringValue(row["artist"])
            possession.dailyCostCents = Self.optionalInt(row["daily_cost_cents"])
            possession.daysOwnedValue = Self.optionalInt(row["days_owned"]).map(Int.init)
            possession.amountValue = Self.optionalDouble(row["amount"])
            possession.amountUnit = Self.stringValue(row["amount_unit"])
            possession.possessionType = Self.stringValue(row["possession_type"])
            if let sourceTable = Self.optionalString(row["source_table"]),
               let sourceRowID = Self.optionalString(row["source_row_id"]),
               let metadata = Self.optionalString(row["metadata_json"]),
               !sourceTable.isEmpty || !sourceRowID.isEmpty || !metadata.isEmpty {
                possession.provenance = PossessionProvenance(sourceTable: sourceTable, sourceRowID: sourceRowID, metadataJSON: metadata)
            }
            return possession
        }

        let assetRows = try db.query("SELECT id, possession_id, path, display_order, alt_text, original_filename FROM possession_images ORDER BY possession_id, display_order, id")
        var assetsByPossession: [String: [PossessionImageAsset]] = [:]
        for row in assetRows {
            guard let id = row["id"] as? String,
                  let possessionID = row["possession_id"] as? String,
                  let path = row["path"] as? String else { continue }
            assetsByPossession[possessionID, default: []].append(PossessionImageAsset(
                id: id,
                possessionID: possessionID,
                path: path,
                displayOrder: Int(Self.intValue(row["display_order"])),
                altText: Self.stringValue(row["alt_text"]),
                originalFilename: Self.stringValue(row["original_filename"])
            ))
        }
        for index in possessions.indices {
            possessions[index].imageAssets = assetsByPossession[possessions[index].id] ?? []
        }
        return possessions
    }

    public func fetchCategories() throws -> [Category] {
        try db.query("SELECT id, name FROM categories ORDER BY name COLLATE NOCASE, id").compactMap { row in
            guard let id = row["id"] as? String, let name = row["name"] as? String else { return nil }
            return Category(id: id, name: name)
        }
    }

    public func migrateSchema() throws {
        let required = Set(Self.columns)
        let actual = Set(try db.query("PRAGMA table_info(possessions)").compactMap { $0["name"] as? String })
        guard required.isSubset(of: actual), try db.hasTable("categories"), try db.hasTable("possession_provenance") else {
            throw DatabaseError.invalidSchema("the selected database is not using the normalized possessions schema")
        }
        try validateSchema()
    }

    public func validateSchema() throws {
        let invalidStatuses = try db.query("SELECT status FROM possessions WHERE status IS NOT NULL AND status NOT IN ('in_use', 'owned', 'wishlist', 'disposed', 'retired') LIMIT 1")
        guard invalidStatuses.isEmpty else {
            throw DatabaseError.invalidSchema("the possessions table contains an unknown lifecycle status")
        }
        let missingCategories = try db.query("SELECT p.id FROM possessions p LEFT JOIN categories c ON c.id = p.category_id WHERE p.category_id IS NOT NULL AND c.id IS NULL LIMIT 1")
        guard missingCategories.isEmpty else {
            throw DatabaseError.invalidSchema("a possession references a missing category")
        }
        let invalidImages = try db.query("SELECT i.id FROM possession_images i LEFT JOIN possessions p ON p.id = i.possession_id WHERE p.id IS NULL LIMIT 1")
        guard invalidImages.isEmpty else {
            throw DatabaseError.invalidSchema("an image references a missing possession")
        }
    }

    public func upsert(_ possession: Possession) throws {
        var normalized = possession
        normalized.name = possession.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.name.isEmpty else { throw DatabaseError.invalidSchema("a possession name is required") }
        normalized.categoryID = try ensureCategory(named: possession.categoryName)

        let existing = try db.query("SELECT id FROM possessions WHERE id = ?", [.string(normalized.id)])
        if existing.isEmpty {
            try insert(normalized)
        } else {
            try update(normalized)
        }
        try replaceProvenance(for: normalized)
        try replaceImageAssets(for: normalized)
    }

    public func delete(id: String) throws {
        try db.execute("DELETE FROM possessions WHERE id = ?", [.string(id)])
    }

    public func createEmptySchema() throws {
        try db.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                normalized_name TEXT NOT NULL UNIQUE
            )
            """)
        try db.execute("""
            CREATE TABLE IF NOT EXISTS possessions (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                brand TEXT,
                model TEXT,
                category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
                sub_category TEXT,
                status TEXT CHECK (status IS NULL OR status IN ('in_use', 'owned', 'wishlist', 'disposed', 'retired')),
                is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
                acquired_date TEXT CHECK (acquired_date IS NULL OR acquired_date = date(acquired_date)),
                retired_date TEXT CHECK (retired_date IS NULL OR retired_date = date(retired_date)),
                price_cents INTEGER,
                sell_price_cents INTEGER,
                net_value_cents INTEGER,
                url TEXT,
                notes TEXT,
                serial_number TEXT,
                size TEXT,
                color TEXT,
                placement TEXT,
                artist TEXT,
                daily_cost_cents INTEGER,
                days_owned INTEGER,
                amount REAL,
                amount_unit TEXT,
                possession_type TEXT
            )
            """)
        try db.execute("CREATE TABLE IF NOT EXISTS possession_provenance (possession_id TEXT PRIMARY KEY NOT NULL REFERENCES possessions(id) ON DELETE CASCADE, source_table TEXT, source_row_id INTEGER, metadata_json TEXT)")
        try db.execute("""
            CREATE TABLE IF NOT EXISTS possession_images (
                id TEXT PRIMARY KEY NOT NULL,
                possession_id TEXT NOT NULL REFERENCES possessions(id) ON DELETE CASCADE,
                path TEXT NOT NULL,
                display_order INTEGER NOT NULL DEFAULT 0,
                alt_text TEXT,
                original_filename TEXT,
                UNIQUE (possession_id, display_order)
            )
            """)
        try db.execute("CREATE TABLE IF NOT EXISTS possessions_quarantine (id INTEGER PRIMARY KEY AUTOINCREMENT, original_table TEXT NOT NULL, original_id TEXT, payload_json TEXT NOT NULL, reason TEXT NOT NULL, quarantined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')))")
        try db.execute("CREATE TABLE IF NOT EXISTS possessions_containers (id TEXT PRIMARY KEY NOT NULL, possession_id TEXT NOT NULL REFERENCES possessions(id) ON DELETE CASCADE, type TEXT, label TEXT NOT NULL, tare_weight_g REAL)")
        try db.execute("CREATE TABLE IF NOT EXISTS possessions_usage (id TEXT PRIMARY KEY NOT NULL, possession_id TEXT NOT NULL REFERENCES possessions(id) ON DELETE CASCADE, container_id TEXT REFERENCES possessions_containers(id) ON DELETE SET NULL, type TEXT NOT NULL, timestamp TEXT, amount REAL, amount_unit TEXT, method TEXT, start_date TEXT, end_date TEXT)")
        try db.execute("CREATE TABLE IF NOT EXISTS possessions_usage_log (id TEXT PRIMARY KEY NOT NULL, container_id TEXT REFERENCES possessions_containers(id) ON DELETE SET NULL, type TEXT NOT NULL, timestamp TEXT, amount REAL, amount_per_day REAL, start_date TEXT, end_date TEXT)")
        try db.execute("CREATE TABLE IF NOT EXISTS possessions_acquisition (id TEXT PRIMARY KEY NOT NULL, possession_id TEXT NOT NULL REFERENCES possessions(id) ON DELETE CASCADE, value_cents INTEGER, timestamp TEXT NOT NULL)")
        try migrateSchema()
    }

    private func insert(_ p: Possession) throws {
        try db.execute("""
            INSERT INTO possessions (
                id, name, brand, model, category_id, sub_category, status, is_archived,
                acquired_date, retired_date, price_cents, sell_price_cents, net_value_cents,
                url, notes, serial_number, size, color, placement, artist, daily_cost_cents,
                days_owned, amount, amount_unit, possession_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, values(of: p))
    }

    private func update(_ p: Possession) throws {
        var params = values(of: p)
        params.removeFirst()
        params.append(.string(p.id))
        try db.execute("""
            UPDATE possessions SET
                name=?, brand=?, model=?, category_id=?, sub_category=?, status=?, is_archived=?,
                acquired_date=?, retired_date=?, price_cents=?, sell_price_cents=?, net_value_cents=?,
                url=?, notes=?, serial_number=?, size=?, color=?, placement=?, artist=?, daily_cost_cents=?,
                days_owned=?, amount=?, amount_unit=?, possession_type=?
            WHERE id=?
            """, params)
    }

    private func values(of p: Possession) -> [SQLValue] {
        func text(_ value: String) -> SQLValue { value.isEmpty ? .null : .string(value) }
        func optionalText(_ value: String?) -> SQLValue { value.map(text) ?? .null }
        return [
            .string(p.id), text(p.name), text(p.brand), text(p.model), optionalText(p.categoryID), text(p.subCategory),
            optionalText(p.status), .integer(p.isArchived ? 1 : 0), optionalText(p.acquiredOn?.value), optionalText(p.retiredOn?.value),
            p.priceCents.map(SQLValue.integer) ?? .null, p.sellPriceCents.map(SQLValue.integer) ?? .null, p.netValueCents.map(SQLValue.integer) ?? .null,
            text(p.url), text(p.notes), text(p.serialNumber), text(p.size), text(p.color), text(p.placement), text(p.artist),
            p.dailyCostCents.map(SQLValue.integer) ?? .null, p.daysOwnedValue.map { .integer(Int64($0)) } ?? .null,
            p.amountValue.map(SQLValue.double) ?? .null, text(p.amountUnit), text(p.possessionType),
        ]
    }

    private func ensureCategory(named name: String) throws -> String? {
        let normalized = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return nil }
        if let existing = try db.query("SELECT id FROM categories WHERE normalized_name = ?", [.string(normalized)]).first?["id"] as? String {
            return existing
        }
        let id = "category-\(UUIDv7.generate())"
        try db.execute("INSERT INTO categories (id, name, normalized_name) VALUES (?, ?, ?)", [.string(id), .string(name.trimmingCharacters(in: .whitespacesAndNewlines)), .string(normalized)])
        return id
    }

    private func replaceProvenance(for p: Possession) throws {
        try db.execute("DELETE FROM possession_provenance WHERE possession_id = ?", [.string(p.id)])
        guard let provenance = p.provenance else { return }
        try db.execute("INSERT INTO possession_provenance (possession_id, source_table, source_row_id, metadata_json) VALUES (?, ?, ?, ?)", [
            .string(p.id), provenance.sourceTable.isEmpty ? .null : .string(provenance.sourceTable), Int64(provenance.sourceRowID).map(SQLValue.integer) ?? .null, provenance.metadataJSON.isEmpty ? .null : .string(provenance.metadataJSON)
        ])
    }

    private func replaceImageAssets(for p: Possession) throws {
        try db.execute("DELETE FROM possession_images WHERE possession_id = ?", [.string(p.id)])
        for (index, originalAsset) in p.imageAssets.enumerated() {
            var asset = originalAsset
            asset.possessionID = p.id
            asset.displayOrder = index
            try db.execute("INSERT INTO possession_images (id, possession_id, path, display_order, alt_text, original_filename) VALUES (?, ?, ?, ?, ?, ?)", [
                .string(asset.id), .string(p.id), .string(asset.path), .integer(Int64(index)), asset.altText.isEmpty ? .null : .string(asset.altText), asset.originalFilename.isEmpty ? .null : .string(asset.originalFilename)
            ])
        }
    }

    private static func optionalString(_ value: Any?) -> String? {
        guard let value, !(value is NSNull) else { return nil }
        if let string = value as? String { return string }
        return String(describing: value)
    }

    private static func stringValue(_ value: Any?) -> String { optionalString(value) ?? "" }

    private static func intValue(_ value: Any?) -> Int64 {
        if let value = value as? Int64 { return value }
        if let value = value as? Int { return Int64(value) }
        if let value = value as? Double { return Int64(value) }
        if let value = value as? String { return Int64(value) ?? 0 }
        return 0
    }

    private static func optionalInt(_ value: Any?) -> Int64? {
        guard !(value is NSNull), value != nil else { return nil }
        return intValue(value)
    }

    private static func optionalDouble(_ value: Any?) -> Double? {
        if let value = value as? Double { return value }
        if let value = value as? Int64 { return Double(value) }
        if let value = value as? String { return Double(value) }
        return nil
    }

    private static func boolValue(_ value: Any?) -> Bool { intValue(value) != 0 }

    private static func localDate(_ value: Any?) -> LocalDate? { optionalString(value).flatMap(LocalDate.init) }
}