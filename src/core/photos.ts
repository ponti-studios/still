import { NativeStill } from '../platform/NativeStill';

export function photoFilename(mimetype: string): string {
  const ext = mimetype === 'image/png' ? 'png' : 'jpg';
  return `item-photo-${Date.now()}.${ext}`;
}

/** Copies a picked photo into Still's on-device folder. Resolves with the stored file URI. */
export async function savePhoto(localUri: string, mimetype: string): Promise<string> {
  const stored = await NativeStill().savePhoto(localUri, photoFilename(mimetype));
  if (typeof stored !== 'string' || !stored.startsWith('file://')) {
    throw new Error('The photo could not be kept. Please try again.');
  }
  return stored;
}

/** Removes a stored photo, best effort: local files only, failures swallowed. */
export async function deleteStoredPhoto(uri: string): Promise<void> {
  if (!uri.startsWith('file://')) return;
  await NativeStill().deletePhoto(uri).catch(() => undefined);
}

/**
 * Cuts the background out of a stored photo. The cutout replaces the
 * original; a photo with no clear subject keeps its original and this
 * rejects with words for the screen.
 */
export async function removePhotoBackground(storedUri: string): Promise<string> {
  const cutout = await NativeStill().removeBackground(storedUri);
  if (typeof cutout !== 'string' || !cutout.startsWith('file://')) {
    throw new Error('No clear subject was found. Try a photo with the item against a plain backdrop.');
  }
  return cutout;
}
