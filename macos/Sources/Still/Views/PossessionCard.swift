import SwiftUI
import StillMacCore

struct PossessionCard: View {
    let possession: Possession
    let isSelected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            thumbnail
                .frame(height: 140)
                .frame(maxWidth: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(possession.name)
                    .font(.headline)
                    .lineLimit(1)
                Text(possession.displaySubtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            HStack {
                StatusBadge(status: possession.statusValue)
                Spacer()
                if let price = possession.priceValue {
                    Text(price, format: .currency(code: "USD"))
                        .font(.callout.weight(.semibold))
                        .monospacedDigit()
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(.white.opacity(0.07))
        )
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(.ultraThinMaterial)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(isSelected ? Color.accentColor : .white.opacity(0.15), lineWidth: isSelected ? 2 : 1)
        }
        .glassEffect(.regular, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityName)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    @ViewBuilder
    private var thumbnail: some View {
        if let path = possession.imagePaths.first, ImageStore.imageExists(at: path) {
            PossessionImage(path: path)
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(LinearGradient(
                        colors: [.white.opacity(0.12), .white.opacity(0.04)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                Image(systemName: iconName)
                    .font(.system(size: 34, weight: .light))
                    .foregroundStyle(.white.opacity(0.35))
            }
        }
    }

    private var iconName: String {
        switch possession.category.lowercased() {
        case "technology": return "laptopcomputer"
        case "clothing": return "tshirt"
        case "accessories": return "watch"
        case "home", "furniture": return "house"
        case "kitchen": return "fork.knife"
        case "vehicle": return "car"
        case "sports equipment": return "figure.tennis"
        case "art": return "paintbrush"
        default: return "shippingbox"
        }
    }

    private var accessibilityName: String {
        let name = possession.name.isEmpty ? "Unnamed possession" : possession.name
        return possession.displaySubtitle.isEmpty ? name : name + ", " + possession.displaySubtitle
    }
}

struct StatusBadge: View {
    let status: Status?

    var body: some View {
        if let status {
            HStack(spacing: 4) {
                Circle()
                    .fill(statusColor(for: status))
                    .frame(width: 7, height: 7)
                Text(status.displayName)
                    .font(.caption2.weight(.medium))
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor(for: status).opacity(0.15), in: Capsule())
        } else {
            Text("No Status")
                .font(.caption2.weight(.medium))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(.secondary.opacity(0.12), in: Capsule())
        }
    }

    private func statusColor(for status: Status) -> Color {
        switch status {
        case .inUse: return .green
        case .owned: return .blue
        case .wishlist: return .orange
        case .disposed: return .red
        case .retired: return .purple
        }
    }
}
