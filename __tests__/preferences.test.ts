import { dismissNudge, isNudgeDismissed } from '../src/core/preferences';

const mockIsDismissed = jest.fn();
const mockDismiss = jest.fn();

jest.mock('../src/platform/NativeStill', () => ({
  NativeStill: () => ({ isNudgeDismissed: () => mockIsDismissed(), dismissNudge: () => mockDismiss() }),
}));

describe('preferences', () => {
  it('reads and writes the nudge flag through the bridge', async () => {
    mockIsDismissed.mockResolvedValueOnce(false);
    await expect(isNudgeDismissed()).resolves.toBe(false);
    dismissNudge();
    expect(mockDismiss).toHaveBeenCalled();
  });
});
