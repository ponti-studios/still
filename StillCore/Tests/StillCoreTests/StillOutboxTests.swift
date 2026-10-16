import CoreData
import Foundation
import Testing

@testable import StillCore

/// Records every call and answers per path, so an outbox flush can be driven
/// deterministically (success, rejection, offline).
private actor FakeOutboxService: StillAccountService {
  struct Call: Sendable, Equatable {
    var method: String
    var path: String
    var body: String?
  }

  private var responses: [String: String] = [:]
  private var failures: [String: StillProblem] = [:]
  private var calls: [Call] = []

  func signedInEmail() async throws -> String? { nil }
  func requestCode(email: String) async throws {}
  func verify(email: String, code: String) async throws -> String { email }
  func signOut() async {}

  func request(method: String, path: String, body: String?) async throws -> Data {
    calls.append(Call(method: method, path: path, body: body))
    if let failure = failures[path] { throw failure }
    return Data((responses[path] ?? "{}").utf8)
  }

  func setResponse(_ path: String, _ json: String) { responses[path] = json }
  func setFailure(_ path: String, _ problem: StillProblem) { failures[path] = problem }
  func takeCalls() -> [Call] {
    defer { calls = [] }
    return calls
  }
}

private func rows(_ payload: [String: Any], _ key: String) -> [[String: Any]] {
  payload[key] as? [[String: Any]] ?? []
}

private func possessionCreate(id: String, name: String) -> LibraryOp {
  LibraryOp(
    id: UUID().uuidString, entity: .possession, kind: .create, entityId: id,
    payload: #"{"name":"\#(name)","category":"home","priceCents":1200,"currencyCode":"GBP","metadata":{},"isArchived":false,"externalId":"\#(id)"}"#,
    createdAt: LibraryOp.now())
}

private func possessionUpdate(id: String, name: String) -> LibraryOp {
  LibraryOp(
    id: UUID().uuidString, entity: .possession, kind: .update, entityId: id,
    payload: #"{"name":"\#(name)"}"#, createdAt: LibraryOp.now())
}

private func membershipOp(collectionId: String, entityId: String, kind: LibraryOp.Kind) -> LibraryOp {
  LibraryOp(
    id: UUID().uuidString, entity: .membership, kind: kind, entityId: entityId,
    payload: #"{"collectionId":"\#(collectionId)"}"#, createdAt: LibraryOp.now())
}

@Suite struct StillOutboxTests {
  @Test func enqueueAppliesOptimistically() {
    let store = StillLibraryStore(inMemory: true)
    store.enqueue(possessionCreate(id: "client-1", name: "Lamp"))

    let payload = store.readPayload()
    #expect(rows(payload, "possessions").count == 1)
    #expect(rows(payload, "possessions").first?["name"] as? String == "Lamp")
    #expect(store.pendingOps().count == 1)
  }

  @Test func createThenUpdateCoalescesIntoOneOp() {
    let store = StillLibraryStore(inMemory: true)
    store.enqueue(possessionCreate(id: "client-1", name: "Lamp"))
    store.enqueue(possessionUpdate(id: "client-1", name: "Desk Lamp"))

    let ops = store.pendingOps()
    #expect(ops.count == 1)
    #expect(ops.first?.kind == .create)
    #expect(ops.first?.payload.contains("Desk Lamp") == true)
    #expect(rows(store.readPayload(), "possessions").first?["name"] as? String == "Desk Lamp")
  }

  @Test func createThenDeleteCancelsBeforeTheServer() {
    let store = StillLibraryStore(inMemory: true)
    store.enqueue(possessionCreate(id: "client-1", name: "Lamp"))
    store.enqueue(
      LibraryOp(
        id: UUID().uuidString, entity: .possession, kind: .delete, entityId: "client-1",
        payload: "{}", createdAt: LibraryOp.now()))

    #expect(store.pendingOps().isEmpty)
    #expect(rows(store.readPayload(), "possessions").isEmpty)
  }

  @Test func flushSendsAnIdempotentCreateAndRenamesTheRow() async throws {
    let service = FakeOutboxService()
    await service.setResponse(
      "/api/possessions/upsert", #"{"id":"server-1","created":true}"#)
    let store = StillLibraryStore(inMemory: true)
    store.enqueue(possessionCreate(id: "client-1", name: "Lamp"))

    let outcome = try await LibraryOutbox(service: service, store: store).flush()

    #expect(outcome == .done(LibraryOutbox.Summary(notices: [], hadRejection: false)))
    #expect(store.pendingOps().isEmpty)
    let calls = await service.takeCalls()
    #expect(calls.count == 1)
    #expect(calls.first?.method == "POST")
    #expect(calls.first?.path == "/api/possessions/upsert")
    #expect(calls.first?.body?.contains(#""externalId":"client-1""#) == true)
    // The row now carries the server's id, so the delta pull matches it.
    #expect(rows(store.readPayload(), "possessions").first?["id"] as? String == "server-1")
  }

  @Test func aSecondFlushWithNothingQueuedSendsNothing() async throws {
    let service = FakeOutboxService()
    await service.setResponse("/api/possessions/upsert", #"{"id":"server-1","created":true}"#)
    let store = StillLibraryStore(inMemory: true)
    store.enqueue(possessionCreate(id: "client-1", name: "Lamp"))
    let outbox = LibraryOutbox(service: service, store: store)
    _ = try await outbox.flush()
    _ = await service.takeCalls()

    _ = try await outbox.flush()

    #expect(await service.takeCalls().isEmpty)
  }

  @Test func offlineKeepsTheOps() async throws {
    let service = FakeOutboxService()
    await service.setFailure("/api/possessions/upsert", .noService)
    let store = StillLibraryStore(inMemory: true)
    store.enqueue(possessionCreate(id: "client-1", name: "Lamp"))

    let outcome = try await LibraryOutbox(service: service, store: store).flush()

    #expect(outcome == .offline)
    #expect(store.pendingOps().count == 1)
    // The optimistic row is still shown while offline.
    #expect(rows(store.readPayload(), "possessions").count == 1)
  }

  @Test func rejectionDropsTheOpAndReportsANotice() async throws {
    let service = FakeOutboxService()
    await service.setFailure("/api/possessions/client-1", .rejected)
    let store = StillLibraryStore(inMemory: true)
    store.enqueue(possessionUpdate(id: "client-1", name: "Nope"))

    let outcome = try await LibraryOutbox(service: service, store: store).flush()

    guard case .done(let summary) = outcome else {
      Issue.record("expected a completed flush")
      return
    }
    #expect(summary.hadRejection)
    #expect(summary.notices.count == 1)
    #expect(store.pendingOps().isEmpty)
  }

  @Test func deletingAnAlreadyGoneRowCountsAsSuccess() async throws {
    let service = FakeOutboxService()
    await service.setFailure("/api/possessions/gone", .notFound)
    let store = StillLibraryStore(inMemory: true)
    store.enqueue(
      LibraryOp(
        id: UUID().uuidString, entity: .possession, kind: .delete, entityId: "gone",
        payload: "{}", createdAt: LibraryOp.now()))

    let outcome = try await LibraryOutbox(service: service, store: store).flush()

    #expect(outcome == .done(LibraryOutbox.Summary(notices: [], hadRejection: false)))
    #expect(store.pendingOps().isEmpty)
  }

  @Test func membershipForANewRowFollowsTheServerId() async throws {
    let service = FakeOutboxService()
    await service.setResponse("/api/possessions/upsert", #"{"id":"server-1","created":true}"#)
    await service.setResponse("/api/collections/c1/items", #"{"ok":true}"#)
    let store = StillLibraryStore(inMemory: true)
    store.enqueue(possessionCreate(id: "client-1", name: "Lamp"))
    store.enqueue(membershipOp(collectionId: "c1", entityId: "client-1", kind: .create))

    _ = try await LibraryOutbox(service: service, store: store).flush()

    let calls = await service.takeCalls()
    let membership = calls.first { $0.path == "/api/collections/c1/items" }
    #expect(membership?.body?.contains("server-1") == true)
    #expect(membership?.body?.contains("client-1") == false)
    // The cached link moved to the server id too.
    #expect(store.readPayload()["membership"] as? [String: [String]] == ["server-1": ["c1"]])
  }

  @Test func reapplyKeepsPendingEditsOnTopOfAPull() async throws {
    let store = StillLibraryStore(inMemory: true)
    store.replaceAll(
      possessions: [
        ["id": "p1", "name": "Lamp", "metadata": [:] as [String: Any],
         "createdAt": "2025-01-10T00:00:00Z"]
      ],
      containers: [], collections: [], membership: [])
    store.enqueue(possessionUpdate(id: "p1", name: "Desk Lamp"))

    // A delta arrives that still carries the old name (the edit is unconfirmed).
    store.applyDelta(
      LibraryDelta(
        possessions: [
          ["id": "p1", "name": "Lamp", "metadata": [:] as [String: Any],
           "createdAt": "2025-01-10T00:00:00Z"]
        ],
        containers: [], collections: [], membership: [], tombstones: []))
    store.reapplyPendingOps()

    #expect(rows(store.readPayload(), "possessions").first?["name"] as? String == "Desk Lamp")
  }
}
