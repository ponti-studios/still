import Foundation
import StillCore

/// Where the app is pointed. Production unless `HOMINEM_API_URL` says otherwise —
/// a development affordance, not something a shipped app ever sees. The sidebar
/// names it when it is not production, so a stray environment variable pointing
/// at a local API is never a silent failure.
enum APIEndpoint {
    static let baseURL: URL =
        ProcessInfo.processInfo.environment["HOMINEM_API_URL"]
        .flatMap(URL.init(string:))
        ?? HominemAccountService.production

    static var isProduction: Bool { baseURL == HominemAccountService.production }

    static var label: String { baseURL.absoluteString }
}
