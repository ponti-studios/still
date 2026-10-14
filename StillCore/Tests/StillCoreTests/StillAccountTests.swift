import Foundation
import HominemAuth
import Testing

@testable import StillCore

// Swift: `actor` makes this fake safe to call from anywhere; tests set `failure` to make the next
// call fail.
actor FakeAccountService: StillAccountService {
  var email: String?
  var codes: [String] = []
  var failure: StillProblem?
  var signedOut = false

  func signedInEmail() async throws -> String? {
    if let failure { throw failure }
    return email
  }

  func requestCode(email: String) async throws {
    if let failure { throw failure }
    codes.append(email)
  }

  func verify(email: String, code: String) async throws -> String {
    if let failure { throw failure }
    self.email = email
    return email
  }

  func signOut() async {
    signedOut = true
    email = nil
  }

  func request(method: String, path: String, body: String?) async throws -> Data {
    if let failure { throw failure }
    requests.append((method, path, body))
    return Data(response.utf8)
  }

  var requests: [(method: String, path: String, body: String?)] = []
  var response = "{}"
}

@MainActor
func account(service: FakeAccountService = FakeAccountService()) -> (StillAccount, FakeAccountService) {
  (StillAccount(service: service), service)
}

@MainActor
@Suite("StillAccount start")
struct StartTests {
  @Test func signedOutIsAnAnswer() async {
    let (account, _) = account()
    await account.start()
    #expect(account.state.ready)
    #expect(account.state.email == nil)
    #expect(account.state.problem == nil)
  }

  @Test func savedSessionSignsIn() async {
    let service = FakeAccountService()
    await service.setEmailForTest("cj@ponti.io")
    let (account, _) = account(service: service)
    await account.start()
    #expect(account.state.email == "cj@ponti.io")
    #expect(account.state.problem == nil)
  }

  @Test func failedLookupKeepsItsReason() async {
    let service = FakeAccountService()
    await service.setFailureForTest(.noService)
    let (account, _) = account(service: service)
    await account.start()
    #expect(account.state.ready)
    #expect(account.state.email == nil)
    #expect(account.state.problem == .noService)
  }
}

@MainActor
@Suite("StillAccount sign-in")
struct SignInTests {
  @Test func requestCodeMovesToCodeSent() async {
    let (account, service) = account()
    await account.requestCode(email: " cj@ponti.io ")
    #expect(account.state.step == .codeSent)
    #expect(account.state.pendingEmail == "cj@ponti.io")
    #expect(await service.codes == ["cj@ponti.io"])
  }

  @Test func badEmailNeverCallsTheService() async {
    let (account, service) = account()
    await account.requestCode(email: "not-an-email")
    #expect(account.state.problem == .badEmail)
    #expect(account.state.step == .idle)
    #expect(await service.codes == [])
  }

  @Test func verifySignsIn() async {
    let (account, _) = account()
    await account.requestCode(email: "cj@ponti.io")
    await account.verify(code: "123456")
    #expect(account.state.email == "cj@ponti.io")
    #expect(account.state.step == .idle)
    #expect(account.state.pendingEmail == nil)
  }

  @Test func shortCodeIsRejectedLocally() async {
    let (account, _) = account()
    await account.requestCode(email: "cj@ponti.io")
    await account.verify(code: "123")
    #expect(account.state.problem == .badCode)
    #expect(account.state.email == nil)
  }

  @Test func wrongCodeShowsTheServicesReason() async {
    let service = FakeAccountService()
    let (account, _) = account(service: service)
    await account.requestCode(email: "cj@ponti.io")
    await service.setFailureForTest(.badCode)
    await account.verify(code: "000000")
    #expect(account.state.problem == .badCode)
    #expect(account.state.email == nil)
    #expect(account.state.step == .codeSent)
  }

  @Test func cancelSignInStartsOver() async {
    let (account, _) = account()
    await account.requestCode(email: "cj@ponti.io")
    account.cancelSignIn()
    #expect(account.state.step == .idle)
    #expect(account.state.pendingEmail == nil)
  }

  @Test func signOutClears() async {
    let service = FakeAccountService()
    await service.setEmailForTest("cj@ponti.io")
    let (account, _) = account(service: service)
    await account.start()
    await account.signOut()
    #expect(account.state.email == nil)
    #expect(await service.signedOut)
  }
}

@MainActor
@Suite("StillAccount api")
struct ApiTests {
  @Test func apiReturnsTheServicesData() async throws {
    let (account, service) = account()
    await service.setResponseForTest(#"{"items":[]}"#)
    let data = try await account.api(method: "GET", path: "/api/possessions", body: nil)
    #expect(String(data: data, encoding: .utf8) == #"{"items":[]}"#)
    let requests = await service.requests
    #expect(requests.count == 1)
    #expect(requests.first?.method == "GET")
    #expect(requests.first?.path == "/api/possessions")
  }

  @Test func expiredSessionClearsTheEmail() async {
    let service = FakeAccountService()
    await service.setEmailForTest("cj@ponti.io")
    let (account, _) = account(service: service)
    await account.start()
    await service.setFailureForTest(.signedOut)
    do {
      _ = try await account.api(method: "GET", path: "/api/possessions", body: nil)
      Issue.record("expected a throw")
    } catch {}
    #expect(account.state.email == nil)
  }

  @Test func otherProblemsKeepTheEmail() async {
    let service = FakeAccountService()
    await service.setEmailForTest("cj@ponti.io")
    let (account, _) = account(service: service)
    await account.start()
    await service.setFailureForTest(.noService)
    do {
      _ = try await account.api(method: "GET", path: "/api/possessions", body: nil)
      Issue.record("expected a throw")
    } catch {}
    #expect(account.state.email == "cj@ponti.io")
  }

}

@Suite("AnyEncodable")
struct AnyEncodableTests {
  @Test func roundTripsJsonValues() throws {
    let object = try JSONSerialization.jsonObject(
      with: Data(#"{"name":"Lamp","priceCents":1200,"archived":false,"vendor":null,"tags":["a"]}"#.utf8))
    let data = try JSONEncoder().encode(AnyEncodable(value: object))
    let text = String(data: data, encoding: .utf8) ?? ""
    #expect(text.contains(#""name":"Lamp""#))
    #expect(text.contains(#""priceCents":1200"#))
    #expect(text.contains(#""archived":false"#))
    #expect(text.contains(#""vendor":null"#))
    #expect(text.contains(#""tags":["a"]"#))
  }
}

@Suite("StillProblem mapping")
struct ProblemMappingTests {
  @Test func mapsClientErrors() {
    #expect(HominemAccountService.problem(HominemAuthError.invalidOTP(message: nil)) == .badCode)
    #expect(HominemAccountService.problem(HominemAuthError.rateLimited(retryAfter: nil)) == .tooMany)
    #expect(HominemAccountService.problem(HominemAuthError.network(underlying: "x")) == .noService)
    #expect(HominemAccountService.problem(HominemAuthError.notAuthenticated) == .signedOut)
    #expect(HominemAccountService.problem(HominemAuthError.server(status: 401, message: nil)) == .signedOut)
    #expect(HominemAccountService.problem(HominemAuthError.badResponse(status: 401, message: nil)) == .signedOut)
    #expect(HominemAccountService.problem(HominemAuthError.server(status: 500, message: nil)) == .other)
    #expect(HominemAccountService.problem(StillProblem.tooMany) == .tooMany)
  }
}

// Test-only writers: the fake's state is actor-isolated, so tests set it through these.
extension FakeAccountService {
  func setEmailForTest(_ email: String?) { self.email = email }
  func setFailureForTest(_ failure: StillProblem?) { self.failure = failure }
  func setResponseForTest(_ response: String) { self.response = response }
}
