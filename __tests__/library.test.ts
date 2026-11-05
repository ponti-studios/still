import { ApiError } from '../src/core/api';
import { enqueueOp, readLibrary, syncLibrary, takeNotices } from '../src/core/library';

const mockSync = jest.fn();
const mockRead = jest.fn();
const mockEnqueue = jest.fn();
const mockNotices = jest.fn();
jest.mock('../src/platform/NativeStill', () => ({
  NativeStill: () => ({
    syncLibrary: (...args: unknown[]) => mockSync(...args),
    readLibrary: (...args: unknown[]) => mockRead(...args),
    enqueue: (...args: unknown[]) => mockEnqueue(...args),
    takeNotices: (...args: unknown[]) => mockNotices(...args),
  }),
}));

const payload = { possessions: [], containers: [], collections: [], membership: {} };

describe('library bridge', () => {
  beforeEach(() => {
    mockSync.mockReset();
    mockRead.mockReset();
    mockEnqueue.mockReset();
    mockNotices.mockReset();
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

  it('sends an op as fields with the payload as JSON text', async () => {
    mockEnqueue.mockResolvedValue(payload);
    await expect(
      enqueueOp({ entity: 'possession', kind: 'create', entityId: 'c1', payload: { name: 'Lamp' } }),
    ).resolves.toEqual(payload);
    expect(mockEnqueue).toHaveBeenCalledWith('possession', 'create', 'c1', '{"name":"Lamp"}');
  });

  it('drains notices, tolerating a non-array answer', async () => {
    mockNotices.mockResolvedValue(['a rolled-back edit']);
    await expect(takeNotices()).resolves.toEqual(['a rolled-back edit']);
    mockNotices.mockResolvedValue(null);
    await expect(takeNotices()).resolves.toEqual([]);
  });
});
