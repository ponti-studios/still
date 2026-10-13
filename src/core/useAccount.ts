import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeStill, stillAvailable, stillEvents, type StillAccountState } from '../platform/NativeStill';
import { stillAccountSchema } from './schemas';

export type AccountController = ReturnType<typeof useAccount>;

const starting: StillAccountState = {
  ready: false,
  email: null,
  step: 'idle',
  pendingEmail: null,
  busy: false,
  problem: null,
  problemCalm: false,
};

/** The person's Still account as the screens use it. The native account does the work; this only shows it and passes taps along. */
export function useAccount() {
  const [screen, setScreen] = useState(starting);

  // The state comes from native code, so it is checked before it is shown. A payload that does not
  // fit is rejected, so a caller never acts on state the screens did not accept.
  const show = useCallback((next: unknown) => {
    const parsed = stillAccountSchema.parse(next);
    setScreen(parsed);
    return parsed;
  }, []);
  const showQuietly = useCallback((next: unknown) => {
    try {
      show(next);
    } catch {
      // An event with a bad payload leaves the screen as it was.
    }
  }, [show]);

  useEffect(() => {
    if (!stillAvailable || !stillEvents) return;
    const subscription = stillEvents.addListener('still', showQuietly);
    NativeStill().start().then(showQuietly).catch(() => undefined);
    return () => subscription.remove();
  }, [showQuietly]);

  const actions = useMemo(
    () => ({
      requestCode: (email: string) => NativeStill().requestCode(email).then(show),
      /** Resolves with the checked state after the code was tried, so the screen can tell if sign-in worked. */
      verify: (code: string) => NativeStill().verify(code).then(show),
      cancelSignIn: () => NativeStill().cancelSignIn().then(show),
      clearProblem: () => NativeStill().clearProblem().then(show),
      signOut: () => NativeStill().signOut().then(show),
    }),
    [show],
  );

  return useMemo(() => ({ ...screen, ...actions }), [screen, actions]);
}
