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
