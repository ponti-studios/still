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
    "/api/possessions?limit=5000": #"{"possessions":\#(possessions)}"#,
    "/api/possessions/containers": #"{"containers":[{"id":"box","name":"Box","containerType":"box","parentContainerId":null,"description":null,"metadata":{}}]}"#,
    "/api/collections?limit=50": #"{"collections":[{"id":"c1","name":"Keep","description":null}]}"#,
    "/api/collections/c1": #"{"items":[{"entityType":"possessions","entityId":"p1"}]}"#,
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
    #expect(calls.contains("/api/possessions?limit=5000"))
    #expect(calls.contains("/api/collections/c1"))
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

  @Test func emptyStoreReadsEmpty() {
    let payload = StillLibraryStore(inMemory: true).readPayload()
    #expect(rows(payload, "possessions").isEmpty)
    #expect(rows(payload, "containers").isEmpty)
    #expect(rows(payload, "collections").isEmpty)
    #expect(payload["membership"] as? [String: [String]] == [:])
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
