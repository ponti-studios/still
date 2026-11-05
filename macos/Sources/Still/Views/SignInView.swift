import SwiftUI
import StillMacCore
import StillCore

/// The sign-in screen, backed by the shared StillCore account state machine so
/// the Mac app uses the same session and the same words as the iOS app.
struct SignInView: View {
    @EnvironmentObject private var account: StillAccount
    @State private var email = ""
    @State private var code = ""
    @FocusState private var focus: Field?

    private enum Field { case email, code }

    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "shippingbox")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("Still")
                .font(.largeTitle.weight(.bold))
            Text(account.state.step == .codeSent
                ? "Enter the code we emailed to \(account.state.pendingEmail ?? "your address")."
                : "Sign in to see your things on every device.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 320)

            switch account.state.step {
            case .idle:
                TextField("Email", text: $email)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 260)
                    .focused($focus, equals: .email)
                    .onSubmit(requestCode)
                    .disabled(account.state.busy)
                Button("Send Code", action: requestCode)
                    .buttonStyle(.borderedProminent)
                    .disabled(account.state.busy || email.trimmingCharacters(in: .whitespaces).isEmpty)
            case .codeSent:
                TextField("6-digit code", text: $code)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 160)
                    .focused($focus, equals: .code)
                    .onSubmit(verify)
                    .disabled(account.state.busy)
                HStack(spacing: 12) {
                    Button("Back") { account.cancelSignIn() }
                    Button("Sign In", action: verify)
                        .buttonStyle(.borderedProminent)
                        .disabled(account.state.busy)
                }
            }

            if let problem = account.state.problem {
                Text(problem.message)
                    .font(.callout)
                    .foregroundStyle(problem.isCalm ? Color.secondary : Color.red)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 320)
            }
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear { focus = .email }
    }

    private func requestCode() {
        let address = email.trimmingCharacters(in: .whitespaces)
        guard !address.isEmpty else { return }
        Task { await account.requestCode(email: address) }
    }

    private func verify() {
        let digits = code.filter(\.isNumber)
        guard !digits.isEmpty else { return }
        Task { await account.verify(code: digits) }
    }
}

/// The toolbar account control: who is signed in, and the way out.
struct AccountMenu: View {
    @EnvironmentObject private var account: StillAccount

    var body: some View {
        Menu {
            if let email = account.state.email {
                Text(email)
                Divider()
                Button("Sign Out") {
                    Task { await account.signOut() }
                }
            } else {
                Text("Signed out")
            }
        } label: {
            Label("Account", systemImage: account.state.email == nil ? "person.crop.circle.badge.questionmark" : "person.crop.circle")
        }
        .help(account.state.email ?? "Signed out")
    }
}
