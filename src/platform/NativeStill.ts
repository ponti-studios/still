import { NativeEventEmitter, NativeModules } from 'react-native';
import type * as z from 'zod';
import type { stillAccountSchema } from '../core/schemas';

/** Everything the sign-in screens show. The native account owns it and sends a new one on every change. */
export type StillAccountState = z.infer<typeof stillAccountSchema>;

type NativeStillApi = {
  /** The API this build talks to. Read once at load. Absent in tests. */
  apiBaseURL?: string;
  /** Looks up the saved session. Resolves with the current state. */
  start(): Promise<StillAccountState>;
  requestCode(email: string): Promise<StillAccountState>;
  verify(code: string): Promise<StillAccountState>;
  cancelSignIn(): Promise<StillAccountState>;
  /** Drops the problem on screen, after the person changed what it was about. */
  clearProblem(): Promise<StillAccountState>;
  signOut(): Promise<StillAccountState>;
  /** An authenticated Hominem API call. The session stays in the Keychain; body is JSON text or null. */
  api(method: string, path: string, body: string | null): Promise<unknown>;
  /** Whether the Overview nudge was dismissed. Kept in the app's defaults. */
  isNudgeDismissed(): Promise<boolean>;
  dismissNudge(): void;
};

const native = NativeModules.StillBridge as NativeStillApi | undefined;
export const stillAvailable = Boolean(native);
export const stillEvents = native ? new NativeEventEmitter(NativeModules.StillBridge) : null;

export function NativeStill(): NativeStillApi {
  if (!native) throw new Error('Still account is unavailable. Build and run the iOS app from Xcode.');
  return native;
}

/** The API this build talks to, or null where native is unavailable (tests). */
export function apiBaseURL(): string | null {
  return native?.apiBaseURL ?? null;
}

/** The Hominem settings page for this build's API, or null where native is unavailable. */
export function settingsUrl(): string | null {
  const base = apiBaseURL();
  return base ? `${base}/auth/settings` : null;
}
