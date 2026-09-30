import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@ponti-studios/ui/overlays';

// The package's Dialog switches from bottom sheet to centred modal at `sm`; Still's shell switches at `md`,
// so undo the `sm:` layout and re-apply it at `md:`. Mobile also clears the home indicator (viewport-fit=cover).
const LAYOUT = [
  'sm:top-auto sm:bottom-0 sm:left-0 sm:w-full sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-t-xl sm:rounded-b-none sm:p-4',
  'pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-[max(1rem,env(safe-area-inset-bottom))]',
  'md:top-1/2 md:bottom-auto md:left-1/2 md:w-[calc(100%-2rem)] md:max-w-[30rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:p-6',
].join(' ');

// A bottom sheet on phones, a centred modal on larger screens (the package's Dialog does both).
export function Sheet({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={LAYOUT}>
        <DialogHeader>
          {eyebrow && <div className="ui-eyebrow">{eyebrow}</div>}
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
