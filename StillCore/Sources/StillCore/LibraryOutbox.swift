import Foundation

// The client outbox: offline-capable writes that converge on Hominem without
// silent loss. RN and the Mac app share this one implementation; the React
// Native side only queues ops and re-reads the cache. See
// docs/cross-platform-merge.md (decision 7) and the sync contract for the
// server side.

/// A queued write. `entityId` is the client's own UUID for a create (also sent
/// as `externalId`, so re-sending is idempotent) and the server id otherwise.
/// `payload` is the API-shaped request body as JSON text.
public struct LibraryOp: Sendable, Equatable {
  public enum Entity: String, Sendable {
    case possession, container, collection, membership
    /// A possession's photo: the bytes live on the device until the outbox uploads them.
    /// The payload is `{localPath, mimetype, name, fileId?}`; `fileId` appears once the
    /// upload has landed, so a retry after a failed attach never uploads twice.
    case photo
  }
  public enum Kind: String, Sendable {
    case create, update, delete
  }

  public var id: String
  public var entity: Entity
  public var kind: Kind
  public var entityId: String
  public var payload: String
  public var createdAt: String
  public var attempts: Int

  public init(
    id: String, entity: Entity, kind: Kind, entityId: String, payload: String,
    createdAt: String, attempts: Int = 0
  ) {
    self.id = id
    self.entity = entity
    self.kind = kind
    self.entityId = entityId
    self.payload = payload
    self.createdAt = createdAt
    self.attempts = attempts
  }

  /// Membership ops carry the collection in the payload; every other entity
  /// is its own target. Used to coalesce a batch of edits into one request.
  public var collectionId: String? {
    guard entity == .membership else { return nil }
    return Self.object(payload)["collectionId"] as? String
  }

  /// Two ops are about the same target when entity, id and (for membership)
  /// collection all match.
  func targetsSame(as other: LibraryOp) -> Bool {
    entity == other.entity && entityId == other.entityId && collectionId == other.collectionId
  }

  static func object(_ payload: String) -> [String: Any] {
    guard let data = payload.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return [:] }
    return object
  }

  /// The clock for ordering ops and stamping optimistic rows.
  static func now() -> String { ISO8601DateFormatter().string(from: Date()) }

  /// `new` overlays `existing`; a missing key leaves the earlier value alone.
  static func merge(_ existing: String, _ new: String) -> String {
    var merged = object(existing)
    for (key, value) in object(new) { merged[key] = value }
    guard let data = try? JSONSerialization.data(withJSONObject: merged) else { return existing }
    return String(data: data, encoding: .utf8) ?? existing
  }
}

/// One row of `app.sync_tombstones`: something that disappeared server-side.
/// `collectionId` set means a membership link was removed; the entity lives on.
public struct LibraryTombstone: Sendable, Equatable {
  public enum Entity: String, Sendable {
    case possession, container, collection
    /// A membership link was removed (the entity itself survives).
    case collectionItem
  }

  public var entity: Entity
  public var entityId: String
  public var collectionId: String?

  public init(entity: Entity, entityId: String, collectionId: String?) {
    self.entity = entity
    self.entityId = entityId
    self.collectionId = collectionId
  }
}

/// The rows and tombstones a delta pull returned, ready to apply to the cache.
public struct LibraryDelta {
  public var possessions: [[String: Any]]
  public var containers: [[String: Any]]
  public var collections: [[String: Any]]
  public var membership: [(collectionId: String, entityId: String)]
  public var tombstones: [LibraryTombstone]

  public init(
    possessions: [[String: Any]], containers: [[String: Any]], collections: [[String: Any]],
    membership: [(collectionId: String, entityId: String)], tombstones: [LibraryTombstone]
  ) {
    self.possessions = possessions
    self.containers = containers
    self.collections = collections
    self.membership = membership
    self.tombstones = tombstones
  }
}

/// What a sync produced: the cache to show, and any notices (a rolled-back edit).
public struct LibrarySyncResult {
  public var payload: [String: Any]
  public var notices: [String]
}

/// Sends queued ops to Hominem, in order, keeping them until they land. A
/// network failure stops the flush (ops stay); a rejection drops that one op
/// and reports a notice, so a bad edit never silently disappears and never
/// retries forever.
public struct LibraryOutbox: Sendable {
  public struct Summary: Sendable, Equatable {
    public var notices: [String]
    public var hadRejection: Bool
  }

  public enum Outcome: Sendable, Equatable {
    /// Every op was sent or dropped; the cache is ready to pull.
    case done(Summary)
    /// The network or server was unavailable; ops are kept for the next try.
    case offline
  }

  private let service: StillAccountService
  private let store: StillLibraryStore

  public init(service: StillAccountService, store: StillLibraryStore) {
    self.service = service
    self.store = store
  }

  public func flush() async throws -> Outcome {
    var notices: [String] = []
    var hadRejection = false
    // Re-read each time: completing a create rewrites the ops that follow it.
    while let op = store.pendingOps().first {
      do {
        let serverId = try await send(op)
        if op.kind == .create, let serverId {
          store.completeCreate(op, serverId: serverId)
        } else {
          store.removeOp(id: op.id)
        }
      } catch let problem as StillProblem {
        switch problem {
        case .signedOut:
          throw problem
        case .noService:
          return .offline
        case .notFound where op.kind == .delete || op.entity == .photo:
          // Already gone: a delete is idempotent, and a photo for a possession that no
          // longer exists has nowhere to go.
          store.removeOp(id: op.id)
        case .rejected:
          store.removeOp(id: op.id)
          hadRejection = true
          notices.append("A change couldn’t be saved and was undone. Pull to refresh.")
        default:
          return .offline
        }
      }
    }
    return .done(Summary(notices: notices, hadRejection: hadRejection))
  }

  /// Sends one op and returns the new server id for a create, else nil.
  private func send(_ op: LibraryOp) async throws -> String? {
    switch (op.entity, op.kind) {
    case (.possession, .create):
      return try await createId(
        path: "/api/possessions/upsert", body: Self.withoutServerPhoto(op.payload))
    case (.possession, .update):
      _ = try await service.request(
        method: "PATCH", path: "/api/possessions/\(op.entityId)",
        body: Self.withoutServerPhoto(op.payload))
    case (.possession, .delete):
      _ = try await service.request(method: "DELETE", path: "/api/possessions/\(op.entityId)", body: nil)
    case (.container, .create):
      return try await createId(path: "/api/possessions/containers/upsert", body: op.payload)
    case (.container, .update):
      _ = try await service.request(
        method: "PATCH", path: "/api/possessions/containers/\(op.entityId)", body: op.payload)
    case (.container, .delete):
      _ = try await service.request(
        method: "DELETE", path: "/api/possessions/containers/\(op.entityId)", body: nil)
    case (.collection, .create):
      return try await createId(path: "/api/collections/upsert", body: op.payload)
    case (.collection, .update):
      _ = try await service.request(method: "PATCH", path: "/api/collections/\(op.entityId)", body: op.payload)
    case (.collection, .delete):
      _ = try await service.request(method: "DELETE", path: "/api/collections/\(op.entityId)", body: nil)
    case (.membership, .create):
      guard let collectionId = op.collectionId else { throw StillProblem.other }
      let body = #"{"entityType":"possessions","entityId":"\#(op.entityId)"}"#
      _ = try await service.request(
        method: "POST", path: "/api/collections/\(collectionId)/items", body: body)
    case (.membership, .delete):
      guard let collectionId = op.collectionId else { throw StillProblem.other }
      _ = try await service.request(
        method: "DELETE",
        path: "/api/collections/\(collectionId)/items/possessions/\(op.entityId)", body: nil)
    case (.membership, .update):
      // Membership is added or removed, never patched.
      throw StillProblem.other
    case (.photo, .create):
      try await sendPhoto(op)
    case (.photo, .update), (.photo, .delete):
      // A newer photo replaces the queued op, and removing one is the cache's business.
      throw StillProblem.other
    }
    return nil
  }

  /// Upload → complete → attach. The bytes go straight to storage on a presigned URL, so the
  /// session cookies never leave for another host.
  /// `metadata.serverPhoto` is a cache of what the server already has; sending it
  /// back would write the signed URL into the possession's own metadata.
  static func withoutServerPhoto(_ payload: String) -> String {
    var object = LibraryOp.object(payload)
    guard var metadata = object["metadata"] as? [String: Any],
      metadata.removeValue(forKey: "serverPhoto") != nil
    else { return payload }
    object["metadata"] = metadata
    return json(object)
  }

  private func sendPhoto(_ op: LibraryOp) async throws {
    var payload = LibraryOp.object(op.payload)
    var fileId = payload["fileId"] as? String
    if fileId == nil {
      guard let path = payload["localPath"] as? String,
        let bytes = try? Data(contentsOf: Self.fileURL(path))
      else { return }  // The file is gone from the device, so there is nothing to send.
      let mimetype = payload["mimetype"] as? String ?? "image/jpeg"
      let initBody = Self.json([
        "originalName": payload["name"] as? String ?? "photo.jpg",
        "mimetype": mimetype,
        "size": bytes.count,
      ])
      let initData = try await service.request(
        method: "POST", path: "/api/files/uploads", body: initBody)
      guard let ticket = try? JSONSerialization.jsonObject(with: initData) as? [String: Any],
        let id = ticket["id"] as? String,
        let uploadUrl = (ticket["uploadUrl"] as? String).flatMap(URL.init(string:))
      else { throw StillProblem.other }
      var headers = ticket["headers"] as? [String: String] ?? [:]
      if headers.isEmpty { headers["Content-Type"] = mimetype }
      try await service.upload(to: uploadUrl, data: bytes, headers: headers)
      _ = try await service.request(
        method: "POST", path: "/api/files/uploads/\(id)/complete", body: "{}")
      fileId = id
      payload["fileId"] = id
      store.updateOpPayload(id: op.id, payload: Self.json(payload))
    }
    guard let fileId else { return }
    _ = try await service.request(
      method: "POST", path: "/api/possessions/\(op.entityId)/images",
      body: Self.json(["fileId": fileId]))
  }

  private static func fileURL(_ path: String) -> URL {
    path.hasPrefix("file://") ? (URL(string: path) ?? URL(fileURLWithPath: path)) : URL(fileURLWithPath: path)
  }

  private static func json(_ object: [String: Any]) -> String {
    guard let data = try? JSONSerialization.data(withJSONObject: object) else { return "{}" }
    return String(data: data, encoding: .utf8) ?? "{}"
  }

  /// The upsert endpoints answer `{ "id": ..., "created": bool }`.
  private func createId(path: String, body: String) async throws -> String {
    let data = try await service.request(method: "POST", path: path, body: body)
    guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let id = object["id"] as? String
    else { throw StillProblem.other }
    return id
  }
}
