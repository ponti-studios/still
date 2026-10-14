import { NativeStill } from '../platform/NativeStill';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// Every call carries the Hominem session from the Keychain (native side holds it, so the cookies
// never cross the bridge). A 401 means the session ended: native already cleared the account, so
// the screens flip to sign-in on the state change and callers just skip their own error handling.
export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  try {
    // The bridge takes the absolute API path; Still's paths leave the /api prefix off, like the web app did.
    return (await NativeStill().api(method, `/api${path}`, body === undefined ? null : JSON.stringify(body))) as T;
  } catch (e) {
    throw toApiError(e);
  }
}

export function toApiError(e: unknown): ApiError {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  const message = e instanceof Error ? e.message : 'Something went wrong';
  // Only 401 is acted on; every other failure is shown with the native message.
  if (code === 'signedOut') return new ApiError('Signed out', 401);
  return new ApiError(message, 0);
}
