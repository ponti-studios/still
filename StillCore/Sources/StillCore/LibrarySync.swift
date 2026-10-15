import Foundation

/// Pulls the library down from Hominem into the on-device cache. Hominem is the source
/// of truth; this never invents data, and what it returns is what it stored, so the
/// read path below serves the identical shape.
public struct LibrarySync: Sendable {
  private let service: StillAccountService
  private let store: StillLibraryStore

  public init(service: StillAccountService, store: StillLibraryStore) {
    self.service = service
    self.store = store
  }

  public func sync() async throws -> [String: Any] {
    async let possessionsData = fetchPossessions()
    async let containersData = service.request(
      method: "GET", path: "/api/possessions/containers", body: nil)
    async let collectionsData = service.request(
      method: "GET", path: "/api/collections?limit=50", body: nil)
    async let membershipData = service.request(
      method: "GET", path: "/api/collections/membership", body: nil)
    let (possessions, containersJson, collectionsJson, membershipJson) = try await (
      possessionsData, containersData, collectionsData, membershipData)
    let containers = try Self.rows(containersJson, key: "containers")
    let collections = try Self.rows(collectionsJson, key: "collections")
    let membership = try Self.membershipLinks(membershipJson)

    store.replaceAll(
      possessions: possessions, containers: containers, collections: collections,
      membership: membership)
    return store.readPayload()
  }

  /// All possessions, paged. The first page keeps the old `limit=5000` shape;
  /// further pages use `limit=1000` with an offset. Rows dedup by id, so a
  /// repeated page (rather than a missing one) ends the walk without doubles.
  private func fetchPossessions() async throws -> [[String: Any]] {
    var all: [[String: Any]] = []
    var seen = Set<String>()
    var offset = 0
    var limit = 5000
    for _ in 0..<25 {
      let data = try await service.request(
        method: "GET", path: "/api/possessions?limit=\(limit)&offset=\(offset)", body: nil)
      let page = try Self.rows(data, key: "possessions")
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
    return all
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

  private static func rows(_ data: Data, key: String) throws -> [[String: Any]] {
    guard let object = try? JSONSerialization.jsonObject(with: data),
      let json = object as? [String: Any],
      let rows = json[key] as? [[String: Any]]
    else { throw StillProblem.other }
    return rows
  }
}
