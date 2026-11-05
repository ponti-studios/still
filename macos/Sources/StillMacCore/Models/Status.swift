import Foundation

/// The one lifecycle Still and Hominem agree on (cross-platform merge, decision
/// 8). The raw values are what Hominem stores; the display names are Still's.
/// Archive is not a case here: it is the separate `isArchived` flag.
///
/// The canonical table is `docs/status-category-mapping.md`; Hominem's
/// `packages/db/src/services/possessions/status.ts` is the source.
public enum Status: String, CaseIterable, Identifiable, Hashable, Sendable {
    case wanted = "wishlist"
    case planned = "planned"
    case ordered = "ordered"
    case delivered = "delivered"
    case owned = "owned"

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .wanted: return "Wanted"
        case .planned: return "Planned"
        case .ordered: return "Ordered"
        case .delivered: return "Delivered"
        case .owned: return "Owned"
        }
    }

    public var systemImage: String {
        switch self {
        case .wanted: return "star"
        case .planned: return "calendar"
        case .ordered: return "shippingbox"
        case .delivered: return "shippingbox.fill"
        case .owned: return "checkmark.circle"
        }
    }

    public var tintColor: String {
        switch self {
        case .wanted: return "yellow"
        case .planned: return "blue"
        case .ordered: return "orange"
        case .delivered: return "teal"
        case .owned: return "blue"
        }
    }

    /// Reads a stored value onto the lifecycle. Values that mean archived
    /// (`retired`, `disposed`, `donated`, `sold`) and anything unrecognised
    /// return nil, so callers fall back to the default below.
    public init?(databaseValue: String?) {
        switch databaseValue?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "wishlist", "wanted": self = .wanted
        case "planned": self = .planned
        case "ordered": self = .ordered
        case "delivered": self = .delivered
        case "owned", "in_use": self = .owned
        default: return nil
        }
    }
}

/// The translations the table describes, in one place so the model and the
/// cache agree and a test can cover every value.
public enum PossessionStatusMapping {
    /// Stored values that mean "archived", whatever the lifecycle says.
    public static let endStates: Set<String> = ["retired", "disposed", "donated", "sold"]

    /// The lifecycle a row shows: an end state or an unrecognised value reads as
    /// `owned` (reads never hide a row).
    public static func lifecycle(status: String?, isArchived: Bool) -> Status {
        Status(databaseValue: status) ?? .owned
    }

    /// Whether a row counts as archived: the flag, or a legacy end-state value
    /// whose `is_archived` the migration backfilled.
    public static func isArchived(status: String?, isArchived: Bool) -> Bool {
        isArchived || endStates.contains(status?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "")
    }
}
