import Foundation

/// A managed category record with a case-insensitive unique name.
public struct Category: Identifiable, Hashable {
    public var id: String
    public var name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

public struct PossessionProvenance: Hashable {
    public var sourceTable: String = ""
    public var sourceRowID: String = ""
    public var metadataJSON: String = ""

    public init(sourceTable: String = "", sourceRowID: String = "", metadataJSON: String = "") {
        self.sourceTable = sourceTable
        self.sourceRowID = sourceRowID
        self.metadataJSON = metadataJSON
    }
}

/// A calendar date stored as an ISO `YYYY-MM-DD` string.
public struct LocalDate: Hashable {
    public var value: String

    public init?(_ value: String) {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let date = Self.formatter.date(from: trimmed),
              Self.formatter.string(from: date) == trimmed else { return nil }
        self.value = trimmed
    }

    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

/// Money stored as integer cents.
public struct Money: Hashable {
    public var cents: Int64

    public var amount: Double { Double(cents) / 100.0 }

    public var display: String {
        amount.formatted(.currency(code: "USD"))
    }

    public init?(text: String) {
        let cleaned = text
            .replacingOccurrences(of: "$", with: "")
            .replacingOccurrences(of: ",", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty, let value = Double(cleaned), value.isFinite else { return nil }
        cents = Int64((value * 100.0).rounded())
    }

    public init(cents: Int64) {
        self.cents = cents
    }
}

public struct PossessionImageAsset: Identifiable, Hashable {
    public var id: String
    public var possessionID: String
    public var path: String
    public var displayOrder: Int
    public var altText: String = ""
    public var originalFilename: String = ""

    public init(id: String, possessionID: String, path: String, displayOrder: Int, altText: String = "", originalFilename: String = "") {
        self.id = id
        self.possessionID = possessionID
        self.path = path
        self.displayOrder = displayOrder
        self.altText = altText
        self.originalFilename = originalFilename
    }
}

public struct Possession: Identifiable, Hashable {
    public var id: String
    public var name: String = ""
    public var brand: String = ""
    public var model: String = ""
    public var categoryID: String?
    public var categoryName: String = ""
    public var subCategory: String = ""
    public var status: String?
    public var isArchived: Bool = false
    public var acquiredOn: LocalDate?
    public var retiredOn: LocalDate?
    public var priceCents: Int64?
    public var sellPriceCents: Int64?
    public var netValueCents: Int64?
    public var url: String = ""
    public var imageAssets: [PossessionImageAsset] = []
    public var notes: String = ""
    public var serialNumber: String = ""
    public var size: String = ""
    public var color: String = ""
    public var placement: String = ""
    public var artist: String = ""
    public var dailyCostCents: Int64?
    public var daysOwnedValue: Int?
    public var amountValue: Double?
    public var amountUnit: String = ""
    public var possessionType: String = ""
    public var provenance: PossessionProvenance?

    public init(id: String) {
        self.id = id
    }

    public var category: String {
        get { categoryName }
        set { categoryName = newValue }
    }

    public var acquiredDate: String {
        get { acquiredOn?.value ?? "" }
        set { acquiredOn = LocalDate(newValue) }
    }

    public var retiredDate: String {
        get { retiredOn?.value ?? "" }
        set { retiredOn = LocalDate(newValue) }
    }

    public var price: String {
        get { priceCents.map { Money(cents: $0).display } ?? "" }
        set { priceCents = Money(text: newValue)?.cents }
    }

    public var sellPrice: String {
        get { sellPriceCents.map { Money(cents: $0).display } ?? "" }
        set { sellPriceCents = Money(text: newValue)?.cents }
    }

    public var netValue: String {
        get { netValueCents.map { Money(cents: $0).display } ?? "" }
        set { netValueCents = Money(text: newValue)?.cents }
    }

    public var dailyCost: String {
        get { dailyCostCents.map { Money(cents: $0).display } ?? "" }
        set { dailyCostCents = Money(text: newValue)?.cents }
    }

    public var daysOwned: String {
        get { daysOwnedValue.map(String.init) ?? "" }
        set { daysOwnedValue = Int(newValue.trimmingCharacters(in: .whitespacesAndNewlines)) }
    }

    public var amount: String {
        get { amountValue.map { String(describing: $0) } ?? "" }
        set { amountValue = Double(newValue.trimmingCharacters(in: .whitespacesAndNewlines)) }
    }

    public var sourceTable: String {
        get { provenance?.sourceTable ?? "" }
        set { updateProvenance { $0.sourceTable = newValue } }
    }

    public var sourceRowID: String {
        get { provenance?.sourceRowID ?? "" }
        set { updateProvenance { $0.sourceRowID = newValue } }
    }

    public var metadata: String {
        get { provenance?.metadataJSON ?? "" }
        set { updateProvenance { $0.metadataJSON = newValue } }
    }

    public var imageUrl: String {
        get { imagePaths.joined(separator: ", ") }
        set {
            imageAssets = newValue.split(separator: ",").enumerated().map { index, path in
                PossessionImageAsset(
                    id: UUIDv7.generate(), possessionID: id, path: path.trimmingCharacters(in: .whitespacesAndNewlines), displayOrder: index
                )
            }
        }
    }

    public var statusValue: Status? {
        get { status.flatMap(Status.init(rawValue:)) }
        set { status = newValue?.rawValue }
    }

    public var imagePaths: [String] {
        imageAssets.sorted { $0.displayOrder < $1.displayOrder }.map(\.path)
    }

    public var priceValue: Double? { priceCents.map { Double($0) / 100.0 } }
    public var netValueValue: Double? { netValueCents.map { Double($0) / 100.0 } }

    public var displaySubtitle: String {
        [brand, categoryName, subCategory]
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    private mutating func updateProvenance(_ update: (inout PossessionProvenance) -> Void) {
        var value = provenance ?? PossessionProvenance()
        update(&value)
        provenance = value.sourceTable.isEmpty && value.sourceRowID.isEmpty && value.metadataJSON.isEmpty ? nil : value
    }
}