import { NativeStill } from '../platform/NativeStill';

/** Whether the Overview nudge was dismissed. Kept in the app's defaults (native side). */
export const isNudgeDismissed = () => NativeStill().isNudgeDismissed();
export const dismissNudge = () => NativeStill().dismissNudge();
