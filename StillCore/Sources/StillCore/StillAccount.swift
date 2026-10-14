import Foundation

/// What the sign-in screens show: whether someone is signed in and where sign-in has got to.
public struct StillAccountState: Equatable, Sendable {
  public enum Step: String, Sendable { case idle, codeSent }

  public var email: String?
  public var step = Step.idle
  /// The address a code was sent to, while a sign-in is under way.
  public var pendingEmail: String?
  public var busy = false
  public var problem: StillProblem?
  /// False until the saved session has been looked up, so the screens do not flash "Sign in".
  public var ready = false

  public init() {}

  // Swift: `[String: Any]` is a dictionary with text keys and any kind of value. React Native turns
  // it into a JavaScript object. `NSNull()` is how a missing value becomes `null` there (a Swift
  // `nil` would remove the key).
  /// The state as plain JSON types, for the React Native screens.
  public var screen: [String: Any] {
    [
      "ready": ready,
      "email": email ?? NSNull(),
      "step": step.rawValue,
      "pendingEmail": pendingEmail ?? NSNull(),
      "busy": busy,
      "problem": problem?.message ?? NSNull(),
      "problemCalm": problem?.isCalm ?? false,
    ]
  }
}

// Swift: `@MainActor` means every call runs on the main thread, so `state` can be read by the
// screens without locks. `ObservableObject` and `@Published` let other code subscribe to changes
// (the bridge does, to send them to JavaScript). `async` methods can wait for the network without
// blocking the app.
/// The person's Still account: sign in with an email code, sign out. The server holds the
/// session; this holds only what the screens need.
@MainActor
public final class StillAccount: ObservableObject {
  @Published public private(set) var state = StillAccountState()
  private let service: StillAccountService
  private let library: StillLibraryStore

  public init(service: StillAccountService, library: StillLibraryStore = StillLibraryStore()) {
    self.service = service
    self.library = library
  }

  /// Looks up the saved session. Signed out is an answer; a failed lookup is not, so its reason
  /// is kept for the next try.
  public func start() async {
    var email: String?
    var problem: StillProblem?
    do {
      email = try await service.signedInEmail()
    } catch {
      let found = Self.problem(error)
      if found != .signedOut { problem = found }
    }
    update {
      $0.email = email
      $0.problem = problem
      $0.ready = true
    }
  }

  public func requestCode(email: String) async {
    let address = email.trimmingCharacters(in: .whitespacesAndNewlines)
    guard address.contains("@"), address.contains("."), !state.busy else {
      return update { $0.problem = .badEmail }
    }
    update {
      $0.busy = true
      $0.problem = nil
    }
    do {
      try await service.requestCode(email: address)
      update {
        $0.step = .codeSent
        $0.pendingEmail = address
        $0.busy = false
      }
    } catch {
      update {
        $0.busy = false
        $0.problem = Self.problem(error)
      }
    }
  }

  /// Checks the code. A good code signs in.
  public func verify(code: String) async {
    let digits = code.filter(\.isNumber)
    guard let address = state.pendingEmail, !state.busy else { return }
    guard digits.count == 6 else { return update { $0.problem = .badCode } }
    update {
      $0.busy = true
      $0.problem = nil
    }
    do {
      let email = try await service.verify(email: address, code: digits)
      update {
        $0.email = email
        $0.step = .idle
        $0.pendingEmail = nil
        $0.busy = false
      }
    } catch {
      update {
        $0.busy = false
        $0.problem = Self.problem(error)
      }
    }
  }

  /// Backs out of a sign-in that is under way, so the sheet can start again.
  public func cancelSignIn() {
    update {
      $0.step = .idle
      $0.pendingEmail = nil
      $0.problem = nil
    }
  }

  /// Drops the problem on screen, because the person changed what it was about (typed in the field,
  /// closed the sheet). Does nothing when there is none, so no change is sent.
  public func clearProblem() {
    guard state.problem != nil else { return }
    update { $0.problem = nil }
  }

  public func signOut() async {
    await service.signOut()
    library.clear()
    update {
      $0.email = nil
      $0.step = .idle
      $0.pendingEmail = nil
      $0.problem = nil
    }
  }

  /// An authenticated Hominem API call for the screens. Throws `StillProblem`. A session that
  /// has run out clears the email, so the screens flip to sign-in on the state change.
  public func api(method: String, path: String, body: String?) async throws -> Data {
    try await guardingSession { try await service.request(method: method, path: path, body: body) }
  }

  /// Refreshes the on-device library cache from Hominem and returns it, API-shaped.
  /// Throws `StillProblem`, with the same session handling as `api`.
  public func syncLibrary() async throws -> [String: Any] {
    try await guardingSession { try await LibrarySync(service: service, store: library).sync() }
  }

  /// The cached library, API-shaped, without touching the network. Empty lists when
  /// nothing is cached yet.
  public func readLibrary() -> [String: Any] {
    library.readPayload()
  }

  private func guardingSession<T>(_ work: () async throws -> T) async throws -> T {
    do {
      return try await work()
    } catch {
      if Self.problem(error) == .signedOut {
        update {
          $0.email = nil
          $0.step = .idle
          $0.pendingEmail = nil
        }
      }
      throw error
    }
  }

  // Swift: `mutate(&state)` hands the closure a changeable copy; assigning it back is what makes
  // `@Published` notify subscribers once per change.
  private func update(_ change: (inout StillAccountState) -> Void) {
    var next = state
    change(&next)
    state = next
  }

  static func problem(_ error: Error) -> StillProblem {
    (error as? StillProblem) ?? .other
  }
}
