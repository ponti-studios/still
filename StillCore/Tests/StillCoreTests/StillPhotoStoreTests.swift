import Foundation
import Testing

@testable import StillCore

@Suite struct StillPhotoStoreTests {
  /// A throwaway photo folder with one source file waiting in it.
  private func setup() throws -> (store: LocalPhotoStore, dir: URL, source: URL) {
    let dir = FileManager.default.temporaryDirectory
      .appendingPathComponent("StillPhotoTests-\(UUID().uuidString)", isDirectory: true)
    let store = try LocalPhotoStore(directory: dir)
    let source = dir.appendingPathComponent("picked.jpg")
    try Data("jpeg-bytes".utf8).write(to: source)
    return (store, dir, source)
  }

  private func teardown(_ dir: URL) {
    try? FileManager.default.removeItem(at: dir)
  }

  @Test func saveCopiesIntoItsOwnFolder() throws {
    let (store, dir, source) = try setup()
    defer { teardown(dir) }

    let stored = try store.savePhoto(from: source, filename: "item-photo-1.jpg")

    #expect(stored.isFileURL)
    #expect(stored.lastPathComponent == "item-photo-1.jpg")
    let bytes = try String(contentsOf: stored, encoding: .utf8)
    #expect(bytes == "jpeg-bytes")
    // The pick itself is untouched: the store copies, never moves.
    #expect(FileManager.default.fileExists(atPath: source.path))
  }

  @Test func saveRefusesNonFileURLs() throws {
    let (store, dir, _) = try setup()
    defer { teardown(dir) }

    #expect(throws: StillProblem.other) {
      try store.savePhoto(from: URL(string: "https://cdn/x.jpg")!, filename: "x.jpg")
    }
  }

  @Test func saveNeverOverwrites() throws {
    let (store, dir, source) = try setup()
    defer { teardown(dir) }

    let first = try store.savePhoto(from: source, filename: "item-photo-1.jpg")
    let second = try store.savePhoto(from: source, filename: "item-photo-1.jpg")

    #expect(first.lastPathComponent == "item-photo-1.jpg")
    #expect(second.lastPathComponent == "item-photo-1-2.jpg")
    #expect(FileManager.default.fileExists(atPath: first.path))
    #expect(FileManager.default.fileExists(atPath: second.path))
  }

  @Test func deleteRemovesAndForgivesTheMissing() throws {
    let (store, dir, source) = try setup()
    defer { teardown(dir) }

    let stored = try store.savePhoto(from: source, filename: "item-photo-1.jpg")
    store.deletePhoto(at: stored)
    #expect(!FileManager.default.fileExists(atPath: stored.path))
    // Twice, and a stranger's URL: nothing thrown, ever.
    store.deletePhoto(at: stored)
    store.deletePhoto(at: URL(string: "https://cdn/x.jpg")!)
  }
}
