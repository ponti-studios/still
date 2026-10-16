import Foundation
import SQLite3

/// Backups the source DB via SQLite's `VACUUM INTO` before destructive edits.
public enum BackupManager {
    public static func snapshot(databaseURL: URL) throws -> URL {
        let dir = databaseURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd-HHmmss-SSS"
        formatter.timeZone = TimeZone(identifier: "UTC")
        let stamp = formatter.string(from: Date())

        let baseName = databaseURL.deletingPathExtension().lastPathComponent
        let backupURL = dir.appendingPathComponent("\(baseName).possessions-backup-\(stamp).db")

        try dbBackup(from: databaseURL, to: backupURL)
        try copyImageAssets(to: backupURL.deletingPathExtension().appendingPathExtension("assets"))
        return backupURL
    }

    /// Restores a database backup and its sidecar assets into explicit destinations.
    /// Callers must provide the destinations so a restore cannot silently replace the active document.
    public static func restore(databaseBackupURL: URL, to destinationDatabaseURL: URL, assetsAt destinationAssetsURL: URL) throws {
        let fileManager = FileManager.default
        guard fileManager.fileExists(atPath: databaseBackupURL.path) else {
            throw DatabaseError.openFailed("Backup database does not exist")
        }

        try fileManager.createDirectory(at: destinationDatabaseURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        if fileManager.fileExists(atPath: destinationDatabaseURL.path) {
            try fileManager.removeItem(at: destinationDatabaseURL)
        }
        try fileManager.copyItem(at: databaseBackupURL, to: destinationDatabaseURL)

        let sourceAssetsURL = databaseBackupURL.deletingPathExtension().appendingPathExtension("assets")
        if fileManager.fileExists(atPath: sourceAssetsURL.path) {
            try fileManager.createDirectory(at: destinationAssetsURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            try mergeDirectory(source: sourceAssetsURL, into: destinationAssetsURL, fileManager: fileManager)
        }
    }

    private static func mergeDirectory(source: URL, into destination: URL, fileManager: FileManager) throws {
        try fileManager.createDirectory(at: destination, withIntermediateDirectories: true)
        for item in try fileManager.contentsOfDirectory(at: source, includingPropertiesForKeys: nil) {
            let target = destination.appendingPathComponent(item.lastPathComponent, isDirectory: item.hasDirectoryPath)
            var isDirectory: ObjCBool = false
            let exists = fileManager.fileExists(atPath: target.path, isDirectory: &isDirectory)
            if item.hasDirectoryPath {
                try mergeDirectory(source: item, into: target, fileManager: fileManager)
            } else {
                if exists { try fileManager.removeItem(at: target) }
                try fileManager.copyItem(at: item, to: target)
            }
        }
    }

    private static func copyImageAssets(to destination: URL) throws {
        let source = ImageStore.rootDirectory
        guard FileManager.default.fileExists(atPath: source.path) else { return }
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.copyItem(at: source, to: destination)
    }

    private static func dbBackup(from source: URL, to destination: URL) throws {
        // VACUUM INTO requires an sqlite handle; use the C API through a temp connection.
        try Self.vacuumInto(from: source, to: destination)
    }

    private static func vacuumInto(from source: URL, to destination: URL) throws {
        var handle: OpaquePointer?
        guard sqlite3_open(source.path, &handle) == SQLITE_OK, let handle else {
            throw DatabaseError.openFailed("Could not open source DB for backup")
        }
        defer { sqlite3_close(handle) }

        // Remove any existing destination first (VACUUM INTO fails if it exists).
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }

        let sql = "VACUUM INTO '\(destination.path.replacingOccurrences(of: "'", with: "''"))'"
        var errorPointer: UnsafeMutablePointer<CChar>?
        let rc = sqlite3_exec(handle, sql, nil, nil, &errorPointer)
        if rc != SQLITE_OK {
            let message = errorPointer.map { String(cString: $0) } ?? "unknown error"
            sqlite3_free(errorPointer)
            throw DatabaseError.stepFailed(message)
        }
    }
}