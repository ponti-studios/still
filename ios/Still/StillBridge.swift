import Combine
import Foundation
import React
import StillCore
import UIKit

// Swift: JavaScript calls these `@objc` methods (listed in StillBridge.m); each returns the whole
// account state as JSON and, on every change, a "still" event carries the new state. The work is
// in StillCore's `StillAccount`; this file only connects it to React Native.
/// Still's account on Hominem, running natively.
@objc(StillBridge)
final class StillBridge: RCTEventEmitter {
  private var account: StillAccount?
  private var subscription: AnyCancellable?
  private var observing = false

  @objc override static func requiresMainQueueSetup() -> Bool { true }
  override var methodQueue: DispatchQueue! { .main }
  override func supportedEvents() -> [String]! { ["still"] }

  /// The API this build talks to, so JavaScript can link out (Settings) to the same place.
  override func constantsToExport() -> [AnyHashable: Any]! {
    ["apiBaseURL": Self.baseURL().absoluteString]
  }

  override func startObserving() {
    observing = true
    Task { @MainActor in
      if let account = self.account { self.emit(account.state) }
    }
  }

  override func stopObserving() { observing = false }

  private func emit(_ state: StillAccountState) {
    guard observing else { return }
    sendEvent(withName: "still", body: state.screen)
  }

  /// Builds the account on first use and looks up the saved session. Safe to call again.
  @objc func start(
    _ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      if self.account == nil { self.build() }
      await self.account?.start()
      resolve(self.account?.state.screen)
    }
  }

  // Swift: `#if DEBUG` code exists only in Debug builds. A launch argument such as
  // `-StillAPIBase http://localhost:4040` lands in UserDefaults, so a Debug build can be
  // pointed at a local API; a Release build always uses the real one.
  private static func baseURL() -> URL {
    #if DEBUG
      if let text = UserDefaults.standard.string(forKey: "StillAPIBase"),
        let url = URL(string: text)
      {
        return url
      }
    #endif
    return HominemAccountService.production
  }

  @MainActor
  private func build() {
    let base = Self.baseURL()
    let account = StillAccount(service: HominemAccountService(baseURL: base))
    self.account = account
    subscription = account.$state.sink { [weak self] in self?.emit($0) }
  }

  // Swift: each call runs `work` on the account, then answers JavaScript with the new state.
  // `@escaping` says the closure outlives the call, because it runs later inside the `Task`.
  private func run(
    _ resolve: @escaping RCTPromiseResolveBlock,
    _ work: @escaping @MainActor (StillAccount) async -> Void
  ) {
    Task { @MainActor in
      guard let account = self.account else { return resolve(NSNull()) }
      await work(account)
      resolve(account.state.screen)
    }
  }

  @objc func requestCode(
    _ email: String, resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) { run(resolve) { await $0.requestCode(email: email) } }

  @objc func verify(
    _ code: String, resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) { run(resolve) { await $0.verify(code: code) } }

  @objc func cancelSignIn(
    _ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock
  ) { run(resolve) { $0.cancelSignIn() } }

  @objc func clearProblem(
    _ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock
  ) { run(resolve) { $0.clearProblem() } }

  @objc func signOut(
    _ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock
  ) { run(resolve) { await $0.signOut() } }

  /// An authenticated Hominem API call. Resolves with the parsed JSON (`null` for an empty body)
  /// and rejects with the problem's code and message.
  @objc func api(
    _ method: String, path: String, body: String?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      guard let account = self.account else {
        return reject(StillProblem.signedOut.code, StillProblem.signedOut.message, nil)
      }
      do {
        let data = try await account.api(method: method, path: path, body: body)
        guard !data.isEmpty else { return resolve(NSNull()) }
        resolve(try JSONSerialization.jsonObject(with: data))
      } catch let problem as StillProblem {
        reject(problem.code, problem.message, nil)
      } catch {
        reject(StillProblem.other.code, StillProblem.other.message, nil)
      }
    }
  }

  /// Copies a picked photo into Still's own on-device folder. Resolves with the stored
  /// file URI. Needs no account: photos work signed out.
  @objc func savePhoto(
    _ localUri: String, filename: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      // The picker hands back a file:// URL; accept a bare path too.
      let url: URL
      if let parsed = URL(string: localUri), parsed.scheme != nil {
        url = parsed
      } else {
        url = URL(fileURLWithPath: localUri)
      }
      let stored = try LocalPhotoStore().savePhoto(from: url, filename: filename)
      resolve(stored.absoluteString)
    } catch let problem as StillProblem {
      reject(problem.code, problem.message, nil)
    } catch {
      reject(StillProblem.other.code, StillProblem.other.message, nil)
    }
  }

  /// Removes a stored photo, best effort. Always resolves.
  @objc func deletePhoto(
    _ storedUri: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if let url = URL(string: storedUri) {
      try? LocalPhotoStore().deletePhoto(at: url)
    }
    resolve(NSNull())
  }

  /// Refreshes the on-device library cache from Hominem and resolves with it, API-shaped.
  @objc func syncLibrary(
    _ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      guard let account = self.account else {
        return reject(StillProblem.signedOut.code, StillProblem.signedOut.message, nil)
      }
      do {
        resolve(try await account.syncLibrary())
      } catch let problem as StillProblem {
        reject(problem.code, problem.message, nil)
      } catch {
        reject(StillProblem.other.code, StillProblem.other.message, nil)
      }
    }
  }

  /// The cached library without touching the network. Needs no account: before the
  /// first sync it resolves empty lists.
  @objc func readLibrary(
    _ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      resolve(self.account?.readLibrary() ?? StillLibraryStore.emptyPayload)
    }
  }

  /// Queues a write (offline-capable) and applies it to the cache at once,
  /// resolving with the library to show. `payload` is the API-shaped body as
  /// JSON text; `entityId` is the client's UUID for a create. The following
  /// `syncLibrary` sends the queue.
  @objc func enqueue(
    _ entity: String, kind: String, entityId: String, payload: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      guard let account = self.account else {
        return reject(StillProblem.signedOut.code, StillProblem.signedOut.message, nil)
      }
      resolve(account.enqueue(entity: entity, kind: kind, entityId: entityId, payload: payload))
    }
  }

  /// Notices raised since the last call (e.g. a rolled-back edit). Resolves with
  /// an array of strings, usually empty.
  @objc func takeNotices(
    _ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Task { @MainActor in
      resolve(self.account?.takeNotices() ?? [])
    }
  }

  /// Whether the Overview nudge was dismissed. Kept in the app's defaults.
  @objc func isNudgeDismissed(
    _ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(UserDefaults.standard.bool(forKey: "still-nudge-dismissed"))
  }

  @objc func dismissNudge() {
    UserDefaults.standard.set(true, forKey: "still-nudge-dismissed")
  }
}
