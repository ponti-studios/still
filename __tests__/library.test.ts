import { ApiError } from '../src/core/api';
import { readLibrary, syncLibrary } from '../src/core/library';

const mockSync = jest.fn();
const mockRead = jest.fn();
jest.mock('../src/platform/NativeStill', () => ({
  NativeStill: () => ({
    syncLibrary: (...args: unknown[]) => mockSync(...args),
    readLibrary: (...args: unknown[]) => mockRead(...args),
  }),
}));

const payload = { possessions: [], containers: [], collections: [], membership: {} };

describe('library bridge', () => {
  beforeEach(() => {
    mockSync.mockReset();
    mockRead.mockReset();
  });

  it('passes a well-formed payload through', async () => {
    mockSync.mockResolvedValue(payload);
    mockRead.mockResolvedValue(payload);
    await expect(syncLibrary()).resolves.toEqual(payload);
    await expect(readLibrary()).resolves.toEqual(payload);
  });

  it('rejects a malformed payload', async () => {
    mockSync.mockResolvedValue({ possessions: [] });
    await expect(syncLibrary()).rejects.toThrow('could not be read');
  });

  it('maps a signed-out rejection to 401', async () => {
    mockSync.mockRejectedValue({ code: 'signedOut', message: 'Signed out' });
    const error = await syncLibrary().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
  });
});
