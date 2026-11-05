import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import TabView, { useBottomTabBarHeight } from 'react-native-bottom-tabs';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { deriveStats } from './src/core/derive';
import { longToday } from './src/core/format';
import { dismissNudge, isNudgeDismissed } from './src/core/preferences';
import { useAccount } from './src/core/useAccount';
import { useStore, type Store } from './src/core/store';
import { SHOPPING, type Group, type GroupKind, type Item, type ItemInput } from './src/core/types';
import { settingsUrl } from './src/platform/NativeStill';
import { GroupGrid, GroupSheet } from './src/ui/Groups';
import { ItemList, type ItemActions } from './src/ui/ItemList';
import { ItemSheet } from './src/ui/ItemSheet';
import { Nudge, Panels, StatCards } from './src/ui/Overview';
import { SignIn } from './src/ui/SignIn';
import { colors } from './src/ui/theme';

const HELP_URL = 'mailto:cj@ponti.io?subject=Still%20feedback';

type Page = 'Overview' | 'Possessions' | 'Shopping' | 'Orders' | 'Containers' | 'Collections' | 'Archive';
type TabKey = 'overview' | 'possessions' | 'shopping' | 'orders' | 'more';
type TabRoute = { key: TabKey; title: string };
type MorePage = 'Containers' | 'Collections' | 'Archive';

const TABS: TabRoute[] = [
  { key: 'overview', title: 'Overview' },
  { key: 'possessions', title: 'Possessions' },
  { key: 'shopping', title: 'Shopping' },
  { key: 'orders', title: 'Orders' },
  { key: 'more', title: 'More' },
];
const TAB_PAGE: Record<Exclude<TabKey, 'more'>, Page> = {
  overview: 'Overview',
  possessions: 'Possessions',
  shopping: 'Shopping',
  orders: 'Orders',
};
// SF Symbol names are checked against the shipped set at typecheck time.
const TAB_ICONS = {
  overview: { base: 'house', fill: 'house.fill' },
  possessions: { base: 'shippingbox', fill: 'shippingbox.fill' },
  shopping: { base: 'cart', fill: 'cart.fill' },
  orders: { base: 'box.truck', fill: 'box.truck.fill' },
  more: { base: 'ellipsis', fill: 'ellipsis' },
} as const;
const MORE_PAGES: { page: MorePage; icon: string }[] = [
  { page: 'Containers', icon: '🧳' },
  { page: 'Collections', icon: '🏷️' },
  { page: 'Archive', icon: '🗄️' },
];
const TITLES: Record<Page, string> = {
  Overview: 'Your things, thoughtfully kept.', Possessions: 'Possessions', Shopping: 'Shopping list', Orders: 'Orders',
  Containers: 'Containers', Collections: 'Collections', Archive: 'Archive',
};
const LIST_TITLES: Record<Page, string> = {
  Overview: 'Recently added', Possessions: 'Everything you own', Shopping: 'Things you’re considering', Orders: 'On their way',
  Containers: 'Items', Collections: 'Items', Archive: 'Past possessions',
};

export default function App() {
  return (
    <SafeAreaProvider>
      <Gated />
    </SafeAreaProvider>
  );
}

function Gated() {
  const account = useAccount();

  if (!account.ready) {
    return (
      <SafeAreaView style={styles.fill}>
        <View style={styles.splash}>
          <Text style={styles.splashText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!account.email) {
    return (
      <SafeAreaView style={styles.fill}>
        <SignIn account={account} />
      </SafeAreaView>
    );
  }

  return <Main email={account.email} onSignOut={() => void account.signOut()} />;
}

function openLink(url: string | null) {
  if (!url) return;
  Linking.openURL(url).catch(() => undefined);
}

export function Main({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const store = useStore();
  const { items } = store;
  const [tabIndex, setTabIndex] = useState(0);
  const [morePage, setMorePage] = useState<MorePage | null>(null);
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [nudge, setNudge] = useState<boolean | null>(null);
  const [itemSheet, setItemSheet] = useState<{ item?: Item; defaults?: Partial<ItemInput> } | null>(null);
  const [groupSheet, setGroupSheet] = useState<{ kind: GroupKind; group?: Group } | null>(null);

  useEffect(() => {
    isNudgeDismissed().then(setNudge).catch(() => setNudge(true));
  }, []);

  const go = (next: Page, id?: string) => {
    const tab = (Object.keys(TAB_PAGE) as TabKey[]).find((k) => TAB_PAGE[k as Exclude<TabKey, 'more'>] === next);
    if (tab) {
      setTabIndex(TABS.findIndex((t) => t.key === tab));
      setMorePage(null);
    } else {
      setTabIndex(TABS.findIndex((t) => t.key === 'more'));
      setMorePage(next as MorePage);
    }
    setGroupId(id);
  };
  const onIndexChange = (next: number) => {
    setTabIndex(next);
    setGroupId(undefined);
  };

  const stats = useMemo(() => deriveStats(items), [items]);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);

  const confirmDeleteItem = (item: Item) => {
    Alert.alert(`Delete “${item.name}”?`, 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void store.deleteItem(item.id) },
    ]);
  };
  const actions: ItemActions = {
    onEdit: (item) => setItemSheet({ item }),
    onAdvance: (item) => void store.advance(item.id),
    onArchive: (item) => void store.updateItem(item.id, { status: item.status === 'Archived' ? 'Owned' : 'Archived' }),
    onDelete: confirmDeleteItem,
  };
  const deleteGroup = (g: Group, k: GroupKind) => {
    Alert.alert(`Delete “${g.name}”?`, 'Its items stay in Still.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          void store.deleteGroup(k, g.id);
          if (groupId === g.id) setGroupId(undefined);
        },
      },
    ]);
  };
  const dismissNudgeNow = () => {
    setNudge(true);
    dismissNudge();
  };

  const navigationState = useMemo(() => ({ index: tabIndex, routes: TABS }), [tabIndex]);
  const scene = { store, stats, groupId, query, searchOpen, nudge, actions, deleteGroup, dismissNudgeNow, go, setGroupId, setQuery, setSearchOpen, setItemSheet, setGroupSheet };

  if (store.phase !== 'ready') {
    return (
      <SafeAreaView style={styles.fill}>
        <View style={styles.splash}>
          {store.phase === 'loading' ? (
            <Text style={styles.splashText}>Loading your things…</Text>
          ) : (
            <>
              <Text style={styles.splashText}>Couldn’t load your things: {store.error}</Text>
              <Pressable style={styles.primary} onPress={() => void store.reload()}>
                <Text style={styles.primaryText}>Try again</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // One quiet line so "did it reach Hominem?" is answered on screen, not guessed.
  const pending = store.pending;
  const changes = `${pending} change${pending === 1 ? '' : 's'}`;
  const syncLabel = store.connected
    ? pending > 0
      ? `${changes} syncing…`
      : 'All changes saved'
    : pending > 0
      ? `${changes} waiting — offline`
      : 'Offline — showing saved data';

  return (
    <SafeAreaView style={styles.fill} edges={['top']}>
      <View style={styles.app}>
        {store.notice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{store.notice}</Text>
            <Pressable onPress={store.dismissNotice} accessibilityLabel="Dismiss" hitSlop={10}>
              <Text style={styles.noticeDismiss}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.status}>
          <Text style={styles.statusText}>{syncLabel}</Text>
        </View>

        <TabView
          navigationState={navigationState}
          renderScene={({ route }: { route: TabRoute; jumpTo: (key: string) => void }) =>
            route.key === 'more'
              ? <MoreScreen email={email} onSignOut={onSignOut} morePage={morePage} setMorePage={setMorePage} scene={scene} />
              : <PageScreen page={TAB_PAGE[route.key]} scene={scene} />
          }
          onIndexChange={onIndexChange}
          getIcon={({ route, focused }: { route: TabRoute; focused: boolean }) => {
            const icon = TAB_ICONS[route.key];
            return { sfSymbol: focused ? icon.fill : icon.base };
          }}
          getBadge={({ route }: { route: TabRoute }) =>
            route.key === 'orders' && stats.ordered.length > 0 ? `${stats.ordered.length}` : undefined
          }
          tabBarActiveTintColor={colors.green}
          minimizeBehavior="onScrollDown"
          hapticFeedbackEnabled
        />

        {itemSheet ? (
          <ItemSheet item={itemSheet.item} defaults={itemSheet.defaults} containers={store.containers} collections={store.collections} categories={categories}
            onSave={(input) => (itemSheet.item ? store.updateItem(itemSheet.item.id, input) : store.addItem(input))} onClose={() => setItemSheet(null)} />
        ) : null}
        {groupSheet ? (
          <GroupSheet kind={groupSheet.kind} group={groupSheet.group} onClose={() => setGroupSheet(null)}
            onSave={(data) => void (groupSheet.group ? store.updateGroup(groupSheet.kind, groupSheet.group.id, data) : store.addGroup(groupSheet.kind, data))} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

type Scene = {
  store: Store;
  stats: ReturnType<typeof deriveStats>;
  groupId: string | undefined;
  query: string;
  searchOpen: boolean;
  nudge: boolean | null;
  actions: ItemActions;
  deleteGroup: (g: Group, k: GroupKind) => void;
  dismissNudgeNow: () => void;
  go: (page: Page, id?: string) => void;
  setGroupId: (id: string | undefined) => void;
  setQuery: (q: string) => void;
  setSearchOpen: (open: boolean) => void;
  setItemSheet: (s: { item?: Item; defaults?: Partial<ItemInput> } | null) => void;
  setGroupSheet: (s: { kind: GroupKind; group?: Group } | null) => void;
};

function PageScreen({ page, scene, onBack }: { page: Page; scene: Scene; onBack?: () => void }) {
  const { store, stats, groupId, query, searchOpen, nudge } = scene;
  const { items, containers, collections } = store;
  const tabBarHeight = useBottomTabBarHeight();
  const searchRef = useRef<TextInputInstance>(null);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const kind: GroupKind | null = page === 'Containers' ? 'container' : page === 'Collections' ? 'collection' : null;
  const groups = kind === 'container' ? containers : collections;
  const openGroup = kind && groupId ? groups.find((g) => g.id === groupId) : undefined;

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

  const openGroupMenu = () => {
    if (!openGroup || !kind) return;
    const group = openGroup;
    ActionSheetIOS.showActionSheetWithOptions(
      { title: group.name, options: ['Rename / edit', 'Delete…', 'Cancel'], cancelButtonIndex: 2, destructiveButtonIndex: 1 },
      (index) => {
        if (index === 0) scene.setGroupSheet({ kind, group });
        else if (index === 1) scene.deleteGroup(group, kind);
      },
    );
  };

  const heading = openGroup ? openGroup.name : TITLES[page];
  const primary = kind && !openGroup
    ? { label: `New ${kind}`, run: () => scene.setGroupSheet({ kind }) }
    : { label: 'Add item', run: () => scene.setItemSheet({ defaults: openGroup && kind ? (kind === 'container' ? { containerId: openGroup.id } : { collectionIds: [openGroup.id] }) : undefined }) };

  return (
    <View style={styles.page}>
      <View style={styles.topbar}>
        {searchOpen ? (
          <View style={styles.searchOpen}>
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              value={query}
              onChangeText={scene.setQuery}
              placeholder="Search anything…"
              returnKeyType="search"
            />
            <Pressable onPress={() => { scene.setQuery(''); scene.setSearchOpen(false); }} accessibilityLabel="Close search" hitSlop={10}>
              <Text style={styles.searchClose}>✕</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.crumb}>
              {openGroup ? (
                <Pressable onPress={() => scene.setGroupId(undefined)}><Text style={styles.back}>← {page}</Text></Pressable>
              ) : onBack ? (
                <Pressable onPress={onBack}><Text style={styles.back}>← More</Text></Pressable>
              ) : (
                <Text style={styles.crumbText}>{page}</Text>
              )}
            </View>
            <Pressable onPress={() => scene.setSearchOpen(true)} accessibilityLabel="Search" hitSlop={10} style={styles.searchToggle}>
              <Text style={styles.searchIcon}>🔍</Text>
            </Pressable>
          </>
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentPad} keyboardShouldPersistTaps="handled">
        <View style={styles.headingRow}>
          <View style={styles.headingMain}>
            {page === 'Overview' ? <Text style={styles.eyebrow}>{longToday().toUpperCase()}</Text> : null}
            <Text style={styles.h1}>{heading}</Text>
            {page === 'Overview' ? <Text style={styles.subtitle}>A clear view of what you own, want, and everything in between.</Text> : null}
            {openGroup?.description ? <Text style={styles.subtitle}>{openGroup.description}</Text> : null}
          </View>
          {openGroup && kind ? (
            <Pressable onPress={openGroupMenu} accessibilityLabel={`Actions for ${openGroup.name}`} hitSlop={10} style={styles.dots}>
              <Text style={styles.dotsText}>•••</Text>
            </Pressable>
          ) : null}
        </View>

        {page === 'Overview' ? (
          <>
            <StatCards stats={stats} />
            {stats.unhomed > 0 && nudge === false ? (
              <Nudge count={stats.unhomed} onReview={() => scene.go('Possessions')} onDismiss={scene.dismissNudgeNow} />
            ) : null}
          </>
        ) : null}

        {kind && !openGroup && groupId === undefined ? (
          <GroupGrid kind={kind} groups={groups} items={items}
            onOpen={(g) => scene.go(page, g.id)} onEdit={(g) => scene.setGroupSheet({ kind, group: g })}
            onDelete={(g) => scene.deleteGroup(g, kind)} onCreate={() => scene.setGroupSheet({ kind })} />
        ) : null}
        {kind && !openGroup && groupId !== undefined ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>That {kind} no longer exists.</Text>
            <Pressable style={styles.primary} onPress={() => scene.setGroupId(undefined)}>
              <Text style={styles.primaryText}>Back to {page}</Text>
            </Pressable>
          </View>
        ) : null}

        {(!kind || openGroup) ? (
          <ItemList title={LIST_TITLES[page]} items={pageItems} containers={containers} query={query}
            limit={page === 'Overview' ? 5 : undefined} showControls={page !== 'Overview'}
            empty={page === 'Archive'
              ? <Text style={styles.emptyText}>Archived items will show up here.</Text>
              : query
                ? <Text style={styles.emptyText}>Nothing matches your search.</Text>
                : <>
                  <Text style={styles.emptyText}>Nothing here yet.</Text>
                  <Pressable style={styles.primary} onPress={() => scene.setItemSheet({})}><Text style={styles.primaryText}>+ Add item</Text></Pressable>
                </>}
            actions={scene.actions} />
        ) : null}

        {page === 'Overview' ? (
          <Panels containers={containers} items={items} ordered={stats.ordered}
            onSeeAll={() => scene.go('Containers')} onOrders={() => scene.go('Orders')} onCreate={() => scene.setGroupSheet({ kind: 'container' })} />
        ) : null}
      </ScrollView>

      {page !== 'Archive' ? (
        <Pressable style={[styles.fab, { bottom: tabBarHeight + 14 }]} onPress={primary.run}>
          <Text style={styles.primaryText}>{`+ ${primary.label}`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function MoreScreen({ email, onSignOut, morePage, setMorePage, scene }: {
  email: string; onSignOut: () => void; morePage: MorePage | null; setMorePage: (p: MorePage | null) => void; scene: Scene;
}) {
  const initials = email.slice(0, 2).toUpperCase();
  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You’ll need an email code to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onSignOut },
    ]);
  };

  if (morePage) {
    return <PageScreen page={morePage} scene={scene} onBack={() => { scene.setGroupId(undefined); setMorePage(null); }} />;
  }

  return (
    <View style={styles.page}>
      <View style={styles.topbar}>
        <View style={styles.crumb}>
          <Text style={styles.crumbText}>More</Text>
        </View>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentPad}>
        <View style={styles.moreList}>
          {MORE_PAGES.map(({ page: label, icon }) => (
            <Pressable key={label} onPress={() => setMorePage(label)} style={styles.navItem}>
              <Text style={styles.navIcon}>{icon}</Text>
              <Text style={styles.navText}>{label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => openLink(settingsUrl())} style={styles.navItem}>
            <Text style={styles.navIcon}>⚙️</Text>
            <Text style={styles.navText}>Settings</Text>
          </Pressable>
          <Pressable onPress={() => openLink(HELP_URL)} style={styles.navItem}>
            <Text style={styles.navIcon}>💬</Text>
            <Text style={styles.navText}>Help & feedback</Text>
          </Pressable>
          <Pressable onPress={confirmSignOut} style={styles.profile}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
            <View style={styles.profileMain}>
              <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
              <Text style={styles.profileSub}>Sign out</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  app: { flex: 1, backgroundColor: colors.bg },
  page: { flex: 1, backgroundColor: colors.bg },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  splashText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  primary: {
    minHeight: 44, borderRadius: 10, backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  notice: {
    margin: 8, marginBottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, padding: 6, paddingLeft: 14, borderRadius: 12, backgroundColor: '#3b2420',
  },
  noticeText: { color: '#fff', fontSize: 14, flex: 1 },
  noticeDismiss: { color: '#fff', fontSize: 14, padding: 10 },
  status: { paddingHorizontal: 16, paddingTop: 6, alignItems: 'center' },
  statusText: { color: colors.faint, fontSize: 12 },
  topbar: {
    minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  crumb: { flex: 1 },
  crumbText: { fontSize: 17, fontWeight: '700', color: colors.ink },
  back: { fontWeight: '600', fontSize: 16, color: colors.green, paddingVertical: 8 },
  searchToggle: { padding: 4 },
  searchIcon: { fontSize: 20 },
  searchOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, fontSize: 16, color: colors.ink, minHeight: 40 },
  searchClose: { fontSize: 16, color: '#6b6e67', padding: 4 },
  content: { flex: 1 },
  contentPad: { padding: 20, paddingBottom: 120 },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  headingMain: { flex: 1, gap: 6 },
  eyebrow: { color: colors.faint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  h1: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, color: colors.ink },
  subtitle: { color: colors.muted, fontSize: 14 },
  dots: { padding: 4 },
  dotsText: { fontSize: 16, color: '#6b6e67', letterSpacing: 1 },
  fab: {
    position: 'absolute', right: 16, minHeight: 52, paddingHorizontal: 20, borderRadius: 26,
    backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#273e34', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 6 },
  },
  empty: { alignItems: 'center', gap: 14, padding: 36, borderWidth: 1, borderStyle: 'dashed', borderColor: '#dcddd6', borderRadius: 12, backgroundColor: '#fbfbf9' },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  moreList: { gap: 2, paddingBottom: 8 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 12, borderRadius: 10 },
  navIcon: { fontSize: 20, width: 26, textAlign: 'center' },
  navText: { fontSize: 15, fontWeight: '500', color: '#62655e' },
  profile: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52,
    paddingHorizontal: 12, paddingTop: 6, marginTop: 8,
    borderTopWidth: 1, borderTopColor: colors.lineSoft,
  },
  avatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#e5eadf', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#52664e', fontSize: 12, fontWeight: '700' },
  profileMain: { flex: 1, minWidth: 0 },
  profileEmail: { fontSize: 14, fontWeight: '600', color: colors.ink },
  profileSub: { fontSize: 12, color: colors.muted },
});
