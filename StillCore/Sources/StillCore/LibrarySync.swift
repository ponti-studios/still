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
    async let possessionsData = service.request(
      method: "GET", path: "/api/possessions?limit=5000", body: nil)
    async let containersData = service.request(
      method: "GET", path: "/api/possessions/containers", body: nil)
    async let collectionsData = service.request(
      method: "GET", path: "/api/collections?limit=50", body: nil)
    let (possessionsJson, containersJson, collectionsJson) = try await (
      possessionsData, containersData, collectionsData)
    let possessions = try Self.rows(possessionsJson, key: "possessions")
    let containers = try Self.rows(containersJson, key: "containers")
    let collections = try Self.rows(collectionsJson, key: "collections")

    // Which collections each possession belongs to lives on the collections.
    let ids = collections.compactMap { $0["id"] as? String }
    var membership: [(collectionId: String, entityId: String)] = []
    try await withThrowingTaskGroup(of: [(String, String)].self) { group in
      for id in ids {
        group.addTask {
          let data = try await self.service.request(
            method: "GET", path: "/api/collections/\(id)", body: nil)
          let items = try Self.rows(data, key: "items")
          return items.compactMap { item in
            guard item["entityType"] as? String == "possessions",
              let entityId = item["entityId"] as? String
            else { return nil }
            return (id, entityId)
          }
        }
      }
      for try await links in group {
        membership.append(contentsOf: links)
      }
    }

    store.replaceAll(
      possessions: possessions, containers: containers, collections: collections,
      membership: membership)
    return store.readPayload()
  }

  private static func rows(_ data: Data, key: String) throws -> [[String: Any]] {
    guard let object = try? JSONSerialization.jsonObject(with: data),
      let json = object as? [String: Any],
      let rows = json[key] as? [[String: Any]]
    else { throw StillProblem.other }
    return rows
  }
}
