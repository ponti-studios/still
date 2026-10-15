import Foundation
import HominemAuth

// Swift: a `protocol` is an interface: a list of what a type must be able to do. The Still
// account only knows this list, so tests give it a fake and the app gives it the real Hominem
// client (`HominemAccountService`). `Sendable` says values of the type are safe to share between
// threads.
/// The person's account on the Hominem API. Signing in uses an email code, exactly like Thames.
/// The session lives in Still's own Keychain entry; there is no sharing between apps.
public protocol StillAccountService: Sendable {
  /// The email of the saved session, or nil when signed out (or the session ran out).
  func signedInEmail() async throws -> String?
  func requestCode(email: String) async throws
  /// Checks the code and keeps the session. Returns the signed-in email.
  func verify(email: String, code: String) async throws -> String
  func signOut() async
  /// An authenticated Hominem API call. `path` is the absolute API path including `/api`
  /// (never `/api/auth/...`). The session cookies stay in the Keychain; `body` is JSON text or
  /// nil. Throws `StillProblem`.
  func request(method: String, path: String, body: String?) async throws -> Data
}

/// What went wrong, in the words the screen shows. Calm, and never "Error".
public enum StillProblem: Error, Equatable, Sendable {
  case badEmail
  case badCode
  case tooMany
  case noService
  case signedOut
  case other

  public var message: String {
    switch self {
    case .badEmail: return "Check the email address."
    case .badCode: return "That code didn’t work. Check it and try again."
    case .tooMany: return "Too many tries. Wait a moment and try again."
    case .noService: return "No service. Try again when you’re back online."
    case .signedOut: return "Signed out. Sign in again to see your things."
    case .other: return "Something went wrong. Try again."
    }
  }

  /// Calm problems are ordinary things (no service, a short wait, an expired session), so the
  /// screens draw them quietly. The rest are real failures and are drawn in red.
  public var isCalm: Bool {
    switch self {
    case .noService, .tooMany, .signedOut: return true
    case .badEmail, .badCode, .other: return false
    }
  }

  /// The machine-readable key the bridge rejects with, so JavaScript can tell signed-out apart.
  public var code: String {
    switch self {
    case .badEmail: return "badEmail"
    case .badCode: return "badCode"
    case .tooMany: return "tooMany"
    case .noService: return "noService"
    case .signedOut: return "signedOut"
    case .other: return "other"
    }
  }
}

/// The real account service: Hominem's sign-in.
public struct HominemAccountService: StillAccountService {
  private let auth: AuthClient
  private let baseURL: URL
  private let keychainService: String

  public init(baseURL: URL, keychainService: String = "io.ponti.still.hominem") {
    auth = AuthClient(
      configuration: AuthConfiguration(baseURL: baseURL, keychainService: keychainService))
    self.baseURL = baseURL
    self.keychainService = keychainService
  }

  /// Hominem's production API.
  public static let production = URL(string: "https://api.ponti.io")!

  public func signedInEmail() async throws -> String? {
    // A session saved in the Keychain is trusted only after the server has confirmed it. The
    // client says "signed out" only when the server ended the session; offline or a server error
    // throws and keeps it.
    do {
      return try await auth.getSession()?.email
    } catch {
      // Offline at launch, or the server is having a bad moment: the saved session is still
      // there, so keep showing it.
      if Self.keepsSavedSession(error), let saved = auth.cachedUser() {
        return saved.email
      }
      throw Self.problem(error)
    }
  }

  public func requestCode(email: String) async throws {
    do { try await auth.requestOTP(email: email) } catch { throw Self.problem(error) }
  }

  public func verify(email: String, code: String) async throws -> String {
    do {
      let session = try await auth.verifyOTP(email: email, otp: code)
      return session.user?.email ?? email
    } catch { throw Self.problem(error) }
  }

  public func signOut() async { try? await auth.signOut() }

  public func request(method: String, path: String, body: String?) async throws -> Data {
    do {
      if let body {
        guard let text = body.data(using: .utf8),
          let object = try? JSONSerialization.jsonObject(with: text)
        else { throw StillProblem.other }
        return try await auth.authenticatedRequest(
          path: path, method: method, body: AnyEncodable(value: object))
      }
      return try await auth.authenticatedRequest(path: path, method: method)
    } catch { throw Self.problem(error) }
  }

  /// An error that says nothing about whether the session is still good (no connection, a server
  /// problem), so the saved one stays on screen.
  static func keepsSavedSession(_ error: Error) -> Bool {
    switch error as? HominemAuthError {
    case .network: return true
    case .server(let status, _), .badResponse(let status, _): return status != 401 && status != 403
    default: return false
    }
  }

  /// The client's errors, put into the words the screens use. The categories come from
  /// HominemAuth, so every app sorts them the same way.
  static func problem(_ error: Error) -> StillProblem {
    if let known = error as? StillProblem { return known }
    guard let failure = error as? HominemAuthError else { return .other }
    switch failure.problem {
    case .badCode: return .badCode
    case .tooManyAttempts: return .tooMany
    case .noService: return .noService
    case .signedOut: return .signedOut
    case .other: return .other
    }
  }
}

/// A JSON value decoded without a type, re-encoded for the request. `Bool` is checked before the
/// numbers because a JSON `true` also bridges to `1`.
struct AnyEncodable: Encodable {
  let value: Any

  func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch value {
    case is NSNull: try container.encodeNil()
    case let value as Bool: try container.encode(value)
    case let value as Int: try container.encode(value)
    case let value as Double: try container.encode(value)
    case let value as String: try container.encode(value)
    case let value as [Any]: try container.encode(value.map(AnyEncodable.init(value:)))
    case let value as [String: Any]:
      try container.encode(value.mapValues(AnyEncodable.init(value:)))
    default: throw StillProblem.other
    }
  }
}
