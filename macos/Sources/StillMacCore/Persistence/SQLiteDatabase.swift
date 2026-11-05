import Foundation
import SQLite3

public enum DatabaseError: LocalizedError {
    case openFailed(String)
    case prepareFailed(String)
    case stepFailed(String)
    case bindFailed(String)
    case schemaMissing
    case invalidSchema(String)

    public var errorDescription: String? {
        switch self {
        case .openFailed(let m): return "Failed to open database: \(m)"
        case .prepareFailed(let m): return "Failed to prepare statement: \(m)"
        case .stepFailed(let m): return "Query failed: \(m)"
        case .bindFailed(let m): return "Failed to bind value: \(m)"
        case .schemaMissing: return "The selected database has no 'possessions' table."
        case .invalidSchema(let message): return "The selected database has an invalid schema: \(message)"
        }
    }
}

/// Minimal thread-confined wrapper around the system SQLite3 C API.
public final class SQLiteDatabase {
    private var handle: OpaquePointer?
    public let path: String

    public init(path: String) throws {
        self.path = path
        let result = sqlite3_open(path, &handle)
        guard result == SQLITE_OK, let handle else {
            throw DatabaseError.openFailed(String(cString: sqlite3_errmsg(handle)))
        }
        sqlite3_busy_timeout(handle, 3000)
        try execute("PRAGMA foreign_keys = ON")
    }

    deinit {
        sqlite3_close(handle)
    }

    public func hasTable(_ name: String) throws -> Bool {
        let sql = "SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?"
        let rows = try query(sql, [.string(name)])
        guard let first = rows.first, let count = first["count(*)"] as? Int64 else {
            return false
        }
        return count > 0
    }

    /// Prepare, bind, step, and collect all rows. Values are String, Int64, Double, or NSNull.
    func query(_ sql: String, _ parameters: [SQLValue] = []) throws -> [[String: Any]] {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(handle)))
        }
        defer { sqlite3_finalize(stmt) }

        try bind(parameters, into: stmt)
        var results: [[String: Any]] = []
        while true {
            let stepResult = sqlite3_step(stmt)
            if stepResult == SQLITE_DONE { break }
            guard stepResult == SQLITE_ROW else {
                throw DatabaseError.stepFailed(String(cString: sqlite3_errmsg(handle)))
            }
            var row: [String: Any] = [:]
            let columnCount = sqlite3_column_count(stmt)
            for index in 0..<columnCount {
                let name = String(cString: sqlite3_column_name(stmt, index))
                switch sqlite3_column_type(stmt, index) {
                case SQLITE_INTEGER:
                    row[name] = sqlite3_column_int64(stmt, index)
                case SQLITE_FLOAT:
                    row[name] = sqlite3_column_double(stmt, index)
                case SQLITE_TEXT:
                    row[name] = String(cString: sqlite3_column_text(stmt, index))
                case SQLITE_NULL:
                    row[name] = NSNull()
                default:
                    row[name] = NSNull()
                }
            }
            results.append(row)
        }
        return results
    }

    func execute(_ sql: String, _ parameters: [SQLValue] = []) throws {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(handle)))
        }
        defer { sqlite3_finalize(stmt) }
        try bind(parameters, into: stmt)
        let stepResult = sqlite3_step(stmt)
        guard stepResult == SQLITE_DONE else {
            throw DatabaseError.stepFailed(String(cString: sqlite3_errmsg(handle)))
        }
    }

    private func bind(_ parameters: [SQLValue], into stmt: OpaquePointer?) throws {
        for (index, value) in parameters.enumerated() {
            let paramIndex = Int32(index + 1)
            let result: Int32
            switch value {
            case .string(let text):
                result = sqlite3_bind_text(stmt, paramIndex, text, -1, SQLITE_TRANSIENT)
            case .integer(let number):
                result = sqlite3_bind_int64(stmt, paramIndex, number)
            case .double(let number):
                result = sqlite3_bind_double(stmt, paramIndex, number)
            case .null:
                result = sqlite3_bind_null(stmt, paramIndex)
            }
            guard result == SQLITE_OK else {
                throw DatabaseError.bindFailed(String(cString: sqlite3_errmsg(handle)))
            }
        }
    }

    func lastInsertRowID() -> Int64 {
        sqlite3_last_insert_rowid(handle)
    }
}

/// Value types accepted for parameter binding.
enum SQLValue {
    case string(String)
    case integer(Int64)
    case double(Double)
    case null

    init(_ value: Any?) {
        if let value = value as? SQLValue { self = value; return }
        guard let value else { self = .null; return }
        if let value = value as? String { self = .string(value) }
        else if let value = value as? Int { self = .integer(Int64(value)) }
        else if let value = value as? Int64 { self = .integer(value) }
        else if let value = value as? Double { self = .double(value) }
        else if value is NSNull { self = .null }
        else { self = .null }
    }
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)