import { NativeModules } from 'react-native';

type HapticsApi = {
  impact(style: string): Promise<null>;
  notify(type: string): Promise<null>;
  select(): Promise<null>;
};

const native = NativeModules.Haptics as HapticsApi | undefined;

/** A tap with weight behind it. Silent where native is absent (tests). */
export async function impact(style: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' = 'medium'): Promise<void> {
  await native?.impact(style).catch(() => undefined);
}

/** Success, warning, or error. For saves, cutouts, sign-in. */
export async function notify(type: 'success' | 'warning' | 'error' = 'success'): Promise<void> {
  await native?.notify(type).catch(() => undefined);
}

/** The tick under a finger moving across options. For chips and segments. */
export async function select(): Promise<void> {
  await native?.select().catch(() => undefined);
}
