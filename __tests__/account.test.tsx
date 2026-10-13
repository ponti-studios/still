import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useAccount, type AccountController } from '../src/core/useAccount';

const good = {
  ready: true,
  email: 'cj@ponti.io',
  step: 'idle',
  pendingEmail: null,
  busy: false,
  problem: null,
  problemCalm: false,
};
const mockStart = jest.fn(() => new Promise(() => undefined));
const mockRequestCode = jest.fn();
const mockVerify = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../src/platform/NativeStill', () => ({
  stillAvailable: true,
  stillEvents: { addListener: () => ({ remove: () => undefined }) },
  NativeStill: () => ({
    start: () => mockStart(),
    requestCode: (email: string) => mockRequestCode(email),
    verify: (code: string) => mockVerify(code),
    cancelSignIn: () => mockRequestCode('cancel'),
    clearProblem: () => mockRequestCode('clear'),
    signOut: () => mockSignOut(),
  }),
}));

function mount() {
  const seen: { current?: AccountController } = {};
  function Probe() {
    const account = useAccount();
    React.useEffect(() => {
      seen.current = account;
    });
    return null;
  }
  ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<Probe />);
  });
  return seen;
}

describe('useAccount.verify', () => {
  it('resolves with the checked state and shows it', async () => {
    mockVerify.mockResolvedValueOnce(good);
    const seen = mount();
    let result: unknown;
    await ReactTestRenderer.act(async () => {
      result = await seen.current?.verify('123456');
    });
    expect(result).toEqual(good);
    expect(seen.current?.email).toBe('cj@ponti.io');
  });

  it('rejects a payload the screens would not accept, and leaves the screen alone', async () => {
    mockVerify.mockResolvedValueOnce({ ...good, step: 'later' });
    const seen = mount();
    await ReactTestRenderer.act(async () => {
      await expect(seen.current?.verify('123456')).rejects.toThrow();
    });
    expect(seen.current?.email).toBeNull();
  });
});

describe('useAccount.requestCode', () => {
  it('shows the code-sent step', async () => {
    mockRequestCode.mockResolvedValueOnce({ ...good, email: null, step: 'codeSent', pendingEmail: 'cj@ponti.io' });
    const seen = mount();
    await ReactTestRenderer.act(async () => {
      await seen.current?.requestCode('cj@ponti.io');
    });
    expect(seen.current?.step).toBe('codeSent');
    expect(seen.current?.pendingEmail).toBe('cj@ponti.io');
  });
});
