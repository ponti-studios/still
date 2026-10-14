import { fromPossession, toPossessionPayload } from '../src/core/mapping';
import { deleteStoredPhoto, photoFilename, savePhoto } from '../src/core/photos';
import type { ApiPossession } from '../src/core/apiTypes';

const mockSave = jest.fn();
const mockDelete = jest.fn();
jest.mock('../src/platform/NativeStill', () => ({
  NativeStill: () => ({
    savePhoto: (...args: unknown[]) => mockSave(...args),
    deletePhoto: (...args: unknown[]) => mockDelete(...args),
  }),
}));

const possession = (metadata: Record<string, unknown>): ApiPossession => ({
  id: 'p1', name: 'Lamp', category: 'home', status: 'owned', isArchived: false,
  acquiredDate: null, priceCents: 1200, currencyCode: 'GBP',
  containerId: null, metadata, createdAt: '2025-01-10T00:00:00Z',
});

describe('item photos', () => {
  beforeEach(() => {
    mockSave.mockReset();
    mockDelete.mockReset();
  });

  it('names stored photos by mimetype', () => {
    expect(photoFilename('image/jpeg')).toMatch(/^item-photo-\d+\.jpg$/);
    expect(photoFilename('image/png')).toMatch(/^item-photo-\d+\.png$/);
    expect(photoFilename('image/heic')).toMatch(/^item-photo-\d+\.jpg$/);
  });

  it('saves through the bridge and returns the stored file URI', async () => {
    mockSave.mockResolvedValue('file:///stored/item-photo-1.jpg');
    await expect(savePhoto('file:///tmp/x.jpg', 'image/jpeg')).resolves.toBe('file:///stored/item-photo-1.jpg');
    expect(mockSave).toHaveBeenCalledWith('file:///tmp/x.jpg', expect.stringMatching(/^item-photo-\d+\.jpg$/));
  });

  it('rejects a stored value that is not a local file', async () => {
    mockSave.mockResolvedValue('https://cdn/x.jpg');
    await expect(savePhoto('file:///tmp/x.jpg', 'image/jpeg')).rejects.toThrow('could not be kept');
  });

  it('deletes stored files but leaves remote URLs alone', async () => {
    mockDelete.mockResolvedValue(null);
    await deleteStoredPhoto('file:///stored/item-photo-1.jpg');
    expect(mockDelete).toHaveBeenCalledWith('file:///stored/item-photo-1.jpg');
    await deleteStoredPhoto('https://cdn/x.jpg');
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('swallows deletion failures', async () => {
    mockDelete.mockRejectedValue(new Error('gone'));
    await expect(deleteStoredPhoto('file:///stored/x.jpg')).resolves.toBeUndefined();
  });

  it('reads the photo from possession metadata', () => {
    expect(fromPossession(possession({ imageUrl: 'file:///stored/x.jpg' }))).toMatchObject({
      imageUrl: 'file:///stored/x.jpg',
    });
    expect(fromPossession(possession({}))).not.toHaveProperty('imageUrl');
    expect(fromPossession(possession({ imageUrl: 42 }))).not.toHaveProperty('imageUrl');
  });

  it('sends the photo URI in metadata without clobbering the vendor', () => {
    expect(toPossessionPayload({ imageUrl: 'file:///stored/x.jpg' })).toEqual({
      metadata: { imageUrl: 'file:///stored/x.jpg' },
    });
    expect(toPossessionPayload({ vendor: 'Ikea', imageUrl: 'file:///stored/x.jpg' })).toEqual({
      metadata: { vendor: 'Ikea', imageUrl: 'file:///stored/x.jpg' },
    });
  });

  it('removes the photo when the key is explicitly undefined', () => {
    const patch: { imageUrl?: string } = { imageUrl: undefined };
    expect(toPossessionPayload(patch)).toEqual({ metadata: { imageUrl: null } });
  });

  it('leaves metadata alone when the photo is untouched', () => {
    expect(toPossessionPayload({ name: 'Lamp' })).toEqual({ name: 'Lamp' });
  });
});
