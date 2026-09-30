import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Box, CircleHelp, Grid2X2, LayoutDashboard, MoreHorizontal, Plus, Search, Settings2, ShoppingBag, ShoppingCart, Tag, X, type LucideIcon } from 'lucide-react';
import { Alert, AlertDescription, EmptyState, Spinner } from '@ponti-studios/ui/feedback';
import { Input } from '@ponti-studios/ui/forms';
import { Avatar, AvatarFallback, Button } from '@ponti-studios/ui/primitives';
import { cn } from '@ponti-studios/ui/utilities';
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
      {page !== 'Archive' && !query && <Button className="mt-3" onClick={() => setItemSheet({})}><Plus /> Add item</Button>}
    </>
  );
  const dismissNudge = () => { setNudgeHidden(true); try { localStorage.setItem('still-nudge-dismissed', '1'); } catch { /* ignore */ } };
  const navClass = 'h-10 w-full justify-start px-3 font-normal';
  const NavButton = ({ label, Icon }: { label: Page; Icon: LucideIcon }) => (
    <Button variant="ghost" className={cn(navClass, page === label && 'bg-muted font-medium')} aria-current={page === label ? 'page' : undefined} onClick={() => go(label)}><Icon /> {label}</Button>
  );
  const initials = (user.name || user.email).slice(0, 2).toUpperCase();
  const userAvatar = <Avatar size="lg"><AvatarFallback>{initials}</AvatarFallback></Avatar>;

  if (store.phase !== 'ready') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center" role="status">
        {store.phase === 'loading' ? (
          <><Spinner /><p className="text-muted-foreground">Loading your things…</p></>
        ) : (
          <>
            <Alert variant="destructive" className="max-w-md"><AlertDescription>Couldn’t load your things: {store.error}</AlertDescription></Alert>
            <Button onClick={() => void store.reload()}>Try again</Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      {store.notice && (
        <Alert variant="destructive" className="fixed top-2 right-2 left-2 z-[60] flex items-center justify-between gap-2 md:left-60 md:w-auto">
          <span>{store.notice}</span>
          <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={store.dismissNotice}><X /></Button>
        </Alert>
      )}
      <aside className="bg-card fixed inset-y-0 left-0 z-10 hidden w-58 flex-col overflow-y-auto border-r px-3 pt-5 pb-3 md:flex">
        <div className="mx-2 mb-5 flex items-center gap-2 text-xl font-semibold"><div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">s</div><span>still</span></div>
        <nav>{NAV.map((s) => (
          <div className="mb-4" key={s.section}>
            <div className="ui-eyebrow mx-3 mb-1.5">{s.section}</div>
            {s.links.map(([label, Icon]) => <NavButton key={label} label={label} Icon={Icon} />)}
          </div>
        ))}</nav>
        <div className="mt-auto flex flex-col gap-1">
          <Button variant="ghost" className={navClass} asChild><a href={settingsUrl()} target="_blank" rel="noreferrer"><Settings2 /> Settings</a></Button>
          <Button variant="ghost" className={navClass} asChild><a href={HELP_URL}><CircleHelp /> Help & feedback</a></Button>
          <Button variant="ghost" className="mt-2 h-12 w-full justify-start gap-2.5 px-3 font-medium" title="Sign out" onClick={signOut}>{userAvatar}<span className="min-w-0 flex-1 truncate text-left">{user.name || user.email}</span><MoreHorizontal /></Button>
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:ml-58 md:pb-0">
        <header className="bg-background/90 sticky top-0 z-[5] flex h-14 items-center justify-between border-b px-4 backdrop-blur md:px-8">
          <div className="text-lg font-semibold">{openGroup ? <Button variant="link" onClick={() => go(page)}>← {page}</Button> : page}</div>
          <div className={cn('items-center gap-2', searchOpen ? 'bg-background absolute inset-0 flex px-4' : 'hidden md:flex md:w-80')}>
            <Search className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
            <Input ref={searchRef} type="search" aria-label="Search items" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search anything…  ⌘K" />
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Close search" onClick={() => { setQuery(''); setSearchOpen(false); }}><X /></Button>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Search" onClick={() => setSearchOpen(true)}><Search /></Button>
        </header>

        <div className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-2 md:px-8 md:pt-8">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              {page === 'Overview' && <div className="ui-eyebrow mb-1.5">{longToday()}</div>}
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{heading}</h1>
              {page === 'Overview' && <p className="text-muted-foreground mt-1.5 text-sm">A clear view of what you own, want, and everything in between.</p>}
              {openGroup?.description && <p className="text-muted-foreground mt-1.5 text-sm">{openGroup.description}</p>}
            </div>
            <div className="flex items-center gap-1">
              {openGroup && kind && (
                <Menu label={`Actions for ${openGroup.name}`} items={[
                  { label: 'Rename / edit', onSelect: () => setGroupSheet({ kind, group: openGroup }) },
                  { label: 'Delete…', danger: true, onSelect: () => deleteGroup(openGroup, kind) },
                ]} />
              )}
              {page !== 'Archive' && (
                <Button size="lg" className="fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.875rem)] z-[5] h-13 rounded-full px-5 shadow-lg md:static md:h-auto md:rounded-md md:px-4 md:shadow-none" onClick={primary.run}><Plus /><span>{primary.label}</span></Button>
              )}
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
            <EmptyState variant="dashed" title={`That ${kind} no longer exists.`} action={<Button onClick={() => go(page)}>Back to {page}</Button>} />
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
        <footer className="text-muted-foreground hidden justify-between px-8 py-4 text-xs md:flex"><span>Made for the things you keep.</span><span>Still · early access</span></footer>
      </main>

      <nav className="bg-background/95 fixed inset-x-0 bottom-0 z-[5] grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Primary">
        {TABS.map(([label, Icon]) => (
          <Button key={label} variant="ghost" className={cn('h-full flex-col gap-0.5 rounded-none text-xs', page === label ? 'text-accent-text' : 'text-muted-foreground')} aria-current={page === label ? 'page' : undefined} onClick={() => go(label)}><Icon className="size-5" /><span>{label}</span></Button>
        ))}
        <Button variant="ghost" className={cn('h-full flex-col gap-0.5 rounded-none text-xs', ['Containers', 'Collections', 'Archive'].includes(page) ? 'text-accent-text' : 'text-muted-foreground')} onClick={() => setMoreOpen(true)}><MoreHorizontal className="size-5" /><span>More</span></Button>
      </nav>

      {moreOpen && (
        <Sheet title="More" onClose={() => setMoreOpen(false)}>
          <div className="flex flex-col gap-0.5">
            {([['Containers', Box], ['Collections', Tag], ['Archive', Archive]] as [Page, LucideIcon][]).map(([label, Icon]) => (
              <Button key={label} variant="ghost" className={navClass} onClick={() => go(label)}><Icon /> {label}</Button>
            ))}
            <Button variant="ghost" className={navClass} asChild><a href={settingsUrl()} target="_blank" rel="noreferrer"><Settings2 /> Settings</a></Button>
            <Button variant="ghost" className={navClass} asChild><a href={HELP_URL}><CircleHelp /> Help & feedback</a></Button>
            <Button variant="ghost" className="mt-2 h-14 w-full justify-start gap-2.5 border-t px-3" onClick={signOut}>{userAvatar}<span className="flex min-w-0 flex-col text-left font-medium"><span className="truncate">{user.name || user.email}</span><small className="text-muted-foreground font-normal">Sign out</small></span></Button>
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
