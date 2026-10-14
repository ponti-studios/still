import Foundation

/// Item photos live on the device, never on the server: plain files under Application Support.
/// An item carries only the local file URI; a missing file just shows the emoji fallback.
public protocol StillPhotoStore: Sendable {
  /// Copies a picked photo into Still's own folder. Returns the stored file URL.
  func savePhoto(from source: URL, filename: String) throws -> URL
  /// Removes a stored photo. Best effort: nothing thrown, ever.
  func deletePhoto(at stored: URL)
}

public struct LocalPhotoStore: StillPhotoStore {
  private let directory: URL

  public init() throws {
    let base = try FileManager.default.url(
      for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    directory = base.appendingPathComponent("Still/Photos", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  }

  /// Test seam: a photo folder anywhere (a temp dir, usually).
  internal init(directory: URL) throws {
    self.directory = directory
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  }

  public func savePhoto(from source: URL, filename: String) throws -> URL {
    guard source.isFileURL else { throw StillProblem.other }
    let safe = filename.replacingOccurrences(of: "/", with: "_")
    let stem = URL(fileURLWithPath: safe).deletingPathExtension().lastPathComponent
    let ext = URL(fileURLWithPath: safe).pathExtension
    var target = directory.appendingPathComponent(safe)
    // Timestamp names should be unique, but never overwrite a stranger.
    var n = 2
    while FileManager.default.fileExists(atPath: target.path) {
      let name = ext.isEmpty ? "\(stem)-\(n)" : "\(stem)-\(n).\(ext)"
      target = directory.appendingPathComponent(name)
      n += 1
    }
    try FileManager.default.copyItem(at: source, to: target)
    return target
  }

  public func deletePhoto(at stored: URL) {
    guard stored.isFileURL else { return }
    try? FileManager.default.removeItem(at: stored)
  }
}
