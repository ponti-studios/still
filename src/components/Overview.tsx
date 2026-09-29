import { ArrowUpRight, Grid2X2, ShoppingBag, ShoppingCart, X } from 'lucide-react';
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
    { label: 'IN YOUR POSSESSION', icon: <Grid2X2 size={16} />, value: stats.owned, unit: 'items', foot: stats.ownedAddedThisMonth ? `${stats.ownedAddedThisMonth} added this month` : 'Nothing added this month' },
    { label: 'ON YOUR MIND', icon: <ShoppingCart size={16} />, value: stats.shopping, unit: 'items', foot: stats.shopping ? `Across ${plural(stats.shoppingCategories, 'category', 'categories')}` : 'Nothing on the list' },
    { label: 'ESTIMATED VALUE', icon: <ArrowUpRight size={16} />, value: money(mainTotal, mainCurrency), foot: others ? `Plus ${others}` : `Across ${plural(stats.owned, 'owned item')}` },
    { label: 'ORDERS IN FLIGHT', icon: <ShoppingBag size={16} />, value: stats.ordered.length, unit: stats.ordered.length === 1 ? 'order' : 'orders', foot: stats.ordered[0] ? `Latest: ${stats.ordered[0].name}` : 'Nothing on its way' },
  ];
  return (
    <div className="stats">
      {cards.map((c) => (
        <div className="stat-card" key={c.label}>
          <div className="stat-label">{c.label} {c.icon}</div>
          <strong>{c.value}{c.unit && <small> {c.unit}</small>}</strong>
          <div className="stat-foot">{c.foot}</div>
        </div>
      ))}
    </div>
  );
}

export function Nudge({ count, onReview, onDismiss }: { count: number; onReview: () => void; onDismiss: () => void }) {
  return (
    <section className="nudge">
      <div className="nudge-icon" aria-hidden="true">📦</div>
      <div className="nudge-copy">
        <span className="eyebrow">A SMALL NUDGE</span>
        <b>Make room for something new?</b>
        <span>{plural(count, 'item')} without a home yet. Put {count === 1 ? 'it' : 'them'} in a container.</span>
      </div>
      <button className="link" onClick={onReview}>Review items →</button>
      <button className="icon-btn dismiss" aria-label="Dismiss" onClick={onDismiss}><X size={16} /></button>
    </section>
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
    <div className="panels">
      <section className="panel">
        <div className="panel-title"><h3>Spaces & places</h3>{containers.length > 0 && <button className="link" onClick={onSeeAll}>See all →</button>}</div>
        {top.length === 0 ? (
          <p className="muted">No containers yet. <button className="link" onClick={onCreate}>Create one</button> to give your things a home.</p>
        ) : top.map((c) => (
          <div className="panel-row" key={c.id}>
            <div className="emoji">{c.icon}</div>
            <span><b>{c.name}</b>{c.description && <small>{c.description}</small>}</span>
            <span className="count">{plural(countIn('container', c, items), 'item')}</span>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-title"><h3>Coming up</h3>{ordered.length > 0 && <button className="link" onClick={onOrders}>View orders →</button>}</div>
        {ordered.length === 0 ? <p className="muted">Nothing is on its way right now.</p> : ordered.slice(0, 3).map((o) => (
          <div className="panel-row" key={o.id}>
            <div className="emoji">{o.icon}</div>
            <span><b>{o.name}</b><small>{o.vendor ? `From ${o.vendor} · ` : ''}Ordered {shortDate(o.date)}</small></span>
            <span className="status-pill">ORDERED</span>
          </div>
        ))}
      </section>
    </div>
  );
}
