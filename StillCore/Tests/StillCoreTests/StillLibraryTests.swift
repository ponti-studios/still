import CoreData
import Foundation
import Testing

@testable import StillCore

private actor FakeLibraryService: StillAccountService {
  private var responses: [String: String] = [:]
  private var failure: StillProblem?
  private var calls: [String] = []

  func signedInEmail() async throws -> String? { nil }
  func requestCode(email: String) async throws {}
  func verify(email: String, code: String) async throws -> String { email }
  func signOut() async {}

  func request(method: String, path: String, body: String?) async throws -> Data {
    if let failure { throw failure }
    calls.append(path)
    return Data((responses[path] ?? "{}").utf8)
  }

  func setResponses(_ responses: [String: String]) { self.responses = responses }
  func setFailure(_ failure: StillProblem?) { self.failure = failure }
  func takeCalls() -> [String] {
    defer { calls = [] }
    return calls
  }
}

private func libraryResponses(possessions: String) -> [String: String] {
  [
    "/api/possessions?limit=5000&offset=0": #"{"possessions":\#(possessions)}"#,
    "/api/possessions/containers": #"{"containers":[{"id":"box","name":"Box","containerType":"box","parentContainerId":null,"description":null,"metadata":{}}]}"#,
    "/api/collections?limit=50": #"{"collections":[{"id":"c1","name":"Keep","description":null}]}"#,
    "/api/collections/membership": #"{"membership":[{"collectionId":"c1","entityType":"possessions","entityId":"p1"}],"count":1}"#,
  ]
}

private let lamp = #"[{"id":"p1","name":"Lamp","category":"home","status":"owned","isArchived":false,"acquiredDate":null,"priceCents":1200,"currencyCode":"GBP","containerId":"box","metadata":{"vendor":"Ikea"},"createdAt":"2025-01-10T00:00:00Z"}]"#

private func rows(_ payload: [String: Any], _ key: String) -> [[String: Any]] {
  payload[key] as? [[String: Any]] ?? []
}

@Suite struct StillLibraryTests {
  @Test func syncFetchesCachesAndReturns() async throws {
    let service = FakeLibraryService()
    await service.setResponses(libraryResponses(possessions: lamp))
    let store = StillLibraryStore(inMemory: true)

    let payload = try await LibrarySync(service: service, store: store).sync()

    let possessions = rows(payload, "possessions")
    #expect(possessions.count == 1)
    #expect(possessions.first?["name"] as? String == "Lamp")
    #expect(possessions.first?["priceCents"] as? Int64 == 1200)
    #expect((possessions.first?["metadata"] as? [String: Any])?["vendor"] as? String == "Ikea")
    #expect(rows(payload, "containers").first?["name"] as? String == "Box")
    #expect(rows(payload, "collections").first?["name"] as? String == "Keep")
    #expect(payload["membership"] as? [String: [String]] == ["p1": ["c1"]])
    let calls = await service.takeCalls()
    #expect(calls.contains("/api/possessions?limit=5000&offset=0"))
    #expect(calls.contains("/api/collections/membership"))
    #expect(!calls.contains(where: { $0.hasPrefix("/api/collections/c") }))
  }

  @Test func readServesTheCacheWithoutNetwork() async throws {
    let service = FakeLibraryService()
    await service.setResponses(libraryResponses(possessions: lamp))
    let store = StillLibraryStore(inMemory: true)
    let synced = try await LibrarySync(service: service, store: store).sync()
    _ = await service.takeCalls()

    let read = store.readPayload()

    #expect(rows(read, "possessions").count == 1)
    #expect(rows(read, "possessions").first?["name"] as? String == "Lamp")
    #expect(read["membership"] as? [String: [String]] == ["p1": ["c1"]])
    #expect(rows(synced, "containers").count == rows(read, "containers").count)
    #expect(await service.takeCalls() == [])
  }

  @Test func syncReplacesStaleRows() async throws {
    let service = FakeLibraryService()
    await service.setResponses(libraryResponses(possessions: lamp))
    let store = StillLibraryStore(inMemory: true)
    let sync = LibrarySync(service: service, store: store)
    _ = try await sync.sync()

    await service.setResponses(libraryResponses(possessions: "[]"))
    let payload = try await sync.sync()

    #expect(rows(payload, "possessions").isEmpty)
    #expect(rows(store.readPayload(), "possessions").isEmpty)
  }

  @Test func syncPagesBeyondTheFirstLimit() async throws {
    let service = FakeLibraryService()
    var firstPageRows: [String] = []
    for i in 0..<5000 {
      firstPageRows.append(
        #"{"id":"p\#(i)","name":"Thing \#(i)","category":null,"status":null,"isArchived":false,"acquiredDate":null,"priceCents":0,"currencyCode":null,"containerId":null,"metadata":{},"createdAt":"2025-01-10T00:00:00Z"}"#
      )
    }
    await service.setResponses([
      "/api/possessions?limit=5000&offset=0": #"{"possessions":[\#(firstPageRows.joined(separator: ","))]}"#,
      "/api/possessions?limit=1000&offset=5000":
        #"{"possessions":[{"id":"p5000","name":"Last","category":null,"status":null,"isArchived":false,"acquiredDate":null,"priceCents":0,"currencyCode":null,"containerId":null,"metadata":{},"createdAt":"2025-01-10T00:00:00Z"}]}"#,
      "/api/possessions/containers": #"{"containers":[]}"#,
      "/api/collections?limit=50": #"{"collections":[{"id":"c1","name":"Keep","description":null}]}"#,
      "/api/collections/membership":
        #"{"membership":[{"collectionId":"c1","entityType":"places","entityId":"x"},{"collectionId":"c1","entityType":"possessions","entityId":"p5000"}],"count":2}"#,
    ])
    let store = StillLibraryStore(inMemory: true)

    let payload = try await LibrarySync(service: service, store: store).sync()

    #expect(rows(payload, "possessions").count == 5001)
    // Non-possession entity types ride the same index and are filtered out.
    #expect(payload["membership"] as? [String: [String]] == ["p5000": ["c1"]])
  }

  @Test func emptyStoreReadsEmpty() {
    let payload = StillLibraryStore(inMemory: true).readPayload()
    #expect(rows(payload, "possessions").isEmpty)
    #expect(rows(payload, "containers").isEmpty)
    #expect(rows(payload, "collections").isEmpty)
    #expect(payload["membership"] as? [String: [String]] == [:])
  }

  @Test func fileBackedStoresShareTheSameFile() throws {
    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathComponent("StillLibrary.sqlite")
    let first = StillLibraryStore(storeURL: url)
    first.replaceAll(
      possessions: [
        ["id": "p1", "name": "Lamp", "metadata": ["vendor": "Ikea"], "createdAt": "2025-01-10T00:00:00Z"]
      ],
      containers: [], collections: [], membership: [])

    let second = StillLibraryStore(storeURL: url)

    #expect(rows(second.readPayload(), "possessions").first?["name"] as? String == "Lamp")
  }

  private func writeV1Fixture(at url: URL) throws {
    // A faithful shipped-v1 store: the frozen v1 model, v1 attributes only.
    try FileManager.default.createDirectory(
      at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    let container = NSPersistentContainer(
      name: "StillLibrary", managedObjectModel: StillLibraryModelV1.make())
    container.persistentStoreDescriptions = [NSPersistentStoreDescription(url: url)]
    var loaded = false
    container.loadPersistentStores { _, error in loaded = error == nil }
    #expect(loaded)
    let context = container.newBackgroundContext()
    try context.performAndWait {
      let row = CachedPossession(context: context)
      row.id = "p1"
      row.name = "Lamp"
      row.priceCents = 1200
      row.metadata = #"{"vendor":"Ikea"}"#
      row.createdAt = "2025-01-10T00:00:00Z"
      try context.save()
    }
  }

  private func isV2Store(at url: URL) -> Bool {
    guard
      let metadata = try? NSPersistentStoreCoordinator.metadataForPersistentStore(
        ofType: NSSQLiteStoreType, at: url)
    else { return false }
    return StillLibraryModelV2.make().isConfiguration(
      withName: nil, compatibleWithStoreMetadata: metadata)
  }

  @Test func v1StoreMigratesWithRowsPreserved() throws {
    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathComponent("StillLibrary.sqlite")
    try writeV1Fixture(at: url)
    #expect(!isV2Store(at: url))

    let store = StillLibraryStore(storeURL: url)

    let possessions = rows(store.readPayload(), "possessions")
    #expect(possessions.count == 1)
    #expect(possessions.first?["name"] as? String == "Lamp")
    #expect(possessions.first?["priceCents"] as? Int64 == 1200)
    #expect(isV2Store(at: url), "the file on disk is now a v2 store")
  }

  @Test func corruptStoreStartsOverInsteadOfCrashing() throws {
    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathComponent("StillLibrary.sqlite")
    try FileManager.default.createDirectory(
      at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    try Data("not a database".utf8).write(to: url)

    let store = StillLibraryStore(storeURL: url)

    #expect(rows(store.readPayload(), "possessions").isEmpty)
  }

  @Test func freshInstallCreatesV2Store() {
    let url = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathComponent("StillLibrary.sqlite")

    _ = StillLibraryStore(storeURL: url)

    #expect(isV2Store(at: url))
  }

  @Test func replaceAllPersistsRichFields() {
    let store = StillLibraryStore(inMemory: true)
    store.replaceAll(
      possessions: [[
        "id": "p1", "name": "Lamp", "brand": "Ikea", "model": "HEJ",
        "subCategory": "desk", "url": "https://example.com/lamp",
        "notes": "warm bulb", "serialNumber": "SN-1", "size": "M", "color": "white",
        "placement": "study", "categoryId": "cat1", "retiredDate": "2025-02-01",
        "sellPriceCents": 500, "updatedAt": "2025-03-01T00:00:00Z",
        "metadata": [:] as [String: Any], "createdAt": "2025-01-10T00:00:00Z",
      ]],
      containers: [
        ["id": "box", "name": "Box", "metadata": [:] as [String: Any],
         "updatedAt": "2025-03-02T00:00:00Z"]
      ],
      collections: [
        ["id": "c1", "name": "Keep", "updatedAt": "2025-03-03T00:00:00Z"]
      ],
      membership: [])

    let payload = store.readPayload()
    let possession = rows(payload, "possessions").first
    #expect(possession?["brand"] as? String == "Ikea")
    #expect(possession?["model"] as? String == "HEJ")
    #expect(possession?["subCategory"] as? String == "desk")
    #expect(possession?["url"] as? String == "https://example.com/lamp")
    #expect(possession?["serialNumber"] as? String == "SN-1")
    #expect(possession?["sellPriceCents"] as? Int64 == 500)
    #expect(possession?["categoryId"] as? String == "cat1")
    #expect(possession?["updatedAt"] as? String == "2025-03-01T00:00:00Z")
    let container = rows(payload, "containers").first
    #expect(container?["updatedAt"] as? String == "2025-03-02T00:00:00Z")
    let collection = rows(payload, "collections").first
    #expect(collection?["updatedAt"] as? String == "2025-03-03T00:00:00Z")
  }

  @Test func tombstonedRowsStayStoredButHidden() {
    let store = StillLibraryStore(inMemory: true)
    store.replaceAll(
      possessions: [
        ["id": "gone", "name": "Gone", "metadata": [:] as [String: Any],
         "createdAt": "2025-01-10T00:00:00Z", "deletedAt": "2025-04-01T00:00:00Z"],
        ["id": "kept", "name": "Kept", "metadata": [:] as [String: Any],
         "createdAt": "2025-01-10T00:00:00Z"],
      ],
      containers: [], collections: [], membership: [])

    let names = rows(store.readPayload(), "possessions").compactMap { $0["name"] as? String }
    #expect(names == ["Kept"])
  }

  @Test func syncRefillPreservesAssetsAndCategories() {
    let store = StillLibraryStore(inMemory: true)
    store.replaceCategories([(id: "cat1", name: "Home")])
    store.replaceImageManifest([
      CachedImageAssetInput(
        id: "a2", possessionId: "p1", sha256: "b", displayOrder: 1),
      CachedImageAssetInput(
        id: "a1", possessionId: "p1", sha256: "a", displayOrder: 0),
    ])
    store.replaceAll(
      possessions: [
        ["id": "p1", "name": "Lamp", "metadata": [:] as [String: Any],
         "createdAt": "2025-01-10T00:00:00Z"]
      ],
      containers: [], collections: [], membership: [])

    let payload = store.readPayload()
    #expect((payload["categories"] as? [[String: String]]) == [["id": "cat1", "name": "Home"]])
    #expect(store.imageAssets(for: "p1").map(\.id) == ["a1", "a2"])
    #expect(store.imageAssets(for: "other").isEmpty)
  }

  @Test func clearRemovesAssetsAndCategoriesToo() {
    let store = StillLibraryStore(inMemory: true)
    store.replaceCategories([(id: "cat1", name: "Home")])
    store.replaceImageManifest([
      CachedImageAssetInput(id: "a1", possessionId: "p1", sha256: "a"),
    ])

    store.clear()

    let payload = store.readPayload()
    #expect((payload["categories"] as? [[String: String]])?.isEmpty == true)
    #expect(store.imageAssets(for: "p1").isEmpty)
  }

  @Test func malformedResponsesThrowOther() async {
    let service = FakeLibraryService()
    await service.setResponses([:])
    let store = StillLibraryStore(inMemory: true)
    await #expect(throws: StillProblem.other) {
      try await LibrarySync(service: service, store: store).sync()
    }
  }

  @Test func serviceFailuresPassThrough() async {
    let service = FakeLibraryService()
    await service.setResponses(libraryResponses(possessions: lamp))
    await service.setFailure(.noService)
    let store = StillLibraryStore(inMemory: true)
    await #expect(throws: StillProblem.noService) {
      try await LibrarySync(service: service, store: store).sync()
    }
  }

  @Test func signOutClearsTheCache() async throws {
    let service = FakeLibraryService()
    await service.setResponses(libraryResponses(possessions: lamp))
    let store = StillLibraryStore(inMemory: true)
    let account = await StillAccount(service: service, library: store)
    _ = try await account.syncLibrary()
    #expect(rows(await account.readLibrary(), "possessions").count == 1)

    await account.signOut()

    #expect(rows(await account.readLibrary(), "possessions").isEmpty)
  }

  @Test func expiredSessionOnSyncClearsTheEmail() async {
    let service = FakeLibraryService()
    let account = await StillAccount(service: service, library: StillLibraryStore(inMemory: true))
    await account.start()
    await service.setFailure(.signedOut)
    do {
      _ = try await account.syncLibrary()
      Issue.record("expected a throw")
    } catch {}
    #expect(await account.state.email == nil)
  }
}
