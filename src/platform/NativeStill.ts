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
  /** Copies a picked photo into Still's on-device folder. Resolves with the stored file URI. */
  savePhoto(localUri: string, filename: string): Promise<string>;
  /** Removes a stored photo, best effort. */
  deletePhoto(storedUri: string): Promise<null>;
  /** Refreshes the on-device library cache from Hominem and resolves with it, API-shaped. */
  syncLibrary(): Promise<unknown>;
  /** The cached library without touching the network. Empty lists before the first sync. */
  readLibrary(): Promise<unknown>;
  /** Queues a write (offline-capable) and applies it to the cache at once. `payload` is JSON text. */
  enqueue(entity: string, kind: string, entityId: string, payload: string): Promise<unknown>;
  /** Notices raised since the last call (e.g. a rolled-back edit), as strings. */
  takeNotices(): Promise<string[]>;
  /** Whether the Overview nudge was dismissed. Kept in the app's defaults. */
  isNudgeDismissed(): Promise<boolean>;
  dismissNudge(): void;
};

const native = NativeModules.StillBridge as NativeStillApi | undefined;
export const stillAvailable = Boolean(native);
export const stillEvents = native ? new NativeEventEmitter(NativeModules.StillBridge) : null;

/** A library native refreshed on its own, usually right after the network returned. */
export type LibraryEvent = { library: unknown; notices: string[] };

/**
 * Subscribes to native's post-reconnect refreshes, so a queued edit appears and
 * lands without the person reopening the app. Returns a removable subscription,
 * or undefined where native is unavailable (tests).
 */
export function onLibraryChanged(listener: (event: LibraryEvent) => void) {
  const wrapped = (event: unknown) => listener(event as LibraryEvent);
  return stillEvents?.addListener('stillLibrary', wrapped);
}

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
