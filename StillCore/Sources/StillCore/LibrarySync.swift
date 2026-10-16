import Foundation

/// Syncs the library with Hominem: flush the outbox first (the user's edits win
/// over a stale server), then pull the delta since the last cursor. Hominem is
/// the source of truth; the cache is a copy that always shows the person's own
/// unconfirmed edits on top. See docs/sync-contract.md on the server side.
public struct LibrarySync: Sendable {
  private let service: StillAccountService
  private let store: StillLibraryStore

  public init(service: StillAccountService, store: StillLibraryStore) {
    self.service = service
    self.store = store
  }

  /// The cursor before the first pull: ask for everything.
  static let epoch = "1970-01-01T00:00:00Z"

  public func sync() async throws -> LibrarySyncResult {
    let outbox = LibraryOutbox(service: service, store: store)
    switch try await outbox.flush() {
    case .offline:
      // Keep the ops and serve the cache; the React Native side shows the
      // optimistic rows and retries on the next sync.
      throw StillProblem.noService
    case .done(let summary):
      // After a rejection the server's row must win again, so pull everything
      // (idempotent upserts make the replay cheap and safe). Otherwise resume
      // from the cursor.
      let since = summary.hadRejection ? Self.epoch : (store.cursor() ?? Self.epoch)
      let serverTime = try await pull(since: since)
      store.setCursor(serverTime)
      store.reapplyPendingOps()
      return LibrarySyncResult(payload: store.readPayload(), notices: summary.notices)
    }
  }

  /// Applies a delta pull and returns the earliest server time seen, which
  /// becomes the next cursor. Taking the minimum across the four endpoints
  /// cannot skip a row between two responses; a replay is harmless.
  private func pull(since: String) async throws -> String {
    let encoded = since.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? since
    async let containersData = service.request(
      method: "GET", path: "/api/possessions/containers?since=\(encoded)", body: nil)
    async let collectionsData = service.request(
      method: "GET", path: "/api/collections?limit=50&since=\(encoded)", body: nil)
    async let membershipData = service.request(
      method: "GET", path: "/api/collections/membership?since=\(encoded)", body: nil)
    let possessionPage = try await fetchPossessions(since: encoded)
    let (containersJson, collectionsJson, membershipJson) = try await (
      containersData, collectionsData, membershipData)

    var delta = LibraryDelta(
      possessions: possessionPage.rows,
      containers: try Self.rows(containersJson, key: "containers"),
      collections: try Self.rows(collectionsJson, key: "collections"),
      membership: try Self.membershipLinks(membershipJson),
      tombstones: possessionPage.tombstones)
    delta.tombstones.append(contentsOf: Self.tombstones(containersJson))
    delta.tombstones.append(contentsOf: Self.tombstones(collectionsJson))
    delta.tombstones.append(contentsOf: Self.tombstones(membershipJson))
    store.applyDelta(delta)

    let times = [possessionPage.serverTime, Self.serverTime(containersJson),
      Self.serverTime(collectionsJson), Self.serverTime(membershipJson)].compactMap { $0 }
    return times.min() ?? since
  }

  /// All possessions changed since `since`, paged. The first page keeps the
  /// old `limit=5000` shape; further pages use `limit=1000` with an offset.
  /// Rows dedup by id, so a repeated page (rather than a missing one) ends the
  /// walk without doubles.
  private func fetchPossessions(
    since: String
  ) async throws -> (rows: [[String: Any]], tombstones: [LibraryTombstone], serverTime: String?) {
    var all: [[String: Any]] = []
    var tombstones: [LibraryTombstone] = []
    var times: [String] = []
    var seen = Set<String>()
    var offset = 0
    var limit = 5000
    for _ in 0..<25 {
      let data = try await service.request(
        method: "GET", path: "/api/possessions?since=\(since)&limit=\(limit)&offset=\(offset)", body: nil)
      let page = try Self.rows(data, key: "possessions")
      tombstones.append(contentsOf: Self.tombstones(data))
      if let time = Self.serverTime(data) { times.append(time) }
      var added = 0
      for row in page {
        guard let id = row["id"] as? String, seen.insert(id).inserted else { continue }
        all.append(row)
        added += 1
      }
      if page.count < limit || added == 0 { break }
      offset += page.count
      limit = 1000
    }
    return (all, tombstones, times.min())
  }

  /// The batch membership index as (collection id, possession id) links.
  /// Non-possession entity types ride the same index and are filtered here.
  private static func membershipLinks(_ data: Data) throws -> [(collectionId: String, entityId: String)] {
    guard let object = try? JSONSerialization.jsonObject(with: data),
      let json = object as? [String: Any],
      let links = json["membership"] as? [[String: Any]]
    else { throw StillProblem.other }
    return links.compactMap { link in
      guard link["entityType"] as? String == "possessions",
        let collectionId = link["collectionId"] as? String,
        let entityId = link["entityId"] as? String
      else { return nil }
      return (collectionId, entityId)
    }
  }

  private static func tombstones(_ data: Data) -> [LibraryTombstone] {
    guard let object = try? JSONSerialization.jsonObject(with: data),
      let json = object as? [String: Any],
      let rows = json["tombstones"] as? [[String: Any]]
    else { return [] }
    return rows.compactMap { row in
      guard let entity = LibraryTombstone.Entity(rawValue: row["entity"] as? String ?? ""),
        let entityId = row["entityId"] as? String
      else { return nil }
      return LibraryTombstone(
        entity: entity, entityId: entityId, collectionId: row["collectionId"] as? String)
    }
  }

  private static func serverTime(_ data: Data) -> String? {
    guard let object = try? JSONSerialization.jsonObject(with: data),
      let json = object as? [String: Any]
    else { return nil }
    return json["serverTime"] as? String
  }

  private static func rows(_ data: Data, key: String) throws -> [[String: Any]] {
    guard let object = try? JSONSerialization.jsonObject(with: data),
      let json = object as? [String: Any],
      let rows = json[key] as? [[String: Any]]
    else { throw StillProblem.other }
    return rows
  }
}
