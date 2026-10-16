import Foundation

/// Reads and writes a StillCore cache row (the API-shaped JSON the shared store
/// hands back) as the Mac app's `Possession`. It mirrors `src/core/mapping.ts`
/// on the React Native side, so both clients agree on which row field backs
/// which screen field.
///
/// Hominem is the source of truth and does not model every field the Mac editor
/// shows, so the extras (artist, net value, the SQLite import provenance, …)
/// live in the row's `metadata` object. Nothing is lost when a record moves
/// between the two apps.
public enum PossessionCache {
    /// The metadata keys the apps agree on. `imageUrl` is shared with React
    /// Native; the rest are the Mac app's own.
    static let imageUrlKey = "imageUrl"
    static let artistKey = "artist"
    static let possessionTypeKey = "possessionType"
    static let netValueKey = "netValueCents"
    static let dailyCostKey = "dailyCostCents"
    static let daysOwnedKey = "daysOwned"
    static let amountKey = "amount"
    static let amountUnitKey = "amountUnit"
    static let sourceTableKey = "importedFrom"
    static let sourceRowKey = "sourceRowId"

    public enum Failure: Error, LocalizedError {
        case invalidMetadata

        public var errorDescription: String? {
            switch self {
            case .invalidMetadata:
                return "Metadata must be a JSON object. Fix it, then save again."
            }
        }
    }

    // MARK: - Reads

    /// Builds a possession from one cache row. Missing values read as empty, so
    /// a partial row (a just-created optimistic row) still renders.
    public static func possession(from row: [String: Any]) -> Possession {
        let stored = string(row, "status")
        let archived = bool(row, "isArchived") ?? false
        let metadata = object(row, "metadata")

        var possession = Possession(id: string(row, "id") ?? "")
        possession.name = string(row, "name") ?? ""
        possession.brand = string(row, "brand") ?? ""
        possession.model = string(row, "model") ?? ""
        possession.categoryName = string(row, "category") ?? ""
        possession.categoryID = string(row, "categoryId")
        possession.subCategory = string(row, "subCategory") ?? ""
        possession.status = PossessionStatusMapping.lifecycle(status: stored, isArchived: archived).rawValue
        possession.isArchived = PossessionStatusMapping.isArchived(status: stored, isArchived: archived)
        possession.acquiredDate = string(row, "acquiredDate") ?? ""
        possession.retiredDate = string(row, "retiredDate") ?? ""
        possession.priceCents = int64(row, "priceCents")
        possession.sellPriceCents = int64(row, "sellPriceCents")
        possession.url = string(row, "url") ?? ""
        possession.notes = string(row, "notes") ?? ""
        possession.serialNumber = string(row, "serialNumber") ?? ""
        possession.size = string(row, "size") ?? ""
        possession.color = string(row, "color") ?? ""
        possession.placement = string(row, "placement") ?? ""

        possession.metadata = text(metadata)
        possession.artist = string(metadata, artistKey) ?? ""
        possession.possessionType = string(metadata, possessionTypeKey) ?? ""
        possession.netValueCents = int64(metadata, netValueKey)
        possession.dailyCostCents = int64(metadata, dailyCostKey)
        possession.daysOwnedValue = int(metadata, daysOwnedKey)
        possession.amountValue = double(metadata, amountKey)
        possession.amountUnit = string(metadata, amountUnitKey) ?? ""
        possession.sourceTable = string(metadata, sourceTableKey) ?? ""
        possession.sourceRowID = string(metadata, sourceRowKey) ?? ""
        possession.imageUrl = string(metadata, imageUrlKey) ?? ""
        return possession
    }

    /// The managed categories the API returned, as records. They arrive beside
    /// the rows rather than on them.
    public static func categories(from payload: [String: Any]) -> [Category] {
        guard let rows = payload["categories"] as? [[String: Any]] else { return [] }
        return rows.compactMap(category(from:))
    }

    public static func category(from row: [String: Any]) -> Category? {
        guard let id = string(row, "id"), let name = string(row, "name") else { return nil }
        return Category(id: id, name: name)
    }

    /// The categories in use, for when the API has not handed back the managed
    /// records yet. Names unique case-insensitively, first spelling wins, which
    /// is the rule Hominem enforces (`lower(btrim(name))`).
    public static func categories(inUse items: [Possession]) -> [Category] {
        var seen = Set<String>()
        var categories: [Category] = []
        for item in items {
            let name = item.categoryName.trimmingCharacters(in: .whitespaces)
            guard !name.isEmpty, seen.insert(name.lowercased()).inserted else { continue }
            categories.append(Category(id: name, name: name))
        }
        return categories.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    // MARK: - Writes

    /// The API request body for a create or an update. The whole row is sent, so
    /// a saved edit cannot leave a stale field behind.
    ///
    /// The metadata object starts as the person's JSON text — keys the Mac app
    /// does not model (`vendor`, anything a later version adds) are carried
    /// through — and the form fields overlay the keys they own.
    public static func writePayload(for possession: Possession) throws -> [String: Any] {
        var metadata = try parseObject(possession.metadata)
        set(&metadata, artistKey, string: possession.artist)
        set(&metadata, possessionTypeKey, string: possession.possessionType)
        set(&metadata, netValueKey, int64: possession.netValueCents)
        set(&metadata, dailyCostKey, int64: possession.dailyCostCents)
        set(&metadata, daysOwnedKey, int: possession.daysOwnedValue)
        set(&metadata, amountKey, double: possession.amountValue)
        set(&metadata, amountUnitKey, string: possession.amountUnit)
        set(&metadata, sourceTableKey, string: possession.sourceTable)
        set(&metadata, sourceRowKey, string: possession.sourceRowID)
        set(&metadata, imageUrlKey, string: possession.imageUrl.isEmpty ? nil : possession.imageUrl)

        let status = Status(rawValue: possession.status ?? "") ?? .owned
        return [
            "name": possession.name,
            "status": status.rawValue,
            "isArchived": possession.isArchived,
            "category": nullable(possession.categoryName),
            "subCategory": nullable(possession.subCategory),
            "brand": nullable(possession.brand),
            "model": nullable(possession.model),
            "acquiredDate": nullable(possession.acquiredDate),
            "retiredDate": nullable(possession.retiredDate),
            "priceCents": number(possession.priceCents),
            "sellPriceCents": number(possession.sellPriceCents),
            "url": nullable(possession.url),
            "notes": nullable(possession.notes),
            "serialNumber": nullable(possession.serialNumber),
            "size": nullable(possession.size),
            "color": nullable(possession.color),
            "placement": nullable(possession.placement),
            "metadata": metadata,
        ]
    }

    // MARK: - JSON helpers

    static func text(_ object: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(
            withJSONObject: object, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
        else { return "{}" }
        return String(data: data, encoding: .utf8) ?? "{}"
    }

    /// Parses the metadata text into an object. Empty text is an empty object;
    /// anything else that is not a JSON object is a mistake the person can fix.
    static func parseObject(_ text: String) throws -> [String: Any] {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [:] }
        guard let data = trimmed.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { throw Failure.invalidMetadata }
        return object
    }

    /// Sets the key when there is a value, removes it otherwise, so the object
    /// stays clean rather than filling with nulls.
    private static func set(_ object: inout [String: Any], _ key: String, string value: String?) {
        let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if trimmed.isEmpty { object.removeValue(forKey: key) } else { object[key] = trimmed }
    }

    private static func set(_ object: inout [String: Any], _ key: String, int value: Int?) {
        if let value { object[key] = value } else { object.removeValue(forKey: key) }
    }

    private static func set(_ object: inout [String: Any], _ key: String, int64 value: Int64?) {
        if let value { object[key] = value } else { object.removeValue(forKey: key) }
    }

    private static func set(_ object: inout [String: Any], _ key: String, double value: Double?) {
        if let value { object[key] = value } else { object.removeValue(forKey: key) }
    }

    private static func nullable(_ text: String) -> Any {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? NSNull() : trimmed
    }

    private static func number(_ value: Int64?) -> Any {
        if let value { return value }
        return NSNull()
    }

    private static func value(_ row: [String: Any], _ key: String) -> Any? {
        guard let found = row[key], !(found is NSNull) else { return nil }
        return found
    }

    private static func string(_ row: [String: Any], _ key: String) -> String? {
        guard let text = value(row, key) as? String, !text.isEmpty else { return nil }
        return text
    }

    private static func int(_ row: [String: Any], _ key: String) -> Int? {
        (value(row, key) as? NSNumber)?.intValue
    }

    private static func int64(_ row: [String: Any], _ key: String) -> Int64? {
        (value(row, key) as? NSNumber)?.int64Value
    }

    private static func double(_ row: [String: Any], _ key: String) -> Double? {
        (value(row, key) as? NSNumber)?.doubleValue
    }

    private static func bool(_ row: [String: Any], _ key: String) -> Bool? {
        (value(row, key) as? NSNumber)?.boolValue
    }

    private static func object(_ row: [String: Any], _ key: String) -> [String: Any] {
        (value(row, key) as? [String: Any]) ?? [:]
    }
}
