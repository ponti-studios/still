import * as z from 'zod';

/** Everything the sign-in screens show. The native account owns it and sends a new one on every change. */
export const stillAccountSchema = z.object({
  ready: z.boolean(),
  email: z.string().nullable(),
  step: z.enum(['idle', 'codeSent']),
  pendingEmail: z.string().nullable(),
  busy: z.boolean(),
  problem: z.string().nullable(),
  /** True for an ordinary problem (no service, a short wait) that is drawn quietly, not in red. */
  problemCalm: z.boolean(),
});
