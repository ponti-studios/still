import { api, ApiError } from '../src/core/api';

const mockBridgeApi = jest.fn();

jest.mock('../src/platform/NativeStill', () => ({
  NativeStill: () => ({ api: (...args: unknown[]) => mockBridgeApi(...args) }),
}));

describe('api', () => {
  it('sends the method, path and JSON body across the bridge', async () => {
    mockBridgeApi.mockResolvedValueOnce({ ok: true });
    await expect(api('POST', '/collections', { name: 'X' })).resolves.toEqual({ ok: true });
    expect(mockBridgeApi).toHaveBeenCalledWith('POST', '/api/collections', '{"name":"X"}');
  });

  it('sends null for a bodyless call', async () => {
    mockBridgeApi.mockResolvedValueOnce([]);
    await api('GET', '/possessions');
    expect(mockBridgeApi).toHaveBeenCalledWith('GET', '/api/possessions', null);
  });

  it('maps a signed-out rejection to a 401', async () => {
    mockBridgeApi.mockRejectedValueOnce(Object.assign(new Error('Signed out'), { code: 'signedOut' }));
    const failure = await api('GET', '/possessions').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(401);
  });

  it('keeps the native message for other failures', async () => {
    mockBridgeApi.mockRejectedValueOnce(Object.assign(new Error('No service'), { code: 'noService' }));
    const failure = await api('GET', '/possessions').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).message).toContain('No service');
    expect((failure as ApiError).status).toBe(0);
  });
});
