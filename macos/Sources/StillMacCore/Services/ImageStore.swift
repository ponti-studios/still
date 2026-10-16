import Foundation
import AppKit

/// Copies possession images into `~/Documents/possessions/<possession-id>/` and
/// stores managed asset references in the ordered `possession_images` table.
/// The legacy `image_url` column remains as a migration/compatibility field.
public enum ImageStore {
    static let folderName = "possessions"

    public static func directory(for possessionID: String) -> URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory() + "/Documents")
        return docs
            .appendingPathComponent(folderName)
            .appendingPathComponent(possessionID, isDirectory: true)
    }

    public static var rootDirectory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            .appendingPathComponent(folderName, isDirectory: true)
    }

    public static func removeImage(at path: String, for possessionID: String) throws {
        let directoryURL = directory(for: possessionID).standardizedFileURL
        let fileURL = resolvedURL(for: path).standardizedFileURL
        guard fileURL.path.hasPrefix(directoryURL.path + "/") else { return }
        if FileManager.default.fileExists(atPath: fileURL.path) {
            try FileManager.default.removeItem(at: fileURL)
        }
    }

    /// Copies a source file into the possession's folder, de-duplicating names.
    @discardableResult
    public static func importImage(from sourceURL: URL, into possessionID: String) throws -> String {
        let dir = directory(for: possessionID)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        let ext = sourceURL.pathExtension.isEmpty ? "jpeg" : sourceURL.pathExtension
        var destination = dir.appendingPathComponent("\(UUIDv7.generate()).\(ext)")
        var counter = 1
        while FileManager.default.fileExists(atPath: destination.path) {
            destination = dir.appendingPathComponent("\(UUIDv7.generate())-\(counter).\(ext)")
            counter += 1
        }

        // Handle security-scoped URLs from file importers.
        let didStartAccess = sourceURL.startAccessingSecurityScopedResource()
        defer { if didStartAccess { sourceURL.stopAccessingSecurityScopedResource() } }

        try FileManager.default.copyItem(at: sourceURL, to: destination)
        return "\(possessionID)/\(destination.lastPathComponent)"
    }

    public static func imageExists(at path: String) -> Bool {
        FileManager.default.fileExists(atPath: resolvedURL(for: path).path)
    }

    public static func thumbnail(from path: String, maxDimension: CGFloat = 320) -> NSImage? {
        guard imageExists(at: path), let image = NSImage(contentsOf: resolvedURL(for: path)) else { return nil }
        return downsample(image, maxDimension: maxDimension)
    }

    private static func resolvedURL(for path: String) -> URL {
        let url = URL(fileURLWithPath: path)
        if url.path.hasPrefix("/") {
            return url
        }
        return rootDirectory.appendingPathComponent(path)
    }

    private static func downsample(_ image: NSImage, maxDimension: CGFloat) -> NSImage {
        let size = image.size
        guard size.width > maxDimension || size.height > maxDimension else { return image }
        let scale = maxDimension / max(size.width, size.height)
        let newSize = NSSize(width: round(size.width * scale), height: round(size.height * scale))
        let resized = NSImage(size: newSize)
        resized.lockFocus()
        NSGraphicsContext.current?.imageInterpolation = .high
        image.draw(in: NSRect(origin: .zero, size: newSize),
                   from: NSRect(origin: .zero, size: size),
                   operation: .copy, fraction: 1.0)
        resized.unlockFocus()
        return resized
    }
}