import { X } from 'lucide-react';
import { MetricCard } from '@ponti-studios/ui/data-display';
import { Button, Badge, Card } from '@ponti-studios/ui/primitives';
import { countIn } from './Groups';
import { deriveStats } from '../derive';
import { money, plural, shortDate } from '../format';
import type { Group, Item } from '../types';

type Stats = ReturnType<typeof deriveStats>;

export function StatCards({ stats }: { stats: Stats }) {
  // Items can be priced in different currencies; show the biggest total and mention the rest.
  const totals = Object.entries(stats.worth).sort((a, b) => b[1] - a[1]);
  const [mainCurrency, mainTotal] = totals[0] ?? ['GBP', 0];
  const others = totals.slice(1).filter(([, total]) => total > 0).map(([currency, total]) => money(total, currency)).join(' + ');
  const cards = [
    { label: 'In your possession', value: plural(stats.owned, 'item'), foot: stats.ownedAddedThisMonth ? `${stats.ownedAddedThisMonth} added this month` : 'Nothing added this month' },
    { label: 'On your mind', value: plural(stats.shopping, 'item'), foot: stats.shopping ? `Across ${plural(stats.shoppingCategories, 'category', 'categories')}` : 'Nothing on the list' },
    { label: 'Estimated value', value: money(mainTotal, mainCurrency), foot: others ? `Plus ${others}` : `Across ${plural(stats.owned, 'owned item')}` },
    { label: 'Orders in flight', value: plural(stats.ordered.length, 'order'), foot: stats.ordered[0] ? `Latest: ${stats.ordered[0].name}` : 'Nothing on its way' },
  ];
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => <MetricCard key={c.label} label={c.label} value={c.value} change={c.foot} />)}
    </div>
  );
}

export function Nudge({ count, onReview, onDismiss }: { count: number; onReview: () => void; onDismiss: () => void }) {
  return (
    <Card className="bg-muted mb-6 flex-row items-start gap-3 p-4">
      <div className="text-2xl" aria-hidden="true">📦</div>
      <div className="flex flex-1 flex-col items-start gap-1 text-sm">
        <span className="ui-eyebrow">A small nudge</span>
        <b>Make room for something new?</b>
        <span className="text-muted-foreground">{plural(count, 'item')} without a home yet. Put {count === 1 ? 'it' : 'them'} in a container.</span>
        <Button variant="link" size="sm" onClick={onReview}>Review items →</Button>
      </div>
      <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={onDismiss}><X /></Button>
    </Card>
  );
}

function PanelRow({ icon, title, sub, aside }: { icon: string; title: string; sub?: string; aside: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t py-2 first:border-t-0">
      <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md text-xl">{icon}</div>
      <span className="min-w-0 flex-1 text-sm"><b className="block truncate">{title}</b>{sub && <small className="text-muted-foreground block truncate text-xs">{sub}</small>}</span>
      {aside}
    </div>
  );
}

export function Panels({ containers, items, ordered, onSeeAll, onOrders, onCreate }: {
  containers: Group[];
  items: Item[];
  ordered: Item[];
  onSeeAll: () => void;
  onOrders: () => void;
  onCreate: () => void;
}) {
  const top = [...containers].sort((a, b) => countIn('container', b, items) - countIn('container', a, items)).slice(0, 3);
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <Card className="gap-2 p-4">
        <div className="flex min-h-8 items-center justify-between"><h3 className="font-semibold">Spaces & places</h3>{containers.length > 0 && <Button variant="link" size="sm" onClick={onSeeAll}>See all →</Button>}</div>
        {top.length === 0 ? (
          <p className="text-muted-foreground text-sm">No containers yet. <Button variant="link" size="sm" onClick={onCreate}>Create one</Button> to give your things a home.</p>
        ) : top.map((c) => (
          <PanelRow key={c.id} icon={c.icon} title={c.name} sub={c.description || undefined}
            aside={<span className="text-muted-foreground text-xs">{plural(countIn('container', c, items), 'item')}</span>} />
        ))}
      </Card>
      <Card className="gap-2 p-4">
        <div className="flex min-h-8 items-center justify-between"><h3 className="font-semibold">Coming up</h3>{ordered.length > 0 && <Button variant="link" size="sm" onClick={onOrders}>View orders →</Button>}</div>
        {ordered.length === 0 ? <p className="text-muted-foreground text-sm">Nothing is on its way right now.</p> : ordered.slice(0, 3).map((o) => (
          <PanelRow key={o.id} icon={o.icon} title={o.name} sub={`${o.vendor ? `From ${o.vendor} · ` : ''}Ordered ${shortDate(o.date)}`}
            aside={<Badge variant="secondary">Ordered</Badge>} />
        ))}
      </Card>
    </div>
  );
}
