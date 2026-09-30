import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ponti-studios/ui/overlays';
import { Button } from '@ponti-studios/ui/primitives';

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean };

export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {items.map((item) => (
          <DropdownMenuItem key={item.label} variant={item.danger ? 'destructive' : 'default'} onClick={item.onSelect}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
