import SwiftUI
import StillMacCore

/// Asynchronously loads and downsamples a possession image for display.
struct PossessionImage: View {
    let path: String
    @State private var image: NSImage?
    @State private var loadFailed = false

    var body: some View {
        ZStack {
            if let image {
                Image(nsImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else if loadFailed {
                ContentUnavailableView("Image Unavailable", systemImage: "photo.slash")
            } else {
                Rectangle()
                    .fill(.white.opacity(0.08))
                ProgressView()
                    .controlSize(.small)
            }
        }
        .task(id: path) {
            image = nil
            loadFailed = false
            let loadedImage = await Task.detached(priority: .utility) {
                ImageStore.thumbnail(from: path)
            }.value
            guard !Task.isCancelled else { return }
            image = loadedImage
            loadFailed = loadedImage == nil
        }
        .accessibilityLabel(loadFailed ? "Image unavailable" : "Possession image")
    }
}
