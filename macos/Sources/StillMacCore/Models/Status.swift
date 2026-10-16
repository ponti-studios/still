import Foundation

/// Lifecycle status: one mutually exclusive value per possession.
public enum Status: String, CaseIterable, Identifiable, Hashable {
    case inUse = "in_use"
    case owned = "owned"
    case wishlist = "wishlist"
    case disposed = "disposed"
    case retired = "retired"

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .inUse: return "In Use"
        case .owned: return "Owned"
        case .wishlist: return "Wishlist"
        case .disposed: return "Disposed"
        case .retired: return "Retired"
        }
    }

    public var systemImage: String {
        switch self {
        case .inUse: return "figure.walk"
        case .owned: return "checkmark.circle"
        case .wishlist: return "star"
        case .disposed: return "trash"
        case .retired: return "xmark.circle"
        }
    }

    public var tintColor: String {
        switch self {
        case .inUse: return "green"
        case .owned: return "blue"
        case .wishlist: return "yellow"
        case .disposed: return "red"
        case .retired: return "purple"
        }
    }
}