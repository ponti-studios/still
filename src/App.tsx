import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Box, CircleHelp, Grid2X2, LayoutDashboard, MoreHorizontal, Plus, Search, Settings2, ShoppingBag, ShoppingCart, Tag, X, type LucideIcon } from 'lucide-react';
import { settingsUrl, signOut, type AuthUser } from './auth';
import { GroupSheet } from './components/GroupSheet';
import { GroupGrid } from './components/Groups';
import { ItemList, type ItemActions } from './components/ItemList';
import { ItemSheet } from './components/ItemSheet';
import { Menu } from './components/Menu';
import { Nudge, Panels, StatCards } from './components/Overview';
import { Sheet } from './components/Sheet';
import { deriveStats } from './derive';
import { longToday } from './format';
import { useRoute, type Page } from './route';
import { useStore } from './store';
import { SHOPPING, type Group, type GroupKind, type Item, type ItemInput } from './types';

const HELP_URL = 'mailto:cj@ponti.io?subject=Still%20feedback';
const NAV: { section: string; links: [Page, LucideIcon][] }[] = [
  { section: 'WORKSPACE', links: [['Overview', LayoutDashboard], ['Possessions', Grid2X2], ['Shopping', ShoppingCart], ['Orders', ShoppingBag]] },
  { section: 'ORGANIZE', links: [['Containers', Box], ['Collections', Tag], ['Archive', Archive]] },
];
const TABS: [Page, LucideIcon][] = [['Overview', LayoutDashboard], ['Possessions', Grid2X2], ['Shopping', ShoppingCart], ['Orders', ShoppingBag]];
const TITLES: Record<Page, string> = {
  Overview: 'Your things, thoughtfully kept.', Possessions: 'Possessions', Shopping: 'Shopping list', Orders: 'Orders',
  Containers: 'Containers', Collections: 'Collections', Archive: 'Archive',
};
const LIST_TITLES: Record<Page, string> = {
  Overview: 'Recently added', Possessions: 'Everything you own', Shopping: 'Things you’re considering', Orders: 'On their way',
  Containers: 'Items', Collections: 'Items', Archive: 'Past possessions',
};

function readFlag(key: string) {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

export default function App({ user }: { user: AuthUser }) {
  const store = useStore();
  const { items, containers, collections } = store;
  const [route, go] = useRoute();
  const { page } = route;
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [nudgeHidden, setNudgeHidden] = useState(() => readFlag('still-nudge-dismissed'));
  const [itemSheet, setItemSheet] = useState<{ item?: Item; defaults?: Partial<ItemInput> } | null>(null);
  const [groupSheet, setGroupSheet] = useState<{ kind: GroupKind; group?: Group } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  useEffect(() => { setMoreOpen(false); }, [route.page, route.id]);

  const stats = useMemo(() => deriveStats(items), [items]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);
  const kind: GroupKind | null = page === 'Containers' ? 'container' : page === 'Collections' ? 'collection' : null;
  const groups = kind === 'container' ? containers : collections;
  const openGroup = kind && route.id ? groups.find((g) => g.id === route.id) : undefined;

  const pageItems = useMemo(() => {
    const live = items.filter((i) => i.status !== 'Archived');
    if (openGroup && kind) return live.filter((i) => (kind === 'container' ? i.containerId === openGroup.id : i.collectionIds.includes(openGroup.id)));
    switch (page) {
      case 'Possessions': return items.filter((i) => i.status === 'Owned');
      case 'Shopping': return items.filter((i) => SHOPPING.includes(i.status));
      case 'Orders': return items.filter((i) => i.status === 'Ordered');
      case 'Archive': return items.filter((i) => i.status === 'Archived');
      case 'Overview': return live;
      default: return [];
    }
  }, [items, page, openGroup, kind]);

  const actions: ItemActions = {
    onEdit: (item) => setItemSheet({ item }),
    onAdvance: (item) => store.advance(item.id),
    onArchive: (item) => store.updateItem(item.id, { status: item.status === 'Archived' ? 'Owned' : 'Archived' }),
    onDelete: (item) => { if (window.confirm(`Delete “${item.name}”? This can’t be undone.`)) store.deleteItem(item.id); },
  };
  const deleteGroup = (g: Group, k: GroupKind) => {
    if (window.confirm(`Delete “${g.name}”? Its items stay in Still.`)) {
      store.deleteGroup(k, g.id);
      if (route.id === g.id) go(page);
    }
  };

  const heading = openGroup ? openGroup.name : TITLES[page];
  const primary = kind && !openGroup
    ? { label: `New ${kind}`, run: () => setGroupSheet({ kind }) }
    : { label: 'Add item', run: () => setItemSheet({ defaults: openGroup && kind ? (kind === 'container' ? { containerId: openGroup.id } : { collectionIds: [openGroup.id] }) : undefined }) };
  const openItemEmpty = (
    <>
      <p>{page === 'Archive' ? 'Archived items will show up here.' : query ? 'Nothing matches your search.' : 'Nothing here yet.'}</p>
      {page !== 'Archive' && !query && <button className="primary" onClick={() => setItemSheet({})}><Plus size={16} /> Add item</button>}
    </>
  );
  const dismissNudge = () => { setNudgeHidden(true); try { localStorage.setItem('still-nudge-dismissed', '1'); } catch { /* ignore */ } };
  const NavButton = ({ label, Icon }: { label: Page; Icon: LucideIcon }) => (
    <button className={`nav-item ${page === label ? 'selected' : ''}`} aria-current={page === label ? 'page' : undefined} onClick={() => go(label)}><Icon size={18} /> {label}</button>
  );
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();

  if (store.phase !== 'ready') {
    return (
      <div className="splash" role="status">
        {store.phase === 'loading' ? (
          <p>Loading your things…</p>
        ) : (
          <>
            <p>Couldn’t load your things: {store.error}</p>
            <button className="primary" onClick={() => void store.reload()}>Try again</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      {store.notice && (
        <div className="notice" role="alert">
          <span>{store.notice}</span>
          <button className="icon-btn" aria-label="Dismiss" onClick={store.dismissNotice}><X size={16} /></button>
        </div>
      )}
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">s</div><span>still</span></div>
        <nav>{NAV.map((s) => (
          <div className="nav-section" key={s.section}>
            <div className="nav-label">{s.section}</div>
            {s.links.map(([label, Icon]) => <NavButton key={label} label={label} Icon={Icon} />)}
          </div>
        ))}</nav>
        <div className="side-bottom">
          <a className="nav-item" href={settingsUrl()} target="_blank" rel="noreferrer"><Settings2 size={18} /> Settings</a>
          <a className="nav-item" href={HELP_URL}><CircleHelp size={18} /> Help & feedback</a>
          <button className="profile" title="Sign out" onClick={signOut}><div className="avatar">{initials}</div><span>{user.name || user.email}</span><MoreHorizontal size={17} /></button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="crumb">{openGroup ? <button className="back" onClick={() => go(page)}>← {page}</button> : page}</div>
          <div className={`searchbox ${searchOpen ? 'open' : ''}`}>
            <Search size={16} aria-hidden="true" />
            <input ref={searchRef} type="search" aria-label="Search items" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search anything…" />
            <kbd>⌘ K</kbd>
            <button className="icon-btn search-close" aria-label="Close search" onClick={() => { setQuery(''); setSearchOpen(false); }}><X size={18} /></button>
          </div>
          <button className="icon-btn search-toggle" aria-label="Search" onClick={() => setSearchOpen(true)}><Search size={20} /></button>
        </header>

        <div className="content">
          <div className="heading-row">
            <div>
              {page === 'Overview' && <div className="eyebrow">{longToday().toUpperCase()}</div>}
              <h1>{heading}</h1>
              {page === 'Overview' && <p className="subtitle">A clear view of what you own, want, and everything in between.</p>}
              {openGroup?.description && <p className="subtitle">{openGroup.description}</p>}
            </div>
            <div className="heading-actions">
              {openGroup && kind && (
                <Menu label={`Actions for ${openGroup.name}`} items={[
                  { label: 'Rename / edit', onSelect: () => setGroupSheet({ kind, group: openGroup }) },
                  { label: 'Delete…', danger: true, onSelect: () => deleteGroup(openGroup, kind) },
                ]} />
              )}
              {page !== 'Archive' && <button className="primary add" onClick={primary.run}><Plus size={18} /><span>{primary.label}</span></button>}
            </div>
          </div>

          {page === 'Overview' && (
            <>
              <StatCards stats={stats} />
              {stats.unhomed > 0 && !nudgeHidden && <Nudge count={stats.unhomed} onReview={() => go('Possessions')} onDismiss={dismissNudge} />}
            </>
          )}

          {kind && !openGroup && route.id === undefined && (
            <GroupGrid kind={kind} groups={groups} items={items}
              onOpen={(g) => go(page, g.id)} onEdit={(g) => setGroupSheet({ kind, group: g })}
              onDelete={(g) => deleteGroup(g, kind)} onCreate={() => setGroupSheet({ kind })} />
          )}
          {kind && !openGroup && route.id !== undefined && (
            <div className="empty"><p>That {kind} no longer exists.</p><button className="primary" onClick={() => go(page)}>Back to {page}</button></div>
          )}

          {(!kind || openGroup) && (
            <ItemList title={LIST_TITLES[page]} items={pageItems} containers={containers} query={query}
              limit={page === 'Overview' ? 5 : undefined} showControls={page !== 'Overview'} empty={openItemEmpty} actions={actions} />
          )}

          {page === 'Overview' && (
            <Panels containers={containers} items={items} ordered={stats.ordered}
              onSeeAll={() => go('Containers')} onOrders={() => go('Orders')} onCreate={() => setGroupSheet({ kind: 'container' })} />
          )}
        </div>
        <footer><span>Made for the things you keep.</span><span>Still · early access</span></footer>
      </main>

      <nav className="tabbar" aria-label="Primary">
        {TABS.map(([label, Icon]) => (
          <button key={label} className={page === label ? 'selected' : ''} aria-current={page === label ? 'page' : undefined} onClick={() => go(label)}><Icon size={22} /><span>{label}</span></button>
        ))}
        <button className={['Containers', 'Collections', 'Archive'].includes(page) ? 'selected' : ''} onClick={() => setMoreOpen(true)}><MoreHorizontal size={22} /><span>More</span></button>
      </nav>

      {moreOpen && (
        <Sheet title="More" onClose={() => setMoreOpen(false)}>
          <div className="more-list">
            {([['Containers', Box], ['Collections', Tag], ['Archive', Archive]] as [Page, LucideIcon][]).map(([label, Icon]) => (
              <button key={label} className="nav-item" onClick={() => go(label)}><Icon size={20} /> {label}</button>
            ))}
            <a className="nav-item" href={settingsUrl()} target="_blank" rel="noreferrer"><Settings2 size={20} /> Settings</a>
            <a className="nav-item" href={HELP_URL}><CircleHelp size={20} /> Help & feedback</a>
            <button className="profile" onClick={signOut}><div className="avatar">{initials}</div><span>{user.name || user.email}<small>Sign out</small></span></button>
          </div>
        </Sheet>
      )}

      {itemSheet && (
        <ItemSheet item={itemSheet.item} defaults={itemSheet.defaults} containers={containers} collections={collections} categories={categories}
          onSave={(input) => (itemSheet.item ? store.updateItem(itemSheet.item.id, input) : store.addItem(input))} onClose={() => setItemSheet(null)} />
      )}
      {groupSheet && (
        <GroupSheet kind={groupSheet.kind} group={groupSheet.group} onClose={() => setGroupSheet(null)}
          onSave={(data) => (groupSheet.group ? store.updateGroup(groupSheet.kind, groupSheet.group.id, data) : store.addGroup(groupSheet.kind, data))} />
      )}
    </div>
  );
}
